import { describe, it, expect } from "vitest";
import { BrioCamera3D } from "../../src/cameras/BrioCamera3D";
import { BrioViewport } from "../../src/core/BrioViewport";

describe("BrioCamera3D.screenToRay", () => {
    it("casts the center pixel straight along the view direction from the near plane", () => {
        const cam = new BrioCamera3D("cam", { position: { x: 0, y: 2, z: 10 }, target: { x: 0, y: 2, z: 0 }, aspect: 2 });
        const ray = cam.screenToRay(400, 200, 800, 400);
        expect(ray.direction.x).toBeCloseTo(0);
        expect(ray.direction.y).toBeCloseTo(0);
        expect(ray.direction.z).toBeCloseTo(-1);
        expect(ray.origin.z).toBeCloseTo(10 - cam.near, 4);
        expect(ray.origin.y).toBeCloseTo(2);
    });

    it("maps corner pixels to rays through the frustum edges (fov and aspect)", () => {
        const cam = new BrioCamera3D("cam", { fov: Math.PI / 2, aspect: 1, position: { x: 0, y: 0, z: 0 }, target: { x: 0, y: 0, z: -1 } });
        const topLeft = cam.screenToRay(0, 0, 100, 100);
        // 90 degree fov: the top-left corner direction is (-1, 1, -1) normalized
        const k = 1 / Math.sqrt(3);
        expect(topLeft.direction.x).toBeCloseTo(-k, 4);
        expect(topLeft.direction.y).toBeCloseTo(k, 4);
        expect(topLeft.direction.z).toBeCloseTo(-k, 4);
    });

    it("honors the camera viewport (split-screen right half)", () => {
        const cam = new BrioCamera3D("cam", {
            aspect: 1,
            position: { x: 0, y: 0, z: 0 },
            target: { x: 0, y: 0, z: -1 },
            viewport: new BrioViewport(0.5, 0, 0.5, 1),
        });
        // Center of the right half of a 200x100 canvas is the viewport center
        const ray = cam.screenToRay(150, 50, 200, 100);
        expect(ray.direction.x).toBeCloseTo(0);
        expect(ray.direction.z).toBeCloseTo(-1);
    });

    it("returns parallel rays for orthographic cameras", () => {
        const cam = new BrioCamera3D("cam", {
            projection: "orthographic",
            orthoSize: 5,
            aspect: 1,
            position: { x: 0, y: 0, z: 10 },
            target: { x: 0, y: 0, z: 0 },
        });
        const a = cam.ndcToRay(-1, 1);
        const b = cam.ndcToRay(1, -1);
        expect(a.direction.z).toBeCloseTo(-1);
        expect(b.direction.z).toBeCloseTo(-1);
        expect(a.origin.x).toBeCloseTo(-5);
        expect(a.origin.y).toBeCloseTo(5);
        expect(b.origin.x).toBeCloseTo(5);
    });
});
