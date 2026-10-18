import { clamp } from "../math/BrioMath";
import type { Vec2, Vec2Bool } from "../math/index";
import { BrioVec2, create } from "../math/vec2";

/**
 * Contract representing a 2D spatial transform component.
 */
export interface Transform {
    /** World or local 2D position in pixels. */
    position: Vec2;
    /** Base unscaled dimensions in pixels. */
    size: Vec2;
    /** Initial unscaled dimensions recorded when the transform was initialized. */
    initialSize: Vec2;
    /** Effective rendered dimensions (`|size * scale|`) in pixels. */
    renderSize: Vec2;
    /** Scale multiplier along the X and Y axes. */
    scale: Vec2;
    /** Horizontal and vertical mirror flags. */
    flip: Vec2Bool;
    /** Normalized origin point in `[0, 1]` for rotation and skew. */
    pivot: Vec2;
    /** Clockwise rotation angle in radians. */
    rotation: number;
    /** Skew angles in radians along the X and Y axes. */
    skew: Vec2;
    /** Whether the object is visible during rendering. */
    visibility: boolean;
    /** Opacity factor clamped to `[0, 1]`. */
    opacity: number;
    /** Non-negative rendering depth order (z-index). */
    layer: number;
}

/**
 * Manages spatial 2D transformation properties (`position`, `size`, `scale`, `rotation`, `skew`, `pivot`, `flip`, `visibility`, `opacity`, and `layer`).
 * Uses reactive `BrioVec2` instances so both full-object assignments (`transform.scale = { x: 2, y: 2 }`)
 * and single-axis mutations (`transform.scale.x = 2`) keep derived state (`renderSize`, `flip`) synchronized.
 *
 * @example
 * ```ts
 * const transform = new BrioTransform({ x: 100, y: 200 }, { x: 64, y: 64 });
 * transform.scale.x = 2; // Automatically updates renderSize.x to 128
 * transform.rotation = BrioMath.degToRad(45);
 * ```
 */
export class BrioTransform implements Transform {
    #position: BrioVec2;
    #size: BrioVec2;
    #initialSize: Vec2;
    #renderSize: Vec2 = create(0, 0);
    #rotation: number = 0;
    #scale: BrioVec2;
    #pivot: BrioVec2;
    #skew: BrioVec2;
    #flip: Vec2Bool = { x: false, y: false };
    #visibility: boolean = true;
    #opacity: number = 1;
    #layer: number = 1;

    /**
     * Creates a new `BrioTransform` instance.
     *
     * @param position Initial 2D position `{ x, y }`
     * @param size Initial base dimensions `{ x, y }`
     * @example
     * ```ts
     * const transform = new BrioTransform({ x: 0, y: 0 }, { x: 32, y: 32 });
     * ```
     */
    constructor(position: Vec2, size: Vec2) {
        this.#position = new BrioVec2(position.x, position.y);
        this.#initialSize = create(Math.abs(size.x), Math.abs(size.y));
        this.#renderSize = create(Math.abs(size.x), Math.abs(size.y));

        this.#size = new BrioVec2(size.x, size.y, (x, y) => {
            this.#flipSpriteVec2({ x, y });
            const absX = Math.abs(x);
            const absY = Math.abs(y);
            this.#size.setSilent(absX, absY);
            if (this.#initialSize.x === 0 && absX > 0) this.#initialSize.x = absX;
            if (this.#initialSize.y === 0 && absY > 0) this.#initialSize.y = absY;
            this.#updateRenderSize();
        });

        this.#scale = new BrioVec2(1, 1, (x, y) => {
            this.#flipSpriteVec2({ x, y });
            this.#updateRenderSize();
        });

        this.#pivot = new BrioVec2(0.5, 0.5, (x, y) => {
            this.#pivot.setSilent(clamp(x, 0, 1), clamp(y, 0, 1));
        });

        this.#skew = new BrioVec2(0, 0);
    }

    /**
     * 2D coordinates (`x`, `y`) of the object in world space.
     *
     * @default { x: 0, y: 0 }
     * @example
     * ```ts
     * player.transform.position.x += 200 * dt;
     * player.transform.position = { x: 320, y: 240 };
     * ```
     */
    public set position(position: Vec2) {
        this.#position.set(position.x, position.y);
    }
    public get position(): Vec2 {
        return this.#position;
    }

    /**
     * Base unscaled dimensions (`x` width, `y` height) of the object in pixels.
     * Assigning a negative value automatically flips the corresponding axis in `flip` and stores the absolute size.
     *
     * @example
     * ```ts
     * player.transform.size = { x: 64, y: 64 };
     * player.transform.size.x = 48;
     * ```
     */
    public set size(size: Vec2) {
        this.#size.set(size.x, size.y);
    }
    public get size(): Vec2 {
        return this.#size;
    }

    /**
     * Initial unscaled dimensions recorded when the object's size was first non-zero.
     *
     * @example
     * ```ts
     * console.log(player.transform.initialSize); // { x: 64, y: 64 }
     * ```
     */
    public get initialSize(): Vec2 {
        return this.#initialSize;
    }

    /**
     * Computed rendering dimensions (`|size.x * scale.x|`, `|size.y * scale.y|`) in pixels.
     * Updated automatically whenever `size` or `scale` changes.
     *
     * @example
     * ```ts
     * player.transform.size = { x: 32, y: 32 };
     * player.transform.scale = { x: 2, y: 2 };
     * console.log(player.transform.renderSize); // { x: 64, y: 64 }
     * ```
     */
    public get renderSize(): Vec2 {
        return this.#renderSize;
    }

    /**
     * Clockwise rotation angle of the object in radians around its `pivot`.
     *
     * @default 0
     * @example
     * ```ts
     * player.transform.rotation += BrioMath.degToRad(90) * dt;
     * ```
     */
    public set rotation(radian: number) {
        this.#rotation = radian;
    }
    public get rotation(): number {
        return this.#rotation;
    }

    /**
     * Scale multiplier of the object on the X and Y axes.
     * Assigning a negative scale value flips the object along that axis and updates `renderSize`.
     *
     * @default { x: 1, y: 1 }
     * @example
     * ```ts
     * player.transform.scale = { x: 2, y: 2 };
     * player.transform.scale.x = -2; // Flips horizontally and sets renderSize.x = size.x * 2
     * ```
     */
    public set scale(scale: Vec2) {
        this.#scale.set(scale.x, scale.y);
    }
    public get scale(): Vec2 {
        return this.#scale;
    }

    /**
     * Horizontal (`x`) and vertical (`y`) mirror flags.
     *
     * @default { x: false, y: false }
     * @example
     * ```ts
     * player.transform.flip.x = true; // Faces left
     * ```
     */
    public set flip(flip: Vec2Bool) {
        this.#flip.x = flip.x;
        this.#flip.y = flip.y;
    }
    public get flip(): Vec2Bool {
        return this.#flip;
    }

    /**
     * Skew angles in radians along the X and Y axes relative to `pivot`.
     *
     * @default { x: 0, y: 0 }
     * @example
     * ```ts
     * player.transform.skew.x = BrioMath.degToRad(15);
     * ```
     */
    public set skew(skew: Vec2) {
        this.#skew.set(skew.x, skew.y);
    }
    public get skew(): Vec2 {
        return this.#skew;
    }

    /**
     * Normalized pivot point in `[0, 1]` used as the origin for rotation and skew.
     * `(0, 0)` is top-left, `(0.5, 0.5)` is center, and `(1, 1)` is bottom-right.
     *
     * @default { x: 0.5, y: 0.5 }
     * @example
     * ```ts
     * player.transform.pivot = { x: 0.5, y: 1 }; // Bottom-center pivot
     * ```
     */
    public set pivot(pivot: Vec2) {
        this.#pivot.set(pivot.x, pivot.y);
    }
    public get pivot(): Vec2 {
        return this.#pivot;
    }

    /**
     * Controls whether the object is rendered on the canvas.
     *
     * @default true
     * @example
     * ```ts
     * projectile.transform.visibility = false;
     * ```
     */
    public set visibility(visibility: boolean) {
        this.#visibility = visibility;
    }
    public get visibility(): boolean {
        return this.#visibility;
    }

    /**
     * Opacity level clamped to `[0, 1]`, where `0` is fully transparent and `1` is fully opaque.
     *
     * @default 1
     * @example
     * ```ts
     * ghost.transform.opacity = 0.5;
     * ```
     */
    public set opacity(opacity: number) {
        this.#opacity = clamp(opacity, 0, 1);
    }
    public get opacity(): number {
        return this.#opacity;
    }

    /**
     * Rendering depth layer (z-index). Higher layers are drawn on top of lower layers.
     * Negative values are automatically converted to their absolute value.
     *
     * @default 1
     * @example
     * ```ts
     * background.transform.layer = 0;
     * player.transform.layer = 2;
     * ```
     */
    public set layer(layer: number) {
        this.#layer = Math.abs(layer);
    }
    public get layer(): number {
        return this.#layer;
    }

    #flipSprite(axis: "x" | "y", value: number) {
        if (axis === "x") {
            this.#flip.x = value < 0;
        } else {
            this.#flip.y = value < 0;
        }
    }

    #flipSpriteVec2(values: Vec2) {
        if (values.x < 0) this.#flipSprite("x", values.x);
        if (values.y < 0) this.#flipSprite("y", values.y);
    }

    #updateRenderSize() {
        this.#renderSize.x = Math.abs(this.#size.x * this.#scale.x);
        this.#renderSize.y = Math.abs(this.#size.y * this.#scale.y);
    }
}

export default BrioTransform;

