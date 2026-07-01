import { clamp } from "../math/BrioMath.js";
import { multiply, create } from "../math/vec2.js";
export default class BrioTransform {
    #position;
    #size;
    #initialSize;
    #renderSize = create(0, 0);
    #rotation = 0;
    #scale = { x: 1, y: 1 };
    #pivot = { x: 0.5, y: 0.5 };
    #skew = { x: 0, y: 0 };
    #flip = { x: false, y: false };
    #visibility = true;
    #opacity = 1;
    #layer = 1;
    constructor(position, size) {
        this.#position = create(position.x, position.y);
        this.#size = create(size.x, size.y);
        this.#initialSize = create(size.x, size.y);
        this.#renderSize = create(size.x, size.y);
    }
    set position(position) {
        this.#position.x = position.x;
        this.#position.y = position.y;
    }
    get position() {
        return this.#position;
    }
    set size(size) {
        this.#flipSpriteVec2(size);
        this.#size.x = size.x;
        this.#size.y = size.y;
        this.#renderSize.x = size.x;
        this.#renderSize.y = size.y;
    }
    get size() {
        return this.#size;
    }
    get initialSize() {
        return this.#initialSize;
    }
    get renderSize() {
        return this.#renderSize;
    }
    /**
     * Use radians to rotate the sprite
     * @default 0
     * */
    set rotation(radian) {
        this.#rotation = radian;
    }
    get rotation() {
        return this.#rotation;
    }
    /** @default { x: 0, y: 0 } */
    set scale(scale) {
        this.#flipSpriteVec2(scale);
        this.#scale.x = scale.x;
        this.#scale.y = scale.y;
        multiply(this.#renderSize, this.#initialSize, scale);
    }
    get scale() {
        return this.#scale;
    }
    /** @default { x: false, y: false } */
    set flip(flip) {
        this.#flip.x = flip.x;
        this.#flip.y = flip.y;
    }
    get flip() {
        return this.#flip;
    }
    /**
     * Uses radians for skewing the sprite
     * @default { x: 0, y: 0 }
     * */
    set skew(skew) {
        this.#skew.x = skew.x;
        this.#skew.y = skew.y;
    }
    get skew() {
        return this.#skew;
    }
    /** @default { x: 0.5, y: 0.5 } */
    set pivot(pivot) {
        this.#pivot.x = clamp(pivot.x, 0, 1);
        this.#pivot.y = clamp(pivot.y, 0, 1);
    }
    get pivot() {
        return this.#pivot;
    }
    /** @default true */
    set visibility(visibility) {
        this.#visibility = visibility;
    }
    get visibility() {
        return this.#visibility;
    }
    /** @default 1 */
    set opacity(opacity) {
        this.#opacity = clamp(opacity, 0, 1);
    }
    get opacity() {
        return this.#opacity;
    }
    /** The layer which the object will be rendered.
     * Minimum value is 0. Negative values becomes positive.
     * @default 1
     */
    set layer(layer) {
        this.#layer = Math.abs(layer);
    }
    get layer() {
        return this.#layer;
    }
    #flipSprite(axis, value) {
        if (axis === "x") {
            if (value < 0)
                this.#flip.x = true;
            else
                this.#flip.x = false;
        }
        else {
            if (value < 0)
                this.#flip.y = true;
            else
                this.#flip.y = false;
        }
    }
    #flipSpriteVec2(values) {
        if (values.x < 0)
            this.#flipSprite("x", values.x);
        if (values.y < 0)
            this.#flipSprite("y", values.y);
    }
    #updateRenderSize() {
        this.#renderSize.x = this.#size.x * this.#scale.x;
        this.#renderSize.y = this.#size.y * this.#scale.y;
    }
}
