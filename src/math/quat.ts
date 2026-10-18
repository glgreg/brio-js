import { Vec3 } from "./vec3";

// #region TYPES-INTERFACES

/**
 * Represents a 3D rotation quaternion `{ x, y, z, w }`.
 * An identity quaternion is `{ x: 0, y: 0, z: 0, w: 1 }`.
 *
 * @example
 * ```ts
 * const q: Quat = { x: 0, y: 0, z: 0, w: 1 };
 * ```
 */
export interface Quat {
    /** X imaginary component. */
    x: number;
    /** Y imaginary component. */
    y: number;
    /** Z imaginary component. */
    z: number;
    /** W scalar (real) component. */
    w: number;
}

/**
 * Reactive atomic quaternion that notifies an optional callback whenever `x`, `y`, `z`, or `w` is mutated.
 * Can optionally bind directly to a 4-float slot in an ECS `Float32Array` buffer.
 *
 * @example
 * ```ts
 * const rot = new BrioQuat(0, 0, 0, 1, () => {
 *     console.log("Quaternion updated");
 * });
 * ```
 */
export class BrioQuat implements Quat {
    #x: number;
    #y: number;
    #z: number;
    #w: number;
    #buffer?: Float32Array;
    #offset: number = 0;
    #onChange?: (x: number, y: number, z: number, w: number) => void;

    /** X imaginary component. */
    declare public x: number;
    /** Y imaginary component. */
    declare public y: number;
    /** Z imaginary component. */
    declare public z: number;
    /** W scalar component. */
    declare public w: number;

    /**
     * Creates a reactive `BrioQuat` instance (defaults to identity `{ x: 0, y: 0, z: 0, w: 1 }`).
     *
     * @param x Initial X component (defaults to `0`)
     * @param y Initial Y component (defaults to `0`)
     * @param z Initial Z component (defaults to `0`)
     * @param w Initial W component (defaults to `1`)
     * @param onChange Optional callback invoked whenever any component changes
     */
    constructor(
        x: number = 0,
        y: number = 0,
        z: number = 0,
        w: number = 1,
        onChange?: (x: number, y: number, z: number, w: number) => void,
    ) {
        this.#x = x;
        this.#y = y;
        this.#z = z;
        this.#w = w;
        this.#onChange = onChange;

        Object.defineProperties(this, {
            x: {
                enumerable: true,
                configurable: true,
                get: (): number => (this.#buffer ? this.#buffer[this.#offset] : this.#x),
                set: (value: number): void => {
                    this.#x = value;
                    if (this.#buffer) this.#buffer[this.#offset] = value;
                    if (this.#onChange) this.#onChange(this.x, this.y, this.z, this.w);
                },
            },
            y: {
                enumerable: true,
                configurable: true,
                get: (): number => (this.#buffer ? this.#buffer[this.#offset + 1] : this.#y),
                set: (value: number): void => {
                    this.#y = value;
                    if (this.#buffer) this.#buffer[this.#offset + 1] = value;
                    if (this.#onChange) this.#onChange(this.x, this.y, this.z, this.w);
                },
            },
            z: {
                enumerable: true,
                configurable: true,
                get: (): number => (this.#buffer ? this.#buffer[this.#offset + 2] : this.#z),
                set: (value: number): void => {
                    this.#z = value;
                    if (this.#buffer) this.#buffer[this.#offset + 2] = value;
                    if (this.#onChange) this.#onChange(this.x, this.y, this.z, this.w);
                },
            },
            w: {
                enumerable: true,
                configurable: true,
                get: (): number => (this.#buffer ? this.#buffer[this.#offset + 3] : this.#w),
                set: (value: number): void => {
                    this.#w = value;
                    if (this.#buffer) this.#buffer[this.#offset + 3] = value;
                    if (this.#onChange) this.#onChange(this.x, this.y, this.z, this.w);
                },
            },
        });
    }

    /**
     * Binds this quaternion directly to a 4-float slot in an ECS `Float32Array` buffer.
     *
     * @param buffer Target `Float32Array` component storage
     * @param offset Starting index in `buffer`
     * @returns This `BrioQuat` instance
     */
    public bindBuffer(buffer: Float32Array, offset: number): this {
        this.#buffer = buffer;
        this.#offset = offset;
        this.#buffer[offset] = this.#x;
        this.#buffer[offset + 1] = this.#y;
        this.#buffer[offset + 2] = this.#z;
        this.#buffer[offset + 3] = this.#w;
        return this;
    }

    /**
     * Updates all four components simultaneously and triggers the change listener once.
     *
     * @param x New X component
     * @param y New Y component
     * @param z New Z component
     * @param w New W component
     * @returns This `BrioQuat` instance
     */
    public set(x: number, y: number, z: number, w: number): this {
        this.#x = x;
        this.#y = y;
        this.#z = z;
        this.#w = w;
        if (this.#buffer) {
            this.#buffer[this.#offset] = x;
            this.#buffer[this.#offset + 1] = y;
            this.#buffer[this.#offset + 2] = z;
            this.#buffer[this.#offset + 3] = w;
        }
        if (this.#onChange) this.#onChange(x, y, z, w);
        return this;
    }

    /**
     * Copies components from another `Quat` into this instance.
     *
     * @param q Source quaternion
     * @returns This `BrioQuat` instance
     */
    public copy(q: Quat): this {
        return this.set(q.x, q.y, q.z, q.w);
    }
}

// #endregion

// #region FUNCTIONS

/**
 * Creates a new `Quat` (defaults to identity `{ x: 0, y: 0, z: 0, w: 1 }`).
 *
 * @param x Initial X component (defaults to `0`)
 * @param y Initial Y component (defaults to `0`)
 * @param z Initial Z component (defaults to `0`)
 * @param w Initial W component (defaults to `1`)
 * @returns Newly allocated `Quat`
 * @example
 * ```ts
 * const q = Quaternion.create();
 * ```
 */
export function create(x: number = 0, y: number = 0, z: number = 0, w: number = 1): Quat {
    return { x, y, z, w };
}

/**
 * Resets `out` to the identity quaternion `{ x: 0, y: 0, z: 0, w: 1 }`.
 *
 * @param out Target quaternion
 * @returns `out`
 * @example
 * ```ts
 * Quaternion.identity(q);
 * ```
 */
export function identity(out: Quat): Quat {
    out.x = 0;
    out.y = 0;
    out.z = 0;
    out.w = 1;
    return out;
}

/**
 * Creates a shallow clone of quaternion `q`.
 *
 * @param q Source quaternion
 * @returns Cloned `Quat`
 * @example
 * ```ts
 * const cloned = Quaternion.clone(q);
 * ```
 */
export function clone(q: Quat): Quat {
    return { x: q.x, y: q.y, z: q.z, w: q.w };
}

/**
 * Copies components from `q` into `out`.
 *
 * @param out Destination quaternion
 * @param q Source quaternion
 * @returns `out`
 * @example
 * ```ts
 * Quaternion.copy(out, source);
 * ```
 */
export function copy(out: Quat, q: Quat): Quat {
    out.x = q.x;
    out.y = q.y;
    out.z = q.z;
    out.w = q.w;
    return out;
}

/**
 * Sets `out` from an axis of rotation `axis` (unit `Vec3`) and an `angleRad` in radians.
 *
 * @param out Destination quaternion
 * @param axis Normalized 3D rotation axis
 * @param angleRad Rotation angle in radians
 * @returns `out`
 * @example
 * ```ts
 * const q = Quaternion.create();
 * Quaternion.fromAxisAngle(q, { x: 0, y: 1, z: 0 }, Math.PI / 2);
 * ```
 */
export function fromAxisAngle(out: Quat, axis: Vec3, angleRad: number): Quat {
    const halfAngle = angleRad * 0.5;
    const s = Math.sin(halfAngle);
    const len = Math.hypot(axis.x, axis.y, axis.z);
    if (len === 0) {
        return identity(out);
    }
    const invLen = s / len;
    out.x = axis.x * invLen;
    out.y = axis.y * invLen;
    out.z = axis.z * invLen;
    out.w = Math.cos(halfAngle);
    return out;
}

/**
 * Sets `out` from intrinsic XYZ Euler angles (pitch `x`, yaw `y`, roll `z`) in radians.
 *
 * @param out Destination quaternion
 * @param x Rotation around X-axis in radians
 * @param y Rotation around Y-axis in radians
 * @param z Rotation around Z-axis in radians
 * @returns `out`
 * @example
 * ```ts
 * const q = Quaternion.create();
 * Quaternion.fromEuler(q, 0, Math.PI, 0);
 * ```
 */
export function fromEuler(out: Quat, x: number, y: number, z: number): Quat {
    const c1 = Math.cos(x * 0.5);
    const c2 = Math.cos(y * 0.5);
    const c3 = Math.cos(z * 0.5);
    const s1 = Math.sin(x * 0.5);
    const s2 = Math.sin(y * 0.5);
    const s3 = Math.sin(z * 0.5);

    out.x = s1 * c2 * c3 - c1 * s2 * s3;
    out.y = c1 * s2 * c3 + s1 * c2 * s3;
    out.z = c1 * c2 * s3 - s1 * s2 * c3;
    out.w = c1 * c2 * c3 + s1 * s2 * s3;
    return out;
}

/**
 * Extracts Euler angles (in radians, XYZ order) from quaternion `q` into `out`.
 *
 * @param out Destination `Vec3` receiving `{ x, y, z }` in radians
 * @param q Source unit quaternion
 * @returns `out`
 * @example
 * ```ts
 * const euler = { x: 0, y: 0, z: 0 };
 * Quaternion.toEuler(euler, q);
 * ```
 */
export function toEuler(out: Vec3, q: Quat): Vec3 {
    const { x, y, z, w } = q;

    const sinrCosp = 2 * (w * x + y * z);
    const cosrCosp = 1 - 2 * (x * x + y * y);
    out.x = Math.atan2(sinrCosp, cosrCosp);

    const sinp = 2 * (w * y - z * x);
    if (Math.abs(sinp) >= 1) {
        out.y = Math.sign(sinp) * (Math.PI / 2);
    } else {
        out.y = Math.asin(sinp);
    }

    const sinyCosp = 2 * (w * z + x * y);
    const cosyCosp = 1 - 2 * (y * y + z * z);
    out.z = Math.atan2(sinyCosp, cosyCosp);

    return out;
}

/**
 * Multiplies two quaternions `a` and `b` (`a * b`) and writes the combined rotation to `out`.
 * Safe for in-place use when `out === a` or `out === b`.
 *
 * @param out Destination quaternion
 * @param a First quaternion
 * @param b Second quaternion
 * @returns `out`
 * @example
 * ```ts
 * Quaternion.multiply(worldRot, parentRot, localRot);
 * ```
 */
export function multiply(out: Quat, a: Quat, b: Quat): Quat {
    const ax = a.x,
        ay = a.y,
        az = a.z,
        aw = a.w;
    const bx = b.x,
        by = b.y,
        bz = b.z,
        bw = b.w;

    out.x = ax * bw + aw * bx + ay * bz - az * by;
    out.y = ay * bw + aw * by + az * bx - ax * bz;
    out.z = az * bw + aw * bz + ax * by - ay * bx;
    out.w = aw * bw - ax * bx - ay * by - az * bz;
    return out;
}

/**
 * Normalizes quaternion `q` to unit length and writes the result to `out`.
 *
 * @param out Destination quaternion
 * @param q Input quaternion
 * @returns `out`
 * @example
 * ```ts
 * Quaternion.normalize(q, q);
 * ```
 */
export function normalize(out: Quat, q: Quat): Quat {
    const len = Math.hypot(q.x, q.y, q.z, q.w);
    if (len === 0) {
        return identity(out);
    }
    const inv = 1 / len;
    out.x = q.x * inv;
    out.y = q.y * inv;
    out.z = q.z * inv;
    out.w = q.w * inv;
    return out;
}

/**
 * Computes the conjugate of unit quaternion `q` (`{-x, -y, -z, w}`) into `out`.
 *
 * @param out Destination quaternion
 * @param q Input quaternion
 * @returns `out`
 * @example
 * ```ts
 * Quaternion.conjugate(invRot, rot);
 * ```
 */
export function conjugate(out: Quat, q: Quat): Quat {
    out.x = -q.x;
    out.y = -q.y;
    out.z = -q.z;
    out.w = q.w;
    return out;
}

/**
 * Computes the multiplicative inverse of quaternion `q` into `out`.
 *
 * @param out Destination quaternion
 * @param q Input quaternion
 * @returns `out`
 * @example
 * ```ts
 * Quaternion.invert(invRot, rot);
 * ```
 */
export function invert(out: Quat, q: Quat): Quat {
    const dotVal = q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w;
    if (dotVal === 0) {
        out.x = 0;
        out.y = 0;
        out.z = 0;
        out.w = 0;
        return out;
    }
    const invDot = 1 / dotVal;
    out.x = -q.x * invDot;
    out.y = -q.y * invDot;
    out.z = -q.z * invDot;
    out.w = q.w * invDot;
    return out;
}

/**
 * Performs spherical linear interpolation (SLERP) between unit quaternions `a` and `b` by factor `t`.
 * Automatically takes the shortest arc on the 4D hypersphere.
 *
 * @param out Destination quaternion
 * @param a Start quaternion (`t === 0`)
 * @param b End quaternion (`t === 1`)
 * @param t Interpolation factor in `[0, 1]`
 * @returns `out`
 * @example
 * ```ts
 * Quaternion.slerp(currentRot, startRot, targetRot, 0.5);
 * ```
 */
export function slerp(out: Quat, a: Quat, b: Quat, t: number): Quat {
    const ax = a.x,
        ay = a.y,
        az = a.z,
        aw = a.w;
    let bx = b.x,
        by = b.y,
        bz = b.z,
        bw = b.w;

    let cosom = ax * bx + ay * by + az * bz + aw * bw;
    if (cosom < 0) {
        cosom = -cosom;
        bx = -bx;
        by = -by;
        bz = -bz;
        bw = -bw;
    }

    let scale0: number;
    let scale1: number;

    if (1.0 - cosom > 1e-6) {
        const omega = Math.acos(cosom);
        const sinom = Math.sin(omega);
        scale0 = Math.sin((1.0 - t) * omega) / sinom;
        scale1 = Math.sin(t * omega) / sinom;
    } else {
        scale0 = 1.0 - t;
        scale1 = t;
    }

    out.x = scale0 * ax + scale1 * bx;
    out.y = scale0 * ay + scale1 * by;
    out.z = scale0 * az + scale1 * bz;
    out.w = scale0 * aw + scale1 * bw;
    return out;
}

/**
 * Rotates a 3D vector `v` by unit quaternion `q` and stores the result in `out`.
 *
 * @param out Destination 3D vector
 * @param v Input 3D vector to rotate
 * @param q Unit rotation quaternion
 * @returns `out`
 * @example
 * ```ts
 * const forward = { x: 0, y: 0, z: -1 };
 * Quaternion.rotateVec3(forward, forward, cameraQuat);
 * ```
 */
export function rotateVec3(out: Vec3, v: Vec3, q: Quat): Vec3 {
    const vx = v.x,
        vy = v.y,
        vz = v.z;
    const qx = q.x,
        qy = q.y,
        qz = q.z,
        qw = q.w;

    const uvx = qy * vz - qz * vy;
    const uvy = qz * vx - qx * vz;
    const uvz = qx * vy - qy * vx;

    const uuvx = qy * uvz - qz * uvy;
    const uuvy = qz * uvx - qx * uvz;
    const uuvz = qx * uvy - qy * uvx;

    const w2 = qw * 2;
    out.x = vx + uvx * w2 + uuvx * 2;
    out.y = vy + uvy * w2 + uuvy * 2;
    out.z = vz + uvz * w2 + uuvz * 2;
    return out;
}

/**
 * Checks whether two quaternions `a` and `b` have approximately equal components within `epsilon`.
 *
 * @param a First quaternion
 * @param b Second quaternion
 * @param epsilon Allowed tolerance (defaults to `1e-5`)
 * @returns `true` if all components are within `epsilon`
 * @example
 * ```ts
 * const isSame = Quaternion.equals(q1, q2);
 * ```
 */
export function equals(a: Quat, b: Quat, epsilon: number = 1e-5): boolean {
    return (
        Math.abs(a.x - b.x) <= epsilon &&
        Math.abs(a.y - b.y) <= epsilon &&
        Math.abs(a.z - b.z) <= epsilon &&
        Math.abs(a.w - b.w) <= epsilon
    );
}

// #endregion
