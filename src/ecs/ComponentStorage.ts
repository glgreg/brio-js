/**
 * Bitmask flags identifying component types attached to an entity in `ECSWorld`.
 *
 * @example
 * ```ts
 * const mask = ComponentMask.TRANSFORM_2D | ComponentMask.COLLIDER;
 * ```
 */
export enum ComponentMask {
    NONE = 0,
    TRANSFORM_2D = 1 << 0,
    TRANSFORM_3D = 1 << 1,
    COLLIDER = 1 << 2,
    RIGIDBODY = 1 << 3,
    VISUAL = 1 << 4,
}

/**
 * Bitmask flags tracking dirty state per entity for incremental updates and static layer caching.
 *
 * @example
 * ```ts
 * storage.markDirty(entityId, DirtyFlag.TRANSFORM | DirtyFlag.RENDER);
 * ```
 */
export enum DirtyFlag {
    NONE = 0,
    TRANSFORM = 1 << 0,
    COLLIDER = 1 << 1,
    RENDER = 1 << 2,
}

/** Number of `Float32` elements per entity in the 2D transform buffer. */
export const TRANSFORM_2D_STRIDE = 16;

/** Number of `Float32` elements per entity in the 3D transform buffer. */
export const TRANSFORM_3D_STRIDE = 16;

/** Number of `Float32` elements per entity in the collider buffer. */
export const COLLIDER_STRIDE = 8;

/** Number of `Float32` elements per entity in the rigid-body physics buffer. */
export const RIGIDBODY_STRIDE = 10;

/** Number of `Uint32` elements per entity in the visual metadata buffer. */
export const VISUAL_STRIDE = 4;

/**
 * Bit flags describing which spatial transform buffers a `ComponentStorage` allocates.
 * Stored in binary snapshots so a snapshot is only restored into a compatible storage layout.
 */
export enum StorageLayoutFlag {
    TRANSFORM_2D = 1 << 0,
    TRANSFORM_3D = 1 << 1,
}

/**
 * Selects which spatial transform buffers are allocated by `ComponentStorage`.
 * Disabling a dimension keeps its buffer empty so pure 2D games do not pay the memory cost of 3D transforms (ADR-0004).
 *
 * @example
 * ```ts
 * const storage2D = new ComponentStorage(4096, false, { transform2D: true, transform3D: false });
 * ```
 */
export interface ComponentStorageLayout {
    /** Allocates the `transform2D` buffer (defaults to `true`). */
    transform2D?: boolean;
    /** Allocates the `transform3D` buffer (defaults to `true`). */
    transform3D?: boolean;
}

/**
 * Structure-of-Arrays (SoA) contiguous memory store for all ECS entities.
 * Allocates flat `TypedArrays` backed by `SharedArrayBuffer` (when supported and requested)
 * or standard `ArrayBuffer`, enabling zero-GC component access, $O(1)$ prefab slot cloning,
 * and direct binary snapshot serialization.
 *
 * @example
 * ```ts
 * const storage = new ComponentStorage(1024);
 * const offset = storage.getTransform2DOffset(entityId);
 * storage.transform2D[offset] = 100; // X position
 * ```
 */
export class ComponentStorage {
    readonly #capacity: number;
    readonly #isSharedMemory: boolean;
    readonly #layoutFlags: number;

    /** Bitmask of active `ComponentMask` flags per entity (`Uint32Array(capacity)`). */
    public readonly componentMasks: Uint32Array;

    /** Bitmask of active `DirtyFlag` bits per entity (`Uint8Array(capacity)`). */
    public readonly dirtyFlags: Uint8Array;

    /** Alive status per entity (`1` = active, `0` = pooled/free). */
    public readonly aliveFlags: Uint8Array;

    /** Contiguous 2D transform float components (`capacity * TRANSFORM_2D_STRIDE`, empty when the layout disables 2D). */
    public readonly transform2D: Float32Array;

    /** Contiguous 3D transform float components (`capacity * TRANSFORM_3D_STRIDE`, empty when the layout disables 3D). */
    public readonly transform3D: Float32Array;

    /** Contiguous 2D/3D collider float components (`capacity * COLLIDER_STRIDE`). */
    public readonly collider: Float32Array;

    /** Contiguous rigid-body physics float components (`capacity * RIGIDBODY_STRIDE`). */
    public readonly rigidBody: Float32Array;

    /** Contiguous visual asset and layer metadata (`capacity * VISUAL_STRIDE`). */
    public readonly visual: Uint32Array;

    /**
     * Allocates contiguous SoA component buffers for up to `capacity` entities.
     *
     * @param capacity Maximum number of simultaneous entities (defaults to `4096`)
     * @param useSharedMemory Whether to attempt `SharedArrayBuffer` allocation for Worker zero-copy
     * @param layout Which spatial transform buffers to allocate (defaults to both 2D and 3D)
     */
    constructor(
        capacity: number = 4096,
        useSharedMemory: boolean = false,
        layout: ComponentStorageLayout = {},
    ) {
        this.#capacity = Math.max(1, Math.floor(capacity));
        const canShare = useSharedMemory && typeof SharedArrayBuffer !== "undefined";
        this.#isSharedMemory = canShare;

        const has2D = layout.transform2D ?? true;
        const has3D = layout.transform3D ?? true;
        this.#layoutFlags =
            (has2D ? StorageLayoutFlag.TRANSFORM_2D : 0) |
            (has3D ? StorageLayoutFlag.TRANSFORM_3D : 0);

        const allocBuffer = (byteLength: number): ArrayBufferLike =>
            canShare ? new SharedArrayBuffer(byteLength) : new ArrayBuffer(byteLength);

        this.componentMasks = new Uint32Array(
            allocBuffer(this.#capacity * Uint32Array.BYTES_PER_ELEMENT),
        );
        this.dirtyFlags = new Uint8Array(
            allocBuffer(this.#capacity * Uint8Array.BYTES_PER_ELEMENT),
        );
        this.aliveFlags = new Uint8Array(
            allocBuffer(this.#capacity * Uint8Array.BYTES_PER_ELEMENT),
        );
        this.transform2D = new Float32Array(
            allocBuffer(
                has2D ? this.#capacity * TRANSFORM_2D_STRIDE * Float32Array.BYTES_PER_ELEMENT : 0,
            ),
        );
        this.transform3D = new Float32Array(
            allocBuffer(
                has3D ? this.#capacity * TRANSFORM_3D_STRIDE * Float32Array.BYTES_PER_ELEMENT : 0,
            ),
        );
        this.collider = new Float32Array(
            allocBuffer(this.#capacity * COLLIDER_STRIDE * Float32Array.BYTES_PER_ELEMENT),
        );
        this.rigidBody = new Float32Array(
            allocBuffer(this.#capacity * RIGIDBODY_STRIDE * Float32Array.BYTES_PER_ELEMENT),
        );
        this.visual = new Uint32Array(
            allocBuffer(this.#capacity * VISUAL_STRIDE * Uint32Array.BYTES_PER_ELEMENT),
        );
    }

    /** Maximum number of entities supported by this storage instance. */
    public get capacity(): number {
        return this.#capacity;
    }

    /** Indicates whether the underlying TypedArrays are backed by `SharedArrayBuffer`. */
    public get isSharedMemory(): boolean {
        return this.#isSharedMemory;
    }

    /** Bitmask of allocated transform buffers (`StorageLayoutFlag`). */
    public get layoutFlags(): number {
        return this.#layoutFlags;
    }

    /** Whether the `transform2D` buffer is allocated. */
    public get has2D(): boolean {
        return (this.#layoutFlags & StorageLayoutFlag.TRANSFORM_2D) !== 0;
    }

    /** Whether the `transform3D` buffer is allocated. */
    public get has3D(): boolean {
        return (this.#layoutFlags & StorageLayoutFlag.TRANSFORM_3D) !== 0;
    }

    /**
     * Returns the starting index in `transform2D` for `entityId`.
     *
     * @param entityId Target entity ID
     * @returns Starting float index (`entityId * TRANSFORM_2D_STRIDE`)
     * @example
     * ```ts
     * const base = storage.getTransform2DOffset(1);
     * ```
     */
    public getTransform2DOffset(entityId: number): number {
        return entityId * TRANSFORM_2D_STRIDE;
    }

    /**
     * Returns the starting index in `transform3D` for `entityId`.
     *
     * @param entityId Target entity ID
     * @returns Starting float index (`entityId * TRANSFORM_3D_STRIDE`)
     * @example
     * ```ts
     * const base = storage.getTransform3DOffset(1);
     * ```
     */
    public getTransform3DOffset(entityId: number): number {
        return entityId * TRANSFORM_3D_STRIDE;
    }

    /**
     * Returns the starting index in `collider` for `entityId`.
     *
     * @param entityId Target entity ID
     * @returns Starting float index (`entityId * COLLIDER_STRIDE`)
     * @example
     * ```ts
     * const base = storage.getColliderOffset(1);
     * ```
     */
    public getColliderOffset(entityId: number): number {
        return entityId * COLLIDER_STRIDE;
    }

    /**
     * Returns the starting index in `rigidBody` for `entityId`.
     *
     * @param entityId Target entity ID
     * @returns Starting float index (`entityId * RIGIDBODY_STRIDE`)
     * @example
     * ```ts
     * const base = storage.getRigidBodyOffset(1);
     * ```
     */
    public getRigidBodyOffset(entityId: number): number {
        return entityId * RIGIDBODY_STRIDE;
    }

    /**
     * Returns the starting index in `visual` for `entityId`.
     *
     * @param entityId Target entity ID
     * @returns Starting uint32 index (`entityId * VISUAL_STRIDE`)
     * @example
     * ```ts
     * const base = storage.getVisualOffset(1);
     * ```
     */
    public getVisualOffset(entityId: number): number {
        return entityId * VISUAL_STRIDE;
    }

    /**
     * Sets dirty flags on `entityId`.
     *
     * @param entityId Target entity ID
     * @param flags Bitwise OR of `DirtyFlag` values
     * @example
     * ```ts
     * storage.markDirty(entityId, DirtyFlag.TRANSFORM);
     * ```
     */
    public markDirty(entityId: number, flags: number): void {
        this.dirtyFlags[entityId] |= flags;
    }

    /**
     * Clears all dirty flags on `entityId`.
     *
     * @param entityId Target entity ID
     * @example
     * ```ts
     * storage.clearDirty(entityId);
     * ```
     */
    public clearDirty(entityId: number): void {
        this.dirtyFlags[entityId] = DirtyFlag.NONE;
    }

    /**
     * Clears dirty flags of entity slots `0 .. limit - 1` in $O(limit)$ using a native `TypedArray.fill`.
     * Pass the world high-water mark as `limit` to skip never-allocated slots.
     *
     * @param limit Number of leading slots to clear (defaults to `capacity`)
     * @example
     * ```ts
     * storage.clearAllDirty(world.highWaterMark);
     * ```
     */
    public clearAllDirty(limit: number = this.#capacity): void {
        this.dirtyFlags.fill(DirtyFlag.NONE, 0, limit);
    }

    /**
     * Resets all component slots of `entityId` to default values in $O(1)$ time.
     *
     * @param entityId Entity slot to initialize or clear
     * @example
     * ```ts
     * storage.resetEntitySlot(entityId);
     * ```
     */
    public resetEntitySlot(entityId: number): void {
        this.componentMasks[entityId] = ComponentMask.NONE;
        this.dirtyFlags[entityId] = DirtyFlag.TRANSFORM | DirtyFlag.RENDER;

        if (this.has2D) {
            const t2 = entityId * TRANSFORM_2D_STRIDE;
            this.transform2D.fill(0, t2, t2 + TRANSFORM_2D_STRIDE);
            // Default 2D scale (1, 1) and opacity (1)
            this.transform2D[t2 + 4] = 1;
            this.transform2D[t2 + 5] = 1;
            this.transform2D[t2 + 13] = 1;
        }

        if (this.has3D) {
            const t3 = entityId * TRANSFORM_3D_STRIDE;
            this.transform3D.fill(0, t3, t3 + TRANSFORM_3D_STRIDE);
            // Default 3D scale (1, 1, 1), identity quaternion w = 1, and opacity (1)
            this.transform3D[t3 + 3] = 1;
            this.transform3D[t3 + 4] = 1;
            this.transform3D[t3 + 5] = 1;
            this.transform3D[t3 + 12] = 1;
            this.transform3D[t3 + 13] = 1;
        }

        const c = entityId * COLLIDER_STRIDE;
        this.collider.fill(0, c, c + COLLIDER_STRIDE);

        const rb = entityId * RIGIDBODY_STRIDE;
        this.rigidBody.fill(0, rb, rb + RIGIDBODY_STRIDE);
        this.rigidBody[rb + 6] = 1; // default mass = 1

        const v = entityId * VISUAL_STRIDE;
        this.visual.fill(0, v, v + VISUAL_STRIDE);
        this.visual[v + 2] = 1; // default visibility = true
    }

    /**
     * Copies all component data from `sourceEntityId` (e.g. a Prefab) into `targetEntityId` in $O(1)$
     * using native `TypedArray.copyWithin`.
     *
     * @param sourceEntityId Source template/prefab entity ID
     * @param targetEntityId Destination instance entity ID
     * @example
     * ```ts
     * storage.copyEntitySlot(prefabId, instanceId);
     * ```
     */
    public copyEntitySlot(sourceEntityId: number, targetEntityId: number): void {
        if (sourceEntityId === targetEntityId) return;

        this.componentMasks[targetEntityId] = this.componentMasks[sourceEntityId];
        this.dirtyFlags[targetEntityId] = DirtyFlag.TRANSFORM | DirtyFlag.RENDER;

        if (this.has2D) {
            const srcT2 = sourceEntityId * TRANSFORM_2D_STRIDE;
            const dstT2 = targetEntityId * TRANSFORM_2D_STRIDE;
            this.transform2D.copyWithin(dstT2, srcT2, srcT2 + TRANSFORM_2D_STRIDE);
        }

        if (this.has3D) {
            const srcT3 = sourceEntityId * TRANSFORM_3D_STRIDE;
            const dstT3 = targetEntityId * TRANSFORM_3D_STRIDE;
            this.transform3D.copyWithin(dstT3, srcT3, srcT3 + TRANSFORM_3D_STRIDE);
        }

        const srcC = sourceEntityId * COLLIDER_STRIDE;
        const dstC = targetEntityId * COLLIDER_STRIDE;
        this.collider.copyWithin(dstC, srcC, srcC + COLLIDER_STRIDE);

        const srcRb = sourceEntityId * RIGIDBODY_STRIDE;
        const dstRb = targetEntityId * RIGIDBODY_STRIDE;
        this.rigidBody.copyWithin(dstRb, srcRb, srcRb + RIGIDBODY_STRIDE);

        const srcV = sourceEntityId * VISUAL_STRIDE;
        const dstV = targetEntityId * VISUAL_STRIDE;
        this.visual.copyWithin(dstV, srcV, srcV + VISUAL_STRIDE);
    }
}
