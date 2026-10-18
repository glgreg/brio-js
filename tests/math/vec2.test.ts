import { describe, it, expect } from "vitest";
import {
    create,
    add,
    multiply,
    normalize,
    clamp,
    distanceTo,
    addSelf,
    multiplySelf,
    normalizeSelf,
} from "../../src/math/vec2";

describe("vec2", () => {
    it("creates a Vec2 with default and custom coordinates", () => {
        expect(create()).toEqual({ x: 0, y: 0 });
        expect(create(3, -4)).toEqual({ x: 3, y: -4 });
    });

    it("adds and multiplies vectors into an output vector", () => {
        const out = create();
        const a = create(2, 3);
        const b = create(4, 5);

        expect(add(out, a, b)).toEqual({ x: 6, y: 8 });
        expect(out).toEqual({ x: 6, y: 8 });

        expect(multiply(out, a, b)).toEqual({ x: 8, y: 15 });
        expect(out).toEqual({ x: 8, y: 15 });
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

    it("calculates Euclidean distance between two vectors without corrupting inputs", () => {
        const a = create(1, 2);
        const b = create(4, 6);

        const dist = distanceTo(a, b);
        expect(dist).toBeCloseTo(5);
        expect(a).toEqual({ x: 1, y: 2 });
        expect(b).toEqual({ x: 4, y: 6 });
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
    });
});
