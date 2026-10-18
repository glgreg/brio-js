import {
    CSSBackgroundBlendMode,
    CSSBackgroundPosition,
    CSSBackgroundRendering,
    CSSBackgroundRepeat,
    CSSBackgroundSize,
    CSSColor,
} from "../tools/base_types";

/**
 * Configuration interface for styling the `HTMLCanvasElement` background via CSS properties.
 */
export interface CanvasBackground {
    /** CSS color or gradient string (e.g. `"#020319"`, `"linear-gradient(...)"`). */
    color?: CSSColor;
    /** URL or relative path to a background image. */
    image?: string;
    /** CSS `background-repeat` mode (`"no-repeat"`, `"repeat"`, `"repeat-x"`, etc.). */
    repeat?: CSSBackgroundRepeat;
    /** CSS `background-position` alignment (e.g. `"center"`, `"center center"`, `"10px 20px"`). */
    position?: CSSBackgroundPosition;
    /** CSS `background-size` mode (`"cover"`, `"contain"`, `"100% 100%"`, etc.). */
    size?: CSSBackgroundSize;
    /** CSS `background-blend-mode` value (`"normal"`, `"multiply"`, `"hard-light"`, etc.). */
    blendMode?: CSSBackgroundBlendMode;
    /** CSS `image-rendering` mode (`"pixelated"`, `"crisp-edges"`, `"smooth"`). */
    rendering?: CSSBackgroundRendering;
}

/**
 * Reactive controller that synchronizes `game.background` properties with the underlying `HTMLCanvasElement` inline CSS styles.
 * Preserves previously configured sub-properties (`repeat`, `position`, `size`, `blendMode`) regardless of assignment order.
 *
 * @example
 * ```ts
 * game.background.color = "#1a1a2e";
 * game.background.image = "./assets/sprites/background.png";
 * game.background.repeat = "no-repeat";
 * game.background.size = "cover";
 * game.background.position = "center";
 * game.background.rendering = "pixelated";
 * ```
 */
export class BrioCanvasBackground implements CanvasBackground {
    #canvas: HTMLCanvasElement;

    #color?: CanvasBackground["color"];
    #image?: CanvasBackground["image"];
    #repeat?: CanvasBackground["repeat"];
    #position?: CanvasBackground["position"];
    #size?: CanvasBackground["size"];
    #blendMode?: CanvasBackground["blendMode"];
    #rendering?: CanvasBackground["rendering"];

    /**
     * Creates a new `BrioCanvasBackground` bound to a target `HTMLCanvasElement`.
     *
     * @param canvas Target canvas element whose CSS background styles will be managed
     */
    constructor(canvas: HTMLCanvasElement) {
        this.#canvas = canvas;
    }

    /**
     * Applies a partial or full `CanvasBackground` configuration object without replacing this controller instance.
     *
     * @param config Partial background configuration properties
     * @example
     * ```ts
     * game.background = {
     *     color: "#020319",
     *     repeat: "no-repeat",
     *     size: "cover",
     * };
     * ```
     */
    public apply(config: CanvasBackground): void {
        if (config.color !== undefined) this.color = config.color;
        if (config.image !== undefined) this.image = config.image;
        if (config.repeat !== undefined) this.repeat = config.repeat;
        if (config.position !== undefined) this.position = config.position;
        if (config.size !== undefined) this.size = config.size;
        if (config.blendMode !== undefined) this.blendMode = config.blendMode;
        if (config.rendering !== undefined) this.rendering = config.rendering;
    }

    #syncBackgroundShorthand(): void {
        const imagePart = this.#image ? `url('${this.#image}')` : null;
        const colorPart = this.#color || null;

        if (imagePart && colorPart) {
            this.#canvas.style.background = `${imagePart}, ${colorPart}`;
        } else if (imagePart) {
            this.#canvas.style.background = imagePart;
        } else if (colorPart) {
            this.#canvas.style.background = colorPart;
        }

        // Re-apply individual sub-properties that CSS `background` shorthand would otherwise reset
        if (this.#repeat) this.#canvas.style.backgroundRepeat = this.#repeat;
        if (this.#position) this.#canvas.style.backgroundPosition = this.#position;
        if (this.#size) this.#canvas.style.backgroundSize = this.#size;
        if (this.#blendMode) this.#canvas.style.backgroundBlendMode = this.#blendMode;
        if (this.#rendering) this.#canvas.style.imageRendering = this.#rendering;
    }

    /**
     * CSS background color or gradient string.
     *
     * @example
     * ```ts
     * game.background.color = "linear-gradient(to bottom, #38bdf8 78%, #020319 22%)";
     * ```
     */
    public set color(CSSColorLike: CanvasBackground["color"]) {
        this.#color = CSSColorLike;
        this.#syncBackgroundShorthand();
    }
    public get color(): CanvasBackground["color"] {
        return this.#color;
    }

    /**
     * URL or path to the CSS background image.
     *
     * @example
     * ```ts
     * game.background.image = "./assets/sprites/background.png";
     * ```
     */
    public set image(imageSrc: CanvasBackground["image"]) {
        this.#image = imageSrc;
        this.#syncBackgroundShorthand();
    }
    public get image(): CanvasBackground["image"] {
        return this.#image;
    }

    /**
     * CSS `background-blend-mode` property.
     *
     * @example
     * ```ts
     * game.background.blendMode = "multiply";
     * ```
     */
    public set blendMode(blendMode: CanvasBackground["blendMode"]) {
        this.#blendMode = blendMode;
        if (blendMode !== undefined) {
            this.#canvas.style.backgroundBlendMode = blendMode;
        }
    }
    public get blendMode(): CanvasBackground["blendMode"] {
        return this.#blendMode;
    }

    /**
     * CSS `background-position` property.
     *
     * @example
     * ```ts
     * game.background.position = "center center";
     * ```
     */
    public set position(imagePosition: CanvasBackground["position"]) {
        this.#position = imagePosition;
        if (imagePosition !== undefined) {
            this.#canvas.style.backgroundPosition = imagePosition;
        }
    }
    public get position(): CanvasBackground["position"] {
        return this.#position;
    }

    /**
     * CSS `background-repeat` property.
     *
     * @example
     * ```ts
     * game.background.repeat = "no-repeat";
     * ```
     */
    public set repeat(imageRepeat: CanvasBackground["repeat"]) {
        this.#repeat = imageRepeat;
        if (imageRepeat !== undefined) {
            this.#canvas.style.backgroundRepeat = imageRepeat;
        }
    }
    public get repeat(): CanvasBackground["repeat"] {
        return this.#repeat;
    }

    /**
     * CSS `background-size` property.
     *
     * @example
     * ```ts
     * game.background.size = "cover";
     * ```
     */
    public set size(imageSize: CanvasBackground["size"]) {
        this.#size = imageSize;
        if (imageSize !== undefined) {
            this.#canvas.style.backgroundSize = imageSize;
        }
    }
    public get size(): CanvasBackground["size"] {
        return this.#size;
    }

    /**
     * CSS `image-rendering` mode (`"pixelated"`, `"crisp-edges"`, `"smooth"`).
     *
     * @example
     * ```ts
     * game.background.rendering = "pixelated";
     * ```
     */
    public set rendering(renderingMode: CanvasBackground["rendering"]) {
        this.#rendering = renderingMode;
        if (renderingMode !== undefined) {
            this.#canvas.style.imageRendering = renderingMode;
        }
    }
    public get rendering(): CanvasBackground["rendering"] {
        return this.#rendering;
    }
}

