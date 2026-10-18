import { BrioObject } from "../objects/BrioObject";
import { CollisionColliderType, CollisionShapeType } from "../objects/BrioObject";
import { Vec2 } from "./index";

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

/**
 * Provides 2D collision mask attachment and intersection testing (AABB and Circle).
 */
export class BrioCollision {
    /**
     * Tests whether two `BrioObject` instances with active collision masks are intersecting.
     * Supports Rectangle/Square vs Rectangle/Square, Circle vs Circle, and symmetric Circle vs Rectangle/Square.
     * @param one First game object
     * @param two Second game object
     * @returns `true` if the two colliders intersect, otherwise `false`
     */
    public static isColliding(one: BrioObject, two: BrioObject): boolean {
        if (!one.collision || !two.collision) return false;
        if (!one.collision.enabled || !two.collision.enabled) return false;

        const oneShape = one.collision.shape;
        const twoShape = two.collision.shape;

        if (oneShape === "circle" || twoShape === "circle") {
            if (oneShape !== "circle" || twoShape !== "circle") {
                const circleObj = oneShape === "circle" ? one : two;
                const rectObj = oneShape === "circle" ? two : one;

                const radius = Math.min(circleObj.collision!.size.x, circleObj.collision!.size.y) / 2;
                const cx =
                    circleObj.transform.position.x + circleObj.collision!.pos.x + radius;
                const cy =
                    circleObj.transform.position.y + circleObj.collision!.pos.y + radius;

                const minX = rectObj.transform.position.x + rectObj.collision!.pos.x;
                const maxX = minX + rectObj.collision!.size.x;
                const minY = rectObj.transform.position.y + rectObj.collision!.pos.y;
                const maxY = minY + rectObj.collision!.size.y;

                // Broadphase AABB check
                if (
                    cx + radius < minX ||
                    cx - radius > maxX ||
                    cy + radius < minY ||
                    cy - radius > maxY
                ) {
                    return false;
                }

                // Closest point on the AABB to the circle center
                const closestX = Math.max(minX, Math.min(cx, maxX));
                const closestY = Math.max(minY, Math.min(cy, maxY));

                const dx = cx - closestX;
                const dy = cy - closestY;
                return dx * dx + dy * dy <= radius * radius;
            }

            const oneRadius = Math.min(one.collision.size.x, one.collision.size.y) / 2;
            const twoRadius = Math.min(two.collision.size.x, two.collision.size.y) / 2;

            const oneCenterX = one.transform.position.x + one.collision.pos.x + oneRadius;
            const oneCenterY = one.transform.position.y + one.collision.pos.y + oneRadius;
            const twoCenterX = two.transform.position.x + two.collision.pos.x + twoRadius;
            const twoCenterY = two.transform.position.y + two.collision.pos.y + twoRadius;

            const radiusSum = oneRadius + twoRadius;
            const dx = oneCenterX - twoCenterX;
            const dy = oneCenterY - twoCenterY;

            if (Math.abs(dx) > radiusSum || Math.abs(dy) > radiusSum) {
                return false;
            }

            return dx * dx + dy * dy <= radiusSum * radiusSum;
        } else {
            const rect1 = {
                x: one.transform.position.x + one.collision.pos.x,
                y: one.transform.position.y + one.collision.pos.y,
                w: one.collision.size.x,
                h: one.collision.size.y,
            };

            const rect2 = {
                x: two.transform.position.x + two.collision.pos.x,
                y: two.transform.position.y + two.collision.pos.y,
                w: two.collision.size.x,
                h: two.collision.size.y,
            };

            return !(
                rect1.x + rect1.w <= rect2.x ||
                rect2.x + rect2.w <= rect1.x ||
                rect1.y + rect1.h <= rect2.y ||
                rect2.y + rect2.h <= rect1.y
            );
        }
    }

    public static addSquare(configurationObject: SquareCollisionType) {
        const config = configurationObject;

        config.object.collision = {
            enabled: true,
            shape: "square",
            colliderType: config.colliderType,
            pos: { x: config.pos.x, y: config.pos.y },
            size: {
                x: config.size,
                y: config.size,
            },
        };
    }

    public static addRectangle(configurationObject: RectangleCollisionType) {
        const config = configurationObject;

        config.object.collision = {
            enabled: true,
            shape: "rectangle",
            colliderType: config.colliderType,
            pos: { x: config.pos.x, y: config.pos.y },
            size: { x: config.size.x, y: config.size.y },
        };
    }

    public static addCircle(configurationObject: CircleCollisionType) {
        const config = configurationObject;

        config.object.collision = {
            enabled: true,
            shape: "circle",
            colliderType: config.colliderType,
            pos: { x: config.pos.x, y: config.pos.y },
            size: {
                x: config.size,
                y: config.size,
            },
        };
    }
}
