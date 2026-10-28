import { describe, expect, it } from "vitest";
import { ComponentMask, VISUAL_VISIBILITY_OFFSET } from "../../src/ecs/ComponentStorage";
import { ECSWorld } from "../../src/ecs/ECSWorld";
import { BrioObject2D } from "../../src/objects/BrioObject2D";
import { BrioTransform3D } from "../../src/objects/BrioTransform3D";
import { BrioSerializer } from "../../src/storage/BrioSerializer";

describe("BrioTransform3D reads the ECS slot when bound", () => {
    it("opacity and layer getters follow direct buffer writes", () => {
        const world = new ECSWorld(4);
        const id = world.createEntity(ComponentMask.TRANSFORM_3D);
        const t = new BrioTransform3D();
        t.opacity = 0.5;
        t.layer = 3;
        t.bindECS(world.storage, id);

        const base = world.storage.getTransform3DOffset(id);
        world.storage.transform3D[base + 13] = 0.25;
        world.storage.transform3D[base + 14] = 9;
        expect(t.opacity).toBe(0.25);
        expect(t.layer).toBe(9);

        t.unbindECS();
        expect(t.opacity).toBe(0.25);
        expect(t.layer).toBe(9);
    });

    it("invalidates the cached local and world matrices on direct buffer writes", () => {
        const world = new ECSWorld(4);
        const parent = new BrioTransform3D();
        const child = new BrioTransform3D({ x: 1, y: 0, z: 0 });
        parent.addChild(child);
        const pid = world.createEntity(ComponentMask.TRANSFORM_3D);
        const cid = world.createEntity(ComponentMask.TRANSFORM_3D);
        parent.bindECS(world.storage, pid);
        child.bindECS(world.storage, cid);

        expect(child.worldMatrix[12]).toBe(1);
        expect(parent.localMatrix[12]).toBe(0);

        const pbase = world.storage.getTransform3DOffset(pid);
        world.storage.transform3D[pbase] = 10;
        world.storage.transform3D[pbase + 3] = 2;

        expect(parent.localMatrix[12]).toBe(10);
        expect(parent.localMatrix[0]).toBe(2);
        // The child world matrix depends on the parent written directly
        expect(child.worldMatrix[12]).toBe(12);
    });
});

describe("visibility lives in the visual buffer", () => {
    it("is captured by snapshots and re-adopted on restore", () => {
        const world = new ECSWorld(4);
        const obj = new BrioObject2D("obj_vis", "", 1);
        const id = world.createEntity(ComponentMask.TRANSFORM_2D);
        obj.entityId = id;
        obj.transform.bindECS(world.storage, id);
        const vis = world.storage.getVisualOffset(id) + VISUAL_VISIBILITY_OFFSET;
        expect(world.storage.visual[vis]).toBe(1);

        obj.transform.visibility = false;
        expect(world.storage.visual[vis]).toBe(0);
        const bytes = BrioSerializer.captureSnapshot(world);

        obj.transform.visibility = true;
        BrioSerializer.restoreSnapshot(world, bytes);
        obj.transform.bindECS(world.storage, id, true);
        expect(obj.transform.visibility).toBe(false);

        obj.transform.unbindECS();
        expect(obj.transform.visibility).toBe(false);
    });

    it("pushes the facade visibility into a new slot", () => {
        const world = new ECSWorld(4);
        const t = new BrioTransform3D();
        t.visibility = false;
        const id = world.createEntity(ComponentMask.TRANSFORM_3D);
        t.bindECS(world.storage, id);
        expect(
            world.storage.visual[world.storage.getVisualOffset(id) + VISUAL_VISIBILITY_OFFSET],
        ).toBe(0);
        expect(t.visibility).toBe(false);
    });
});
