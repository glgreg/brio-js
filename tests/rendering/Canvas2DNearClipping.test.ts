import { describe, it, expect } from "vitest";
import { Canvas2DBackend } from "../../src/rendering/BrioRenderer";
import { BrioMesh } from "../../src/assets/BrioMesh";
import { BrioMaterial } from "../../src/assets/BrioMaterial";
import { Matrix4 } from "../../src/math/index";
import { createRecordingContext } from "../helpers/recordingContext";

/** Camera at the origin looking down -Z with near = 0.5. */
function viewProj(): Float32Array {
    const proj = Matrix4.perspective(Matrix4.create(), Math.PI / 2, 1, 0.5, 100);
    const view = Matrix4.lookAt(Matrix4.create(), { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, { x: 0, y: 1, z: 0 });
    return Matrix4.multiply(Matrix4.create(), proj, view);
}

function triangle(a: number[], b: number[], c: number[]): BrioMesh {
    return new BrioMesh(
        "tri",
        new Float32Array([...a, ...b, ...c]),
        new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
        new Float32Array(6),
        new Uint16Array([0, 1, 2]),
    );
}

async function rasterize(mesh: BrioMesh) {
    const rec = createRecordingContext();
    const backend = new Canvas2DBackend();
    await backend.init({ width: 200, height: 200, getContext: () => rec.ctx } as any);
    backend.beginFrame({ x: 0, y: 0, width: 1, height: 1 });
    backend.renderMesh3D(mesh, new BrioMaterial("m", { doubleSided: true }), Matrix4.create(), viewProj());
    backend.endFrame();
    const points = rec.calls
        .filter((c) => c.name === "moveTo" || c.name === "lineTo")
        .map((c) => c.args as number[]);
    return { triangles: backend.trianglesRendered, points };
}

describe("Canvas2DBackend near-plane clipping", () => {
    it("keeps triangles fully in front of the camera untouched", async () => {
        const { triangles } = await rasterize(triangle([-1, -1, -2], [1, -1, -2], [0, 1, -2]));
        expect(triangles).toBe(1);
    });

    it("drops triangles fully behind the near plane", async () => {
        const { triangles, points } = await rasterize(triangle([-1, -1, 2], [1, -1, 2], [0, 1, 2]));
        expect(triangles).toBe(0);
        expect(points).toHaveLength(0);
    });

    it("splits a triangle crossing the near plane into a clipped quad (2 triangles) without mirrored vertices", async () => {
        // One vertex behind the camera: unclipped, it would project mirrored to the other side of the screen
        const { triangles, points } = await rasterize(triangle([-1, -1, -2], [1, -1, -2], [0, -1, 3]));
        expect(triangles).toBe(2);
        for (const [x, y] of points) {
            expect(Number.isFinite(x)).toBe(true);
            // All clipped vertices sit at or below the horizon (y >= 100 px) because the triangle lies at y = -1
            expect(y).toBeGreaterThanOrEqual(99);
        }
    });

    it("clips to a single smaller triangle when two vertices are behind the plane", async () => {
        const { triangles } = await rasterize(triangle([0, -1, -3], [1, -1, 2], [-1, -1, 2]));
        expect(triangles).toBe(1);
    });
});
