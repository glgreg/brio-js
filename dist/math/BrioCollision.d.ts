import { BrioObject } from "../objects/BrioObject.js";
import { CollisionColliderType } from "../objects/BrioObject.js";
import { Vector2 } from "./BrioVector2.js";
type RectangleCollisionType = {
    object: BrioObject;
    colliderType: CollisionColliderType;
    pos: Vector2<number>;
    size: Vector2<number>;
};
type SquareCollisionType = {
    object: BrioObject;
    colliderType: CollisionColliderType;
    pos: Vector2<number>;
    size: number;
};
type CircleCollisionType = {
    object: BrioObject;
    colliderType: CollisionColliderType;
    pos: Vector2<number>;
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
