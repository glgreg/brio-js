import { describe, it, expect } from "vitest";
import { BrioObject2D } from "../../src/objects/BrioObject2D";
import { BrioCollision } from "../../src/math/BrioCollision";

describe("BrioObject2D", () => {
    it("creates a BrioObject2D with sanitized layer and properties", () => {
        const obj = new BrioObject2D("player", "spr_player", -3.2);
        expect(obj.name).toBe("player");
        expect(obj.sprite).toBe("spr_player");
        expect(obj.transform.layer).toBe(3);
        expect(obj.instanceId).toBe(0);
    });

    it("accepts any object name, including names ending in -number", () => {
        expect(() => new BrioObject2D("enemy-1", "spr_enemy", 1)).not.toThrow();
        expect(new BrioObject2D("enemy-1").name).toBe("enemy-1");
    });

    it("clones a BrioObject2D preserving its collision mask and all transform properties", () => {
        const original = new BrioObject2D("orc", "spr_orc", 2);
        original.transform.position = { x: 12, y: 24 };
        original.transform.size = { x: 48, y: 64 };
        original.transform.rotation = Math.PI / 4;
        original.transform.scale = { x: 2, y: 1.5 };
        original.transform.pivot = { x: 0.25, y: 0.75 };
        original.transform.skew = { x: 0.1, y: 0.2 };
        original.transform.flip = { x: true, y: false };
        original.transform.visibility = false;
        original.transform.opacity = 0.75;

        BrioCollision.addRectangle({
            object: original,
            colliderType: "trigger",
            pos: { x: 4, y: 8 },
            size: { x: 40, y: 56 },
        });
        original.collision!.enabled = false;

        const cloned = BrioObject2D.clone(original);
        expect(cloned).not.toBe(original);
        expect(cloned.name).toBe("orc");
        expect(cloned.sprite).toBe("spr_orc");
        expect(cloned.transform.layer).toBe(2);
        expect(cloned.transform.position).toEqual({ x: 12, y: 24 });
        expect(cloned.transform.size).toEqual({ x: 48, y: 64 });
        expect(cloned.transform.rotation).toBeCloseTo(Math.PI / 4);
        expect(cloned.transform.scale).toEqual({ x: 2, y: 1.5 });
        expect(cloned.transform.pivot).toEqual({ x: 0.25, y: 0.75 });
        expect(cloned.transform.skew).toEqual({ x: 0.1, y: 0.2 });
        expect(cloned.transform.flip).toEqual({ x: true, y: false });
        expect(cloned.transform.visibility).toBe(false);
        expect(cloned.transform.opacity).toBe(0.75);
        expect(cloned.collision).toBeDefined();
        expect(cloned.collision?.shape).toBe("rectangle");
        expect(cloned.collision?.colliderType).toBe("trigger");
        expect(cloned.collision?.enabled).toBe(false);
        expect(cloned.collision?.pos).toEqual({ x: 4, y: 8 });
        expect(cloned.collision?.size).toEqual({ x: 40, y: 56 });
    });
});
