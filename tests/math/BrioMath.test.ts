import { describe, it, expect } from "vitest";
import {
    radToDeg,
    degToRad,
    clamp,
    lerp,
    inverseLerp,
    remap,
    smoothstep,
    wrap,
    approxEqual,
    randomRange,
    randomInt,
} from "../../src/math/BrioMath";

describe("BrioMath", () => {
    it("converts radians to degrees accurately", () => {
        expect(radToDeg(0)).toBe(0);
        expect(radToDeg(Math.PI)).toBeCloseTo(180);
        expect(radToDeg(Math.PI / 2)).toBeCloseTo(90);
        expect(radToDeg(2 * Math.PI)).toBeCloseTo(360);
    });

    it("converts degrees to radians accurately", () => {
        expect(degToRad(0)).toBe(0);
        expect(degToRad(180)).toBeCloseTo(Math.PI);
        expect(degToRad(90)).toBeCloseTo(Math.PI / 2);
        expect(degToRad(360)).toBeCloseTo(2 * Math.PI);
    });

    it("clamps scalar values within [min, max]", () => {
        expect(clamp(5, 0, 10)).toBe(5);
        expect(clamp(-5, 0, 10)).toBe(0);
        expect(clamp(15, 0, 10)).toBe(10);
        expect(clamp(0, 0, 0)).toBe(0);
    });

    it("throws an error when clamp min is greater than max", () => {
        expect(() => clamp(5, 10, 0)).toThrow("clamp.min was set to higher than clamp.max");
    });

    it("supports lerp, inverseLerp, remap, and smoothstep", () => {
        expect(lerp(0, 100, 0.25)).toBe(25);
        expect(inverseLerp(0, 100, 25)).toBe(0.25);
        expect(inverseLerp(10, 10, 10)).toBe(0);
        expect(remap(50, 0, 100, 0, 1)).toBe(0.5);
        expect(smoothstep(0, 10, -5)).toBe(0);
        expect(smoothstep(0, 10, 5)).toBe(0.5);
        expect(smoothstep(0, 10, 15)).toBe(1);
    });

    it("supports wrap, approxEqual, randomRange, and randomInt", () => {
        expect(wrap(370, 0, 360)).toBe(10);
        expect(wrap(-10, 0, 360)).toBe(350);
        expect(approxEqual(0.1 + 0.2, 0.3)).toBe(true);
        expect(approxEqual(1.0, 1.1)).toBe(false);

        for (let i = 0; i < 20; i++) {
            const r = randomRange(5, 10);
            expect(r).toBeGreaterThanOrEqual(5);
            expect(r).toBeLessThan(10);

            const ri = randomInt(1, 3);
            expect(Number.isInteger(ri)).toBe(true);
            expect(ri).toBeGreaterThanOrEqual(1);
            expect(ri).toBeLessThanOrEqual(3);
        }
    });
});
