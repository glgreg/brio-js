// #region TYPES-INTERFACES

/**
 * Represents a 3D numeric vector with `x`, `y`, and `z` components.
 *
 * @example
 * ```ts
 * const pos: Vec3 = { x: 0, y: 10, z: -25 };
 * ```
 */
export interface Vec3 {
    /** Horizontal (X-axis) coordinate or component. */
    x: number;
    /** Vertical (Y-axis) coordinate or component. */
    y: number;
    /** Depth (Z-axis) coordinate or component. */
    z: number;
}

/**
 * Represents a 3D boolean vector with `x`, `y`, and `z` flags.
 *
 * @example
 * ```ts
 * const lockAxes: Vec3Bool = { x: false, y: true, z: false };
 * ```
 */
export interface Vec3Bool {
    /** X-axis boolean flag. */
    x: boolean;
    /** Y-axis boolean flag. */
    y: boolean;
    /** Z-axis boolean flag. */
    z: boolean;
}

/**
 * Reactive atomic 3D vector that notifies an optional callback whenever `x`, `y`, or `z` is mutated.
 * Can optionally bind directly to a contiguous `Float32Array` slice inside `ComponentStorage` (ECS SoA)
 * for zero-overhead memory synchronization.
 *
 * @example
 * ```ts
 * const position = new BrioVec3(0, 5, -10, (x, y, z) => {
 *     console.log(`Moved to (${x}, ${y}, ${z})`);
 * });
 * position.z = -20; // Triggers callback with (0, 5, -20)
 * ```
 */
export class BrioVec3 implements Vec3 {
    #x: number;
    #y: number;
    #z: number;
    #buffer?: Float32Array;
    #offset: number = 0;
    #onChange?: (x: number, y: number, z: number) => void;

    /** Horizontal (X-axis) component of the vector. */
    declare public x: number;

    /** Vertical (Y-axis) component of the vector. */
    declare public y: number;

    /** Depth (Z-axis) component of the vector. */
    declare public z: number;

    /**
     * Creates a reactive `BrioVec3` instance.
     *
     * @param x Initial X component (defaults to `0`)
     * @param y Initial Y component (defaults to `0`)
     * @param z Initial Z component (defaults to `0`)
     * @param onChange Optional callback invoked whenever `x`, `y`, or `z` changes
     */
    constructor(
        x: number = 0,
        y: number = 0,
        z: number = 0,
        onChange?: (x: number, y: number, z: number) => void,
    ) {
        this.#x = x;
        this.#y = y;
        this.#z = z;
        this.#onChange = onChange;

        Object.defineProperties(this, {
            x: {
                enumerable: true,
                configurable: true,
                get: (): number => (this.#buffer ? this.#buffer[this.#offset] : this.#x),
                set: (value: number): void => {
                    this.#x = value;
                    if (this.#buffer) this.#buffer[this.#offset] = value;
                    if (this.#onChange) this.#onChange(this.x, this.y, this.z);
                },
            },
            y: {
                enumerable: true,
                configurable: true,
                get: (): number => (this.#buffer ? this.#buffer[this.#offset + 1] : this.#y),
                set: (value: number): void => {
                    this.#y = value;
                    if (this.#buffer) this.#buffer[this.#offset + 1] = value;
                    if (this.#onChange) this.#onChange(this.x, this.y, this.z);
                },
            },
            z: {
                enumerable: true,
                configurable: true,
                get: (): number => (this.#buffer ? this.#buffer[this.#offset + 2] : this.#z),
                set: (value: number): void => {
                    this.#z = value;
                    if (this.#buffer) this.#buffer[this.#offset + 2] = value;
                    if (this.#onChange) this.#onChange(this.x, this.y, this.z);
                },
            },
        });
    }

    /**
     * Binds this vector directly to a 3-float slot in an ECS `Float32Array` buffer.
     * Copies current local values into the buffer slot upon binding, unless `adopt` is `true`.
     *
     * @param buffer Target `Float32Array` component storage
     * @param offset Starting index in `buffer` (`offset`, `offset + 1`, `offset + 2`)
     * @param adopt When `true`, reads the current slot values into this vector instead of overwriting the slot (defaults to `false`)
     * @returns This `BrioVec3` instance
     * @example
     * ```ts
     * const buf = new Float32Array(3);
     * const v = new BrioVec3(1, 2, 3).bindBuffer(buf, 0);
     * ```
     */
    public bindBuffer(buffer: Float32Array, offset: number, adopt: boolean = false): this {
        this.#buffer = buffer;
        this.#offset = offset;
        if (adopt) {
            this.#x = buffer[offset];
            this.#y = buffer[offset + 1];
            this.#z = buffer[offset + 2];
        } else {
            buffer[offset] = this.#x;
            buffer[offset + 1] = this.#y;
            buffer[offset + 2] = this.#z;
        }
        return this;
    }

    /**
     * Detaches this vector from its ECS buffer slot, keeping the last slot values as local state.
     * Subsequent writes no longer touch the (possibly recycled) slot.
     *
     * @returns This `BrioVec3` instance
     * @example
     * ```ts
     * position.unbindBuffer();
     * ```
     */
    public unbindBuffer(): this {
        if (this.#buffer) {
            this.#x = this.#buffer[this.#offset];
            this.#y = this.#buffer[this.#offset + 1];
            this.#z = this.#buffer[this.#offset + 2];
            this.#buffer = undefined;
        }
        return this;
    }

    /**
     * Updates all three components simultaneously and triggers the change listener once.
     *
     * @param x New X component
     * @param y New Y component
     * @param z New Z component
     * @returns This `BrioVec3` instance for chaining
     * @example
     * ```ts
     * vec.set(10, 20, 30);
     * ```
     */
    public set(x: number, y: number, z: number): this {
        this.#x = x;
        this.#y = y;
        this.#z = z;
        if (this.#buffer) {
            this.#buffer[this.#offset] = x;
            this.#buffer[this.#offset + 1] = y;
            this.#buffer[this.#offset + 2] = z;
        }
        if (this.#onChange) this.#onChange(x, y, z);
        return this;
    }

    /**
     * Copies `x`, `y`, and `z` from another `Vec3` into this instance and triggers the change listener once.
     *
     * @param v Source 3D vector
     * @returns This `BrioVec3` instance for chaining
     * @example
     * ```ts
     * vec.copy({ x: 5, y: 10, z: 15 });
     * ```
     */
    public copy(v: Vec3): this {
        return this.set(v.x, v.y, v.z);
    }
}

// #endregion

// #region FUNCTIONS

/**
 * Creates a new plain `Vec3` object.
 *
 * @param x Initial X component (defaults to `0`)
 * @param y Initial Y component (defaults to `0`)
 * @param z Initial Z component (defaults to `0`)
 * @returns Newly allocated `Vec3`
 * @example
 * ```ts
 * const v = Vector3.create(1, 2, 3);
 * ```
 */
export function create(x: number = 0, y: number = 0, z: number = 0): Vec3 {
    return { x, y, z };
}

/**
 * Creates an independent shallow copy of a `Vec3`.
 *
 * @param v Source vector to clone
 * @returns Cloned `Vec3`
 * @example
 * ```ts
 * const copyVec = Vector3.clone(original);
 * ```
 */
export function clone(v: Vec3): Vec3 {
    return { x: v.x, y: v.y, z: v.z };
}

/**
 * Copies the components of `v` into `out`.
 *
 * @param out Destination vector
 * @param v Source vector
 * @returns `out`
 * @example
 * ```ts
 * Vector3.copy(target, source);
 * ```
 */
export function copy(out: Vec3, v: Vec3): Vec3 {
    out.x = v.x;
    out.y = v.y;
    out.z = v.z;
    return out;
}

/**
 * Resets all components of `out` to `0`.
 *
 * @param out Target vector to zero out
 * @returns `out`
 * @example
 * ```ts
 * Vector3.zero(velocity);
 * ```
 */
export function zero(out: Vec3): Vec3 {
    out.x = 0;
    out.y = 0;
    out.z = 0;
    return out;
}

/**
 * Adds two 3D vectors `a` and `b` component-wise and stores the result in `out`.
 *
 * @param out Destination vector receiving `a + b`
 * @param a First operand vector
 * @param b Second operand vector
 * @returns `out`
 * @example
 * ```ts
 * Vector3.add(out, pos, velocity);
 * ```
 */
export function add(out: Vec3, a: Vec3, b: Vec3): Vec3 {
    out.x = a.x + b.x;
    out.y = a.y + b.y;
    out.z = a.z + b.z;
    return out;
}

/**
 * Subtracts vector `b` from vector `a` (`a - b`) and stores the result in `out`.
 *
 * @param out Destination vector receiving `a - b`
 * @param a Minuend vector
 * @param b Subtrahend vector
 * @returns `out`
 * @example
 * ```ts
 * Vector3.subtract(offset, targetPos, originPos);
 * ```
 */
export function subtract(out: Vec3, a: Vec3, b: Vec3): Vec3 {
    out.x = a.x - b.x;
    out.y = a.y - b.y;
    out.z = a.z - b.z;
    return out;
}

/**
 * Multiplies two 3D vectors `a` and `b` component-wise (Hadamard product) into `out`.
 *
 * @param out Destination vector receiving `a * b`
 * @param a First operand vector
 * @param b Second operand vector
 * @returns `out`
 * @example
 * ```ts
 * Vector3.multiply(worldScale, parentScale, localScale);
 * ```
 */
export function multiply(out: Vec3, a: Vec3, b: Vec3): Vec3 {
    out.x = a.x * b.x;
    out.y = a.y * b.y;
    out.z = a.z * b.z;
    return out;
}

/**
 * Multiplies vector `v` by a scalar `s` and stores the result in `out`.
 *
 * @param out Destination vector receiving `v * s`
 * @param v Input vector
 * @param s Scalar multiplier
 * @returns `out`
 * @example
 * ```ts
 * Vector3.scale(step, direction, speed * dt);
 * ```
 */
export function scale(out: Vec3, v: Vec3, s: number): Vec3 {
    out.x = v.x * s;
    out.y = v.y * s;
    out.z = v.z * s;
    return out;
}

/**
 * Normalizes vector `v` into a unit vector of length `1` and writes the result to `out`.
 * If `v` has zero length, `out` is set to `{ x: 0, y: 0, z: 0 }`.
 *
 * @param out Destination vector receiving the unit vector
 * @param v Input vector to normalize
 * @returns `out`
 * @example
 * ```ts
 * const dir = Vector3.create();
 * Vector3.normalize(dir, Vector3.create(0, 3, 4)); // { x: 0, y: 0.6, z: 0.8 }
 * ```
 */
export function normalize(out: Vec3, v: Vec3): Vec3 {
    const len = Math.hypot(v.x, v.y, v.z);
    if (len > 0) {
        out.x = v.x / len;
        out.y = v.y / len;
        out.z = v.z / len;
    } else {
        out.x = 0;
        out.y = 0;
        out.z = 0;
    }
    return out;
}

/**
 * Clamps the components of `out` within the range defined by `min` and `max`.
 *
 * @param out Target vector whose components will be clamped in place
 * @param min Minimum component bounds
 * @param max Maximum component bounds
 * @returns `out`
 * @example
 * ```ts
 * Vector3.clamp(pos, { x: -10, y: 0, z: -10 }, { x: 10, y: 50, z: 10 });
 * ```
 */
export function clamp(out: Vec3, min: Vec3, max: Vec3): Vec3 {
    out.x = Math.max(min.x, Math.min(max.x, out.x));
    out.y = Math.max(min.y, Math.min(max.y, out.y));
    out.z = Math.max(min.z, Math.min(max.z, out.z));
    return out;
}

/**
 * Computes the scalar dot product of two 3D vectors `a` and `b`.
 *
 * @param a First vector
 * @param b Second vector
 * @returns Dot product (`a.x * b.x + a.y * b.y + a.z * b.z`)
 * @example
 * ```ts
 * const alignment = Vector3.dot(forward, toTarget);
 * ```
 */
export function dot(a: Vec3, b: Vec3): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * Computes the 3D cross product `a × b` orthogonal to both `a` and `b` and writes it to `out`.
 * Safe for in-place use when `out === a` or `out === b`.
 *
 * @param out Destination vector receiving `a × b`
 * @param a First operand vector
 * @param b Second operand vector
 * @returns `out`
 * @example
 * ```ts
 * const up = Vector3.create();
 * Vector3.cross(up, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }); // { x: 0, y: 1, z: 0 }
 * ```
 */
export function cross(out: Vec3, a: Vec3, b: Vec3): Vec3 {
    const ax = a.x,
        ay = a.y,
        az = a.z;
    const bx = b.x,
        by = b.y,
        bz = b.z;
    out.x = ay * bz - az * by;
    out.y = az * bx - ax * bz;
    out.z = ax * by - ay * bx;
    return out;
}

/**
 * Computes the Euclidean magnitude (length) of vector `v`.
 *
 * @param v Input vector
 * @returns Euclidean length $\sqrt{x^2 + y^2 + z^2}$
 * @example
 * ```ts
 * const speed = Vector3.length(velocity);
 * ```
 */
export function length(v: Vec3): number {
    return Math.hypot(v.x, v.y, v.z);
}

/**
 * Computes the squared magnitude of vector `v` without a square-root operation.
 *
 * @param v Input vector
 * @returns Squared length ($x^2 + y^2 + z^2$)
 * @example
 * ```ts
 * const lenSq = Vector3.lengthSquared(velocity);
 * ```
 */
export function lengthSquared(v: Vec3): number {
    return v.x * v.x + v.y * v.y + v.z * v.z;
}

/**
 * Computes the Euclidean distance between points `a` and `b`.
 *
 * @param a First point
 * @param b Second point
 * @returns Scalar distance between `a` and `b`
 * @example
 * ```ts
 * const dist = Vector3.distanceTo(playerPos, enemyPos);
 * ```
 */
export function distanceTo(a: Vec3, b: Vec3): number {
    return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}

/**
 * Computes the squared Euclidean distance between points `a` and `b`.
 *
 * @param a First point
 * @param b Second point
 * @returns Squared distance between `a` and `b`
 * @example
 * ```ts
 * const distSq = Vector3.distanceSquared(a, b);
 * ```
 */
export function distanceSquared(a: Vec3, b: Vec3): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    return dx * dx + dy * dy + dz * dz;
}

/**
 * Linearly interpolates between vectors `a` and `b` by factor `t` and stores the result in `out`.
 *
 * @param out Destination vector
 * @param a Start vector (`t === 0`)
 * @param b End vector (`t === 1`)
 * @param t Interpolation factor
 * @returns `out`
 * @example
 * ```ts
 * Vector3.lerp(cameraPos, cameraPos, targetPos, 0.1);
 * ```
 */
export function lerp(out: Vec3, a: Vec3, b: Vec3, t: number): Vec3 {
    out.x = a.x + (b.x - a.x) * t;
    out.y = a.y + (b.y - a.y) * t;
    out.z = a.z + (b.z - a.z) * t;
    return out;
}

/**
 * Checks whether two 3D vectors `a` and `b` are approximately equal within `epsilon`.
 *
 * @param a First vector
 * @param b Second vector
 * @param epsilon Allowed tolerance per component (defaults to `1e-5`)
 * @returns `true` if all three components are within `epsilon`
 * @example
 * ```ts
 * const same = Vector3.equals(v1, v2);
 * ```
 */
export function equals(a: Vec3, b: Vec3, epsilon: number = 1e-5): boolean {
    return (
        Math.abs(a.x - b.x) <= epsilon &&
        Math.abs(a.y - b.y) <= epsilon &&
        Math.abs(a.z - b.z) <= epsilon
    );
}

/**
 * Adds vector `a` into `out` in place (`out += a`).
 *
 * @param out Target vector to mutate
 * @param a Vector to add
 * @returns `out`
 * @example
 * ```ts
 * Vector3.addSelf(position, velocity);
 * ```
 */
export function addSelf(out: Vec3, a: Vec3): Vec3 {
    return add(out, out, a);
}

/**
 * Subtracts vector `a` from `out` in place (`out -= a`).
 *
 * @param out Target vector to mutate
 * @param a Vector to subtract
 * @returns `out`
 * @example
 * ```ts
 * Vector3.subtractSelf(position, offset);
 * ```
 */
export function subtractSelf(out: Vec3, a: Vec3): Vec3 {
    return subtract(out, out, a);
}

/**
 * Multiplies `out` component-wise by `a` in place (`out *= a`).
 *
 * @param out Target vector to mutate
 * @param a Multiplier vector
 * @returns `out`
 * @example
 * ```ts
 * Vector3.multiplySelf(scale, factor);
 * ```
 */
export function multiplySelf(out: Vec3, a: Vec3): Vec3 {
    return multiply(out, out, a);
}

/**
 * Scales `out` by scalar `s` in place (`out *= s`).
 *
 * @param out Target vector to mutate
 * @param s Scalar factor
 * @returns `out`
 * @example
 * ```ts
 * Vector3.scaleSelf(velocity, 0.95);
 * ```
 */
export function scaleSelf(out: Vec3, s: number): Vec3 {
    return scale(out, out, s);
}

/**
 * Normalizes `out` in place into a unit vector.
 *
 * @param out Target vector to normalize in place
 * @returns `out`
 * @example
 * ```ts
 * Vector3.normalizeSelf(direction);
 * ```
 */
export function normalizeSelf(out: Vec3): Vec3 {
    return normalize(out, out);
}

// #endregion
