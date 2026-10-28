import { describe, expect, it } from "vitest";
import { ComponentMask, StorageLayoutFlag } from "../../src/ecs/ComponentStorage";
import { ECSWorld } from "../../src/ecs/ECSWorld";
import { BrioSerializer } from "../../src/storage/BrioSerializer";
import { AsyncDatabaseStorage, BrioStorage } from "../../src/storage/BrioStorage";

/** Builds a version 1 snapshot (5-word header, both transform sections) from a current one. */
function toVersion1(v2: Uint8Array): Uint8Array {
    const out = new Uint8Array(v2.byteLength - 4);
    out.set(v2.subarray(0, 20), 0);
    out.set(v2.subarray(24), 20);
    new Uint32Array(out.buffer, 0, 5)[1] = 1;
    return out;
}

function populatedWorld(): ECSWorld {
    const world = new ECSWorld(16);
    const a = world.createEntity(ComponentMask.TRANSFORM_2D);
    world.createEntity(ComponentMask.TRANSFORM_2D);
    world.createEntity(ComponentMask.TRANSFORM_3D);
    world.destroyEntity(a);
    world.storage.transform2D[world.storage.getTransform2DOffset(1)] = 42;
    return world;
}

describe("BrioSerializer validation before mutation", () => {
    it("rejects a truncated body and leaves the world untouched", () => {
        const source = populatedWorld();
        const bytes = BrioSerializer.captureSnapshot(source);
        const truncated = bytes.slice(0, bytes.byteLength - 8);

        const target = populatedWorld();
        target.storage.transform2D[target.storage.getTransform2DOffset(1)] = 7;
        const gen = target.generationOf(1);

        expect(() => BrioSerializer.restoreSnapshot(target, truncated)).toThrow(/truncated/);
        expect(target.highWaterMark).toBe(3);
        expect(target.activeCount).toBe(2);
        expect(target.isAlive(1, gen)).toBe(true);
        expect(target.storage.transform2D[target.storage.getTransform2DOffset(1)]).toBe(7);
    });

    it("rejects out-of-range, alive or duplicated free-list ids before clearing", () => {
        const source = populatedWorld();
        const bytes = BrioSerializer.captureSnapshot(source);
        const words = new Uint32Array(bytes.buffer, bytes.byteOffset, 7);
        expect(words[4]).toBe(1);

        const outOfRange = bytes.slice();
        new Uint32Array(outOfRange.buffer, 0, 7)[6] = 99;
        const aliveId = bytes.slice();
        new Uint32Array(aliveId.buffer, 0, 7)[6] = 1;

        const target = populatedWorld();
        expect(() => BrioSerializer.restoreSnapshot(target, outOfRange)).toThrow(/free-list/);
        expect(() => BrioSerializer.restoreSnapshot(target, aliveId)).toThrow(/free-list/);
        expect(target.activeCount).toBe(2);

        // A valid snapshot still restores
        BrioSerializer.restoreSnapshot(target, bytes);
        expect(target.getFreeListSnapshot()).toEqual([0]);
        expect(target.storage.transform2D[target.storage.getTransform2DOffset(1)]).toBe(42);
    });

    it("toJSON reports the version of the input snapshot", () => {
        const v2 = BrioSerializer.captureSnapshot(populatedWorld());
        const v1 = toVersion1(v2);
        expect(JSON.parse(BrioSerializer.toJSON(v2)).version).toBe(2);
        const parsedV1 = JSON.parse(BrioSerializer.toJSON(v1));
        expect(parsedV1.version).toBe(1);
        expect(parsedV1.layout).toBe(
            StorageLayoutFlag.TRANSFORM_2D | StorageLayoutFlag.TRANSFORM_3D,
        );

        // fromJSON re-encodes into the current format
        const reencoded = BrioSerializer.fromJSON(BrioSerializer.toJSON(v1));
        expect(new Uint32Array(reencoded.buffer, reencoded.byteOffset, 2)[1]).toBe(2);
    });
});

describe("BrioStorage scoping and persistence reporting", () => {
    it("local.clear() removes only the engine's own keys", () => {
        window.localStorage.setItem("other_app_token", "keep-me");
        BrioStorage.local.set("score", 10);
        BrioStorage.local.set("profile", { name: "p1" });
        expect(window.localStorage.getItem(BrioStorage.webStoragePrefix + "score")).toBe("10");

        BrioStorage.local.clear();
        expect(BrioStorage.local.has("score")).toBe(false);
        expect(BrioStorage.local.get("profile")).toBeUndefined();
        expect(window.localStorage.getItem("other_app_token")).toBe("keep-me");
        window.localStorage.removeItem("other_app_token");
    });

    it("session.clear() is scoped too, and legacy unprefixed keys stay readable", () => {
        window.sessionStorage.setItem("legacy", JSON.stringify({ v: 1 }));
        expect(BrioStorage.session.get<{ v: number }>("legacy")?.v).toBe(1);
        expect(BrioStorage.session.has("legacy")).toBe(true);

        // Writing migrates the value under the prefix
        BrioStorage.session.set("legacy", { v: 2 });
        expect(window.sessionStorage.getItem("legacy")).toBeNull();
        expect(BrioStorage.session.get<{ v: number }>("legacy")?.v).toBe(2);

        window.sessionStorage.setItem("foreign", "x");
        BrioStorage.session.clear();
        expect(BrioStorage.session.has("legacy")).toBe(false);
        expect(window.sessionStorage.getItem("foreign")).toBe("x");
        window.sessionStorage.removeItem("foreign");
    });

    it("db reports the in-memory fallback when IndexedDB is unavailable", async () => {
        const db = new AsyncDatabaseStorage("brio_test_db");
        expect(db.persistent).toBeUndefined();
        expect(await db.isPersistent()).toBe(typeof indexedDB !== "undefined");
        expect(db.persistent).toBe(typeof indexedDB !== "undefined");
    });
});
