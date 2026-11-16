import { clamp } from "../math/BrioMath";

/**
 * Built-in viewport layout presets for full-screen, split-screen multiplayer (2 to 4 players), and picture-in-picture minimaps.
 */
export type ViewportPreset =
    | "fullscreen"
    | "split-horizontal-top"
    | "split-horizontal-bottom"
    | "split-vertical-left"
    | "split-vertical-right"
    | "quad-top-left"
    | "quad-top-right"
    | "quad-bottom-left"
    | "quad-bottom-right"
    | "minimap-top-right"
    | "minimap-bottom-right";

/**
 * Normalized rectangular region (`[0..1]`) of the screen assigned to a camera.
 *
 * @example
 * ```ts
 * const rect: ViewportRect = { x: 0, y: 0, width: 0.5, height: 1 };
 * ```
 */
export interface ViewportRect {
    /** Normalized left offset in `[0, 1]`. */
    x: number;
    /** Normalized top offset in `[0, 1]`. */
    y: number;
    /** Normalized width in `[0, 1]`. */
    width: number;
    /** Normalized height in `[0, 1]`. */
    height: number;
}

/**
 * Represents a normalized screen region (`[0..1]`) assigned to a `BrioCamera2D` or `BrioCamera3D`.
 * Enables full-screen rendering, local multiplayer split-screen layouts (e.g. 2-player horizontal/vertical
 * or 4-player quadrants), and picture-in-picture minimaps.
 *
 * @example
 * ```ts
 * const p1Viewport = BrioViewport.fromPreset("split-horizontal-top");
 * const p2Viewport = BrioViewport.fromPreset("split-horizontal-bottom");
 * ```
 */
export class BrioViewport implements ViewportRect {
    #x: number;
    #y: number;
    #width: number;
    #height: number;

    /**
     * Creates a normalized `BrioViewport` (defaults to full-screen `{ x: 0, y: 0, width: 1, height: 1 }`).
     *
     * @param x Normalized X offset in `[0, 1]` (defaults to `0`)
     * @param y Normalized Y offset in `[0, 1]` (defaults to `0`)
     * @param width Normalized width in `[0, 1]` (defaults to `1`)
     * @param height Normalized height in `[0, 1]` (defaults to `1`)
     */
    constructor(x: number = 0, y: number = 0, width: number = 1, height: number = 1) {
        this.#x = clamp(x, 0, 1);
        this.#y = clamp(y, 0, 1);
        this.#width = clamp(width, 0, 1);
        this.#height = clamp(height, 0, 1);
    }

    /** Normalized X coordinate (`[0, 1]`). */
    public get x(): number {
        return this.#x;
    }
    public set x(value: number) {
        this.#x = clamp(value, 0, 1);
    }

    /** Normalized Y coordinate (`[0, 1]`). */
    public get y(): number {
        return this.#y;
    }
    public set y(value: number) {
        this.#y = clamp(value, 0, 1);
    }

    /** Normalized width (`[0, 1]`). */
    public get width(): number {
        return this.#width;
    }
    public set width(value: number) {
        this.#width = clamp(value, 0, 1);
    }

    /** Normalized height (`[0, 1]`). */
    public get height(): number {
        return this.#height;
    }
    public set height(value: number) {
        this.#height = clamp(value, 0, 1);
    }

    /**
     * Converts this normalized `[0..1]` viewport into pixel coordinates for a surface of `surfaceWidth x surfaceHeight`.
     *
     * @param surfaceWidth Total canvas width in pixels
     * @param surfaceHeight Total canvas height in pixels
     * @returns Pixel rectangle `{ x, y, width, height }`
     * @example
     * ```ts
     * const pxRect = viewport.toPixelRect(1280, 720);
     * ```
     */
    public toPixelRect(
        surfaceWidth: number,
        surfaceHeight: number,
    ): { x: number; y: number; width: number; height: number } {
        return {
            x: Math.round(this.#x * surfaceWidth),
            y: Math.round(this.#y * surfaceHeight),
            width: Math.round(this.#width * surfaceWidth),
            height: Math.round(this.#height * surfaceHeight),
        };
    }

    /**
     * Creates a `BrioViewport` from a named `ViewportPreset`.
     *
     * @param preset Named preset layout
     * @returns Configured `BrioViewport`
     * @example
     * ```ts
     * const leftView = BrioViewport.fromPreset("split-vertical-left");
     * ```
     */
    public static fromPreset(preset: ViewportPreset): BrioViewport {
        switch (preset) {
            case "fullscreen":
                return new BrioViewport(0, 0, 1, 1);
            case "split-horizontal-top":
                return new BrioViewport(0, 0, 1, 0.5);
            case "split-horizontal-bottom":
                return new BrioViewport(0, 0.5, 1, 0.5);
            case "split-vertical-left":
                return new BrioViewport(0, 0, 0.5, 1);
            case "split-vertical-right":
                return new BrioViewport(0.5, 0, 0.5, 1);
            case "quad-top-left":
                return new BrioViewport(0, 0, 0.5, 0.5);
            case "quad-top-right":
                return new BrioViewport(0.5, 0, 0.5, 0.5);
            case "quad-bottom-left":
                return new BrioViewport(0, 0.5, 0.5, 0.5);
            case "quad-bottom-right":
                return new BrioViewport(0.5, 0.5, 0.5, 0.5);
            case "minimap-top-right":
                return new BrioViewport(0.75, 0.02, 0.23, 0.23);
            case "minimap-bottom-right":
                return new BrioViewport(0.75, 0.75, 0.23, 0.23);
        }
    }
}
