import { BrioObject } from "./BrioObject.js";
import { CollisionColliderType } from "./BrioObject.js";
import { Vector2 } from "./BrioVector2.js";
type RectangleCollisionType = {
    object: BrioObject;
    colliderType: CollisionColliderType;
    pos: Vector2;
    size: Vector2;
};
type SquareCollisionType = {
    object: BrioObject;
    colliderType: CollisionColliderType;
    pos: Vector2;
    size: number;
};
type CircleCollisionType = {
    object: BrioObject;
    colliderType: CollisionColliderType;
    pos: Vector2;
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
