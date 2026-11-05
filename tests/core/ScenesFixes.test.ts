import { describe, expect, it } from "vitest";
import { BrioScene } from "../../src/core/BrioScene";
import { BrioLayer } from "../../src/core/BrioLayer";
import { BrioObject2D } from "../../src/objects/BrioObject2D";
import { BrioObject3D } from "../../src/objects/BrioObject3D";

function modelWithPart(name: string): { root: BrioObject3D; part: BrioObject3D } {
    const root = new BrioObject3D(name, "");
    const part = new BrioObject3D(`${name}_part`, "");
    root.addChild(part);
    return { root, part };
}

describe("BrioScene fixes", () => {
    it("restoreCheckpoint(bytes) rebinds 3D parts and drops objects added after the capture", () => {
        const scene = new BrioScene("s", 32);
        const { root, part } = modelWithPart("ship");
        scene.addObject3D(root);
        part.transform.position = { x: 5, y: 0, z: 0 };

        const bytes = scene.createCheckpoint().slice();
        const late = scene.addObject2D(new BrioObject2D("obj_late", "", 1));
        part.transform.position = { x: 50, y: 0, z: 0 };

        scene.restoreCheckpoint(bytes);
        expect(part.transform.position.x).toBe(5);
        expect(part.entityGeneration).toBe(scene.world.generationOf(part.entityId));
        // A write after restore lands in the restored slot
        part.transform.position.x = 6;
        expect(
            scene.world.storage.transform3D[
                scene.world.storage.getTransform3DOffset(part.entityId)
            ],
        ).toBe(6);

        expect(scene.objects2D.has("obj_late")).toBe(false);
        expect(late.entityId).toBe(-1);
        expect(scene.layers.get("default")!.hasObject(late)).toBe(false);
    });

    it("restoreCheckpoint(lastBytes) restores the full state", () => {
        const scene = new BrioScene("s", 32);
        const a = scene.addObject2D(new BrioObject2D("obj_a", "", 1));
        const bytes = scene.createCheckpoint();
        scene.removeObject(a);
        scene.restoreCheckpoint(bytes);
        expect(scene.objects2D.get("obj_a")).toBe(a);
        expect(a.entityId).toBeGreaterThanOrEqual(0);
    });

    it("destroy() unbinds 3D parts", () => {
        const scene = new BrioScene("s", 32);
        const { root, part } = modelWithPart("ship");
        scene.addObject3D(root);
        scene.destroy();
        expect(part.entityId).toBe(-1);
        expect(part.transform.isBoundToECS).toBe(false);
        expect(root.transform.isBoundToECS).toBe(false);
    });

    it("a second 2D object with the same name releases the first one's slot and layer", () => {
        const scene = new BrioScene("s", 32);
        const hud = scene
            .addLayer(new BrioLayer({ name: "hud", order: 1, policy: "ui" }))
            .layers.get("hud")!;
        const first = scene.addObject2D(new BrioObject2D("obj_dup", "", 1), "hud");
        const second = scene.addObject2D(new BrioObject2D("obj_dup", "", 1), "hud");

        expect(scene.world.activeCount).toBe(1);
        expect(first.entityId).toBe(-1);
        expect(hud.hasObject(first)).toBe(false);
        expect(hud.hasObject(second)).toBe(true);
        expect(scene.objects2D.get("obj_dup")).toBe(second);

        // Adding the same object again does not leak a slot either
        scene.addObject2D(second, "hud");
        expect(scene.world.activeCount).toBe(1);
    });

    it("a 3D object with the same name replaces the previous one without leaking slots", () => {
        const scene = new BrioScene("s", 32);
        const a = modelWithPart("ship");
        const b = modelWithPart("ship");
        scene.addObject3D(a.root);
        scene.addObject3D(b.root);
        expect(scene.world.activeCount).toBe(2);
        expect(a.part.entityId).toBe(-1);
        expect(scene.objects3D.get("ship")).toBe(b.root);
    });

    it("useLayout() narrows the scene world to the game preset", () => {
        const scene = new BrioScene("s", 32);
        const obj = scene.addObject2D(new BrioObject2D("obj_a", "", 1));
        obj.transform.position = { x: 3, y: 4 };
        expect(scene.world.storage.has3D).toBe(true);

        expect(scene.useLayout({ transform2D: true, transform3D: false })).toBe(true);
        expect(scene.world.storage.has3D).toBe(false);
        expect(scene.world.storage.transform3D.length).toBe(0);
        expect(scene.compositorSource.world).toBe(scene.world);
        expect(obj.transform.position.x).toBe(3);
        expect(scene.world.isAlive(obj.entityId, obj.entityGeneration)).toBe(true);

        expect(() => scene.addObject3D(new BrioObject3D("obj_3d", ""))).toThrow(/2d/);
    });

    it("useLayout() refuses when a registered object or a captured state needs the old layout", () => {
        const with3D = new BrioScene("a", 8);
        with3D.addObject3D(new BrioObject3D("obj_3d", ""));
        expect(with3D.useLayout({ transform3D: false })).toBe(false);
        expect(with3D.world.storage.has3D).toBe(true);

        const captured = new BrioScene("b", 8);
        captured.createCheckpoint();
        expect(captured.useLayout({ transform3D: false })).toBe(false);

        const explicit = new BrioScene("c", 8, { transform3D: false });
        expect(explicit.world.storage.has3D).toBe(false);
        expect(explicit.useLayout({ transform3D: false })).toBe(true);
    });
});
