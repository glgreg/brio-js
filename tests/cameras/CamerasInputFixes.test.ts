import { describe, expect, it } from "vitest";
import { BrioCamera2D } from "../../src/cameras/BrioCamera2D";
import { BrioCamera3D } from "../../src/cameras/BrioCamera3D";
import { BrioViewport } from "../../src/core/BrioViewport";

/** Minimal 2D affine matrix replaying the canvas calls the compositor issues for a camera pass. */
class Affine {
    a = 1;
    b = 0;
    c = 0;
    d = 1;
    e = 0;
    f = 0;
    translate(x: number, y: number): void {
        this.e += this.a * x + this.c * y;
        this.f += this.b * x + this.d * y;
    }
    scale(x: number, y: number): void {
        this.a *= x;
        this.b *= x;
        this.c *= y;
        this.d *= y;
    }
    rotate(t: number): void {
        const cos = Math.cos(t);
        const sin = Math.sin(t);
        const { a, b, c, d } = this;
        this.a = a * cos + c * sin;
        this.b = b * cos + d * sin;
        this.c = -a * sin + c * cos;
        this.d = -b * sin + d * cos;
    }
    apply(x: number, y: number): { x: number; y: number } {
        return { x: this.a * x + this.c * y + this.e, y: this.b * x + this.d * y + this.f };
    }
}

/** Canvas pixel where the compositor draws world point `(wx, wy)` (see BrioCompositor and BrioSpriteRenderer). */
function compositorProject(
    camera: BrioCamera2D,
    canvasW: number,
    canvasH: number,
    gameScale: number,
    wx: number,
    wy: number,
): { x: number; y: number } {
    const vp = camera.viewport;
    const vx = Math.round(vp.x * canvasW);
    const vy = Math.round(vp.y * canvasH);
    const vw = Math.round(vp.width * canvasW);
    const vh = Math.round(vp.height * canvasH);
    const m = new Affine();
    m.translate(vx, vy);
    if (camera.rotation !== 0) {
        m.translate(vw * 0.5, vh * 0.5);
        m.rotate(-camera.rotation);
        m.translate(-vw * 0.5, -vh * 0.5);
    }
    if (camera.zoom !== 1) m.scale(camera.zoom, camera.zoom);
    m.translate(-camera.renderX * gameScale, -camera.renderY * gameScale);
    return m.apply(wx * gameScale, wy * gameScale);
}

describe("CamerasInput: BrioCamera2D coordinate conversion", () => {
    it("keeps the legacy viewport-local result for unrotated cameras", () => {
        const cam = new BrioCamera2D("cam", { x: 100, y: 50 }, { x: 640, y: 480 });
        cam.zoom = 2;
        expect(cam.worldToScreen({ x: 110, y: 60 })).toEqual({ x: 20, y: 20 });
        expect(cam.screenToWorld({ x: 20, y: 20 })).toEqual({ x: 110, y: 60 });
    });

    it("matches the compositor transform with rotation, zoom, game scale and a split-screen viewport", () => {
        const cam = new BrioCamera2D(
            "cam",
            { x: 40, y: -30 },
            { x: 400, y: 600 },
            new BrioViewport(0.5, 0, 0.5, 1),
        );
        cam.rotation = 0.7;
        cam.zoom = 1.5;
        const space = { canvasWidth: 800, canvasHeight: 600, scale: 2 };
        const points = [
            { x: 0, y: 0 },
            { x: 123, y: 45 },
            { x: -80, y: 300 },
        ];
        for (const p of points) {
            const expected = compositorProject(cam, 800, 600, 2, p.x, p.y);
            const screen = cam.worldToScreen(p, space);
            expect(screen.x).toBeCloseTo(expected.x, 6);
            expect(screen.y).toBeCloseTo(expected.y, 6);
            const back = cam.screenToWorld(screen, space);
            expect(back.x).toBeCloseTo(p.x, 6);
            expect(back.y).toBeCloseTo(p.y, 6);
        }
    });

    it("rotates around the viewport center in viewport-local mode", () => {
        const cam = new BrioCamera2D("cam", { x: 0, y: 0 }, { x: 200, y: 100 });
        cam.rotation = Math.PI / 2;
        const center = cam.worldToScreen({ x: 100, y: 50 });
        expect(center.x).toBeCloseTo(100);
        expect(center.y).toBeCloseTo(50);
        const right = cam.worldToScreen({ x: 110, y: 50 });
        expect(right.x).toBeCloseTo(100);
        expect(right.y).toBeCloseTo(40);
    });

    it("applies the layer scroll factor and writes into an out parameter", () => {
        const cam = new BrioCamera2D("cam", { x: 100, y: 100 });
        const out = { x: 0, y: 0 };
        const result = cam.screenToWorld({ x: 0, y: 0 }, { scrollFactor: { x: 0.5, y: 0 } }, out);
        expect(result).toBe(out);
        expect(out).toEqual({ x: 50, y: 0 });
    });
});

describe("CamerasInput: BrioCamera3D.isSphereInFrustum", () => {
    const makeCam = (): BrioCamera3D =>
        new BrioCamera3D("cam", {
            position: { x: 0, y: 0, z: 0 },
            target: { x: 0, y: 0, z: -1 },
            fov: Math.PI / 2,
            aspect: 1,
            near: 0.1,
            far: 100,
        });

    it("accepts spheres inside and rejects spheres beyond every one of the six planes", () => {
        const cam = makeCam();
        expect(cam.isSphereInFrustum({ x: 0, y: 0, z: -10 }, 1)).toBe(true);
        // 90 degree fov: at depth 10 the frustum spans x and y in [-10, 10]
        expect(cam.isSphereInFrustum({ x: -20, y: 0, z: -10 }, 1)).toBe(false);
        expect(cam.isSphereInFrustum({ x: 20, y: 0, z: -10 }, 1)).toBe(false);
        expect(cam.isSphereInFrustum({ x: 0, y: -20, z: -10 }, 1)).toBe(false);
        expect(cam.isSphereInFrustum({ x: 0, y: 20, z: -10 }, 1)).toBe(false);
        expect(cam.isSphereInFrustum({ x: 0, y: 0, z: 5 }, 1)).toBe(false);
        expect(cam.isSphereInFrustum({ x: 0, y: 0, z: -200 }, 1)).toBe(false);
    });

    it("accepts spheres that straddle a plane", () => {
        const cam = makeCam();
        // Center 1 unit outside the right plane (distance 1 / sqrt(2) * ... < radius)
        expect(cam.isSphereInFrustum({ x: 11, y: 0, z: -10 }, 2)).toBe(true);
        expect(cam.isSphereInFrustum({ x: 0, y: 0, z: -101 }, 2)).toBe(true);
    });

    it("rebuilds the cached planes when the camera moves or the projection changes", () => {
        const cam = makeCam();
        const sphere = { x: 50, y: 0, z: -10 };
        expect(cam.isSphereInFrustum(sphere, 1)).toBe(false);
        cam.position.x = 50;
        cam.target.x = 50;
        expect(cam.isSphereInFrustum(sphere, 1)).toBe(true);
        cam.far = 5;
        expect(cam.isSphereInFrustum(sphere, 1)).toBe(false);
    });

    it("tests the box of an orthographic camera", () => {
        const cam = new BrioCamera3D("ortho", {
            projection: "orthographic",
            position: { x: 0, y: 0, z: 0 },
            target: { x: 0, y: 0, z: -1 },
            orthoSize: 5,
            aspect: 2,
        });
        expect(cam.isSphereInFrustum({ x: 9, y: 0, z: -10 }, 0.5)).toBe(true);
        expect(cam.isSphereInFrustum({ x: 12, y: 0, z: -10 }, 0.5)).toBe(false);
        expect(cam.isSphereInFrustum({ x: 0, y: 6, z: -10 }, 0.5)).toBe(false);
    });
});
