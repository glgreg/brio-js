import { BrioObject2D } from "../objects/BrioObject2D";

/**
 * Uniform 2D Spatial Hash Grid for broadphase collision partitioning.
 * Partitions 2D space into cells of `cellSize x cellSize` pixels so narrow-phase intersection tests
 * only run between objects sharing at least one spatial cell, avoiding $O(N^2)$ pair checks.
 *
 * @example
 * ```ts
 * const grid = new SpatialHash2D(128);
 * grid.insert(player);
 * grid.insert(enemy);
 * const candidates = grid.queryNear(player);
 * ```
 */
export class SpatialHash2D {
    readonly #cellSize: number;
    readonly #invCellSize: number;
    readonly #cells = new Map<string, BrioObject2D[]>();

    /**
     * Creates a new `SpatialHash2D` broadphase structure.
     *
     * @param cellSize Width and height of each spatial cell in pixels (defaults to `128`)
     */
    constructor(cellSize: number = 128) {
        this.#cellSize = Math.max(1, cellSize);
        this.#invCellSize = 1 / this.#cellSize;
    }

    /** Size of each spatial cell in pixels. */
    public get cellSize(): number {
        return this.#cellSize;
    }

    /**
     * Clears all cells in the spatial hash grid.
     *
     * @example
     * ```ts
     * grid.clear();
     * ```
     */
    public clear(): void {
        this.#cells.clear();
    }

    /**
     * Inserts a `BrioObject2D` into all spatial cells overlapped by its collider (or transform bounds).
     *
     * @param object Object to insert
     * @example
     * ```ts
     * grid.insert(obj);
     * ```
     */
    public insert(object: BrioObject2D): void {
        if (object.collision && !object.collision.enabled) return;

        const minX = object.transform.position.x + (object.collision ? object.collision.pos.x : 0);
        const minY = object.transform.position.y + (object.collision ? object.collision.pos.y : 0);
        const width = object.collision ? object.collision.size.x : object.transform.renderSize.x;
        const height = object.collision ? object.collision.size.y : object.transform.renderSize.y;

        const startCellX = Math.floor(minX * this.#invCellSize);
        const endCellX = Math.floor((minX + width) * this.#invCellSize);
        const startCellY = Math.floor(minY * this.#invCellSize);
        const endCellY = Math.floor((minY + height) * this.#invCellSize);

        for (let cx = startCellX; cx <= endCellX; cx++) {
            for (let cy = startCellY; cy <= endCellY; cy++) {
                const key = `${cx},${cy}`;
                let bucket = this.#cells.get(key);
                if (!bucket) {
                    bucket = [];
                    this.#cells.set(key, bucket);
                }
                bucket.push(object);
            }
        }
    }

    /**
     * Queries all unique objects sharing at least one spatial cell with `object` (excluding `object` itself).
     *
     * @param object Query target object
     * @returns Array of nearby candidate `BrioObject2D` instances
     * @example
     * ```ts
     * const nearby = grid.queryNear(player);
     * ```
     */
    public queryNear(object: BrioObject2D): BrioObject2D[] {
        const result = new Set<BrioObject2D>();
        const minX = object.transform.position.x + (object.collision ? object.collision.pos.x : 0);
        const minY = object.transform.position.y + (object.collision ? object.collision.pos.y : 0);
        const width = object.collision ? object.collision.size.x : object.transform.renderSize.x;
        const height = object.collision ? object.collision.size.y : object.transform.renderSize.y;

        const startCellX = Math.floor(minX * this.#invCellSize);
        const endCellX = Math.floor((minX + width) * this.#invCellSize);
        const startCellY = Math.floor(minY * this.#invCellSize);
        const endCellY = Math.floor((minY + height) * this.#invCellSize);

        for (let cx = startCellX; cx <= endCellX; cx++) {
            for (let cy = startCellY; cy <= endCellY; cy++) {
                const bucket = this.#cells.get(`${cx},${cy}`);
                if (!bucket) continue;
                for (let i = 0; i < bucket.length; i++) {
                    const candidate = bucket[i];
                    if (candidate !== object) {
                        result.add(candidate);
                    }
                }
            }
        }
        return Array.from(result);
    }

    /**
     * Populates the grid from `objects` and returns all unique candidate collision pairs `[a, b]`.
     *
     * @param objects Collection of 2D objects to partition
     * @returns Array of unique candidate `[BrioObject2D, BrioObject2D]` pairs
     * @example
     * ```ts
     * const pairs = grid.getPotentialPairs(sceneObjects);
     * ```
     */
    public getPotentialPairs(objects: Iterable<BrioObject2D>): [BrioObject2D, BrioObject2D][] {
        this.clear();
        for (const obj of objects) {
            if (obj.collision && obj.collision.enabled) {
                this.insert(obj);
            }
        }

        const seenPairs = new Set<string>();
        const pairs: [BrioObject2D, BrioObject2D][] = [];

        for (const bucket of this.#cells.values()) {
            const len = bucket.length;
            if (len < 2) continue;

            for (let i = 0; i < len; i++) {
                for (let j = i + 1; j < len; j++) {
                    const a = bucket[i];
                    const b = bucket[j];
                    const key =
                        a.name < b.name ? `${a.name}::${b.name}` : `${b.name}::${a.name}`;
                    if (!seenPairs.has(key)) {
                        seenPairs.add(key);
                        pairs.push([a, b]);
                    }
                }
            }
        }
        return pairs;
    }
}
