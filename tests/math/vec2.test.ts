import { describe, it, expect } from "vitest";
import {
    create,
    clone,
    copy,
    zero,
    add,
    subtract,
    multiply,
    scale,
    normalize,
    clamp,
    dot,
    length,
    lengthSquared,
    distanceTo,
    distanceSquared,
    lerp,
    equals,
    addSelf,
    subtractSelf,
    multiplySelf,
    scaleSelf,
    normalizeSelf,
} from "../../src/math/vec2";

describe("vec2", () => {
    it("creates, clones, copies, and zeroes a Vec2", () => {
        expect(create()).toEqual({ x: 0, y: 0 });
        const v = create(3, -4);
        expect(v).toEqual({ x: 3, y: -4 });

        const c = clone(v);
        expect(c).toEqual(v);
        expect(c).not.toBe(v);

        const target = create();
        copy(target, v);
        expect(target).toEqual({ x: 3, y: -4 });

        zero(target);
        expect(target).toEqual({ x: 0, y: 0 });
    });

    it("adds, subtracts, multiplies, and scales vectors into an output vector", () => {
        const out = create();
        const a = create(2, 3);
        const b = create(4, 5);

        expect(add(out, a, b)).toEqual({ x: 6, y: 8 });
        expect(subtract(out, b, a)).toEqual({ x: 2, y: 2 });
        expect(multiply(out, a, b)).toEqual({ x: 8, y: 15 });
        expect(scale(out, a, 3)).toEqual({ x: 6, y: 9 });
    });

    it("normalizes input vector v into out (even when out starts at 0,0)", () => {
        const out = create(0, 0);
        const v = create(3, 4);

        normalize(out, v);
        expect(out.x).toBeCloseTo(0.6);
        expect(out.y).toBeCloseTo(0.8);

        const zeroOut = create(5, 5);
        normalize(zeroOut, create(0, 0));
        expect(zeroOut).toEqual({ x: 0, y: 0 });
    });

    it("clamps a vector within min and max bounds", () => {
        const out = create(15, -5);
        clamp(out, create(0, 0), create(10, 10));
        expect(out).toEqual({ x: 10, y: 0 });
    });

    it("calculates Euclidean distance, squared distance, length, dot, lerp, and equals", () => {
        const a = create(1, 2);
        const b = create(4, 6);

        expect(distanceTo(a, b)).toBeCloseTo(5);
        expect(distanceSquared(a, b)).toBe(25);
        expect(length(create(3, 4))).toBe(5);
        expect(lengthSquared(create(3, 4))).toBe(25);
        expect(dot(create(1, 0), create(0, 1))).toBe(0);
        expect(dot(create(2, 3), create(4, 5))).toBe(23);

        const out = create();
        lerp(out, create(0, 0), create(10, 20), 0.5);
        expect(out).toEqual({ x: 5, y: 10 });
        expect(equals(out, create(5, 10))).toBe(true);
    });

    it("supports self-mutating vector operations", () => {
        const v = create(2, 3);
        addSelf(v, create(1, 1));
        expect(v).toEqual({ x: 3, y: 4 });

        normalizeSelf(v);
        expect(v.x).toBeCloseTo(0.6);
        expect(v.y).toBeCloseTo(0.8);

        multiplySelf(v, create(10, 10));
        expect(v.x).toBeCloseTo(6);
        expect(v.y).toBeCloseTo(8);

        scaleSelf(v, 0.5);
        expect(v.x).toBeCloseTo(3);
        expect(v.y).toBeCloseTo(4);

        subtractSelf(v, create(1, 2));
        expect(v.x).toBeCloseTo(2);
        expect(v.y).toBeCloseTo(2);
    });
});
