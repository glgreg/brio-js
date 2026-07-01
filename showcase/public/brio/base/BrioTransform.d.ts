import type { Vec2, Vec2Bool } from "../math/index.js";
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
    #private;
    constructor(position: Vec2, size: Vec2);
    set position(position: Vec2);
    get position(): Vec2;
    set size(size: Vec2);
    get size(): Vec2;
    get initialSize(): Vec2;
    get renderSize(): Vec2;
    /**
     * Use radians to rotate the sprite
     * @default 0
     * */
    set rotation(radian: number);
    get rotation(): number;
    /** @default { x: 0, y: 0 } */
    set scale(scale: Vec2);
    get scale(): Vec2;
    /** @default { x: false, y: false } */
    set flip(flip: Vec2Bool);
    get flip(): Vec2Bool;
    /**
     * Uses radians for skewing the sprite
     * @default { x: 0, y: 0 }
     * */
    set skew(skew: Vec2);
    get skew(): Vec2;
    /** @default { x: 0.5, y: 0.5 } */
    set pivot(pivot: Vec2);
    get pivot(): Vec2;
    /** @default true */
    set visibility(visibility: boolean);
    get visibility(): boolean;
    /** @default 1 */
    set opacity(opacity: number);
    get opacity(): number;
    /** The layer which the object will be rendered.
     * Minimum value is 0. Negative values becomes positive.
     * @default 1
     */
    set layer(layer: number);
    get layer(): number;
}
export {};
//# sourceMappingURL=BrioTransform.d.ts.map
