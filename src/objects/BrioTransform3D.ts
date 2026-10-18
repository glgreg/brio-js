import { ComponentStorage, DirtyFlag } from "../ecs/ComponentStorage";
import { clamp } from "../math/BrioMath";
import { BrioQuat, BrioVec3, Mat4, Matrix4, Quat, Quaternion, Vec3, Vector3 } from "../math/index";

/**
 * Contract representing a 3D spatial transform component with local and world matrix hierarchy.
 */
export interface Transform3D {
    /** Local 3D position `{ x, y, z }`. */
    position: Vec3;
    /** Local 3D scale `{ x, y, z }`. */
    scale: Vec3;
    /** Local Euler angles `{ x, y, z }` in radians (XYZ order). */
    rotation: Vec3;
    /** Local unit rotation quaternion `{ x, y, z, w }`. */
    quaternion: Quat;
    /** Whether the 3D object is visible during rendering. */
    visibility: boolean;
    /** Opacity factor clamped to `[0, 1]`. */
    opacity: number;
    /** Rendering layer index. */
    layer: number;
    /** Optional parent `BrioTransform3D` in the 3D scene graph. */
    parent?: BrioTransform3D;
    /** Read-only array of child `BrioTransform3D` nodes. */
    readonly children: readonly BrioTransform3D[];
    /** Local 4x4 transformation matrix (`Float32Array(16)`). */
    readonly localMatrix: Mat4;
    /** World 4x4 transformation matrix (`Float32Array(16)`). */
    readonly worldMatrix: Mat4;
}

/**
 * Concrete 3D spatial transformation class managing `position` (`BrioVec3`), `scale` (`BrioVec3`),
 * `rotation` (Euler radians `BrioVec3`), `quaternion` (`BrioQuat`), parent-child scene graph hierarchy,
 * lazy `localMatrix` / `worldMatrix` (`Mat4`) computation, and direct ECS `ComponentStorage` binding.
 *
 * @example
 * ```ts
 * const transform3D = new BrioTransform3D({ x: 0, y: 2, z: -10 });
 * transform3D.rotation.y = Math.PI / 4; // Automatically updates quaternion and marks matrices dirty
 * const worldMat = transform3D.worldMatrix;
 * ```
 */
export class BrioTransform3D implements Transform3D {
    #position: BrioVec3;
    #scale: BrioVec3;
    #rotation: BrioVec3;
    #quaternion: BrioQuat;
    #visibility: boolean = true;
    #opacity: number = 1;
    #layer: number = 1;

    #parent?: BrioTransform3D;
    #children: BrioTransform3D[] = [];
    #localMatrix: Mat4 = Matrix4.create();
    #worldMatrix: Mat4 = Matrix4.create();
    #localDirty: boolean = true;
    #worldDirty: boolean = true;
    #syncingRotation: boolean = false;

    #ecsStorage?: ComponentStorage;
    #entityId: number = -1;

    /**
     * Creates a new `BrioTransform3D` instance.
     *
     * @param position Initial 3D position (defaults to `{ x: 0, y: 0, z: 0 }`)
     * @param scale Initial 3D scale (defaults to `{ x: 1, y: 1, z: 1 }`)
     * @param rotation Initial Euler rotation in radians (defaults to `{ x: 0, y: 0, z: 0 }`)
     * @example
     * ```ts
     * const t3d = new BrioTransform3D({ x: 0, y: 5, z: -15 });
     * ```
     */
    constructor(
        position: Vec3 = Vector3.create(0, 0, 0),
        scale: Vec3 = Vector3.create(1, 1, 1),
        rotation: Vec3 = Vector3.create(0, 0, 0),
    ) {
        this.#position = new BrioVec3(position.x, position.y, position.z, () => {
            this.#markLocalDirty();
        });

        this.#scale = new BrioVec3(scale.x, scale.y, scale.z, () => {
            this.#markLocalDirty();
        });

        this.#quaternion = new BrioQuat(0, 0, 0, 1, (qx, qy, qz, qw) => {
            if (!this.#syncingRotation) {
                this.#syncingRotation = true;
                const euler = { x: 0, y: 0, z: 0 };
                Quaternion.toEuler(euler, { x: qx, y: qy, z: qz, w: qw });
                this.#rotation.set(euler.x, euler.y, euler.z);
                this.#syncingRotation = false;
            }
            this.#markLocalDirty();
        });

        this.#rotation = new BrioVec3(rotation.x, rotation.y, rotation.z, (rx, ry, rz) => {
            if (!this.#syncingRotation) {
                this.#syncingRotation = true;
                const q = { x: 0, y: 0, z: 0, w: 1 };
                Quaternion.fromEuler(q, rx, ry, rz);
                this.#quaternion.set(q.x, q.y, q.z, q.w);
                this.#syncingRotation = false;
            }
            this.#markLocalDirty();
        });

        if (rotation.x !== 0 || rotation.y !== 0 || rotation.z !== 0) {
            const q = { x: 0, y: 0, z: 0, w: 1 };
            Quaternion.fromEuler(q, rotation.x, rotation.y, rotation.z);
            this.#syncingRotation = true;
            this.#quaternion.set(q.x, q.y, q.z, q.w);
            this.#syncingRotation = false;
        }
    }

    /**
     * Binds this 3D transform directly to an entity slot in `ComponentStorage`.
     *
     * @param storage Target ECS `ComponentStorage`
     * @param entityId Allocated entity ID
     * @returns This `BrioTransform3D` instance
     */
    public bindECS(storage: ComponentStorage, entityId: number): this {
        this.#ecsStorage = storage;
        this.#entityId = entityId;
        const base = storage.getTransform3DOffset(entityId);
        const buf = storage.transform3D;

        this.#position.bindBuffer(buf, base);
        this.#scale.bindBuffer(buf, base + 3);
        this.#rotation.bindBuffer(buf, base + 6);
        this.#quaternion.bindBuffer(buf, base + 9);
        buf[base + 13] = this.#opacity;
        buf[base + 14] = this.#layer;
        return this;
    }

    /** Local 3D position `{ x, y, z }`. */
    public get position(): Vec3 {
        return this.#position;
    }
    public set position(value: Vec3) {
        this.#position.set(value.x, value.y, value.z);
    }

    /**
     * Computed world-space 3D position extracted from `worldMatrix`.
     *
     * @example
     * ```ts
     * const worldPos = cameraTarget.transform.worldPosition;
     * ```
     */
    public get worldPosition(): Vec3 {
        const wm = this.worldMatrix;
        return { x: wm[12], y: wm[13], z: wm[14] };
    }

    /** Local 3D scale `{ x, y, z }`. */
    public get scale(): Vec3 {
        return this.#scale;
    }
    public set scale(value: Vec3) {
        this.#scale.set(value.x, value.y, value.z);
    }

    /**
     * Local Euler rotation `{ x, y, z }` in radians (intrinsic XYZ).
     * Mutating `rotation` automatically updates `quaternion`.
     */
    public get rotation(): Vec3 {
        return this.#rotation;
    }
    public set rotation(value: Vec3) {
        this.#rotation.set(value.x, value.y, value.z);
    }

    /**
     * Local rotation quaternion `{ x, y, z, w }`.
     * Mutating `quaternion` automatically updates `rotation` Euler angles.
     */
    public get quaternion(): Quat {
        return this.#quaternion;
    }
    public set quaternion(value: Quat) {
        this.#quaternion.set(value.x, value.y, value.z, value.w);
    }

    /** Controls whether the 3D object is rendered. */
    public get visibility(): boolean {
        return this.#visibility;
    }
    public set visibility(value: boolean) {
        this.#visibility = value;
        this.#markWorldDirty();
    }

    /** Opacity factor clamped to `[0, 1]`. */
    public get opacity(): number {
        return this.#opacity;
    }
    public set opacity(value: number) {
        this.#opacity = clamp(value, 0, 1);
        if (this.#ecsStorage && this.#entityId >= 0) {
            const base = this.#ecsStorage.getTransform3DOffset(this.#entityId);
            this.#ecsStorage.transform3D[base + 13] = this.#opacity;
        }
        this.#markWorldDirty();
    }

    /** Rendering layer index. */
    public get layer(): number {
        return this.#layer;
    }
    public set layer(value: number) {
        this.#layer = Math.abs(value);
        if (this.#ecsStorage && this.#entityId >= 0) {
            const base = this.#ecsStorage.getTransform3DOffset(this.#entityId);
            this.#ecsStorage.transform3D[base + 14] = this.#layer;
        }
        this.#markWorldDirty();
    }

    /** Optional parent `BrioTransform3D` in the 3D scene graph. */
    public get parent(): BrioTransform3D | undefined {
        return this.#parent;
    }
    public set parent(newParent: BrioTransform3D | undefined) {
        if (this.#parent === newParent) return;
        if (this.#parent) {
            this.#parent.removeChild(this);
        }
        if (newParent) {
            newParent.addChild(this);
        }
    }

    /** Read-only array of child `BrioTransform3D` nodes. */
    public get children(): readonly BrioTransform3D[] {
        return this.#children;
    }

    /**
     * Attaches a child `BrioTransform3D` to this node in the 3D scene graph.
     *
     * @param child Child `BrioTransform3D` to attach
     * @returns This `BrioTransform3D` instance
     * @example
     * ```ts
     * carTransform.addChild(wheelTransform);
     * ```
     */
    public addChild(child: BrioTransform3D): this {
        if (child === this) {
            throw new Error("BrioTransform3D cannot be a child of itself.");
        }
        if (child.#parent === this) return this;
        if (child.#parent) {
            child.#parent.removeChild(child);
        }
        child.#parent = this;
        this.#children.push(child);
        child.#markWorldDirty();
        return this;
    }

    /**
     * Removes a child `BrioTransform3D` from this node.
     *
     * @param child Child `BrioTransform3D` to detach
     * @returns This `BrioTransform3D` instance
     */
    public removeChild(child: BrioTransform3D): this {
        const idx = this.#children.indexOf(child);
        if (idx !== -1) {
            this.#children.splice(idx, 1);
            child.#parent = undefined;
            child.#markWorldDirty();
        }
        return this;
    }

    /**
     * Returns the lazily recomputed 4x4 local transformation matrix (`Float32Array(16)`).
     */
    public get localMatrix(): Mat4 {
        if (this.#localDirty) {
            Matrix4.fromRotationTranslationScale(
                this.#localMatrix,
                this.#quaternion,
                this.#position,
                this.#scale,
            );
            this.#localDirty = false;
        }
        return this.#localMatrix;
    }

    /**
     * Returns the lazily recomputed 4x4 world transformation matrix (`Float32Array(16)`),
     * combining `parent.worldMatrix * localMatrix`.
     */
    public get worldMatrix(): Mat4 {
        const local = this.localMatrix;
        if (this.#worldDirty) {
            if (this.#parent) {
                Matrix4.multiply(this.#worldMatrix, this.#parent.worldMatrix, local);
            } else {
                Matrix4.copy(this.#worldMatrix, local);
            }
            this.#worldDirty = false;
        }
        return this.#worldMatrix;
    }

    #markLocalDirty(): void {
        this.#localDirty = true;
        this.#markWorldDirty();
    }

    #markWorldDirty(): void {
        this.#worldDirty = true;
        if (this.#ecsStorage && this.#entityId >= 0) {
            this.#ecsStorage.markDirty(this.#entityId, DirtyFlag.TRANSFORM | DirtyFlag.RENDER);
        }
        for (let i = 0; i < this.#children.length; i++) {
            this.#children[i].#markWorldDirty();
        }
    }
}

export default BrioTransform3D;
