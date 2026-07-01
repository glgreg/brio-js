export interface Vec2 {
    x: number;
    y: number;
}
export interface Vec2Bool {
    x: boolean;
    y: boolean;
}
export declare function create(x?: number, y?: number): Vec2;
export declare function multiply(out: Vec2, a: Readonly<Vec2>, b: Readonly<Vec2>): Vec2;
export declare function add(out: Vec2, a: Vec2, b: Vec2): Vec2;
export declare function normalize(out: Vec2, v: Vec2): Vec2;
export declare function clamp(out: Vec2, min: Vec2, max: Vec2): Vec2 | undefined;
export declare function distanceTo(out: Vec2, target: Vec2): Vec2;
export declare function multiplySelf(self: Vec2, v: Vec2): Vec2;
export declare function addSelf(self: Vec2, v: Vec2): Vec2;
export declare function normalizeSelf(self: Vec2): Vec2;
//# sourceMappingURL=vec2.d.ts.map