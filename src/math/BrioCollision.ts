import { BrioObject, CollisionColliderType } from "../objects/BrioObject";
import { Vec2 } from "./index";

/**
 * Configuration object for attaching a rectangular AABB collider to a `BrioObject`.
 */
export type RectangleCollisionType = {
    /** Target `BrioObject` that will receive the collider. */
    object: BrioObject;
    /** Physical interaction mode (`"solid"` or `"trigger"`). */
    colliderType: CollisionColliderType;
    /** Local offset `{ x, y }` relative to `object.transform.position`. */
    pos: Vec2;
    /** Width (`x`) and height (`y`) of the rectangle in pixels. */
    size: Vec2;
};

/**
 * Configuration object for attaching a square AABB collider to a `BrioObject`.
 */
export type SquareCollisionType = {
    /** Target `BrioObject` that will receive the collider. */
    object: BrioObject;
    /** Physical interaction mode (`"solid"` or `"trigger"`). */
    colliderType: CollisionColliderType;
    /** Local offset `{ x, y }` relative to `object.transform.position`. */
    pos: Vec2;
    /** Side length of the square collider in pixels. */
    size: number;
};

/**
 * Configuration object for attaching a circular collider to a `BrioObject`.
 */
export type CircleCollisionType = {
    /** Target `BrioObject` that will receive the collider. */
    object: BrioObject;
    /** Physical interaction mode (`"solid"` or `"trigger"`). */
    colliderType: CollisionColliderType;
    /** Local offset `{ x, y }` of the circle's top-left bounding box relative to `object.transform.position`. */
    pos: Vec2;
    /** Diameter of the circle collider in pixels (`radius = size / 2`). */
    size: number;
};

/**
 * Provides 2D collision mask attachment and narrow-phase intersection testing
 * (Rectangle/Square vs Rectangle/Square, Circle vs Circle, and symmetric Circle vs Rectangle/Square).
 *
 * @example
 * ```ts
 * BrioCollision.addRectangle({
 *     object: player,
 *     colliderType: "solid",
 *     pos: { x: 8, y: 4 },
 *     size: { x: 48, y: 56 },
 * });
 *
 * if (BrioCollision.isColliding(player, coin)) {
 *     game.destroy(coin);
 * }
 * ```
 */
export class BrioCollision {
    /**
     * Tests whether two `BrioObject` instances with active (`enabled: true`) collision masks are intersecting.
     * Supports Rectangle/Square vs Rectangle/Square, Circle vs Circle, and symmetric Circle vs Rectangle/Square.
     *
     * @param one First game object
     * @param two Second game object
     * @returns `true` if the two colliders overlap, otherwise `false`
     * @example
     * ```ts
     * if (BrioCollision.isColliding(enemy, projectile)) {
     *     game.destroy(projectile);
     * }
     * ```
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

                const radius =
                    Math.min(circleObj.collision!.size.x, circleObj.collision!.size.y) / 2;
                const cx = circleObj.transform.position.x + circleObj.collision!.pos.x + radius;
                const cy = circleObj.transform.position.y + circleObj.collision!.pos.y + radius;

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

    /**
     * Attaches an enabled square AABB collider (`width === height === size`) to `configurationObject.object`.
     *
     * @param configurationObject Square collider configuration
     * @example
     * ```ts
     * BrioCollision.addSquare({
     *     object: crate,
     *     colliderType: "solid",
     *     pos: { x: 0, y: 0 },
     *     size: 32,
     * });
     * ```
     */
    public static addSquare(configurationObject: SquareCollisionType): void {
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

    /**
     * Attaches an enabled rectangular AABB collider to `configurationObject.object`.
     *
     * @param configurationObject Rectangle collider configuration
     * @example
     * ```ts
     * BrioCollision.addRectangle({
     *     object: enemy,
     *     colliderType: "solid",
     *     pos: { x: 6, y: 0 },
     *     size: { x: 50, y: 64 },
     * });
     * ```
     */
    public static addRectangle(configurationObject: RectangleCollisionType): void {
        const config = configurationObject;

        config.object.collision = {
            enabled: true,
            shape: "rectangle",
            colliderType: config.colliderType,
            pos: { x: config.pos.x, y: config.pos.y },
            size: { x: config.size.x, y: config.size.y },
        };
    }

    /**
     * Attaches an enabled circular collider (`diameter = size`, `radius = size / 2`) to `configurationObject.object`.
     *
     * @param configurationObject Circle collider configuration
     * @example
     * ```ts
     * BrioCollision.addCircle({
     *     object: coin,
     *     colliderType: "trigger",
     *     pos: { x: 0, y: 0 },
     *     size: 24,
     * });
     * ```
     */
    public static addCircle(configurationObject: CircleCollisionType): void {
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

