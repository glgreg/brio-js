import { Vector2 } from "../math/BrioVector2.js";
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
    #private;
    constructor(position: Vector2<number>, size: Vector2<number>);
    set position(position: Vector2<number>);
    get position(): Vector2<number>;
    set size(size: Vector2<number>);
    get size(): Vector2<number>;
    get baseSize(): Vector2<number>;
    /** @default 0 */
    set rotation(radian: number);
    get rotation(): number;
    /** @default { x: 0, y: 0 } */
    set scale(scale: Vector2<number>);
    get scale(): Vector2<number>;
    /** @default { x: false, y: false } */
    set flip(flip: Vector2<boolean>);
    get flip(): Vector2<boolean>;
    /** @default { x: 0, y: 0 } */
    set skew(skew: Vector2<number>);
    get skew(): Vector2<number>;
    /** @default { x: 0.5, y: 0.5 } */
    set pivot(pivot: Vector2<number>);
    get pivot(): Vector2<number>;
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
