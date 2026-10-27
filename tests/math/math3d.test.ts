import { describe, expect, it } from "vitest";
import { BrioQuat, BrioVec3, Matrix4, Quaternion, Vector3 } from "../../src/math/index";

describe("3D Math (Vector3, Quaternion, Matrix4)", () => {
    it("performs Vector3 arithmetic, dot/cross product, and reactive buffer binding", () => {
        const a = Vector3.create(1, 0, 0);
        const b = Vector3.create(0, 1, 0);
        const out = Vector3.create();

        expect(Vector3.dot(a, b)).toBe(0);
        expect(Vector3.cross(out, a, b)).toEqual({ x: 0, y: 0, z: 1 });
        expect(Vector3.add(out, { x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 })).toEqual({
            x: 5,
            y: 7,
            z: 9,
        });
        expect(Vector3.distanceTo({ x: 0, y: 0, z: 0 }, { x: 0, y: 3, z: 4 })).toBeCloseTo(5);

        const buf = new Float32Array(6);
        let changes = 0;
        const reactive = new BrioVec3(1, 2, 3, () => {
            changes++;
        });
        reactive.bindBuffer(buf, 2);
        expect(buf[2]).toBe(1);
        expect(buf[3]).toBe(2);
        expect(buf[4]).toBe(3);

        reactive.z = 10;
        expect(buf[4]).toBe(10);
        expect(changes).toBe(1);
    });

    it("rotates vectors with Quaternion and converts Euler angles and SLERP", () => {
        const q90Y = Quaternion.fromAxisAngle(Quaternion.create(), { x: 0, y: 1, z: 0 }, Math.PI / 2);
        const rotated = Quaternion.rotateVec3(Vector3.create(), { x: 0, y: 0, z: 1 }, q90Y);
        expect(rotated.x).toBeCloseTo(1, 5);
        expect(rotated.y).toBeCloseTo(0, 5);
        expect(rotated.z).toBeCloseTo(0, 5);

        const qId = Quaternion.identity(Quaternion.create());
        const mid = Quaternion.slerp(Quaternion.create(), qId, q90Y, 0.5);
        const midRot = Quaternion.rotateVec3(Vector3.create(), { x: 0, y: 0, z: 1 }, mid);
        expect(midRot.x).toBeCloseTo(Math.SQRT1_2, 4);
        expect(midRot.z).toBeCloseTo(Math.SQRT1_2, 4);

        const eulerQuat = new BrioQuat();
        const euler = Quaternion.fromEuler(Quaternion.create(), 0.2, 0.4, -0.1);
        eulerQuat.copy(euler);
        const back = Quaternion.toEuler(Vector3.create(), eulerQuat);
        expect(back.x).toBeCloseTo(0.2, 4);
        expect(back.y).toBeCloseTo(0.4, 4);
        expect(back.z).toBeCloseTo(-0.1, 4);
    });

    it("computes Matrix4 TRS transforms, inversion, and camera projections", () => {
        const trs = Matrix4.fromRotationTranslationScale(
            Matrix4.create(),
            Quaternion.identity(Quaternion.create()),
            { x: 10, y: 20, z: 30 },
            { x: 2, y: 2, z: 2 },
        );
        const pt = Matrix4.transformPoint(Vector3.create(), { x: 1, y: 2, z: 3 }, trs);
        expect(pt).toEqual({ x: 12, y: 24, z: 36 });

        const inv = Matrix4.invert(Matrix4.create(), trs);
        const orig = Matrix4.transformPoint(Vector3.create(), pt, inv);
        expect(orig.x).toBeCloseTo(1, 5);
        expect(orig.y).toBeCloseTo(2, 5);
        expect(orig.z).toBeCloseTo(3, 5);

        const view = Matrix4.lookAt(
            Matrix4.create(),
            { x: 0, y: 0, z: 10 },
            { x: 0, y: 0, z: 0 },
            { x: 0, y: 1, z: 0 },
        );
        const proj = Matrix4.perspective(Matrix4.create(), Math.PI / 3, 16 / 9, 0.1, 100);
        const vp = Matrix4.multiply(Matrix4.create(), proj, view);
        const clipOrigin = Matrix4.transformPoint(Vector3.create(), { x: 0, y: 0, z: 0 }, vp);
        expect(clipOrigin.x).toBeCloseTo(0, 5);
        expect(clipOrigin.y).toBeCloseTo(0, 5);
        expect(clipOrigin.z).toBeGreaterThan(-1);
        expect(clipOrigin.z).toBeLessThan(1);
    });
});
