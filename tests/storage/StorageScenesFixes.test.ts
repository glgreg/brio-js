import { describe, expect, it } from "vitest";
import { ComponentMask, StorageLayoutFlag } from "../../src/ecs/ComponentStorage";
import { ECSWorld } from "../../src/ecs/ECSWorld";
import { BrioSerializer } from "../../src/storage/BrioSerializer";
import { AsyncDatabaseStorage, BrioStorage } from "../../src/storage/BrioStorage";

/** Builds a version 1 snapshot (5-word header, both transform sections) from a current (v3) one. */
function toVersion1(v3: Uint8Array): Uint8Array {
    const out = new Uint8Array(v3.byteLength - 24);
    out.set(v3.subarray(0, 20), 0);
    out.set(v3.subarray(44), 20);
    new Uint32Array(out.buffer, 0, 5)[1] = 1;
    return out;
}

/** Builds a version 2 snapshot (6-word header with the layout, no strides) from a current (v3) one. */
function toVersion2(v3: Uint8Array): Uint8Array {
    const out = new Uint8Array(v3.byteLength - 20);
    out.set(v3.subarray(0, 24), 0);
    out.set(v3.subarray(44), 24);
    new Uint32Array(out.buffer, 0, 6)[1] = 2;
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
        const words = new Uint32Array(bytes.buffer, bytes.byteOffset, 12);
        expect(words[4]).toBe(1);

        const outOfRange = bytes.slice();
        new Uint32Array(outOfRange.buffer, 0, 12)[11] = 99;
        const aliveId = bytes.slice();
        new Uint32Array(aliveId.buffer, 0, 12)[11] = 1;

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
        const v3 = BrioSerializer.captureSnapshot(populatedWorld());
        const v2 = toVersion2(v3);
        const v1 = toVersion1(v3);
        expect(JSON.parse(BrioSerializer.toJSON(v3)).version).toBe(3);
        expect(JSON.parse(BrioSerializer.toJSON(v2)).version).toBe(2);
        const parsedV1 = JSON.parse(BrioSerializer.toJSON(v1));
        expect(parsedV1.version).toBe(1);
        expect(parsedV1.layout).toBe(
            StorageLayoutFlag.TRANSFORM_2D | StorageLayoutFlag.TRANSFORM_3D,
        );

        // fromJSON re-encodes into the current format
        const reencoded = BrioSerializer.fromJSON(BrioSerializer.toJSON(v1));
        expect(new Uint32Array(reencoded.buffer, reencoded.byteOffset, 2)[1]).toBe(3);
    });

    it("restores version 2 snapshots written before strides were recorded", () => {
        const v2 = toVersion2(BrioSerializer.captureSnapshot(populatedWorld()));
        const target = new ECSWorld(16);
        BrioSerializer.restoreSnapshot(target, v2);
        expect(target.activeCount).toBe(2);
        expect(target.storage.transform2D[target.storage.getTransform2DOffset(1)]).toBe(42);
    });

    it("migrates a section written with a shorter stride (fields appended later read as 0)", () => {
        const world = new ECSWorld(4, false, { transform2D: true, transform3D: false });
        const id = world.createEntity(ComponentMask.TRANSFORM_2D);
        const t2 = world.storage.transform2D;
        const stride = world.storage.getTransform2DOffset(1);
        for (let i = 0; i < stride; i++) t2[world.storage.getTransform2DOffset(id) + i] = i + 1;
        const current = BrioSerializer.captureSnapshot(world);

        // Simulates a save made by an older engine whose 2D transform had one float less per entity
        const words = new Uint32Array(current.buffer.slice(0));
        const oldStride = stride - 1;
        const count = words[2];
        const headerBytes = 11 * 4;
        const t2Offset = headerBytes + words[4] * 4 + Math.ceil(count / 4) * 4 + count * 4;
        const before = new Uint8Array(words.buffer, 0, t2Offset);
        const oldT2 = new Float32Array(count * oldStride);
        for (let e = 0; e < count; e++) {
            for (let f = 0; f < oldStride; f++) oldT2[e * oldStride + f] = e * stride + f + 1;
        }
        const after = new Uint8Array(words.buffer, t2Offset + count * stride * 4);
        const old = new Uint8Array(before.byteLength + oldT2.byteLength + after.byteLength);
        old.set(before, 0);
        old.set(new Uint8Array(oldT2.buffer), before.byteLength);
        old.set(after, before.byteLength + oldT2.byteLength);
        new Uint32Array(old.buffer, 0, 11)[6] = oldStride;

        expect(BrioSerializer.inspect(old).strides.transform2D).toBe(oldStride);
        const target = new ECSWorld(4, false, { transform2D: true, transform3D: false });
        BrioSerializer.restoreSnapshot(target, old);
        const base = target.storage.getTransform2DOffset(id);
        expect(target.storage.transform2D[base]).toBe(1);
        expect(target.storage.transform2D[base + oldStride - 1]).toBe(oldStride);
        expect(target.storage.transform2D[base + oldStride]).toBe(0);
    });

    it("inspect() reports the header without restoring, and flags unknown versions", () => {
        const bytes = BrioSerializer.captureSnapshot(populatedWorld());
        const info = BrioSerializer.inspect(bytes);
        expect(info.version).toBe(BrioSerializer.FORMAT_VERSION);
        expect(info.highWaterMark).toBe(3);
        expect(info.activeCount).toBe(2);
        expect(info.supported).toBe(true);

        const future = bytes.slice();
        new Uint32Array(future.buffer, 0, 2)[1] = 99;
        expect(BrioSerializer.inspect(future).supported).toBe(false);
        expect(() => BrioSerializer.restoreSnapshot(new ECSWorld(16), future)).toThrow(
            /reads versions 1 to/,
        );
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
