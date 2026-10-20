import { ComponentMask, ComponentStorage, ComponentStorageLayout } from "./ComponentStorage";

/**
 * Central Entity-Component-System (ECS) World managing entity lifecycles, component bitmasks,
 * fast queries, and transparent $O(1)$ Object Pooling via an internal free-list.
 *
 * Every slot carries a **generation** counter that is incremented whenever the slot is destroyed
 * or the world is cleared. A handle is the pair `(entityId, generation)`: comparing the stored
 * generation with `generationOf(entityId)` detects stale handles that point to a recycled slot.
 *
 * @example
 * ```ts
 * const world = new ECSWorld(2048);
 * const playerEntity = world.createEntity(ComponentMask.TRANSFORM_2D | ComponentMask.COLLIDER);
 * const bulletClone = world.instantiateFrom(playerEntity);
 * world.destroyEntity(bulletClone); // Recycled into the free-list in O(1)
 * ```
 */
export class ECSWorld {
    readonly #storage: ComponentStorage;
    readonly #generations: Uint32Array;
    readonly #freeList: number[] = [];
    #nextEntityId: number = 0;
    #activeCount: number = 0;

    /**
     * Creates a new `ECSWorld` with pre-allocated `ComponentStorage`.
     *
     * @param maxEntities Maximum number of simultaneous entities (defaults to `4096`)
     * @param useSharedMemory Whether to allocate `SharedArrayBuffer` for Worker threads
     * @param layout Which spatial transform buffers to allocate (defaults to both 2D and 3D)
     */
    constructor(
        maxEntities: number = 4096,
        useSharedMemory: boolean = false,
        layout: ComponentStorageLayout = {},
    ) {
        this.#storage = new ComponentStorage(maxEntities, useSharedMemory, layout);
        this.#generations = new Uint32Array(this.#storage.capacity);
    }

    /** Underlying Structure-of-Arrays `ComponentStorage`. */
    public get storage(): ComponentStorage {
        return this.#storage;
    }

    /** Total number of currently alive entities in the world. */
    public get activeCount(): number {
        return this.#activeCount;
    }

    /** High-water mark of entity IDs allocated so far. */
    public get highWaterMark(): number {
        return this.#nextEntityId;
    }

    /** Number of recycled entity slots currently available in the free-list pool. */
    public get pooledCount(): number {
        return this.#freeList.length;
    }

    /**
     * Returns the current generation of the slot `entityId`.
     * Store it next to `entityId` when the entity is created and compare later via `isAlive(entityId, generation)`.
     *
     * @param entityId Entity slot to inspect
     * @returns Current slot generation (starts at `0`)
     * @example
     * ```ts
     * const id = world.createEntity();
     * const gen = world.generationOf(id);
     * world.destroyEntity(id);
     * world.isAlive(id, gen); // false, even after the slot is recycled
     * ```
     */
    public generationOf(entityId: number): number {
        return this.#generations[entityId] ?? 0;
    }

    /**
     * Allocates a new or recycled `entityId` in $O(1)$ time and initializes its component slots.
     *
     * @param initialMask Initial `ComponentMask` bitmask (defaults to `ComponentMask.NONE`)
     * @returns Allocated `entityId`
     * @throws {Error} When `maxEntities` capacity is exceeded
     * @example
     * ```ts
     * const id = world.createEntity(ComponentMask.TRANSFORM_2D);
     * ```
     */
    public createEntity(initialMask: number = ComponentMask.NONE): number {
        let entityId: number;
        if (this.#freeList.length > 0) {
            entityId = this.#freeList.pop()!;
        } else {
            if (this.#nextEntityId >= this.#storage.capacity) {
                throw new Error(
                    `ECSWorld capacity exceeded (maxEntities = ${this.#storage.capacity}).`,
                );
            }
            entityId = this.#nextEntityId++;
        }

        this.#storage.resetEntitySlot(entityId);
        this.#storage.aliveFlags[entityId] = 1;
        this.#storage.componentMasks[entityId] = initialMask;
        this.#activeCount++;
        return entityId;
    }

    /**
     * Instantiates a new entity in $O(1)$ time by recycling a pooled slot (or allocating a new one)
     * and copying all SoA component data from `prefabEntityId`.
     *
     * @param prefabEntityId Source template/prefab entity ID
     * @returns Newly instantiated `entityId` with identical component state
     * @example
     * ```ts
     * const projectileId = world.instantiateFrom(prefabProjectileId);
     * ```
     */
    public instantiateFrom(prefabEntityId: number): number {
        const instanceId = this.createEntity(this.#storage.componentMasks[prefabEntityId]);
        this.#storage.copyEntitySlot(prefabEntityId, instanceId);
        return instanceId;
    }

    /**
     * Destroys `entityId` in $O(1)$ time and returns its slot to the internal Object Pool free-list.
     * Safe to call multiple times on the same ID (idempotent).
     *
     * @param entityId Entity ID to recycle
     * @returns `true` if the entity was alive and recycled, `false` if already inactive
     * @example
     * ```ts
     * world.destroyEntity(bulletId);
     * ```
     */
    public destroyEntity(entityId: number): boolean {
        if (
            entityId < 0 ||
            entityId >= this.#nextEntityId ||
            this.#storage.aliveFlags[entityId] === 0
        ) {
            return false;
        }

        this.#storage.aliveFlags[entityId] = 0;
        this.#storage.componentMasks[entityId] = ComponentMask.NONE;
        this.#generations[entityId]++;
        this.#freeList.push(entityId);
        this.#activeCount--;
        return true;
    }

    /**
     * Checks whether `entityId` is currently alive in the world.
     * When `generation` is provided, also verifies that the slot was not recycled since that generation was read.
     *
     * @param entityId Entity ID to inspect
     * @param generation Optional generation captured via `generationOf(entityId)`
     * @returns `true` if alive (and, when `generation` is given, still owned by the same handle)
     * @example
     * ```ts
     * if (world.isAlive(id, gen)) { ... }
     * ```
     */
    public isAlive(entityId: number, generation?: number): boolean {
        return (
            entityId >= 0 &&
            entityId < this.#nextEntityId &&
            this.#storage.aliveFlags[entityId] === 1 &&
            (generation === undefined || this.#generations[entityId] === generation)
        );
    }

    /**
     * Attaches one or more `ComponentMask` flags to `entityId`.
     *
     * @param entityId Target entity ID
     * @param mask Bitwise OR of `ComponentMask` flags to add
     * @example
     * ```ts
     * world.addComponent(id, ComponentMask.RIGIDBODY);
     * ```
     */
    public addComponent(entityId: number, mask: number): void {
        this.#storage.componentMasks[entityId] |= mask;
    }

    /**
     * Removes one or more `ComponentMask` flags from `entityId`.
     *
     * @param entityId Target entity ID
     * @param mask Bitwise OR of `ComponentMask` flags to remove
     * @example
     * ```ts
     * world.removeComponent(id, ComponentMask.COLLIDER);
     * ```
     */
    public removeComponent(entityId: number, mask: number): void {
        this.#storage.componentMasks[entityId] &= ~mask;
    }

    /**
     * Checks whether `entityId` possesses all bits specified in `mask`.
     *
     * @param entityId Target entity ID
     * @param mask Bitwise OR of required `ComponentMask` flags
     * @returns `true` if all specified components are present on `entityId`
     * @example
     * ```ts
     * if (world.hasComponent(id, ComponentMask.TRANSFORM_2D | ComponentMask.COLLIDER)) { ... }
     * ```
     */
    public hasComponent(entityId: number, mask: number): boolean {
        return (this.#storage.componentMasks[entityId] & mask) === mask;
    }

    /**
     * Returns all alive `entityId`s whose component bitmask includes `requiredMask`.
     * Pass a reusable `out` array inside the game loop to avoid a per-call allocation.
     *
     * @param requiredMask Bitmask of required components
     * @param out Optional array that is cleared and filled with the results
     * @returns `out` (or a new array) with the matching `entityId` numbers
     * @example
     * ```ts
     * const scratch: number[] = [];
     * world.query(ComponentMask.TRANSFORM_2D | ComponentMask.RIGIDBODY, scratch);
     * ```
     */
    public query(requiredMask: number, out: number[] = []): number[] {
        const results = out;
        results.length = 0;
        const alive = this.#storage.aliveFlags;
        const masks = this.#storage.componentMasks;
        const limit = this.#nextEntityId;

        for (let id = 0; id < limit; id++) {
            if (alive[id] === 1 && (masks[id] & requiredMask) === requiredMask) {
                results.push(id);
            }
        }
        return results;
    }

    /**
     * Clears the dirty flags of all allocated slots (`0 .. highWaterMark - 1`).
     *
     * @example
     * ```ts
     * world.clearAllDirty(); // end of frame
     * ```
     */
    public clearAllDirty(): void {
        this.#storage.clearAllDirty(this.#nextEntityId);
    }

    /**
     * Restores the internal entity allocator state during binary snapshot deserialization.
     *
     * @param nextEntityId Restored high-water mark
     * @param activeCount Restored count of alive entities
     * @param freeList Restored array of pooled entity IDs
     */
    public restoreInternalState(
        nextEntityId: number,
        activeCount: number,
        freeList: number[],
    ): void {
        this.#nextEntityId = nextEntityId;
        this.#activeCount = activeCount;
        this.#freeList.length = 0;
        for (let i = 0; i < freeList.length; i++) {
            this.#freeList.push(freeList[i]);
        }
    }

    /**
     * Returns a copy of the current free-list for snapshot serialization.
     *
     * @returns Array of recycled entity IDs
     */
    public getFreeListSnapshot(): number[] {
        return this.#freeList.slice();
    }

    /**
     * Clears all entities and resets the world allocator to its initial empty state.
     * Generations of every previously allocated slot are incremented so old handles become stale.
     *
     * @example
     * ```ts
     * world.clear();
     * ```
     */
    public clear(): void {
        this.#storage.aliveFlags.fill(0, 0, this.#nextEntityId);
        this.#storage.componentMasks.fill(0, 0, this.#nextEntityId);
        this.#storage.dirtyFlags.fill(0, 0, this.#nextEntityId);
        for (let id = 0; id < this.#nextEntityId; id++) {
            this.#generations[id]++;
        }
        this.#freeList.length = 0;
        this.#nextEntityId = 0;
        this.#activeCount = 0;
    }
}
