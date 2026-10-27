import { BrioObject3D } from "../objects/BrioObject3D";

/**
 * 3D Spatial Grid/Octree broadphase structure for partitioning `BrioObject3D` colliders in 3D space.
 * Eliminates $O(N^2)$ pair checks by hashing 3D bounding volumes into uniform 3D spatial cells.
 *
 * @example
 * ```ts
 * const octree = new SpatialOctree3D(32);
 * const pairs = octree.getPotentialPairs(sceneObjects3D);
 * ```
 */
export class SpatialOctree3D {
    readonly #cellSize: number;
    readonly #invCellSize: number;
    readonly #cells = new Map<string, BrioObject3D[]>();

    /**
     * Creates a new `SpatialOctree3D` instance.
     *
     * @param cellSize Side length of each 3D spatial cell in world units (defaults to `32`)
     */
    constructor(cellSize: number = 32) {
        this.#cellSize = Math.max(1e-3, cellSize);
        this.#invCellSize = 1 / this.#cellSize;
    }

    /** Side length of each 3D cell in world units. */
    public get cellSize(): number {
        return this.#cellSize;
    }

    /**
     * Clears all 3D spatial cells.
     */
    public clear(): void {
        this.#cells.clear();
    }

    /**
     * Inserts a `BrioObject3D` into all 3D spatial cells overlapped by its collider.
     *
     * @param object 3D object to insert
     */
    public insert(object: BrioObject3D): void {
        if (!object.collision || !object.collision.enabled) return;

        const minX = object.transform.position.x + object.collision.pos.x;
        const minY = object.transform.position.y + object.collision.pos.y;
        const minZ = object.transform.position.z + object.collision.pos.z;

        const sx = object.collision.size.x;
        const sy = object.collision.shape === "sphere" ? sx : object.collision.size.y;
        const sz = object.collision.shape === "sphere" ? sx : object.collision.size.z;

        const x0 = Math.floor(minX * this.#invCellSize);
        const x1 = Math.floor((minX + sx) * this.#invCellSize);
        const y0 = Math.floor(minY * this.#invCellSize);
        const y1 = Math.floor((minY + sy) * this.#invCellSize);
        const z0 = Math.floor(minZ * this.#invCellSize);
        const z1 = Math.floor((minZ + sz) * this.#invCellSize);

        for (let cx = x0; cx <= x1; cx++) {
            for (let cy = y0; cy <= y1; cy++) {
                for (let cz = z0; cz <= z1; cz++) {
                    const key = `${cx},${cy},${cz}`;
                    let bucket = this.#cells.get(key);
                    if (!bucket) {
                        bucket = [];
                        this.#cells.set(key, bucket);
                    }
                    bucket.push(object);
                }
            }
        }
    }

    /**
     * Partitions `objects` and returns all unique candidate 3D collision pairs `[a, b]`.
     *
     * @param objects Iterable collection of `BrioObject3D` instances
     * @returns Array of unique candidate `[BrioObject3D, BrioObject3D]` pairs
     */
    public getPotentialPairs(objects: Iterable<BrioObject3D>): [BrioObject3D, BrioObject3D][] {
        this.clear();
        for (const obj of objects) {
            if (obj.collision && obj.collision.enabled) {
                this.insert(obj);
            }
        }

        const seen = new Set<string>();
        const pairs: [BrioObject3D, BrioObject3D][] = [];

        for (const bucket of this.#cells.values()) {
            const len = bucket.length;
            if (len < 2) continue;

            for (let i = 0; i < len; i++) {
                for (let j = i + 1; j < len; j++) {
                    const a = bucket[i];
                    const b = bucket[j];
                    const key =
                        a.name < b.name ? `${a.name}::${b.name}` : `${b.name}::${a.name}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        pairs.push([a, b]);
                    }
                }
            }
        }
        return pairs;
    }
}
