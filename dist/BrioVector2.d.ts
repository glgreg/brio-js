export interface Vector2<T> {
    x: T;
    y: T;
}
export declare class BrioVector2 implements Vector2<number> {
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
    normalize(): Vector2<number>;
    clamp(min: Vector2<number>, max: Vector2<number>): Vector2<number>;
    distanceTo(target: Vector2<number>): this;
}
//# sourceMappingURL=BrioVector2.d.ts.map