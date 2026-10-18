// #region TYPES-INTERFACES

/**
 * Represents a 2D numeric vector with `x` and `y` components.
 *
 * @example
 * ```ts
 * const pos: Vec2 = { x: 120, y: 240 };
 * ```
 */
export interface Vec2 {
    /** Horizontal coordinate or component. */
    x: number;
    /** Vertical coordinate or component. */
    y: number;
}

/**
 * Represents a 2D boolean vector with `x` and `y` flags.
 *
 * @example
 * ```ts
 * const flip: Vec2Bool = { x: true, y: false };
 * ```
 */
export interface Vec2Bool {
    /** Horizontal boolean flag. */
    x: boolean;
    /** Vertical boolean flag. */
    y: boolean;
}

/**
 * Reactive atomic 2D vector that notifies an optional callback whenever `x` or `y` is mutated.
 * Prevents stale derived state when users mutate individual vector components (`vec.x = 2`).
 *
 * @example
 * ```ts
 * const scale = new BrioVec2(1, 1, (x, y) => {
 *     console.log(`Scale changed to (${x}, ${y})`);
 * });
 * scale.x = 2; // Triggers callback with (2, 1)
 * ```
 */
export class BrioVec2 implements Vec2 {
    #x: number;
    #y: number;
    #buffer?: Float32Array;
    #offset: number = 0;
    #onChange?: (x: number, y: number) => void;

    /** Horizontal component of the vector. */
    declare public x: number;

    /** Vertical component of the vector. */
    declare public y: number;

    /**
     * Creates a reactive `BrioVec2` instance.
     *
     * @param x Initial X component (defaults to `0`)
     * @param y Initial Y component (defaults to `0`)
     * @param onChange Optional callback invoked whenever `x` or `y` changes
     */
    constructor(x: number = 0, y: number = 0, onChange?: (x: number, y: number) => void) {
        this.#x = x;
        this.#y = y;
        this.#onChange = onChange;

        Object.defineProperties(this, {
            x: {
                enumerable: true,
                configurable: true,
                get: (): number => (this.#buffer ? this.#buffer[this.#offset] : this.#x),
                set: (value: number): void => {
                    this.#x = value;
                    if (this.#buffer) this.#buffer[this.#offset] = value;
                    if (this.#onChange) this.#onChange(this.x, this.y);
                },
            },
            y: {
                enumerable: true,
                configurable: true,
                get: (): number => (this.#buffer ? this.#buffer[this.#offset + 1] : this.#y),
                set: (value: number): void => {
                    this.#y = value;
                    if (this.#buffer) this.#buffer[this.#offset + 1] = value;
                    if (this.#onChange) this.#onChange(this.x, this.y);
                },
            },
        });
    }

    /**
     * Binds this vector directly to a 2-float slot in an ECS `Float32Array` buffer.
     *
     * @param buffer Target `Float32Array` component storage
     * @param offset Starting index in `buffer` (`offset`, `offset + 1`)
     * @returns This `BrioVec2` instance
     */
    public bindBuffer(buffer: Float32Array, offset: number): this {
        this.#buffer = buffer;
        this.#offset = offset;
        this.#buffer[offset] = this.#x;
        this.#buffer[offset + 1] = this.#y;
        return this;
    }

    /**
     * Updates both components simultaneously and triggers the change listener once.
     *
     * @param x New X component
     * @param y New Y component
     * @returns This `BrioVec2` instance for chaining
     * @example
     * ```ts
     * vec.set(64, 128);
     * ```
     */
    public set(x: number, y: number): this {
        this.#x = x;
        this.#y = y;
        if (this.#buffer) {
            this.#buffer[this.#offset] = x;
            this.#buffer[this.#offset + 1] = y;
        }
        if (this.#onChange) this.#onChange(x, y);
        return this;
    }

    /**
     * Copies `x` and `y` from another `Vec2` into this instance and triggers the change listener once.
     *
     * @param v Source 2D vector
     * @returns This `BrioVec2` instance
     */
    public copy(v: Vec2): this {
        return this.set(v.x, v.y);
    }

    /**
     * Updates both components without triggering the change listener.
     * Used internally to sanitize values inside an `onChange` hook without infinite recursion.
     *
     * @param x New X component
     * @param y New Y component
     * @returns This `BrioVec2` instance for chaining
     */
    public setSilent(x: number, y: number): this {
        this.#x = x;
        this.#y = y;
        if (this.#buffer) {
            this.#buffer[this.#offset] = x;
            this.#buffer[this.#offset + 1] = y;
        }
        return this;
    }
}

// #endregion TYPES-INTERFACES

/**
 * Creates a new plain 2D vector object.
 *
 * @param x Initial X coordinate (defaults to `0`)
 * @param y Initial Y coordinate (defaults to `0`)
 * @returns A new `Vec2` instance
 * @example
 * ```ts
 * const velocity = Vector2.create(10, -5);
 * ```
 */
export function create(x: number = 0, y: number = 0): Vec2 {
    return { x: x, y: y };
}

/**
 * Clones a 2D vector into a new plain `Vec2` object.
 *
 * @param v Source vector to clone
 * @returns A new `Vec2` with the same `x` and `y` values
 * @example
 * ```ts
 * const copy = Vector2.clone(player.transform.position);
 * ```
 */
export function clone(v: Readonly<Vec2>): Vec2 {
    return { x: v.x, y: v.y };
}

/**
 * Copies the components of `v` into `out`.
 *
 * @param out Target vector to receive the values
 * @param v Source vector
 * @returns The mutated `out` vector
 * @example
 * ```ts
 * Vector2.copy(targetPos, player.transform.position);
 * ```
 */
export function copy(out: Vec2, v: Readonly<Vec2>): Vec2 {
    out.x = v.x;
    out.y = v.y;
    return out;
}

/**
 * Resets both components of `out` to `0`.
 *
 * @param out Target vector to zero out
 * @returns The mutated `out` vector
 * @example
 * ```ts
 * Vector2.zero(velocity);
 * ```
 */
export function zero(out: Vec2): Vec2 {
    out.x = 0;
    out.y = 0;
    return out;
}

/**
 * Multiplies two vectors component-wise and stores the result in `out`.
 *
 * @param out Target vector to receive the result
 * @param a First operand vector
 * @param b Second operand vector
 * @returns The mutated `out` vector
 * @example
 * ```ts
 * Vector2.multiply(out, { x: 2, y: 3 }, { x: 4, y: 5 }); // { x: 8, y: 15 }
 * ```
 */
export function multiply(out: Vec2, a: Readonly<Vec2>, b: Readonly<Vec2>): Vec2 {
    out.x = a.x * b.x;
    out.y = a.y * b.y;
    return out;
}

/**
 * Scales vector `a` by scalar `s` and stores the result in `out`.
 *
 * @param out Target vector to receive the result
 * @param a Input vector
 * @param s Scalar multiplier
 * @returns The mutated `out` vector
 * @example
 * ```ts
 * Vector2.scale(out, direction, speed * dt);
 * ```
 */
export function scale(out: Vec2, a: Readonly<Vec2>, s: number): Vec2 {
    out.x = a.x * s;
    out.y = a.y * s;
    return out;
}

/**
 * Adds two vectors component-wise and stores the result in `out`.
 *
 * @param out Target vector to receive the result
 * @param a First operand vector
 * @param b Second operand vector
 * @returns The mutated `out` vector
 * @example
 * ```ts
 * Vector2.add(out, position, velocity);
 * ```
 */
export function add(out: Vec2, a: Readonly<Vec2>, b: Readonly<Vec2>): Vec2 {
    out.x = a.x + b.x;
    out.y = a.y + b.y;
    return out;
}

/**
 * Subtracts vector `b` from vector `a` (`a - b`) and stores the result in `out`.
 *
 * @param out Target vector to receive the result
 * @param a Minuend vector
 * @param b Subtrahend vector
 * @returns The mutated `out` vector
 * @example
 * ```ts
 * Vector2.subtract(dir, targetPos, playerPos);
 * ```
 */
export function subtract(out: Vec2, a: Readonly<Vec2>, b: Readonly<Vec2>): Vec2 {
    out.x = a.x - b.x;
    out.y = a.y - b.y;
    return out;
}

/**
 * Computes the dot product of two 2D vectors.
 *
 * @param a First vector
 * @param b Second vector
 * @returns Scalar dot product (`a.x * b.x + a.y * b.y`)
 * @example
 * ```ts
 * const d = Vector2.dot({ x: 1, y: 0 }, { x: 0, y: 1 }); // 0
 * ```
 */
export function dot(a: Readonly<Vec2>, b: Readonly<Vec2>): number {
    return a.x * b.x + a.y * b.y;
}

/**
 * Computes the Euclidean length (magnitude) of vector `v`.
 *
 * @param v Input vector
 * @returns Scalar length of `v`
 * @example
 * ```ts
 * const len = Vector2.length({ x: 3, y: 4 }); // 5
 * ```
 */
export function length(v: Readonly<Vec2>): number {
    return Math.hypot(v.x, v.y);
}

/**
 * Computes the squared length of vector `v` (faster than `length` by avoiding `Math.hypot`).
 *
 * @param v Input vector
 * @returns Squared magnitude (`v.x * v.x + v.y * v.y`)
 * @example
 * ```ts
 * const lenSq = Vector2.lengthSquared({ x: 3, y: 4 }); // 25
 * ```
 */
export function lengthSquared(v: Readonly<Vec2>): number {
    return v.x * v.x + v.y * v.y;
}

/**
 * Normalizes vector `v` to unit length and writes the result into `out`.
 * Safely sets `(0, 0)` when `v` has zero magnitude.
 *
 * @param out Target vector to receive the normalized components
 * @param v Input vector to normalize
 * @returns The mutated `out` vector
 * @example
 * ```ts
 * Vector2.normalize(dir, { x: 3, y: 4 }); // { x: 0.6, y: 0.8 }
 * ```
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
 *
 * @param out Target vector to clamp in-place
 * @param min Minimum component bounds
 * @param max Maximum component bounds
 * @returns The clamped `out` vector, or `undefined` if `min` exceeds `max`
 * @example
 * ```ts
 * Vector2.clamp(pos, { x: 0, y: 0 }, { x: 640, y: 480 });
 * ```
 */
export function clamp(out: Vec2, min: Readonly<Vec2>, max: Readonly<Vec2>): Vec2 | undefined {
    if (min.x > max.x || min.y > max.y) return undefined;

    out.x = Math.max(min.x, Math.min(max.x, out.x));
    out.y = Math.max(min.y, Math.min(max.y, out.y));
    return out;
}

/**
 * Calculates the Euclidean distance between two 2D vectors without mutating either input.
 *
 * @param a First point vector
 * @param b Second point vector
 * @returns Scalar Euclidean distance between `a` and `b`
 * @example
 * ```ts
 * const dist = Vector2.distanceTo(player.transform.position, enemy.transform.position);
 * ```
 */
export function distanceTo(a: Readonly<Vec2>, b: Readonly<Vec2>): number {
    return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Calculates the squared Euclidean distance between two 2D vectors.
 *
 * @param a First point vector
 * @param b Second point vector
 * @returns Squared distance between `a` and `b`
 * @example
 * ```ts
 * const distSq = Vector2.distanceSquared(a, b);
 * ```
 */
export function distanceSquared(a: Readonly<Vec2>, b: Readonly<Vec2>): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return dx * dx + dy * dy;
}

/**
 * Linearly interpolates between vectors `a` and `b` by factor `t` and writes the result into `out`.
 *
 * @param out Target vector to receive the interpolated result
 * @param a Starting vector (`t === 0`)
 * @param b Ending vector (`t === 1`)
 * @param t Interpolation factor
 * @returns The mutated `out` vector
 * @example
 * ```ts
 * Vector2.lerp(cameraPos, cameraPos, targetPos, 0.1);
 * ```
 */
export function lerp(out: Vec2, a: Readonly<Vec2>, b: Readonly<Vec2>, t: number): Vec2 {
    out.x = a.x + (b.x - a.x) * t;
    out.y = a.y + (b.y - a.y) * t;
    return out;
}

/**
 * Checks whether two 2D vectors are approximately equal within `epsilon`.
 *
 * @param a First vector
 * @param b Second vector
 * @param epsilon Allowed component tolerance (defaults to `1e-5`)
 * @returns `true` if both components are within `epsilon`
 * @example
 * ```ts
 * const same = Vector2.equals({ x: 1, y: 2 }, { x: 1, y: 2 }); // true
 * ```
 */
export function equals(a: Readonly<Vec2>, b: Readonly<Vec2>, epsilon: number = 1e-5): boolean {
    return Math.abs(a.x - b.x) <= epsilon && Math.abs(a.y - b.y) <= epsilon;
}

// Vec2 self mutating functions
// #region VEC2-SELF

/**
 * Multiplies `self` in-place by vector `v`.
 *
 * @param self Vector to mutate
 * @param v Multiplier vector
 * @returns The mutated `self` vector
 * @example
 * ```ts
 * Vector2.multiplySelf(velocity, { x: 0.9, y: 0.9 });
 * ```
 */
export function multiplySelf(self: Vec2, v: Readonly<Vec2>): Vec2 {
    return multiply(self, self, v);
}

/**
 * Scales `self` in-place by scalar `s`.
 *
 * @param self Vector to mutate
 * @param s Scalar factor
 * @returns The mutated `self` vector
 * @example
 * ```ts
 * Vector2.scaleSelf(velocity, 0.5);
 * ```
 */
export function scaleSelf(self: Vec2, s: number): Vec2 {
    return scale(self, self, s);
}

/**
 * Adds vector `v` in-place to `self`.
 *
 * @param self Vector to mutate
 * @param v Vector to add
 * @returns The mutated `self` vector
 * @example
 * ```ts
 * Vector2.addSelf(position, velocity);
 * ```
 */
export function addSelf(self: Vec2, v: Readonly<Vec2>): Vec2 {
    return add(self, self, v);
}

/**
 * Subtracts vector `v` in-place from `self`.
 *
 * @param self Vector to mutate
 * @param v Vector to subtract
 * @returns The mutated `self` vector
 * @example
 * ```ts
 * Vector2.subtractSelf(position, offset);
 * ```
 */
export function subtractSelf(self: Vec2, v: Readonly<Vec2>): Vec2 {
    return subtract(self, self, v);
}

/**
 * Normalizes `self` in-place to unit length.
 *
 * @param self Vector to normalize
 * @returns The mutated `self` vector
 * @example
 * ```ts
 * Vector2.normalizeSelf(direction);
 * ```
 */
export function normalizeSelf(self: Vec2): Vec2 {
    return normalize(self, self);
}

// #endregion VEC2-SELF

