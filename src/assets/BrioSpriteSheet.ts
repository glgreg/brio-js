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
 * and `BrioAnimation` sequences.
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
     * Creates a `BrioSprite` initialized with this spritesheet's cell dimensions.
     *
     * @param spriteName Unique identifier for the created `BrioSprite`
     * @returns Configured `BrioSprite` instance
     * @example
     * ```ts
     * const frame0 = sheet.createSprite("spr_hero_0");
     * ```
     */
    public createSprite(spriteName: string): BrioSprite {
        const spr = new BrioSprite(spriteName, this.#texture.src);
        spr.size = { x: this.#cellWidth, y: this.#cellHeight };
        return spr;
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
