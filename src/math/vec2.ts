// #region TYPES-INTERFACES

/**
 * Represents a 2D numeric vector with `x` and `y` components.
 */
export interface Vec2 {
    x: number;
    y: number;
}

/**
 * Represents a 2D boolean vector with `x` and `y` flags.
 */
export interface Vec2Bool {
    x: boolean;
    y: boolean;
}

/**
 * Reactive atomic 2D vector that notifies an optional callback whenever `x` or `y` is mutated.
 * Prevents stale derived state when users mutate individual vector components (`vec.x = 2`).
 */
export class BrioVec2 implements Vec2 {
    #x: number;
    #y: number;
    #onChange?: (x: number, y: number) => void;

    /**
     * @param x Initial X component
     * @param y Initial Y component
     * @param onChange Optional callback invoked whenever `x` or `y` changes
     */
    constructor(x: number = 0, y: number = 0, onChange?: (x: number, y: number) => void) {
        this.#x = x;
        this.#y = y;
        this.#onChange = onChange;
    }

    public get x(): number {
        return this.#x;
    }

    public set x(value: number) {
        this.#x = value;
        if (this.#onChange) this.#onChange(this.#x, this.#y);
    }

    public get y(): number {
        return this.#y;
    }

    public set y(value: number) {
        this.#y = value;
        if (this.#onChange) this.#onChange(this.#x, this.#y);
    }

    /**
     * Updates both components simultaneously and triggers the change listener once.
     * @param x New X component
     * @param y New Y component
     */
    public set(x: number, y: number): this {
        this.#x = x;
        this.#y = y;
        if (this.#onChange) this.#onChange(this.#x, this.#y);
        return this;
    }

    /**
     * Updates both components without triggering the change listener.
     * @param x New X component
     * @param y New Y component
     */
    public setSilent(x: number, y: number): this {
        this.#x = x;
        this.#y = y;
        return this;
    }
}

// #endregion TYPES-INTERFACES

/**
 * Creates a new plain 2D vector object.
 * @param x Initial X coordinate (defaults to 0)
 * @param y Initial Y coordinate (defaults to 0)
 * @returns A new `Vec2` instance
 */
export function create(x: number = 0, y: number = 0): Vec2 {
    return { x: x, y: y };
}

/**
 * Multiplies two vectors component-wise and stores the result in `out`.
 * @param out Target vector to receive the result
 * @param a First operand vector
 * @param b Second operand vector
 * @returns The mutated `out` vector
 */
export function multiply(out: Vec2, a: Readonly<Vec2>, b: Readonly<Vec2>): Vec2 {
    out.x = a.x * b.x;
    out.y = a.y * b.y;
    return out;
}

/**
 * Adds two vectors component-wise and stores the result in `out`.
 * @param out Target vector to receive the result
 * @param a First operand vector
 * @param b Second operand vector
 * @returns The mutated `out` vector
 */
export function add(out: Vec2, a: Readonly<Vec2>, b: Readonly<Vec2>): Vec2 {
    out.x = a.x + b.x;
    out.y = a.y + b.y;
    return out;
}

/**
 * Normalizes vector `v` to unit length and writes the result into `out`.
 * Safely sets `(0, 0)` when `v` has zero magnitude.
 * @param out Target vector to receive the normalized components
 * @param v Input vector to normalize
 * @returns The mutated `out` vector
 */
export function normalize(out: Vec2, v: Readonly<Vec2>): Vec2 {
    const magnitude = Math.hypot(v.x, v.y);

    if (magnitude === 0) {
        out.x = 0;
        out.y = 0;
    } else {
        out.x = v.x / magnitude;
        out.y = v.y / magnitude;
    }
    return out;
}

/**
 * Clamps the components of `out` within `[min, max]`.
 * @param out Target vector to clamp in-place
 * @param min Minimum component bounds
 * @param max Maximum component bounds
 * @returns The clamped `out` vector
 */
export function clamp(out: Vec2, min: Readonly<Vec2>, max: Readonly<Vec2>): Vec2 | undefined {
    if (min.x > max.x || min.y > max.y) return undefined;

    out.x = Math.max(min.x, Math.min(max.x, out.x));
    out.y = Math.max(min.y, Math.min(max.y, out.y));
    return out;
}

/**
 * Calculates the Euclidean distance between two 2D vectors without mutating either input.
 * @param a First point vector
 * @param b Second point vector
 * @returns Scalar Euclidean distance between `a` and `b`
 */
export function distanceTo(a: Readonly<Vec2>, b: Readonly<Vec2>): number {
    return Math.hypot(b.x - a.x, b.y - a.y);
}

// Vec2 self mutating functions
// #region VEC2-SELF

/**
 * Multiplies `self` in-place by vector `v`.
 * @param self Vector to mutate
 * @param v Multiplier vector
 * @returns The mutated `self` vector
 */
export function multiplySelf(self: Vec2, v: Readonly<Vec2>): Vec2 {
    return multiply(self, self, v);
}

/**
 * Adds vector `v` in-place to `self`.
 * @param self Vector to mutate
 * @param v Vector to add
 * @returns The mutated `self` vector
 */
export function addSelf(self: Vec2, v: Readonly<Vec2>): Vec2 {
    return add(self, self, v);
}

/**
 * Normalizes `self` in-place to unit length.
 * @param self Vector to normalize
 * @returns The mutated `self` vector
 */
export function normalizeSelf(self: Vec2): Vec2 {
    return normalize(self, self);
}

// #endregion VEC2-SELF
