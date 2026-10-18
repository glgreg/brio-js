import { clamp } from "../math/BrioMath";
import type { Vec2, Vec2Bool } from "../math/index";
import { BrioVec2, create } from "../math/vec2";

interface Transform {
    position: Vec2;
    size: Vec2;
    initialSize: Vec2;
    renderSize: Vec2;
    scale: Vec2;
    flip: Vec2Bool;
    pivot: Vec2;
    rotation: number;
    skew: Vec2;
    visibility: boolean;
    opacity: number;
    layer: number;
}

/**
 * Manages spatial 2D transformation properties (position, size, scale, rotation, skew, pivot, flip, visibility, opacity, and layer).
 * Uses reactive `BrioVec2` instances so both full-object assignments (`transform.scale = { x: 2, y: 2 }`)
 * and single-axis mutations (`transform.scale.x = 2`) keep derived state (`renderSize`, `flip`) synchronized.
 */
export default class BrioTransform implements Transform {
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

    public set position(position: Vec2) {
        this.#position.set(position.x, position.y);
    }
    public get position(): Vec2 {
        return this.#position;
    }

    public set size(size: Vec2) {
        this.#size.set(size.x, size.y);
    }
    public get size(): Vec2 {
        return this.#size;
    }

    public get initialSize(): Vec2 {
        return this.#initialSize;
    }

    public get renderSize(): Vec2 {
        return this.#renderSize;
    }

    /**
     * Rotation angle of the object in radians.
     * @default 0
     */
    public set rotation(radian: number) {
        this.#rotation = radian;
    }
    public get rotation(): number {
        return this.#rotation;
    }

    /**
     * Scale multiplier of the object on the X and Y axes.
     * @default { x: 1, y: 1 }
     */
    public set scale(scale: Vec2) {
        this.#scale.set(scale.x, scale.y);
    }
    public get scale(): Vec2 {
        return this.#scale;
    }

    /**
     * Horizontal and vertical flip flags.
     * @default { x: false, y: false }
     */
    public set flip(flip: Vec2Bool) {
        this.#flip.x = flip.x;
        this.#flip.y = flip.y;
    }
    public get flip(): Vec2Bool {
        return this.#flip;
    }

    /**
     * Skew angles in radians along the X and Y axes.
     * @default { x: 0, y: 0 }
     */
    public set skew(skew: Vec2) {
        this.#skew.set(skew.x, skew.y);
    }
    public get skew(): Vec2 {
        return this.#skew;
    }

    /**
     * Normalized pivot point in `[0, 1]` used as the origin for rotation and skew.
     * @default { x: 0.5, y: 0.5 }
     */
    public set pivot(pivot: Vec2) {
        this.#pivot.set(pivot.x, pivot.y);
    }
    public get pivot(): Vec2 {
        return this.#pivot;
    }

    /**
     * Controls whether the object is rendered.
     * @default true
     */
    public set visibility(visibility: boolean) {
        this.#visibility = visibility;
    }
    public get visibility(): boolean {
        return this.#visibility;
    }

    /**
     * Opacity level clamped to `[0, 1]`.
     * @default 1
     */
    public set opacity(opacity: number) {
        this.#opacity = clamp(opacity, 0, 1);
    }
    public get opacity(): number {
        return this.#opacity;
    }

    /**
     * Rendering depth layer. Minimum value is 0; negative values are converted to positive.
     * @default 1
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
