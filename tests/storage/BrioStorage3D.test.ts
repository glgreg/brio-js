import { describe, expect, it } from "vitest";
import { ComponentMask } from "../../src/ecs/ComponentStorage";
import { ECSWorld } from "../../src/ecs/ECSWorld";
import { BrioMath } from "../../src/math/BrioMath";
import { BrioObject3D } from "../../src/objects/BrioObject3D";
import { BrioSerializer } from "../../src/storage/BrioSerializer";
import { BrioStorage } from "../../src/storage/BrioStorage";

describe("3D Object ECS Binding, Snapshots and IndexedDB Persistence", () => {
    it("binds BrioObject3D to ECSWorld, persists binary snapshots via BrioStorage.db, and restores transforms", async () => {
        const world = new ECSWorld(32);

        // 1. Create and bind 3D objects
        const core = new BrioObject3D("core");
        core.transform.position = { x: 10, y: 20, z: 30 };
        core.transform.scale = { x: 2, y: 2, z: 2 };
        core.transform.rotation = {
            x: BrioMath.degToRad(45),
            y: BrioMath.degToRad(90),
            z: 0,
        };
        core.transform.opacity = 0.85;

        const entityId = world.createEntity(ComponentMask.TRANSFORM_3D);
        core.entityId = entityId;
        core.transform.bindECS(world.storage, entityId);

        // 2. Validate ECS buffer storage
        const base = world.storage.getTransform3DOffset(entityId);
        expect(world.storage.transform3D[base]).toBeCloseTo(10);
        expect(world.storage.transform3D[base + 1]).toBeCloseTo(20);
        expect(world.storage.transform3D[base + 2]).toBeCloseTo(30);
        expect(world.storage.transform3D[base + 3]).toBeCloseTo(2);

        // 3. Capture binary snapshot
        const snapshot = BrioSerializer.captureSnapshot(world);
        expect(snapshot).toBeInstanceOf(Uint8Array);

        // 4. Persist to BrioStorage.db (IndexedDB / Memory fallback)
        await BrioStorage.db.saveSnapshot("slot_3d_test", snapshot);
        await BrioStorage.db.set("slot_3d_meta", {
            timestamp: 123456789,
            activeEntities: world.activeCount,
        });

        // 5. Mutate state in world
        core.transform.position = { x: 999, y: 888, z: 777 };
        expect(world.storage.transform3D[base]).toBeCloseTo(999);

        // 6. Retrieve snapshot from BrioStorage.db and restore
        const loadedSnapshot = await BrioStorage.db.loadSnapshot("slot_3d_test");
        expect(loadedSnapshot).toBeDefined();
        expect(loadedSnapshot).toEqual(snapshot);

        BrioSerializer.restoreSnapshot(world, loadedSnapshot!);
        expect(world.storage.transform3D[base]).toBeCloseTo(10);
        expect(world.storage.transform3D[base + 1]).toBeCloseTo(20);
        expect(world.storage.transform3D[base + 2]).toBeCloseTo(30);

        const loadedMeta = await BrioStorage.db.get<{ timestamp: number }>("slot_3d_meta");
        expect(loadedMeta?.timestamp).toBe(123456789);
    });

    it("evaluates BrioMath utilities: smoothstep, wrap, remap, and degToRad", () => {
        // smoothstep
        expect(BrioMath.smoothstep(0, 0, 10)).toBe(0);
        expect(BrioMath.smoothstep(10, 0, 10)).toBe(1);
        expect(BrioMath.smoothstep(5, 0, 10)).toBe(0.5);

        // wrap
        expect(BrioMath.wrap(370, 0, 360)).toBeCloseTo(10);
        expect(BrioMath.wrap(-10, 0, 360)).toBeCloseTo(350);

        // remap
        expect(BrioMath.remap(0, -1, 1, 0, 100)).toBeCloseTo(50);
        expect(BrioMath.remap(-1, -1, 1, 0, 100)).toBeCloseTo(0);
        expect(BrioMath.remap(1, -1, 1, 0, 100)).toBeCloseTo(100);

        // degToRad & radToDeg
        expect(BrioMath.degToRad(180)).toBeCloseTo(Math.PI);
        expect(BrioMath.radToDeg(Math.PI)).toBeCloseTo(180);
    });
});
