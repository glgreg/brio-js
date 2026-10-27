import { Vec3 } from "./vec3";
import { Quat } from "./quat";

// #region TYPES-INTERFACES

/**
 * Column-major 4x4 transformation matrix stored as a contiguous 16-element `Float32Array`.
 * Compatible directly with WebGPU, WebGL2, WebGL1 uniform buffers, and the Software 3D Projector.
 *
 * @example
 * ```ts
 * const m: Mat4 = Matrix4.create();
 * ```
 */
export type Mat4 = Float32Array;

// #endregion

// #region FUNCTIONS

/**
 * Creates a new 4x4 identity matrix (`Float32Array(16)`).
 *
 * @returns Newly allocated 16-float identity `Mat4`
 * @example
 * ```ts
 * const mat = Matrix4.create();
 * ```
 */
export function create(): Mat4 {
    const out = new Float32Array(16);
    out[0] = 1;
    out[5] = 1;
    out[10] = 1;
    out[15] = 1;
    return out;
}

/**
 * Resets a 4x4 matrix `out` to the identity matrix.
 *
 * @param out Target 4x4 matrix
 * @returns `out`
 * @example
 * ```ts
 * Matrix4.identity(worldMatrix);
 * ```
 */
export function identity(out: Mat4): Mat4 {
    out.fill(0);
    out[0] = 1;
    out[5] = 1;
    out[10] = 1;
    out[15] = 1;
    return out;
}

/**
 * Clones a 4x4 matrix `a` into a new `Float32Array(16)`.
 *
 * @param a Source matrix
 * @returns Newly allocated copy of `a`
 * @example
 * ```ts
 * const backup = Matrix4.clone(viewMatrix);
 * ```
 */
export function clone(a: Mat4): Mat4 {
    return new Float32Array(a);
}

/**
 * Copies all 16 elements from `a` into `out`.
 *
 * @param out Destination matrix
 * @param a Source matrix
 * @returns `out`
 * @example
 * ```ts
 * Matrix4.copy(dest, src);
 * ```
 */
export function copy(out: Mat4, a: Mat4): Mat4 {
    out.set(a);
    return out;
}

/**
 * Multiplies two 4x4 column-major matrices `a` and `b` (`out = a * b`).
 * Safe for in-place multiplication when `out === a` or `out === b`.
 *
 * @param out Destination matrix
 * @param a Left matrix operand
 * @param b Right matrix operand
 * @returns `out`
 * @example
 * ```ts
 * Matrix4.multiply(viewProj, projMatrix, viewMatrix);
 * ```
 */
export function multiply(out: Mat4, a: Mat4, b: Mat4): Mat4 {
    const a00 = a[0],
        a01 = a[1],
        a02 = a[2],
        a03 = a[3];
    const a10 = a[4],
        a11 = a[5],
        a12 = a[6],
        a13 = a[7];
    const a20 = a[8],
        a21 = a[9],
        a22 = a[10],
        a23 = a[11];
    const a30 = a[12],
        a31 = a[13],
        a32 = a[14],
        a33 = a[15];

    let b0 = b[0],
        b1 = b[1],
        b2 = b[2],
        b3 = b[3];
    out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[4];
    b1 = b[5];
    b2 = b[6];
    b3 = b[7];
    out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[8];
    b1 = b[9];
    b2 = b[10];
    b3 = b[11];
    out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[12];
    b1 = b[13];
    b2 = b[14];
    b3 = b[15];
    out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    return out;
}

/**
 * Translates matrix `a` by vector `v` and writes the result to `out`.
 *
 * @param out Destination matrix
 * @param a Input matrix
 * @param v Translation vector `{ x, y, z }`
 * @returns `out`
 * @example
 * ```ts
 * Matrix4.translate(modelMatrix, modelMatrix, { x: 0, y: 2, z: -5 });
 * ```
 */
export function translate(out: Mat4, a: Mat4, v: Vec3): Mat4 {
    const { x, y, z } = v;
    if (a !== out) {
        out.set(a);
    }
    out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
    out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
    out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
    out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
    return out;
}

/**
 * Scales matrix `a` by vector `v` and writes the result to `out`.
 *
 * @param out Destination matrix
 * @param a Input matrix
 * @param v Scale factors `{ x, y, z }`
 * @returns `out`
 * @example
 * ```ts
 * Matrix4.scale(modelMatrix, modelMatrix, { x: 2, y: 2, z: 2 });
 * ```
 */
export function scale(out: Mat4, a: Mat4, v: Vec3): Mat4 {
    const { x, y, z } = v;
    out[0] = a[0] * x;
    out[1] = a[1] * x;
    out[2] = a[2] * x;
    out[3] = a[3] * x;
    out[4] = a[4] * y;
    out[5] = a[5] * y;
    out[6] = a[6] * y;
    out[7] = a[7] * y;
    out[8] = a[8] * z;
    out[9] = a[9] * z;
    out[10] = a[10] * z;
    out[11] = a[11] * z;
    if (a !== out) {
        out[12] = a[12];
        out[13] = a[13];
        out[14] = a[14];
        out[15] = a[15];
    }
    return out;
}

/**
 * Composes a 4x4 transformation matrix `out` from quaternion `q`, translation `v`, and scale `s`.
 *
 * @param out Destination matrix
 * @param q Rotation quaternion
 * @param v Translation vector
 * @param s Scale vector
 * @returns `out`
 * @example
 * ```ts
 * Matrix4.fromRotationTranslationScale(localMat, rotQuat, posVec, scaleVec);
 * ```
 */
export function fromRotationTranslationScale(out: Mat4, q: Quat, v: Vec3, s: Vec3): Mat4 {
    const { x, y, z, w } = q;
    const x2 = x + x;
    const y2 = y + y;
    const z2 = z + z;

    const xx = x * x2;
    const xy = x * y2;
    const xz = x * z2;
    const yy = y * y2;
    const yz = y * z2;
    const zz = z * z2;
    const wx = w * x2;
    const wy = w * y2;
    const wz = w * z2;
    const sx = s.x;
    const sy = s.y;
    const sz = s.z;

    out[0] = (1 - (yy + zz)) * sx;
    out[1] = (xy + wz) * sx;
    out[2] = (xz - wy) * sx;
    out[3] = 0;
    out[4] = (xy - wz) * sy;
    out[5] = (1 - (xx + zz)) * sy;
    out[6] = (yz + wx) * sy;
    out[7] = 0;
    out[8] = (xz + wy) * sz;
    out[9] = (yz - wx) * sz;
    out[10] = (1 - (xx + yy)) * sz;
    out[11] = 0;
    out[12] = v.x;
    out[13] = v.y;
    out[14] = v.z;
    out[15] = 1;
    return out;
}

/**
 * Generates a right-handed perspective projection matrix in `out`.
 *
 * @param out Destination matrix
 * @param fovyRad Vertical field of view in radians
 * @param aspect Viewport aspect ratio (`width / height`)
 * @param near Near clipping plane distance (must be `> 0`)
 * @param far Far clipping plane distance
 * @returns `out`
 * @example
 * ```ts
 * Matrix4.perspective(proj, Math.PI / 3, 640 / 480, 0.1, 1000);
 * ```
 */
export function perspective(
    out: Mat4,
    fovyRad: number,
    aspect: number,
    near: number,
    far: number,
): Mat4 {
    const f = 1.0 / Math.tan(fovyRad * 0.5);
    out.fill(0);
    out[0] = f / aspect;
    out[5] = f;
    out[11] = -1;

    if (far !== Infinity) {
        const nf = 1 / (near - far);
        out[10] = (far + near) * nf;
        out[14] = 2 * far * near * nf;
    } else {
        out[10] = -1;
        out[14] = -2 * near;
    }
    return out;
}

/**
 * Generates a right-handed orthographic projection matrix in `out`.
 *
 * @param out Destination matrix
 * @param left Left plane coordinate
 * @param right Right plane coordinate
 * @param bottom Bottom plane coordinate
 * @param top Top plane coordinate
 * @param near Near clipping plane distance
 * @param far Far clipping plane distance
 * @returns `out`
 * @example
 * ```ts
 * Matrix4.orthographic(proj, -320, 320, -240, 240, 0.1, 1000);
 * ```
 */
export function orthographic(
    out: Mat4,
    left: number,
    right: number,
    bottom: number,
    top: number,
    near: number,
    far: number,
): Mat4 {
    const lr = 1 / (left - right);
    const bt = 1 / (bottom - top);
    const nf = 1 / (near - far);

    out.fill(0);
    out[0] = -2 * lr;
    out[5] = -2 * bt;
    out[10] = 2 * nf;
    out[12] = (left + right) * lr;
    out[13] = (top + bottom) * bt;
    out[14] = (far + near) * nf;
    out[15] = 1;
    return out;
}

/**
 * Generates a right-handed view matrix looking from `eye` toward `target` with `up` orientation.
 *
 * @param out Destination view matrix
 * @param eye Camera world position
 * @param target Target point in world space
 * @param up Up direction vector (typically `{ x: 0, y: 1, z: 0 }`)
 * @returns `out`
 * @example
 * ```ts
 * Matrix4.lookAt(view, { x: 0, y: 5, z: 10 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
 * ```
 */
export function lookAt(out: Mat4, eye: Vec3, target: Vec3, up: Vec3): Mat4 {
    let zx = eye.x - target.x;
    let zy = eye.y - target.y;
    let zz = eye.z - target.z;

    let len = Math.hypot(zx, zy, zz);
    if (len === 0) {
        return identity(out);
    }
    zx /= len;
    zy /= len;
    zz /= len;

    let xx = up.y * zz - up.z * zy;
    let xy = up.z * zx - up.x * zz;
    let xz = up.x * zy - up.y * zx;
    len = Math.hypot(xx, xy, xz);
    if (len === 0) {
        xx = 0;
        xy = 0;
        xz = 0;
    } else {
        xx /= len;
        xy /= len;
        xz /= len;
    }

    const yx = zy * xz - zz * xy;
    const yy = zz * xx - zx * xz;
    const yz = zx * xy - zy * xx;

    out[0] = xx;
    out[1] = yx;
    out[2] = zx;
    out[3] = 0;
    out[4] = xy;
    out[5] = yy;
    out[6] = zy;
    out[7] = 0;
    out[8] = xz;
    out[9] = yz;
    out[10] = zz;
    out[11] = 0;
    out[12] = -(xx * eye.x + xy * eye.y + xz * eye.z);
    out[13] = -(yx * eye.x + yy * eye.y + yz * eye.z);
    out[14] = -(zx * eye.x + zy * eye.y + zz * eye.z);
    out[15] = 1;
    return out;
}

/**
 * Transposes a 4x4 matrix `a` into `out`.
 *
 * @param out Destination matrix
 * @param a Input matrix
 * @returns `out`
 * @example
 * ```ts
 * Matrix4.transpose(out, mat);
 * ```
 */
export function transpose(out: Mat4, a: Mat4): Mat4 {
    if (out === a) {
        const a01 = a[1],
            a02 = a[2],
            a03 = a[3];
        const a12 = a[6],
            a13 = a[7];
        const a23 = a[11];
        out[1] = a[4];
        out[2] = a[8];
        out[3] = a[12];
        out[4] = a01;
        out[6] = a[9];
        out[7] = a[13];
        out[8] = a02;
        out[9] = a12;
        out[11] = a[14];
        out[12] = a03;
        out[13] = a13;
        out[14] = a23;
        return out;
    }
    out[0] = a[0];
    out[1] = a[4];
    out[2] = a[8];
    out[3] = a[12];
    out[4] = a[1];
    out[5] = a[5];
    out[6] = a[9];
    out[7] = a[13];
    out[8] = a[2];
    out[9] = a[6];
    out[10] = a[10];
    out[11] = a[14];
    out[12] = a[3];
    out[13] = a[7];
    out[14] = a[11];
    out[15] = a[15];
    return out;
}

/**
 * Computes the inverse of 4x4 matrix `a` into `out`.
 * If `a` is singular (`det === 0`), `out` is zeroed.
 *
 * @param out Destination matrix
 * @param a Input matrix
 * @returns `out`
 * @example
 * ```ts
 * Matrix4.invert(invViewProj, viewProj);
 * ```
 */
export function invert(out: Mat4, a: Mat4): Mat4 {
    const a00 = a[0],
        a01 = a[1],
        a02 = a[2],
        a03 = a[3];
    const a10 = a[4],
        a11 = a[5],
        a12 = a[6],
        a13 = a[7];
    const a20 = a[8],
        a21 = a[9],
        a22 = a[10],
        a23 = a[11];
    const a30 = a[12],
        a31 = a[13],
        a32 = a[14],
        a33 = a[15];

    const b00 = a00 * a11 - a01 * a10;
    const b01 = a00 * a12 - a02 * a10;
    const b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11;
    const b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30;
    const b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31;
    const b10 = a21 * a33 - a23 * a31;
    const b11 = a22 * a33 - a23 * a32;

    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) {
        out.fill(0);
        return out;
    }
    det = 1.0 / det;

    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return out;
}

/**
 * Transforms a 3D point `v` (`w = 1`, including perspective divide) by 4x4 matrix `m` into `out`.
 *
 * @param out Destination 3D point
 * @param v Input 3D point
 * @param m Transformation or View-Projection matrix
 * @returns `out`
 * @example
 * ```ts
 * Matrix4.transformPoint(worldPos, localPos, worldMatrix);
 * ```
 */
export function transformPoint(out: Vec3, v: Vec3, m: Mat4): Vec3 {
    const x = v.x,
        y = v.y,
        z = v.z;
    const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1.0;
    out.x = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
    out.y = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
    out.z = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
    return out;
}

// #endregion
