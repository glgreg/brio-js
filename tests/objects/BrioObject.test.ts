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

    it("clones a BrioObject preserving its collision mask and transform size", () => {
        const original = new BrioObject("orc", "spr_orc", 2);
        original.transform.size = { x: 48, y: 64 };
        BrioCollision.addRectangle({
            object: original,
            colliderType: "solid",
            pos: { x: 4, y: 8 },
            size: { x: 40, y: 56 },
        });

        const cloned = BrioObject.clone(original);
        expect(cloned).not.toBe(original);
        expect(cloned.name).toBe("orc");
        expect(cloned.sprite).toBe("spr_orc");
        expect(cloned.transform.layer).toBe(2);
        expect(cloned.transform.size.x).toBe(48);
        expect(cloned.transform.size.y).toBe(64);
        expect(cloned.collision).toBeDefined();
        expect(cloned.collision?.shape).toBe("rectangle");
        expect(cloned.collision?.pos).toEqual({ x: 4, y: 8 });
        expect(cloned.collision?.size).toEqual({ x: 40, y: 56 });
    });
});
