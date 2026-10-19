import { BrioCollision } from "../math/BrioCollision";
import { BrioObject } from "../objects/BrioObject";
import { BrioObject2D } from "../objects/BrioObject2D";

/**
 * Rectangular merged collider generated automatically by `BrioTileMap.buildMergedColliders()`.
 */
export interface MergedTileCollider {
    /** World X coordinate of the merged rectangle in pixels. */
    x: number;
    /** World Y coordinate of the merged rectangle in pixels. */
    y: number;
    /** Width of the merged rectangle in pixels. */
    width: number;
    /** Height of the merged rectangle in pixels. */
    height: number;
}

/**
 * Grid-based 2D spatial map (`BrioTileMap`) composed of reusable tile IDs (`0` = empty, `> 0` = tile index)
 * with greedy 2D rectangle merging (`buildMergedColliders`) that collapses adjacent solid tiles into
 * minimal AABB colliders for high-performance physics.
 *
 * @example
 * ```ts
 * const tilemap = new BrioTileMap("map_level_1", 32, 32, [
 *     [1, 1, 1, 1],
 *     [1, 0, 0, 1],
 *     [1, 1, 1, 1],
 * ]);
 * const wallColliders = tilemap.createColliderObjects();
 * ```
 */
export class BrioTileMap {
    readonly #name: string;
    readonly #tileWidth: number;
    readonly #tileHeight: number;
    readonly #grid: number[][];
    readonly #rows: number;
    readonly #columns: number;
    readonly #solidTileIds: Set<number>;

    /**
     * Creates a new `BrioTileMap` from a 2D matrix of tile IDs.
     *
     * @param name Unique tilemap identifier
     * @param tileWidth Width of each tile cell in pixels
     * @param tileHeight Height of each tile cell in pixels
     * @param grid 2D array (`rows x columns`) of integer tile IDs (`0` = empty)
     * @param solidTileIds Optional list of tile IDs treated as solid obstacles (if omitted, all IDs `> 0` are solid)
     */
    constructor(
        name: string,
        tileWidth: number,
        tileHeight: number,
        grid: number[][],
        solidTileIds?: number[],
    ) {
        this.#name = name;
        this.#tileWidth = Math.max(1, Math.floor(tileWidth));
        this.#tileHeight = Math.max(1, Math.floor(tileHeight));
        this.#grid = grid.map((row) => row.slice());
        this.#rows = this.#grid.length;
        this.#columns = this.#rows > 0 ? this.#grid[0].length : 0;
        this.#solidTileIds = new Set(solidTileIds);
    }

    /** Unique identifier of the tilemap. */
    public get name(): string {
        return this.#name;
    }

    /** Width of a single tile in pixels. */
    public get tileWidth(): number {
        return this.#tileWidth;
    }

    /** Height of a single tile in pixels. */
    public get tileHeight(): number {
        return this.#tileHeight;
    }

    /** Number of tile rows. */
    public get rows(): number {
        return this.#rows;
    }

    /** Number of tile columns. */
    public get columns(): number {
        return this.#columns;
    }

    /** Total map width in pixels (`columns * tileWidth`). */
    public get widthInPixels(): number {
        return this.#columns * this.#tileWidth;
    }

    /** Total map height in pixels (`rows * tileHeight`). */
    public get heightInPixels(): number {
        return this.#rows * this.#tileHeight;
    }

    /**
     * Returns the tile ID at `(col, row)`, or `0` if out of bounds.
     *
     * @param col Zero-based column index
     * @param row Zero-based row index
     * @returns Tile ID
     */
    public getTile(col: number, row: number): number {
        if (row < 0 || row >= this.#rows || col < 0 || col >= this.#columns) return 0;
        return this.#grid[row][col] ?? 0;
    }

    /**
     * Updates the tile ID at `(col, row)`.
     *
     * @param col Zero-based column index
     * @param row Zero-based row index
     * @param tileId New integer tile ID
     */
    public setTile(col: number, row: number, tileId: number): void {
        if (row < 0 || row >= this.#rows || col < 0 || col >= this.#columns) return;
        this.#grid[row][col] = tileId;
    }

    /**
     * Checks whether a given `tileId` is configured as a solid collision tile.
     *
     * @param tileId Tile ID to inspect
     * @returns `true` if solid
     */
    public isSolidTile(tileId: number): boolean {
        if (tileId <= 0) return false;
        return this.#solidTileIds.size === 0 ? true : this.#solidTileIds.has(tileId);
    }

    /**
     * Uses a 2D greedy meshing algorithm to merge adjacent solid tiles horizontally and vertically
     * into the minimum number of rectangular `MergedTileCollider` regions.
     *
     * @returns Array of merged rectangular collider bounds in pixel coordinates
     * @example
     * ```ts
     * const merged = tilemap.buildMergedColliders();
     * ```
     */
    public buildMergedColliders(): MergedTileCollider[] {
        const visited: boolean[][] = Array.from({ length: this.#rows }, () =>
            new Array<boolean>(this.#columns).fill(false),
        );
        const colliders: MergedTileCollider[] = [];

        for (let r = 0; r < this.#rows; r++) {
            for (let c = 0; c < this.#columns; c++) {
                if (visited[r][c] || !this.isSolidTile(this.getTile(c, r))) {
                    continue;
                }

                // Expand width along current row
                let spanCols = 1;
                while (
                    c + spanCols < this.#columns &&
                    !visited[r][c + spanCols] &&
                    this.isSolidTile(this.getTile(c + spanCols, r))
                ) {
                    spanCols++;
                }

                // Expand height downward across subsequent rows while all columns in [c, c + spanCols) are solid
                let spanRows = 1;
                let canExpandRow = true;
                while (r + spanRows < this.#rows && canExpandRow) {
                    for (let k = 0; k < spanCols; k++) {
                        if (
                            visited[r + spanRows][c + k] ||
                            !this.isSolidTile(this.getTile(c + k, r + spanRows))
                        ) {
                            canExpandRow = false;
                            break;
                        }
                    }
                    if (canExpandRow) {
                        spanRows++;
                    }
                }

                // Mark merged rectangle as visited
                for (let dr = 0; dr < spanRows; dr++) {
                    for (let dc = 0; dc < spanCols; dc++) {
                        visited[r + dr][c + dc] = true;
                    }
                }

                colliders.push({
                    x: c * this.#tileWidth,
                    y: r * this.#tileHeight,
                    width: spanCols * this.#tileWidth,
                    height: spanRows * this.#tileHeight,
                });
            }
        }

        return colliders;
    }

    /**
     * Generates invisible solid `BrioObject2D` collider entities for all merged solid regions in this tilemap.
     *
     * @returns Array of configured `BrioObject2D` instances with `"solid"` rectangular colliders
     * @example
     * ```ts
     * const walls = tilemap.createColliderObjects();
     * ```
     */
    public createColliderObjects(): BrioObject2D[] {
        const regions = this.buildMergedColliders();
        return regions.map((rect, idx) => {
            const obj = new BrioObject2D(`${this.#name}_collider_${idx}`, "", 0);
            obj.transform.position = { x: rect.x, y: rect.y };
            obj.transform.size = { x: rect.width, y: rect.height };
            obj.transform.visibility = false;
            BrioCollision.addRectangle({
                object: obj as unknown as BrioObject,
                colliderType: "solid",
                pos: { x: 0, y: 0 },
                size: { x: rect.width, y: rect.height },
            });
            return obj;
        });
    }
}
