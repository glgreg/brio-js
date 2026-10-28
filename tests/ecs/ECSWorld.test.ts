import { describe, expect, it } from "vitest";
import { ComponentMask } from "../../src/ecs/ComponentStorage";
import { ECSWorld } from "../../src/ecs/ECSWorld";
import { BrioSerializer } from "../../src/storage/BrioSerializer";
import { BrioStorage } from "../../src/storage/BrioStorage";

describe("ECSWorld, Object Pooling & Binary Serialization", () => {
    it("allocates entities, queries bitmasks, and recycles slots via O(1) free-list pool", () => {
        const world = new ECSWorld(64);
        const e0 = world.createEntity(ComponentMask.TRANSFORM_2D);
        const e1 = world.createEntity(ComponentMask.TRANSFORM_2D | ComponentMask.COLLIDER);
        const e2 = world.createEntity(ComponentMask.TRANSFORM_3D);

        expect(world.activeCount).toBe(3);
        expect(world.query(ComponentMask.TRANSFORM_2D)).toEqual([e0, e1]);
        expect(world.query(ComponentMask.TRANSFORM_2D | ComponentMask.COLLIDER)).toEqual([e1]);

        const offset1 = world.storage.getTransform2DOffset(e1);
        world.storage.transform2D[offset1] = 320;
        world.storage.transform2D[offset1 + 1] = 240;

        // Destroy e0 and verify slot recycling
        world.destroyEntity(e0);
        expect(world.isAlive(e0)).toBe(false);
        expect(world.activeCount).toBe(2);

        // Instantiate from e1 template into recycled slot e0
        const cloneId = world.instantiateFrom(e1);
        expect(cloneId).toBe(e0);
        const cloneOffset = world.storage.getTransform2DOffset(cloneId);
        expect(world.storage.transform2D[cloneOffset]).toBe(320);
        expect(world.storage.transform2D[cloneOffset + 1]).toBe(240);
        expect(world.hasComponent(cloneId, ComponentMask.COLLIDER)).toBe(true);
        expect(world.isAlive(e2)).toBe(true);
    });

    it("captures and restores pure binary snapshots and translates to/from JSON", async () => {
        const world = new ECSWorld(32);
        const id = world.createEntity(ComponentMask.TRANSFORM_2D);
        const base = world.storage.getTransform2DOffset(id);
        world.storage.transform2D[base] = 128;
        world.storage.transform2D[base + 1] = 256;

        const snapshot = BrioSerializer.captureSnapshot(world);
        expect(snapshot).toBeInstanceOf(Uint8Array);

        // Mutate state after snapshot
        world.storage.transform2D[base] = 999;
        const extra = world.createEntity(ComponentMask.TRANSFORM_3D);
        expect(world.activeCount).toBe(2);

        // Restore binary snapshot
        BrioSerializer.restoreSnapshot(world, snapshot);
        expect(world.activeCount).toBe(1);
        expect(world.isAlive(extra)).toBe(false);
        expect(world.storage.transform2D[base]).toBe(128);
        expect(world.storage.transform2D[base + 1]).toBe(256);

        // JSON translation roundtrip
        const json = BrioSerializer.toJSON(snapshot);
        const roundtripBytes = BrioSerializer.fromJSON(json);
        expect(roundtripBytes).toEqual(snapshot);

        // Multi-tier BrioStorage verification
        BrioStorage.state.set("score", 4200);
        expect(BrioStorage.state.get<number>("score")).toBe(4200);

        BrioStorage.local.set("settings", { volume: 0.75 });
        expect(BrioStorage.local.get<{ volume: number }>("settings")?.volume).toBe(0.75);

        await BrioStorage.db.saveSnapshot("slot_1", snapshot);
        const loaded = await BrioStorage.db.loadSnapshot("slot_1");
        expect(loaded).toEqual(snapshot);
    });
});
