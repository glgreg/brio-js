/**
 * Converts an angle from radians to degrees.
 *
 * @param radValue Angle in radians
 * @returns Angle in degrees
 * @example
 * ```ts
 * const deg = BrioMath.radToDeg(Math.PI); // 180
 * ```
 */
export function radToDeg(radValue: number): number {
    return (radValue * 180) / Math.PI;
}

/**
 * Converts an angle from degrees to radians.
 *
 * @param degValue Angle in degrees
 * @returns Angle in radians
 * @example
 * ```ts
 * const rad = BrioMath.degToRad(90); // Math.PI / 2
 * ```
 */
export function degToRad(degValue: number): number {
    return (degValue * Math.PI) / 180;
}

/**
 * Clamps a numeric `value` within the inclusive range `[min, max]`.
 *
 * @param value Value to clamp
 * @param min Minimum allowed boundary
 * @param max Maximum allowed boundary
 * @returns Clamped value in `[min, max]`
 * @throws {Error} When `min` is strictly greater than `max`
 * @example
 * ```ts
 * const hp = BrioMath.clamp(120, 0, 100); // 100
 * ```
 */
export function clamp(value: number, min: number, max: number): number {
    if (min > max) throw new Error("clamp.min was set to higher than clamp.max");
    return Math.min(Math.max(value, min), max);
}

/**
 * Linearly interpolates between `start` and `end` by factor `t`.
 *
 * @param start Starting value when `t === 0`
 * @param end Ending value when `t === 1`
 * @param t Interpolation factor (typically in `[0, 1]`)
 * @returns Interpolated scalar value
 * @example
 * ```ts
 * const mid = BrioMath.lerp(0, 100, 0.5); // 50
 * ```
 */
export function lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
}

/**
 * Calculates the normalized interpolation factor `t` of `value` within `[start, end]`.
 * Returns `0` when `start === end` to prevent division by zero.
 *
 * @param value Input value inside or outside `[start, end]`
 * @param start Range start
 * @param end Range end
 * @returns Normalized factor `t`
 * @example
 * ```ts
 * const t = BrioMath.inverseLerp(15, 10, 20); // 0.5
 * ```
 */
export function inverseLerp(value: number, start: number, end: number): number {
    if (start === end) return 0;
    return (value - start) / (end - start);
}

/**
 * Remaps `value` proportionally from `[inMin, inMax]` to `[outMin, outMax]`.
 *
 * @param value Input value to remap
 * @param inMin Input range minimum
 * @param inMax Input range maximum
 * @param outMin Output range minimum
 * @param outMax Output range maximum
 * @returns Remapped value in `[outMin, outMax]`
 * @example
 * ```ts
 * const alpha = BrioMath.remap(50, 0, 100, 0, 1); // 0.5
 * ```
 */
export function remap(
    value: number,
    inMin: number,
    inMax: number,
    outMin: number,
    outMax: number,
): number {
    return lerp(outMin, outMax, inverseLerp(value, inMin, inMax));
}

/**
 * Performs Hermite smoothstep interpolation of `value` between `edge0` and `edge1`.
 *
 * @param value Input value to evaluate
 * @param edge0 Lower edge of the transition
 * @param edge1 Upper edge of the transition
 * @returns Smoothly interpolated factor in `[0, 1]`
 * @example
 * ```ts
 * const eased = BrioMath.smoothstep(5, 0, 10); // 0.5
 * ```
 */
export function smoothstep(value: number, edge0: number, edge1: number): number {
    if (edge0 === edge1) return 0;
    const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
}

/**
 * Wraps `value` cyclically within the half-open interval `[min, max)`.
 *
 * @param value Input value to wrap
 * @param min Lower bound (inclusive)
 * @param max Upper bound (exclusive)
 * @returns Wrapped value in `[min, max)`
 * @example
 * ```ts
 * const angle = BrioMath.wrap(370, 0, 360); // 10
 * ```
 */
export function wrap(value: number, min: number, max: number): number {
    const range = max - min;
    if (range <= 0) return min;
    return ((((value - min) % range) + range) % range) + min;
}

/**
 * Checks whether two floating-point numbers `a` and `b` are approximately equal within `epsilon`.
 *
 * @param a First number
 * @param b Second number
 * @param epsilon Allowed tolerance (defaults to `1e-5`)
 * @returns `true` if `|a - b| <= epsilon`
 * @example
 * ```ts
 * const isSame = BrioMath.approxEqual(0.1 + 0.2, 0.3); // true
 * ```
 */
export function approxEqual(a: number, b: number, epsilon: number = 1e-5): boolean {
    return Math.abs(a - b) <= epsilon;
}

/**
 * Generates a random floating-point number in `[min, max)`.
 *
 * @param min Minimum bound (inclusive)
 * @param max Maximum bound (exclusive)
 * @returns Random float in `[min, max)`
 * @example
 * ```ts
 * const speed = BrioMath.randomRange(100, 250);
 * ```
 */
export function randomRange(min: number, max: number): number {
    return min + Math.random() * (max - min);
}

/**
 * Generates a random integer in `[min, max]` (both bounds inclusive).
 *
 * @param min Minimum integer (inclusive)
 * @param max Maximum integer (inclusive)
 * @returns Random integer in `[min, max]`
 * @example
 * ```ts
 * const dice = BrioMath.randomInt(1, 6);
 * ```
 */
export function randomInt(min: number, max: number): number {
    const ceilMin = Math.ceil(min);
    const floorMax = Math.floor(max);
    return Math.floor(Math.random() * (floorMax - ceilMin + 1)) + ceilMin;
}

export const BrioMath = {
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
};

export default BrioMath;

