import { describe, expect, it } from "vitest";
import { BrioObject2D } from "../../src/objects/BrioObject2D";
import { BrioCollision } from "../../src/math/BrioCollision";
import { BrioRandom } from "../../src/math/BrioRandom";
import { randomInt, randomRange } from "../../src/math/BrioMath";
import {
    BrioQuat,
    BrioVec2,
    BrioVec3,
    Matrix4,
    Quaternion,
    Vector2,
    Vector3,
} from "../../src/math/index";

function circle(name: string, x: number, y: number, diameter: number): BrioObject2D {
    const obj = new BrioObject2D(name, "spr", 1);
    obj.transform.position = { x, y };
    BrioCollision.addCircle({
        object: obj,
        colliderType: "solid",
        pos: { x: 0, y: 0 },
        size: diameter,
    });
    return obj;
}

function rect(name: string, x: number, y: number, w: number, h: number): BrioObject2D {
    const obj = new BrioObject2D(name, "spr", 1);
    obj.transform.position = { x, y };
    BrioCollision.addRectangle({
        object: obj,
        colliderType: "solid",
        pos: { x: 0, y: 0 },
        size: { x: w, y: h },
    });
    return obj;
}

describe("Quaternion.fromEuler convention", () => {
    it("equals qz * qy * qx (extrinsic X-Y-Z) and round-trips through toEuler", () => {
        const x = 0.3;
        const y = -0.7;
        const z = 1.1;
        const q = Quaternion.fromEuler(Quaternion.create(), x, y, z);

        const qx = Quaternion.fromAxisAngle(Quaternion.create(), { x: 1, y: 0, z: 0 }, x);
        const qy = Quaternion.fromAxisAngle(Quaternion.create(), { x: 0, y: 1, z: 0 }, y);
        const qz = Quaternion.fromAxisAngle(Quaternion.create(), { x: 0, y: 0, z: 1 }, z);
        const composed = Quaternion.create();
        Quaternion.multiply(composed, qz, qy);
        Quaternion.multiply(composed, composed, qx);

        expect(q.x).toBeCloseTo(composed.x, 6);
        expect(q.y).toBeCloseTo(composed.y, 6);
        expect(q.z).toBeCloseTo(composed.z, 6);
        expect(q.w).toBeCloseTo(composed.w, 6);

        const euler = Quaternion.toEuler({ x: 0, y: 0, z: 0 }, q);
        expect(euler.x).toBeCloseTo(x, 6);
        expect(euler.y).toBeCloseTo(y, 6);
        expect(euler.z).toBeCloseTo(z, 6);
    });
});

describe("Matrix4 zero-to-one depth projections", () => {
    const clipDepth = (m: Float32Array, viewZ: number): number => {
        const p = Matrix4.transformPoint({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: viewZ }, m);
        return p.z;
    };

    it("perspectiveZO maps near to 0 and far to 1, perspective maps them to -1 and 1", () => {
        const zo = Matrix4.perspectiveZO(Matrix4.create(), Math.PI / 3, 1, 0.5, 100);
        expect(clipDepth(zo, -0.5)).toBeCloseTo(0, 5);
        expect(clipDepth(zo, -100)).toBeCloseTo(1, 4);

        const gl = Matrix4.perspective(Matrix4.create(), Math.PI / 3, 1, 0.5, 100);
        expect(clipDepth(gl, -0.5)).toBeCloseTo(-1, 5);
        expect(clipDepth(gl, -100)).toBeCloseTo(1, 4);

        // x/y terms match the OpenGL variant.
        expect(zo[0]).toBeCloseTo(gl[0]);
        expect(zo[5]).toBeCloseTo(gl[5]);
    });

    it("perspectiveZO supports an infinite far plane", () => {
        const zo = Matrix4.perspectiveZO(Matrix4.create(), Math.PI / 3, 1, 0.5, Infinity);
        expect(clipDepth(zo, -0.5)).toBeCloseTo(0, 5);
        expect(clipDepth(zo, -1e7)).toBeCloseTo(1, 5);
    });

    it("orthographicZO maps near to 0 and far to 1", () => {
        const zo = Matrix4.orthographicZO(Matrix4.create(), -10, 10, -5, 5, 1, 21);
        expect(clipDepth(zo, -1)).toBeCloseTo(0, 6);
        expect(clipDepth(zo, -21)).toBeCloseTo(1, 6);
        expect(clipDepth(zo, -11)).toBeCloseTo(0.5, 6);

        const p = Matrix4.transformPoint({ x: 0, y: 0, z: 0 }, { x: 10, y: -5, z: -1 }, zo);
        expect(p.x).toBeCloseTo(1, 6);
        expect(p.y).toBeCloseTo(-1, 6);
    });
});

describe("BrioCollision.computeMTV circle vs rectangle", () => {
    it("pushes a circle near a corner along the diagonal, not by its bounding box", () => {
        // Circle radius 10 centered at (105, 105); rectangle corner at (100, 100) .. (0, 0).
        const c = circle("c", 95, 95, 20);
        const r = rect("r", 0, 0, 100, 100);
        expect(BrioCollision.isColliding(c, r)).toBe(true);

        const mtv = BrioCollision.computeMTV(c, r)!;
        const expected = (10 - Math.hypot(5, 5)) / Math.SQRT2;
        expect(mtv.x).toBeCloseTo(expected, 6);
        expect(mtv.y).toBeCloseTo(expected, 6);
    });

    it("returns null for a circle inside the corner gap of the bounding box", () => {
        // Center (108, 108) is ~11.3 px from the corner: bounding boxes overlap, shapes do not.
        const c = circle("c", 98, 98, 20);
        const r = rect("r", 0, 0, 100, 100);
        expect(BrioCollision.isColliding(c, r)).toBe(false);
        expect(BrioCollision.computeMTV(c, r)).toBeNull();
    });

    it("pushes along the face normal for an edge contact and inverts when the rectangle moves", () => {
        // Circle radius 10 centered at (50, 108): 8 px from the bottom face.
        const c = circle("c", 40, 98, 20);
        const r = rect("r", 0, 0, 100, 100);

        expect(BrioCollision.computeMTV(c, r)).toEqual({ x: 0, y: 2 });
        expect(BrioCollision.computeMTV(r, c)).toEqual({ x: 0, y: -2 });
    });

    it("exits through the nearest face when the circle center is inside the rectangle", () => {
        // Center (95, 50) is 5 px from the right face.
        const c = circle("c", 85, 40, 20);
        const r = rect("r", 0, 0, 100, 100);
        expect(BrioCollision.computeMTV(c, r)).toEqual({ x: 15, y: 0 });
    });

    it("resolveCollision separates the circle from the rectangle", () => {
        const c = circle("c", 95, 95, 20);
        const r = rect("r", 0, 0, 100, 100);
        BrioCollision.resolveCollision(c, r);
        const cx = c.transform.position.x + 10;
        const cy = c.transform.position.y + 10;
        expect(Math.hypot(cx - 100, cy - 100)).toBeCloseTo(10, 4);
    });
});

describe("Vector clamp contract", () => {
    it("Vector2.clamp and Vector3.clamp throw when min > max, like BrioMath.clamp", () => {
        const v2 = Vector2.create(5, 5);
        expect(() => Vector2.clamp(v2, { x: 10, y: 0 }, { x: 0, y: 10 })).toThrow(
            "clamp.min was set to higher than clamp.max",
        );
        expect(v2).toEqual({ x: 5, y: 5 });

        const v3 = Vector3.create(5, 5, 5);
        expect(() => Vector3.clamp(v3, { x: 0, y: 0, z: 10 }, { x: 10, y: 10, z: 0 })).toThrow(
            "clamp.min was set to higher than clamp.max",
        );
        expect(v3).toEqual({ x: 5, y: 5, z: 5 });
    });

    it("clamps normally, including equal bounds", () => {
        expect(
            Vector3.clamp(Vector3.create(-1, 5, 20), Vector3.create(), Vector3.create(10, 5, 10)),
        ).toEqual({
            x: 0,
            y: 5,
            z: 10,
        });
    });
});

describe("BrioMath random source", () => {
    it("randomRange and randomInt are deterministic with a seeded BrioRandom", () => {
        const a = new BrioRandom(42);
        const b = new BrioRandom(42);
        const seqA = [randomRange(0, 10, a), randomInt(1, 6, a), randomRange(-5, 5, a)];
        const seqB = [randomRange(0, 10, b), randomInt(1, 6, b), randomRange(-5, 5, b)];
        expect(seqA).toEqual(seqB);
    });

    it("accepts a function source and keeps the bounds", () => {
        expect(randomRange(10, 20, () => 0.5)).toBe(15);
        expect(randomInt(1, 6, () => 0)).toBe(1);
        expect(randomInt(1, 6, () => 0.999999)).toBe(6);
    });

    it("draws exactly one value per call from the source", () => {
        const rng = new BrioRandom("draws");
        const ref = rng.clone();
        randomInt(0, 100, rng);
        randomRange(0, 1, rng);
        ref.next();
        ref.next();
        expect(rng.next()).toBe(ref.next());
    });
});

describe("Reactive vectors share accessors", () => {
    it("keeps own enumerable x/y/z/w accessors without per-instance closures", () => {
        const a = new BrioVec2(1, 2);
        const b = new BrioVec2(3, 4);
        const da = Object.getOwnPropertyDescriptor(a, "x")!;
        const db = Object.getOwnPropertyDescriptor(b, "x")!;
        expect(da.enumerable).toBe(true);
        expect(da.get).toBe(db.get);
        expect(da.set).toBe(db.set);
        expect({ ...a }).toEqual({ x: 1, y: 2 });

        const v1 = new BrioVec3(1, 2, 3);
        const v2 = new BrioVec3();
        expect(Object.getOwnPropertyDescriptor(v1, "z")!.get).toBe(
            Object.getOwnPropertyDescriptor(v2, "z")!.get,
        );
        expect(JSON.parse(JSON.stringify(v1))).toEqual({ x: 1, y: 2, z: 3 });

        const q1 = new BrioQuat();
        const q2 = new BrioQuat(0, 0, 1, 0);
        expect(Object.getOwnPropertyDescriptor(q1, "w")!.set).toBe(
            Object.getOwnPropertyDescriptor(q2, "w")!.set,
        );
        expect(q2).toEqual({ x: 0, y: 0, z: 1, w: 0 });
    });

    it("still notifies onChange and writes through to a bound buffer", () => {
        const calls: number[][] = [];
        const buf = new Float32Array(8);
        const q = new BrioQuat(0, 0, 0, 1, (x, y, z, w) => calls.push([x, y, z, w]));
        q.bindBuffer(buf, 4);
        q.y = 0.5;
        expect(buf[5]).toBe(0.5);
        expect(calls).toEqual([[0, 0.5, 0, 1]]);

        const changes: number[][] = [];
        const v = new BrioVec2(0, 0, (x, y) => changes.push([x, y]));
        v.x = 3;
        expect(changes).toEqual([[3, 0]]);
        expect(v.x).toBe(3);
    });
});
