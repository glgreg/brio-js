import { BrioViewport } from "../core/BrioViewport";
import { BrioVec3, Mat4, Matrix4, Vec3, Vector3 } from "../math/index";

/**
 * 3D projection mode supported by `BrioCamera3D`.
 */
export type CameraProjection3D = "perspective" | "orthographic";

/**
 * Configuration options for creating a `BrioCamera3D`.
 */
export interface BrioCamera3DOptions {
    /** Projection mode (`"perspective"` or `"orthographic"`, defaults to `"perspective"`). */
    projection?: CameraProjection3D;
    /** Initial camera position in 3D world space (defaults to `{ x: 0, y: 0, z: 10 }`). */
    position?: Vec3;
    /** Initial target point the camera looks at (defaults to `{ x: 0, y: 0, z: 0 }`). */
    target?: Vec3;
    /** Up direction vector (defaults to `{ x: 0, y: 1, z: 0 }`). */
    up?: Vec3;
    /** Vertical field of view in radians for `"perspective"` mode (defaults to `Math.PI / 3`, i.e. 60 degrees). */
    fov?: number;
    /** Viewport aspect ratio `width / height` (defaults to `640 / 480`). */
    aspect?: number;
    /** Near clipping plane distance (defaults to `0.1`). */
    near?: number;
    /** Far clipping plane distance (defaults to `1000`). */
    far?: number;
    /** Half-height in world units for `"orthographic"` projection (defaults to `10`). */
    orthoSize?: number;
    /** Normalized screen `BrioViewport` (defaults to full-screen). */
    viewport?: BrioViewport;
    /** Optional CSS color used to clear the viewport before the 3D pass (transparent clear when omitted). */
    clearColor?: string;
}

/**
 * Perspective and orthographic 3D observer (`BrioCamera3D`) that computes `viewMatrix`, `projectionMatrix`,
 * and `viewProjectionMatrix` (`Mat4`) for a target `BrioViewport` and provides 3D sphere frustum culling.
 *
 * @example
 * ```ts
 * const cam3D = new BrioCamera3D("cam_3d", {
 *     position: { x: 0, y: 5, z: 15 },
 *     target: { x: 0, y: 0, z: 0 },
 *     fov: Math.PI / 3,
 *     aspect: 16 / 9,
 * });
 * const vpMatrix = cam3D.viewProjectionMatrix;
 * ```
 */
export class BrioCamera3D {
    readonly #name: string;
    #projection: CameraProjection3D;
    readonly #position: BrioVec3;
    readonly #target: BrioVec3;
    readonly #up: BrioVec3;

    #fov: number;
    #aspect: number;
    #near: number;
    #far: number;
    #orthoSize: number;
    #viewport: BrioViewport;

    /** Optional CSS color used by `BrioGame` to clear this camera's viewport before rendering (transparent when `undefined`). */
    public clearColor?: string;

    readonly #viewMatrix: Mat4 = Matrix4.create();
    readonly #projectionMatrix: Mat4 = Matrix4.create();
    readonly #viewProjectionMatrix: Mat4 = Matrix4.create();
    #viewDirty: boolean = true;
    #projDirty: boolean = true;

    /**
     * Creates a new `BrioCamera3D` instance.
     *
     * @param name Unique camera identifier
     * @param options Optional 3D camera settings
     */
    constructor(name: string, options: BrioCamera3DOptions = {}) {
        this.#name = name;
        this.#projection = options.projection ?? "perspective";

        const p = options.position ?? { x: 0, y: 0, z: 10 };
        const t = options.target ?? { x: 0, y: 0, z: 0 };
        const u = options.up ?? { x: 0, y: 1, z: 0 };

        this.#position = new BrioVec3(p.x, p.y, p.z, () => {
            this.#viewDirty = true;
        });
        this.#target = new BrioVec3(t.x, t.y, t.z, () => {
            this.#viewDirty = true;
        });
        this.#up = new BrioVec3(u.x, u.y, u.z, () => {
            this.#viewDirty = true;
        });

        this.#fov = options.fov ?? Math.PI / 3;
        this.#aspect = options.aspect ?? 640 / 480;
        this.#near = Math.max(1e-4, options.near ?? 0.1);
        this.#far = Math.max(this.#near + 1, options.far ?? 1000);
        this.#orthoSize = Math.max(0.01, options.orthoSize ?? 10);
        this.#viewport = options.viewport ?? new BrioViewport(0, 0, 1, 1);
        this.clearColor = options.clearColor;
    }

    /** Unique camera identifier. */
    public get name(): string {
        return this.#name;
    }

    /** Projection mode (`"perspective"` or `"orthographic"`). */
    public get projection(): CameraProjection3D {
        return this.#projection;
    }
    public set projection(value: CameraProjection3D) {
        this.#projection = value;
        this.#projDirty = true;
    }

    /** Camera world position `{ x, y, z }`. */
    public get position(): Vec3 {
        return this.#position;
    }
    public set position(value: Vec3) {
        this.#position.set(value.x, value.y, value.z);
    }

    /** World target point `{ x, y, z }` the camera looks toward. */
    public get target(): Vec3 {
        return this.#target;
    }
    public set target(value: Vec3) {
        this.#target.set(value.x, value.y, value.z);
    }

    /** Camera up vector `{ x, y, z }`. */
    public get up(): Vec3 {
        return this.#up;
    }
    public set up(value: Vec3) {
        this.#up.set(value.x, value.y, value.z);
    }

    /** Vertical field of view in radians (used in `"perspective"` mode). */
    public get fov(): number {
        return this.#fov;
    }
    public set fov(value: number) {
        this.#fov = value;
        this.#projDirty = true;
    }

    /** Viewport aspect ratio (`width / height`). */
    public get aspect(): number {
        return this.#aspect;
    }
    public set aspect(value: number) {
        this.#aspect = Math.max(1e-4, value);
        this.#projDirty = true;
    }

    /** Near clipping plane distance. */
    public get near(): number {
        return this.#near;
    }
    public set near(value: number) {
        this.#near = Math.max(1e-4, value);
        this.#projDirty = true;
    }

    /** Far clipping plane distance. */
    public get far(): number {
        return this.#far;
    }
    public set far(value: number) {
        this.#far = Math.max(this.#near + 1e-3, value);
        this.#projDirty = true;
    }

    /** Half-height in world units for `"orthographic"` projection. */
    public get orthoSize(): number {
        return this.#orthoSize;
    }
    public set orthoSize(value: number) {
        this.#orthoSize = Math.max(1e-3, value);
        this.#projDirty = true;
    }

    /** Normalized screen `BrioViewport` assigned to this camera. */
    public get viewport(): BrioViewport {
        return this.#viewport;
    }
    public set viewport(value: BrioViewport) {
        this.#viewport = value;
    }

    /**
     * Points the camera toward `targetPos` in 3D world space.
     *
     * @param targetPos Target 3D coordinates `{ x, y, z }`
     * @example
     * ```ts
     * camera3D.lookAt(player3D.transform.position);
     * ```
     */
    public lookAt(targetPos: Vec3): void {
        this.#target.set(targetPos.x, targetPos.y, targetPos.z);
    }

    /**
     * Lazily computed 4x4 View Matrix (`Mat4`).
     */
    public get viewMatrix(): Mat4 {
        if (this.#viewDirty) {
            Matrix4.lookAt(this.#viewMatrix, this.#position, this.#target, this.#up);
            this.#viewDirty = false;
        }
        return this.#viewMatrix;
    }

    /**
     * Lazily computed 4x4 Projection Matrix (`Mat4`).
     */
    public get projectionMatrix(): Mat4 {
        if (this.#projDirty) {
            if (this.#projection === "perspective") {
                Matrix4.perspective(
                    this.#projectionMatrix,
                    this.#fov,
                    this.#aspect,
                    this.#near,
                    this.#far,
                );
            } else {
                const halfH = this.#orthoSize;
                const halfW = halfH * this.#aspect;
                Matrix4.orthographic(
                    this.#projectionMatrix,
                    -halfW,
                    halfW,
                    -halfH,
                    halfH,
                    this.#near,
                    this.#far,
                );
            }
            this.#projDirty = false;
        }
        return this.#projectionMatrix;
    }

    /**
     * Computes and returns the combined 4x4 `projectionMatrix * viewMatrix` (`Mat4`).
     */
    public get viewProjectionMatrix(): Mat4 {
        const v = this.viewMatrix;
        const p = this.projectionMatrix;
        Matrix4.multiply(this.#viewProjectionMatrix, p, v);
        return this.#viewProjectionMatrix;
    }

    /**
     * Projects a 3D world point into Normalized Device Coordinates (NDC `[-1, 1]`).
     *
     * @param worldPoint 3D point `{ x, y, z }`
     * @returns Projected NDC point `{ x, y, z }`
     * @example
     * ```ts
     * const ndc = camera3D.projectToNDC({ x: 0, y: 0, z: 0 });
     * ```
     */
    public projectToNDC(worldPoint: Vec3): Vec3 {
        const out = Vector3.create();
        return Matrix4.transformPoint(out, worldPoint, this.viewProjectionMatrix);
    }

    /**
     * Performs 3D bounding-sphere frustum culling in view space (`near`/`far` depth and NDC bounds).
     *
     * @param center World-space sphere center `{ x, y, z }`
     * @param radius Sphere radius in world units
     * @returns `true` if the sphere is potentially inside the view frustum
     * @example
     * ```ts
     * if (camera3D.isSphereInFrustum(meshObj.transform.position, 2.0)) { ... }
     * ```
     */
    public isSphereInFrustum(center: Vec3, radius: number): boolean {
        const view = this.viewMatrix;
        // View-space Z is negative along the forward view direction in right-handed coordinates
        const vz =
            view[2] * center.x + view[6] * center.y + view[10] * center.z + view[14];
        const depth = -vz;
        if (depth + radius < this.#near || depth - radius > this.#far) {
            return false;
        }
        return true;
    }
}
