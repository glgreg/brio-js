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

describe("BrioCamera2D follow is framerate independent", () => {
    function positionAfterOneSecond(hz: number): number {
        const target = new BrioObject2D("obj_target");
        target.transform.position = { x: 1000, y: 0 };
        const cam = new BrioCamera2D("cam", { x: 0, y: 0 }, { x: 100, y: 100 });
        cam.follow(target, 0.05);
        for (let i = 0; i < hz; i++) cam.update(1 / hz);
        return cam.pos.x;
    }

    it("covers the same distance per second at 30, 60, 144 and 240 Hz", () => {
        const at60 = positionAfterOneSecond(60);
        expect(at60).toBeGreaterThan(0);
        for (const hz of [30, 144, 240]) {
            expect(positionAfterOneSecond(hz)).toBeCloseTo(at60, 3);
        }
    });

    it("does not move when dt is zero and locks instantly with lerpFactor 1", () => {
        const target = new BrioObject2D("obj_target");
        target.transform.position = { x: 500, y: 0 };
        const cam = new BrioCamera2D("cam", { x: 0, y: 0 }, { x: 100, y: 100 });
        cam.follow(target, 0.2);
        cam.update(0);
        expect(cam.pos.x).toBe(0);
        cam.follow(target, 1);
        cam.update(0);
        expect(cam.pos.x).toBe(500 - 50);
    });
});
