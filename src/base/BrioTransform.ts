import { clamp } from "../math/BrioMath";
import type { Vec2, Vec2Bool } from "../math/index";
import { multiply, create } from "../math/vec2";

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

export default class BrioTransform implements Transform {
    #position: Vec2;
    #size: Vec2;
    #initialSize: Vec2;
    #renderSize: Vec2 = create(0, 0);
    #rotation: number = 0;
    #scale: Vec2 = { x: 1, y: 1 };
    #pivot: Vec2 = { x: 0.5, y: 0.5 };
    #skew: Vec2 = { x: 0, y: 0 };
    #flip: Vec2Bool = { x: false, y: false };
    #visibility: boolean = true;
    #opacity: number = 1;
    #layer: number = 1;

    constructor(position: Vec2, size: Vec2) {
        this.#position = create(position.x, position.y);
        this.#size = create(size.x, size.y);
        this.#initialSize = create(size.x, size.y);
        this.#renderSize = create(size.x, size.y);
    }

    public set position(position) {
        this.#position.x = position.x;
        this.#position.y = position.y;
    }
    public get position() {
        return this.#position;
    }

    public set size(size) {
        this.#flipSpriteVec2(size);

        this.#size.x = size.x;
        this.#size.y = size.y;
        this.#renderSize.x = size.x;
        this.#renderSize.y = size.y;
    }
    public get size() {
        return this.#size;
    }

    public get initialSize() {
        return this.#initialSize;
    }

    public get renderSize() {
        return this.#renderSize;
    }

    /**
     * Use radians to rotate the sprite
     * @default 0
     * */
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
        multiply(this.#renderSize, this.#initialSize, scale);
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

    /**
     * Uses radians for skewing the sprite
     * @default { x: 0, y: 0 }
     * */
    public set skew(skew) {
        this.#skew.x = skew.x;
        this.#skew.y = skew.y;
    }
    public get skew() {
        return this.#skew;
    }

    /** @default { x: 0.5, y: 0.5 } */
    public set pivot(pivot) {
        this.#pivot.x = clamp(pivot.x, 0, 1);
        this.#pivot.y = clamp(pivot.y, 0, 1);
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
    #flipSpriteVec2(values: Vec2) {
        if (values.x < 0) this.#flipSprite("x", values.x);
        if (values.y < 0) this.#flipSprite("y", values.y);
    }

    #updateRenderSize() {
        this.#renderSize.x = this.#size.x * this.#scale.x;
        this.#renderSize.y = this.#size.y * this.#scale.y;
    }
}
