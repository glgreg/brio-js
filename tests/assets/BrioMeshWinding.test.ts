import { describe, it, expect } from "vitest";
import { BrioMesh } from "../../src/assets/BrioMesh";

/** Fraction of triangles whose geometric normal (CCW winding) agrees with the averaged vertex normals. */
function outwardRatio(mesh: BrioMesh): number {
    const p = mesh.positions;
    const n = mesh.normals;
    const idx = mesh.indices;
    let agree = 0;
    let total = 0;
    for (let i = 0; i < idx.length; i += 3) {
        const a = idx[i] * 3;
        const b = idx[i + 1] * 3;
        const c = idx[i + 2] * 3;
        const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
        const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
        const gx = uy * vz - uz * vy;
        const gy = uz * vx - ux * vz;
        const gz = ux * vy - uy * vx;
        if (Math.hypot(gx, gy, gz) < 1e-9) continue;
        const nx = n[a] + n[b] + n[c];
        const ny = n[a + 1] + n[b + 1] + n[c + 1];
        const nz = n[a + 2] + n[b + 2] + n[c + 2];
        total++;
        if (gx * nx + gy * ny + gz * nz > 0) agree++;
    }
    return agree / total;
}

describe("BrioMesh primitives winding", () => {
    it.each([
        ["box", BrioMesh.createBox("b")],
        ["plane", BrioMesh.createPlane("p")],
        ["subdivided plane", BrioMesh.createPlane("p4", 8, 6, 4, 3)],
        ["sphere", BrioMesh.createSphere("s")],
        ["cylinder", BrioMesh.createCylinder("c")],
        ["cone", BrioMesh.createCylinder("k", 0, 1, 2, 12)],
        ["truncated cone", BrioMesh.createCylinder("t", 0.25, 1, 1, 7)],
    ])("%s faces are counter-clockwise when seen from outside", (_name, mesh) => {
        expect(outwardRatio(mesh)).toBe(1);
    });
});

describe("BrioMesh.createCylinder", () => {
    it("builds side, top and bottom caps with the expected counts and bounds", () => {
        const mesh = BrioMesh.createCylinder("c", 0.5, 0.5, 2, 8);
        // side: (8 + 1) columns x 2, caps: 2 x (1 center + 9 ring)
        expect(mesh.vertexCount).toBe(18 + 20);
        expect(mesh.triangleCount).toBe(16 + 16);
        const box = mesh.computeBoundingBox();
        expect(box.min.y).toBeCloseTo(-1);
        expect(box.max.y).toBeCloseTo(1);
        expect(box.max.x).toBeCloseTo(0.5);
    });

    it("omits caps when uncapped or when a radius is zero (cone)", () => {
        expect(BrioMesh.createCylinder("u", 1, 1, 1, 6, false).triangleCount).toBe(12);
        expect(BrioMesh.createCylinder("k", 0, 1, 1, 6).triangleCount).toBe(12 + 6);
        expect(BrioMesh.createCylinder("min", 1, 1, 1, 1).triangleCount).toBe(6 + 6);
    });

    it("tilts side normals of cones toward +Y", () => {
        const cone = BrioMesh.createCylinder("k", 0, 1, 1, 4, false);
        expect(cone.normals[1]).toBeCloseTo(1 / Math.SQRT2);
        expect(Math.hypot(cone.normals[0], cone.normals[1], cone.normals[2])).toBeCloseTo(1);
    });
});

describe("BrioMesh.createPlane subdivision", () => {
    it("keeps the single-quad default and subdivides on request", () => {
        const quad = BrioMesh.createPlane("q", 10, 10);
        expect(quad.vertexCount).toBe(4);
        expect(quad.triangleCount).toBe(2);
        const grid = BrioMesh.createPlane("g", 8, 6, 4, 3);
        expect(grid.vertexCount).toBe(20);
        expect(grid.triangleCount).toBe(24);
        const box = grid.computeBoundingBox();
        expect(box.min.x).toBeCloseTo(-4);
        expect(box.max.z).toBeCloseTo(3);
    });
});
