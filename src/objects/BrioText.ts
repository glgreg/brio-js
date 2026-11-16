import { CSSColor } from "../tools/base_types";
import { BrioObject2D } from "./BrioObject2D";

/** Horizontal alignment of the lines of a `BrioText` inside its box. */
export type TextAlign = "left" | "center" | "right";

/**
 * Appearance of a `BrioText`. Every option can also be changed later through the property of the same name.
 */
export interface BrioTextOptions {
    /** Font size in pixels (defaults to `16`). */
    size?: number;
    /** CSS font family list (defaults to `"sans-serif"`); web fonts must be loaded by the page. */
    font?: string;
    /** CSS font weight (defaults to `"normal"`). */
    weight?: "normal" | "bold" | number;
    /** CSS font style (defaults to `"normal"`). */
    style?: "normal" | "italic";
    /** Fill color (defaults to `"#ffffff"`). */
    color?: CSSColor;
    /** Alignment of the lines inside the box (defaults to `"left"`). */
    align?: TextAlign;
    /** Line height as a multiple of `size` (defaults to `1.25`). */
    lineHeight?: number;
    /** Wraps lines longer than this width in pixels at spaces (`0`, the default, disables wrapping). */
    maxWidth?: number;
    /** Outline color, drawn below the fill when `strokeWidth > 0`. */
    strokeColor?: CSSColor;
    /** Outline width in pixels (defaults to `0`). */
    strokeWidth?: number;
    /** Drop shadow color (no shadow when omitted). */
    shadowColor?: CSSColor;
    /** Drop shadow blur radius in pixels (defaults to `0`). */
    shadowBlur?: number;
    /** Drop shadow offset in pixels (defaults to `{ x: 2, y: 2 }` when `shadowColor` is set). */
    shadowOffset?: { x: number; y: number };
    /** Drawing order inside its `BrioLayer` (`transform.depth`, defaults to `1`). */
    depth?: number;
}

/** Settings of a `BrioText` kept in checkpoints (`captureState()`). */
interface TextState {
    text: string;
    color: CSSColor;
}

/** 2D context `BrioText` measures and draws with (canvas element or `OffscreenCanvas`). */
export type TextDrawContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Shared context used to measure text (`null` where the runtime has no canvas text support, e.g. jsdom). */
let measureContext: TextDrawContext | null | undefined;

function getMeasureContext(): TextDrawContext | null {
    if (measureContext !== undefined) return measureContext;
    measureContext = null;
    try {
        const surface =
            typeof OffscreenCanvas !== "undefined"
                ? new OffscreenCanvas(1, 1)
                : typeof document !== "undefined"
                  ? document.createElement("canvas")
                  : undefined;
        const ctx = surface?.getContext("2d") as TextDrawContext | null | undefined;
        if (ctx && typeof ctx.measureText === "function") measureContext = ctx;
    } catch {
        measureContext = null;
    }
    return measureContext;
}

/**
 * Text drawn by the engine (`BrioText`): scores, labels, dialogue and menus, in world space or on a `"ui"` layer.
 * It is a `BrioObject2D`, so it has a transform (position, scale, rotation, opacity, depth), joins layers and
 * cameras, can be animated, cloned with `game.instantiate()` and is covered by checkpoints. `transform.position` is
 * the top-left corner of the text box and `transform.size` is measured automatically from the text and font (its
 * width is `maxWidth` when wrapping is enabled), so culling, pivots and colliders follow the text.
 *
 * Text is rasterized by the Canvas2D API at the canvas pixel ratio, so it stays sharp on high-DPI screens. Lines
 * break at `"\n"` and, with `maxWidth`, at spaces. Changing `text` to the same value is free; changing it to a new
 * value re-measures the lines once (not every frame).
 *
 * @example
 * ```ts
 * const hud = new BrioLayer({ name: "hud", order: 100, policy: "ui" });
 * const score = new BrioText("txt_score", "Score: 0", { size: 24, color: "#fde047", strokeColor: "#000", strokeWidth: 4 });
 * score.transform.position = { x: 16, y: 16 };
 * hud.addObject(score);
 *
 * game.load(() => [hud, score]);
 * game.update(() => {
 *     score.text = `Score: ${points}`;
 * });
 * ```
 */
export class BrioText extends BrioObject2D {
    #text: string = "";
    #size: number;
    #font: string;
    #weight: "normal" | "bold" | number;
    #style: "normal" | "italic";
    #align: TextAlign;
    #lineHeight: number;
    #maxWidth: number;
    #lines: string[] = [];
    #lineWidths: number[] = [];
    #fontString: string = "";
    /** Whether the font changed since the lines were last measured. */
    #layoutDirty: boolean = true;

    /** Fill color of the text. */
    public color: CSSColor;
    /** Outline color (drawn when `strokeWidth > 0`). */
    public strokeColor: CSSColor;
    /** Outline width in pixels. */
    public strokeWidth: number;
    /** Drop shadow color (`undefined` disables the shadow). */
    public shadowColor?: CSSColor;
    /** Drop shadow blur radius in pixels. */
    public shadowBlur: number;
    /** Drop shadow offset in pixels. */
    public readonly shadowOffset: { x: number; y: number };

    /**
     * Creates a new `BrioText`. Register it like any `BrioObject2D` (`load()`, `game.addObject()`, a layer).
     *
     * @param name Unique object name
     * @param text Initial text (numbers are converted with `String()`)
     * @param options Appearance options
     */
    constructor(name: string, text: string | number = "", options: BrioTextOptions = {}) {
        super(name, "", options.depth ?? 1);
        this.#size = Math.max(1, options.size ?? 16);
        this.#font = options.font ?? "sans-serif";
        this.#weight = options.weight ?? "normal";
        this.#style = options.style ?? "normal";
        this.#align = options.align ?? "left";
        this.#lineHeight = Math.max(0.1, options.lineHeight ?? 1.25);
        this.#maxWidth = Math.max(0, options.maxWidth ?? 0);
        this.color = options.color ?? "#ffffff";
        this.strokeColor = options.strokeColor ?? "#000000";
        this.strokeWidth = Math.max(0, options.strokeWidth ?? 0);
        this.shadowColor = options.shadowColor;
        this.shadowBlur = Math.max(0, options.shadowBlur ?? 0);
        this.shadowOffset = {
            x: options.shadowOffset?.x ?? 2,
            y: options.shadowOffset?.y ?? 2,
        };
        this.text = String(text);
    }

    /** Displayed text; `"\n"` starts a new line. */
    public get text(): string {
        return this.#text;
    }
    public set text(value: string | number) {
        const next = typeof value === "string" ? value : String(value);
        if (next === this.#text && !this.#layoutDirty) return;
        this.#text = next;
        this.#layout();
    }

    /** Font size in pixels. */
    public get size(): number {
        return this.#size;
    }
    public set size(value: number) {
        this.#size = Math.max(1, value);
        this.#invalidateFont();
    }

    /** CSS font family list. */
    public get font(): string {
        return this.#font;
    }
    public set font(value: string) {
        this.#font = value;
        this.#invalidateFont();
    }

    /** CSS font weight. */
    public get weight(): "normal" | "bold" | number {
        return this.#weight;
    }
    public set weight(value: "normal" | "bold" | number) {
        this.#weight = value;
        this.#invalidateFont();
    }

    /** CSS font style. */
    public get style(): "normal" | "italic" {
        return this.#style;
    }
    public set style(value: "normal" | "italic") {
        this.#style = value;
        this.#invalidateFont();
    }

    /** Alignment of the lines inside the box. */
    public get align(): TextAlign {
        return this.#align;
    }
    public set align(value: TextAlign) {
        this.#align = value;
        this.transform.markDirty();
    }

    /** Line height as a multiple of `size`. */
    public get lineHeight(): number {
        return this.#lineHeight;
    }
    public set lineHeight(value: number) {
        this.#lineHeight = Math.max(0.1, value);
        this.#invalidateFont();
    }

    /** Wrapping width in pixels (`0` disables wrapping). */
    public get maxWidth(): number {
        return this.#maxWidth;
    }
    public set maxWidth(value: number) {
        this.#maxWidth = Math.max(0, value);
        this.#invalidateFont();
    }

    /** Lines after breaking at `"\n"` and wrapping at `maxWidth`. */
    public get lines(): readonly string[] {
        return this.#lines;
    }

    /** CSS `font` shorthand used to draw the text (e.g. `"bold 24px sans-serif"`). */
    public get fontString(): string {
        return this.#fontString;
    }

    /**
     * Draws the lines into the text box whose top-left corner is `(x, y)`; called by the sprite renderer with the
     * object transform already applied.
     *
     * @internal
     * @param ctx Destination context
     * @param x Left of the box in local pixels
     * @param y Top of the box in local pixels
     * @param scaleX Horizontal stretch from the measured size to the render size
     * @param scaleY Vertical stretch from the measured size to the render size
     */
    public drawText(
        ctx: TextDrawContext,
        x: number,
        y: number,
        scaleX: number,
        scaleY: number,
    ): void {
        const lines = this.#lines;
        if (lines.length === 0) return;
        if (scaleX !== 1 || scaleY !== 1) {
            ctx.translate(x, y);
            ctx.scale(scaleX, scaleY);
            x = 0;
            y = 0;
        }
        ctx.font = this.#fontString;
        ctx.textBaseline = "top";
        ctx.textAlign = this.#align;
        const boxWidth = this.transform.size.x;
        const originX =
            this.#align === "center"
                ? x + boxWidth * 0.5
                : this.#align === "right"
                  ? x + boxWidth
                  : x;
        const step = this.#size * this.#lineHeight;
        // Centers the glyphs vertically inside each line box
        const top = y + (step - this.#size) * 0.5;

        if (this.shadowColor) {
            ctx.shadowColor = this.shadowColor;
            ctx.shadowBlur = this.shadowBlur;
            ctx.shadowOffsetX = this.shadowOffset.x;
            ctx.shadowOffsetY = this.shadowOffset.y;
        }
        if (this.strokeWidth > 0) {
            ctx.lineWidth = this.strokeWidth;
            ctx.lineJoin = "round";
            ctx.strokeStyle = this.strokeColor;
            for (let i = 0; i < lines.length; i++)
                ctx.strokeText(lines[i], originX, top + i * step);
            // The outline already casts the shadow; the fill on top would double it
            ctx.shadowColor = "transparent";
        }
        ctx.fillStyle = this.color;
        for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], originX, top + i * step);
    }

    protected override createCopy(name: string): BrioObject2D {
        const copy = new BrioText(name, this.#text, {
            size: this.#size,
            font: this.#font,
            weight: this.#weight,
            style: this.#style,
            color: this.color,
            align: this.#align,
            lineHeight: this.#lineHeight,
            maxWidth: this.#maxWidth,
            strokeColor: this.strokeColor,
            strokeWidth: this.strokeWidth,
            shadowColor: this.shadowColor,
            shadowBlur: this.shadowBlur,
            shadowOffset: this.shadowOffset,
            depth: this.transform.depth,
        });
        return copy;
    }

    protected override captureExtraState(): unknown {
        return { text: this.#text, color: this.color };
    }

    protected override restoreExtraState(extra: unknown): void {
        const state = extra as TextState | undefined;
        if (!state) return;
        this.text = state.text;
        this.color = state.color;
    }

    #invalidateFont(): void {
        this.#layoutDirty = true;
        this.#layout();
    }

    /** Builds the font string, breaks the text into lines and resizes the transform to the measured box. */
    #layout(): void {
        this.#fontString = `${this.#style} ${this.#weight} ${this.#size}px ${this.#font}`;
        this.#layoutDirty = false;
        const ctx = getMeasureContext();
        if (ctx) ctx.font = this.#fontString;

        const lines = this.#lines;
        const widths = this.#lineWidths;
        lines.length = 0;
        widths.length = 0;
        const paragraphs = this.#text.length > 0 ? this.#text.split("\n") : [];
        for (const paragraph of paragraphs) {
            if (this.#maxWidth <= 0 || this.#measure(ctx, paragraph) <= this.#maxWidth) {
                lines.push(paragraph);
                widths.push(this.#measure(ctx, paragraph));
                continue;
            }
            let current = "";
            for (const word of paragraph.split(" ")) {
                const candidate = current.length > 0 ? `${current} ${word}` : word;
                if (current.length > 0 && this.#measure(ctx, candidate) > this.#maxWidth) {
                    lines.push(current);
                    widths.push(this.#measure(ctx, current));
                    current = word;
                } else {
                    current = candidate;
                }
            }
            lines.push(current);
            widths.push(this.#measure(ctx, current));
        }

        let width = this.#maxWidth;
        if (width <= 0) {
            for (let i = 0; i < widths.length; i++) width = Math.max(width, widths[i]);
        }
        const height = lines.length * this.#size * this.#lineHeight;
        const pad = this.strokeWidth ?? 0;
        this.transform.size = { x: Math.ceil(width + pad), y: Math.ceil(height + pad) };
    }

    /** Width of `text` in pixels; estimated from the font size where canvas text metrics are unavailable. */
    #measure(ctx: TextDrawContext | null, text: string): number {
        if (ctx) return ctx.measureText(text).width;
        return text.length * this.#size * 0.55;
    }
}
