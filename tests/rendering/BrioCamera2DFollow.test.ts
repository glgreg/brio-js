import { describe, it, expect } from "vitest";
import { BrioCamera2D } from "../../src/cameras/BrioCamera2D";
import { BrioObject2D } from "../../src/objects/BrioObject2D";

describe("BrioCamera2D follow convergence", () => {
    it("settles exactly on the destination instead of drifting by sub-pixel amounts forever", () => {
        const target = new BrioObject2D("obj_target");
        target.transform.size = { x: 32, y: 32 };
        target.transform.position = { x: 900, y: 600 };

        const cam = new BrioCamera2D("cam", { x: 0, y: 0 }, { x: 640, y: 360 });
        cam.follow(target, 0.12);

        for (let i = 0; i < 200; i++) cam.update(1 / 60);
        const settled = { x: cam.pos.x, y: cam.pos.y };
        cam.update(1 / 60);

        expect(cam.pos.x).toBe(settled.x);
        expect(cam.pos.y).toBe(settled.y);
        expect(settled.x).toBeCloseTo(900 + 16 - 320, 6);
        expect(settled.y).toBeCloseTo(600 + 16 - 180, 6);
    });
});
