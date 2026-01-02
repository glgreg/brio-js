export interface Vector2 {
    x: number;
    y: number;
}
export declare class BrioVector2 implements Vector2 {
    x: number;
    y: number;
    /**
     * @param x
     * @param y
     */
    constructor(x: number, y: number);
    /**
     * Returns a normalized version of this vector
     * @example const vec2 = new BrioVector2(10, 10);
     */
    normalize(): Vector2;
    clamp(min: Vector2, max: Vector2): Vector2;
    distanceTo(target: Vector2): this;
}
//# sourceMappingURL=BrioVector2.d.ts.map