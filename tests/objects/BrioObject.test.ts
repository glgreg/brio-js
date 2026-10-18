import { describe, it, expect } from "vitest";
import { BrioObject } from "../../src/objects/BrioObject";
import { BrioCollision } from "../../src/math/BrioCollision";

describe("BrioObject", () => {
    it("creates a BrioObject with sanitized layer and properties", () => {
        const obj = new BrioObject("player", "spr_player", -3.2);
        expect(obj.name).toBe("player");
        expect(obj.sprite).toBe("spr_player");
        expect(obj.transform.layer).toBe(3);
        expect(obj.instanceId).toBe(0);
    });

    it("rejects manual object names ending in -number unless instantiating a clone", () => {
        expect(() => new BrioObject("enemy-1", "spr_enemy", 1)).toThrow(
            "Game objects can't end with '-number'",
        );
    });

    it("clones a BrioObject preserving its collision mask and all transform properties", () => {
        const original = new BrioObject("orc", "spr_orc", 2);
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

        const cloned = BrioObject.clone(original);
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
