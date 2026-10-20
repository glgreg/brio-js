import { describe, it, expect, vi, beforeEach } from "vitest";
import { ECSWorld } from "../../src/ecs/ECSWorld";
import { ComponentMask, ComponentStorage, DirtyFlag } from "../../src/ecs/ComponentStorage";
import { BrioObject2D } from "../../src/objects/BrioObject2D";
import { BrioObject3D } from "../../src/objects/BrioObject3D";
import { BrioGame } from "../../src/game/BrioGame";
import { createRecordingContext } from "../helpers/recordingContext";

describe("ECS handle safety (generations + unbind)", () => {
    it("advances the slot generation on destroy so stale handles are detected after recycling", () => {
        const world = new ECSWorld(4);
        const id = world.createEntity(ComponentMask.TRANSFORM_2D);
        const gen = world.generationOf(id);

        expect(world.isAlive(id, gen)).toBe(true);
        world.destroyEntity(id);

        const recycled = world.createEntity(ComponentMask.TRANSFORM_2D);
        expect(recycled).toBe(id);
        expect(world.isAlive(recycled)).toBe(true);
        expect(world.isAlive(id, gen)).toBe(false);
        expect(world.isAlive(recycled, world.generationOf(recycled))).toBe(true);
    });

    it("invalidates every handle on clear()", () => {
        const world = new ECSWorld(4);
        const a = world.createEntity();
        const genA = world.generationOf(a);
        world.clear();
        const b = world.createEntity();
        expect(b).toBe(a);
        expect(world.isAlive(a, genA)).toBe(false);
    });

    it("unbindECS keeps the last values locally and stops writing into the recycled slot", () => {
        const world = new ECSWorld(8);
        const a = new BrioObject2D("a");
        a.entityId = world.createEntity(ComponentMask.TRANSFORM_2D);
        a.transform.bindECS(world.storage, a.entityId);
        a.transform.position.x = 42;
        a.transform.rotation = 1.5;

        world.destroyEntity(a.entityId);
        a.transform.unbindECS();
        a.entityId = -1;
        expect(a.transform.isBoundToECS).toBe(false);
        expect(a.transform.position.x).toBe(42);
        expect(a.transform.rotation).toBe(1.5);

        const b = new BrioObject2D("b");
        b.entityId = world.createEntity(ComponentMask.TRANSFORM_2D);
        b.transform.bindECS(world.storage, b.entityId);
        b.transform.position.x = 10;

        a.transform.position.x = 999;
        a.transform.rotation = 3;
        expect(b.transform.position.x).toBe(10);
        expect(b.transform.rotation).toBe(0);
    });

    it("bindECS(adopt = true) reads the slot instead of overwriting it", () => {
        const world = new ECSWorld(4);
        const id = world.createEntity(ComponentMask.TRANSFORM_2D);
        const base = world.storage.getTransform2DOffset(id);
        world.storage.transform2D[base] = 77;
        world.storage.transform2D[base + 12] = 0.5;

        const obj = new BrioObject2D("adopter");
        obj.transform.bindECS(world.storage, id, true);
        expect(obj.transform.position.x).toBe(77);
        expect(obj.transform.rotation).toBe(0.5);
    });

    it("reuses the caller array in query(mask, out) and bounds clearAllDirty to the high-water mark", () => {
        const world = new ECSWorld(1024);
        world.createEntity(ComponentMask.TRANSFORM_2D);
        world.createEntity(ComponentMask.TRANSFORM_2D | ComponentMask.COLLIDER);

        const out: number[] = [99, 98, 97];
        const result = world.query(ComponentMask.TRANSFORM_2D, out);
        expect(result).toBe(out);
        expect(out).toEqual([0, 1]);

        const fill = vi.spyOn(world.storage.dirtyFlags, "fill");
        world.clearAllDirty();
        expect(fill).toHaveBeenCalledWith(DirtyFlag.NONE, 0, 2);
    });

    it("allocates no 3D transform memory for a 2D-only storage layout", () => {
        const storage2D = new ComponentStorage(4096, false, { transform3D: false });
        expect(storage2D.has2D).toBe(true);
        expect(storage2D.has3D).toBe(false);
        expect(storage2D.transform3D.length).toBe(0);
        expect(storage2D.transform2D.length).toBe(4096 * 16);

        // Slot reset/copy must not touch the absent buffer
        storage2D.resetEntitySlot(3);
        storage2D.copyEntitySlot(3, 4);
        expect(storage2D.transform2D[4 * 16 + 4]).toBe(1);
    });
});

describe("BrioGame destroy/instantiate handle lifecycle", () => {
    let container: HTMLDivElement;

    beforeEach(() => {
        container = document.createElement("div");
        const { ctx } = createRecordingContext();
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as any);
    });

    it("a destroyed projectile reference can no longer move the projectile that reuses its slot", () => {
        const game = new BrioGame(640, 480, container);
        const prefab = game.addObject(new BrioObject2D("obj_bullet", "", 1));
        prefab.transform.size = { x: 4, y: 4 };

        const first = game.instantiate(prefab);
        first.transform.position = { x: 100, y: 100 };
        game.destroy(first);
        expect(first.entityId).toBe(-1);

        const second = game.instantiate(prefab);
        second.transform.position = { x: 10, y: 20 };

        // User code still holding the destroyed reference (classic stale-handle bug)
        first.transform.position.x = 999;
        first.transform.position.y = 999;

        expect(second.transform.position.x).toBe(10);
        expect(second.transform.position.y).toBe(20);
        expect(game.ecsWorld.activeCount).toBe(2);
    });

    it("names clones without colliding with user objects ending in -number", () => {
        const game = new BrioGame(640, 480, container);
        const prefab = game.addObject(new BrioObject2D("obj_enemy"));
        game.addObject(new BrioObject2D("obj_enemy-1"));

        const clone = game.instantiate(prefab);
        expect(clone.name).toBe("obj_enemy-2");
        expect(clone.instanceId).toBe(2);
        expect(game.gameObjects.get("obj_enemy-1")).not.toBe(clone);
    });

    it("rejects BrioObject3D in a 2D game, whose world has no 3D transform buffer", () => {
        const game = new BrioGame(640, 480, container, "2d");
        expect(game.ecsWorld.storage.has3D).toBe(false);
        expect(() => game.addObject(new BrioObject3D("obj_cube", "mesh_box"))).toThrow(
            /"2d" BrioGame/,
        );
    });

    it("restoreCheckPoint re-registers objects destroyed after it and unregisters objects spawned after it", () => {
        const game = new BrioGame(640, 480, container);
        const prefab = game.addObject(new BrioObject2D("obj_rock"));
        const kept = game.instantiate(prefab);
        kept.transform.position = { x: 5, y: 6 };

        game.createCheckPoint();

        game.destroy(kept);
        const late = game.instantiate(prefab);
        late.transform.position = { x: 300, y: 300 };

        expect(game.restoreCheckPoint()).toBe(true);
        expect(game.gameObjects.get(kept.name)).toBe(kept);
        expect(game.gameObjects.has(late.name)).toBe(false);
        expect(kept.transform.isBoundToECS).toBe(true);
        expect(kept.transform.position).toEqual({ x: 5, y: 6 });
        expect(late.transform.isBoundToECS).toBe(false);
        expect(game.layers.get("default")!.hasObject(kept)).toBe(true);
        expect(game.layers.get("default")!.hasObject(late)).toBe(false);

        // The late reference is detached: writing to it does not affect the restored world
        late.transform.position.x = -1;
        expect(kept.transform.position.x).toBe(5);
    });
});
