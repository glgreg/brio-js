import { BrioAnimation, BrioAnimationOptions } from "./BrioAnimation";
import { BrioSprite } from "./BrioSprite";
import { BrioTexture, TextureRegistry } from "./BrioTexture";

/**
 * Rectangular sub-region (`x, y, width, height`) of a cell within a `BrioSpriteSheet`.
 */
export interface SpriteSheetCellRect {
    /** Zero-based column index. */
    col: number;
    /** Zero-based row index. */
    row: number;
    /** Pixel X offset in the source texture. */
    x: number;
    /** Pixel Y offset in the source texture. */
    y: number;
    /** Cell width in pixels. */
    width: number;
    /** Cell height in pixels. */
    height: number;
}

/**
 * Specialized uniform-grid atlas (`BrioSpriteSheet`) organized into `columns` and `rows` of equal-sized
 * `cellWidth x cellHeight` cells over a shared `BrioTexture`. Acts as a factory for `BrioSprite` frames
 * (each with the cell as its `sourceRect`) and `BrioAnimation` sequences.
 *
 * @example
 * ```ts
 * const sheet = new BrioSpriteSheet("sht_hero", "./hero_sheet.png", 64, 64, 8, 4);
 * const idleAnim = sheet.createAnimation("anim_idle", 0, 3, { fps: 8, loop: true });
 * ```
 */
export class BrioSpriteSheet {
    readonly #name: string;
    readonly #texture: BrioTexture;
    readonly #cellWidth: number;
    readonly #cellHeight: number;
    readonly #columns: number;
    readonly #rows: number;

    /**
     * Creates a new `BrioSpriteSheet`.
     *
     * @param name Unique identifier for the spritesheet
     * @param src Source texture URI
     * @param cellWidth Width of each grid cell in pixels
     * @param cellHeight Height of each grid cell in pixels
     * @param columns Number of columns in the grid (defaults to `1`)
     * @param rows Number of rows in the grid (defaults to `1`)
     */
    constructor(
        name: string,
        src: string,
        cellWidth: number,
        cellHeight: number,
        columns: number = 1,
        rows: number = 1,
    ) {
        this.#name = name;
        this.#texture = TextureRegistry.acquire(src);
        this.#cellWidth = Math.max(1, Math.floor(cellWidth));
        this.#cellHeight = Math.max(1, Math.floor(cellHeight));
        this.#columns = Math.max(1, Math.floor(columns));
        this.#rows = Math.max(1, Math.floor(rows));
    }

    /** Unique identifier of the spritesheet. */
    public get name(): string {
        return this.#name;
    }

    /** Shared underlying `BrioTexture`. */
    public get texture(): BrioTexture {
        return this.#texture;
    }

    /** Cell width in pixels. */
    public get cellWidth(): number {
        return this.#cellWidth;
    }

    /** Cell height in pixels. */
    public get cellHeight(): number {
        return this.#cellHeight;
    }

    /** Number of columns in the grid. */
    public get columns(): number {
        return this.#columns;
    }

    /** Number of rows in the grid. */
    public get rows(): number {
        return this.#rows;
    }

    /** Total number of cells (`columns * rows`). */
    public get totalCells(): number {
        return this.#columns * this.#rows;
    }

    /**
     * Computes the pixel rectangle for a 0-based linear `cellIndex` (row-major order).
     *
     * @param cellIndex Zero-based index in `[0, totalCells - 1]`
     * @returns `SpriteSheetCellRect` coordinates
     * @example
     * ```ts
     * const rect = sheet.getCellRect(5);
     * ```
     */
    public getCellRect(cellIndex: number): SpriteSheetCellRect {
        const clamped = Math.max(0, Math.min(this.totalCells - 1, Math.floor(cellIndex)));
        const col = clamped % this.#columns;
        const row = Math.floor(clamped / this.#columns);
        return {
            col,
            row,
            x: col * this.#cellWidth,
            y: row * this.#cellHeight,
            width: this.#cellWidth,
            height: this.#cellHeight,
        };
    }

    /**
     * Creates a `BrioSprite` that shows one cell of this spritesheet: its `sourceRect` is the cell rectangle
     * and its `size` the cell size.
     *
     * @param spriteName Unique identifier for the created `BrioSprite`
     * @param cellIndex Zero-based cell index in row-major order, clamped to the grid (defaults to `0`)
     * @returns Configured `BrioSprite` instance
     * @example
     * ```ts
     * const frame0 = sheet.createSprite("spr_hero_0");
     * const frame5 = sheet.createSprite("spr_hero_5", 5);
     * ```
     */
    public createSprite(spriteName: string, cellIndex: number = 0): BrioSprite {
        const rect = this.getCellRect(cellIndex);
        const spr = new BrioSprite(spriteName, this.#texture.src, rect);
        spr.size = { x: rect.width, y: rect.height };
        return spr;
    }

    /**
     * Creates one `BrioSprite` per cell in `[startCell, endCell]`, named `"<sheet>_cell_<i>"`: the frame names
     * `createAnimation` uses. Return them from `preload()` so animations can resolve their frames.
     *
     * @param startCell First cell index (defaults to `0`)
     * @param endCell Last cell index, inclusive (defaults to the last cell)
     * @returns Cell sprites in index order
     * @example
     * ```ts
     * game.preload(() => [...sheet.createCellSprites()]);
     * const walk = sheet.createAnimation("anim_walk", 0, 5, { fps: 10 });
     * ```
     */
    public createCellSprites(
        startCell: number = 0,
        endCell: number = this.totalCells - 1,
    ): BrioSprite[] {
        const first = Math.max(0, Math.floor(startCell));
        const last = Math.min(this.totalCells - 1, Math.floor(endCell));
        const sprites: BrioSprite[] = [];
        for (let i = first; i <= last; i++) {
            sprites.push(this.createSprite(`${this.#name}_cell_${i}`, i));
        }
        return sprites;
    }

    /**
     * Creates a `BrioAnimation` spanning cell indices `startCell` through `endCell` (inclusive).
     *
     * @param animationName Unique name for the animation
     * @param startCell Starting 0-based cell index
     * @param endCell Ending 0-based cell index (inclusive)
     * @param options Optional playback settings (`fps`, `loop`, `pingPong`, `onComplete`)
     * @returns Configured `BrioAnimation`
     * @example
     * ```ts
     * const walk = sheet.createAnimation("anim_walk", 0, 5, { fps: 10, loop: true });
     * ```
     */
    public createAnimation(
        animationName: string,
        startCell: number,
        endCell: number,
        options: Omit<BrioAnimationOptions, "name" | "frames"> = {},
    ): BrioAnimation {
        const frames: string[] = [];
        const step = startCell <= endCell ? 1 : -1;
        for (let i = startCell; step > 0 ? i <= endCell : i >= endCell; i += step) {
            frames.push(`${this.#name}_cell_${i}`);
        }
        return new BrioAnimation({
            name: animationName,
            frames,
            ...options,
        });
    }
}
