import { describe, it, expect } from "vitest";
import { radToDeg, degToRad, clamp } from "../../src/math/BrioMath";

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
});
