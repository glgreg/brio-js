import { BrioObject } from "../objects/BrioObject.js";
import { CollisionColliderType } from "../objects/BrioObject.js";
import { Vec2 } from "./index.js";
type RectangleCollisionType = {
    object: BrioObject;
    colliderType: CollisionColliderType;
    pos: Vec2;
    size: Vec2;
};
type SquareCollisionType = {
    object: BrioObject;
    colliderType: CollisionColliderType;
    pos: Vec2;
    size: number;
};
type CircleCollisionType = {
    object: BrioObject;
    colliderType: CollisionColliderType;
    pos: Vec2;
    size: number;
};
export declare class BrioCollision {
    static isColliding(one: BrioObject, two: BrioObject): boolean;
    static addSquare(configurationObject: SquareCollisionType): void;
    static addRectangle(configurationObject: RectangleCollisionType): void;
    static addCircle(configurationObject: CircleCollisionType): void;
}
export {};
//# sourceMappingURL=BrioCollision.d.ts.map
