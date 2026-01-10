import { clamp } from "../math/BrioMath.js";
export default class BrioTransform {
    #position;
    #size;
    #baseSize;
    #rotation = 0;
    #scale = { x: 1, y: 1 };
    #pivot = { x: 0.5, y: 0.5 };
    #skew = { x: 0, y: 0 };
    #flip = { x: false, y: false };
    #visibility = true;
    #opacity = 1;
    #layer = 1;
    constructor(position, size) {
        this.#position = position;
        this.#size = size;
        this.#baseSize = size;
    }
    set position(position) {
        this.#position = position;
    }
    get position() {
        return this.#position;
    }
    set size(size) {
        this.#flipSpriteVec2(size);
        this.#size.x = Math.abs(size.x);
        this.#size.y = Math.abs(size.y);
    }
    get size() {
        return this.#size;
    }
    get baseSize() {
        return this.#baseSize;
    }
    /** @default 0 */
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
    /** @default { x: 0, y: 0 } */
    set skew(skew) {
        this.#skew.x = skew.x;
        this.#skew.y = skew.y;
    }
    get skew() {
        return this.#skew;
    }
    /** @default { x: 0.5, y: 0.5 } */
    set pivot(pivot) {
        const normalX = Math.min(Math.abs(pivot.x), 1);
        const normalY = Math.min(Math.abs(pivot.y), 1);
        this.#pivot.x = normalX;
        this.#pivot.y = normalY;
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
}
