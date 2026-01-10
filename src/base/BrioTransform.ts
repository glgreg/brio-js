import { clamp } from "../math/BrioMath";
import { Vector2 } from "../math/BrioVector2";

interface Transform {
    position: Vector2<number>;
    size: Vector2<number>;
    baseSize: Vector2<number>;
    scale: Vector2<number>;
    flip: Vector2<boolean>;
    pivot: Vector2<number>;
    rotation: number;
    skew: Vector2<number>;
    visibility: boolean;
    opacity: number;
    layer: number;
}

export default class BrioTransform implements Transform {
    #position: Vector2<number>;
    #size: Vector2<number>;
    #baseSize: Vector2<number>;
    #rotation: number = 0;
    #scale: Vector2<number> = { x: 1, y: 1 };
    #pivot: Vector2<number> = { x: 0.5, y: 0.5 };
    #skew: Vector2<number> = { x: 0, y: 0 };
    #flip: Vector2<boolean> = { x: false, y: false };
    #visibility: boolean = true;
    #opacity: number = 1;
    #layer: number = 1;

    constructor(position: Vector2<number>, size: Vector2<number>) {
        this.#position = position;
        this.#size = size;
        this.#baseSize = size;
    }

    public set position(position) {
        this.#position = position;
    }
    public get position() {
        return this.#position;
    }

    public set size(size) {
        this.#flipSpriteVec2(size);

        this.#size.x = Math.abs(size.x);
        this.#size.y = Math.abs(size.y);
    }
    public get size() {
        return this.#size;
    }

    public get baseSize() {
        return this.#baseSize;
    }

    /** @default 0 */
    public set rotation(radian) {
        this.#rotation = radian;
    }
    public get rotation() {
        return this.#rotation;
    }

    /** @default { x: 0, y: 0 } */
    public set scale(scale) {
        this.#flipSpriteVec2(scale);

        this.#scale.x = scale.x;
        this.#scale.y = scale.y;
    }
    public get scale() {
        return this.#scale;
    }

    /** @default { x: false, y: false } */
    public set flip(flip) {
        this.#flip.x = flip.x;
        this.#flip.y = flip.y;
    }
    public get flip() {
        return this.#flip;
    }

    /** @default { x: 0, y: 0 } */
    public set skew(skew) {
        this.#skew.x = skew.x;
        this.#skew.y = skew.y;
    }
    public get skew() {
        return this.#skew;
    }

    /** @default { x: 0.5, y: 0.5 } */
    public set pivot(pivot) {
        const normalX = Math.min(Math.abs(pivot.x), 1);
        const normalY = Math.min(Math.abs(pivot.y), 1);

        this.#pivot.x = normalX;
        this.#pivot.y = normalY;
    }
    public get pivot() {
        return this.#pivot;
    }

    /** @default true */
    public set visibility(visibility) {
        this.#visibility = visibility;
    }
    public get visibility() {
        return this.#visibility;
    }

    /** @default 1 */
    public set opacity(opacity) {
        this.#opacity = clamp(opacity, 0, 1);
    }
    public get opacity() {
        return this.#opacity;
    }

    /** The layer which the object will be rendered.
     * Minimum value is 0. Negative values becomes positive.
     * @default 1
     */
    public set layer(layer) {
        this.#layer = Math.abs(layer);
    }
    public get layer() {
        return this.#layer;
    }

    #flipSprite(axis: "x" | "y", value: number) {
        if (axis === "x") {
            if (value < 0) this.#flip.x = true;
            else this.#flip.x = false;
        } else {
            if (value < 0) this.#flip.y = true;
            else this.#flip.y = false;
        }
    }
    #flipSpriteVec2(values: Vector2<number>) {
        if (values.x < 0) this.#flipSprite("x", values.x);
        if (values.y < 0) this.#flipSprite("y", values.y);
    }
}
