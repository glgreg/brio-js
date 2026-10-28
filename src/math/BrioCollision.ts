import { BrioObject2D, CollisionColliderType } from "../objects/BrioObject2D";
import { BrioObject3D } from "../objects/BrioObject3D";
import { Vec2 } from "./index";

/**
 * Configuration object for attaching a rectangular AABB collider to a `BrioObject2D`.
 */
export type RectangleCollisionType = {
    /** Target `BrioObject2D` that will receive the collider. */
    object: BrioObject2D;
    /** Physical interaction mode (`"solid"` or `"trigger"`). */
    colliderType: CollisionColliderType;
    /** Local offset `{ x, y }` relative to `object.transform.position`. */
    pos: Vec2;
    /** Width (`x`) and height (`y`) of the rectangle in pixels. */
    size: Vec2;
};

/**
 * Configuration object for attaching a square AABB collider to a `BrioObject2D`.
 */
export type SquareCollisionType = {
    /** Target `BrioObject2D` that will receive the collider. */
    object: BrioObject2D;
    /** Physical interaction mode (`"solid"` or `"trigger"`). */
    colliderType: CollisionColliderType;
    /** Local offset `{ x, y }` relative to `object.transform.position`. */
    pos: Vec2;
    /** Side length of the square collider in pixels. */
    size: number;
};

/**
 * Configuration object for attaching a circular collider to a `BrioObject2D`.
 */
export type CircleCollisionType = {
    /** Target `BrioObject2D` that will receive the collider. */
    object: BrioObject2D;
    /** Physical interaction mode (`"solid"` or `"trigger"`). */
    colliderType: CollisionColliderType;
    /** Local offset `{ x, y }` of the circle's top-left bounding box relative to `object.transform.position`. */
    pos: Vec2;
    /** Diameter of the circle collider in pixels (`radius = size / 2`). */
    size: number;
};

/**
 * Provides 2D and 3D collision mask attachment, narrow-phase intersection testing
 * (Rectangle/Square, Circle, Box3D, Sphere3D), and Minimum Translation Vector (MTV) physical resolution.
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
 * if (BrioCollision.isColliding(player, wall)) {
 *     BrioCollision.resolveCollision(player, wall);
 * }
 * ```
 */
export class BrioCollision {
    /**
     * Tests whether two `BrioObject2D` instances with active (`enabled: true`) collision masks are intersecting.
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
    public static isColliding(one: BrioObject2D, two: BrioObject2D): boolean {
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
     * Computes the Minimum Translation Vector (MTV) needed to push `one` out of penetration with `two`.
     * Returns `null` if the two objects are not colliding.
     *
     * @param one Moving or primary `BrioObject2D`
     * @param two Obstacle or secondary `BrioObject2D`
     * @returns Translation vector `{ x, y }` to apply to `one`, or `null` if not overlapping
     * @example
     * ```ts
     * const mtv = BrioCollision.computeMTV(player, wall);
     * if (mtv) {
     *     player.transform.position.x += mtv.x;
     *     player.transform.position.y += mtv.y;
     * }
     * ```
     */
    public static computeMTV(one: BrioObject2D, two: BrioObject2D): Vec2 | null {
        if (!this.isColliding(one, two)) return null;

        const c1 = one.collision!;
        const c2 = two.collision!;

        if (c1.shape === "circle" && c2.shape === "circle") {
            const r1 = Math.min(c1.size.x, c1.size.y) / 2;
            const r2 = Math.min(c2.size.x, c2.size.y) / 2;
            const c1x = one.transform.position.x + c1.pos.x + r1;
            const c1y = one.transform.position.y + c1.pos.y + r1;
            const c2x = two.transform.position.x + c2.pos.x + r2;
            const c2y = two.transform.position.y + c2.pos.y + r2;

            const dx = c1x - c2x;
            const dy = c1y - c2y;
            const dist = Math.hypot(dx, dy);
            const overlap = r1 + r2 - dist;
            if (dist === 0) {
                return { x: overlap, y: 0 };
            }
            return {
                x: (dx / dist) * overlap,
                y: (dy / dist) * overlap,
            };
        }

        const x1 = one.transform.position.x + c1.pos.x;
        const y1 = one.transform.position.y + c1.pos.y;
        const w1 = c1.size.x;
        const h1 = c1.size.y;

        const x2 = two.transform.position.x + c2.pos.x;
        const y2 = two.transform.position.y + c2.pos.y;
        const w2 = c2.size.x;
        const h2 = c2.size.y;

        const overlapLeft = x1 + w1 - x2;
        const overlapRight = x2 + w2 - x1;
        const overlapTop = y1 + h1 - y2;
        const overlapBottom = y2 + h2 - y1;

        const minX = overlapLeft < overlapRight ? -overlapLeft : overlapRight;
        const minY = overlapTop < overlapBottom ? -overlapTop : overlapBottom;

        if (Math.abs(minX) < Math.abs(minY)) {
            return { x: minX, y: 0 };
        } else {
            return { x: 0, y: minY };
        }
    }

    /**
     * Resolves physical penetration between `mover` and `obstacle` when both colliders are `"solid"`.
     * If either collider has `colliderType === "trigger"`, no displacement is applied and `null` is returned.
     *
     * @param mover Dynamic `BrioObject2D` whose position will be adjusted
     * @param obstacle Solid obstacle `BrioObject2D`
     * @returns Applied MTV displacement `{ x, y }`, or `null` if no solid collision occurred
     * @example
     * ```ts
     * BrioCollision.resolveCollision(player, platform);
     * ```
     */
    public static resolveCollision(mover: BrioObject2D, obstacle: BrioObject2D): Vec2 | null {
        if (!mover.collision || !obstacle.collision) return null;
        if (
            mover.collision.colliderType !== "solid" ||
            obstacle.collision.colliderType !== "solid"
        ) {
            return null;
        }

        const mtv = this.computeMTV(mover, obstacle);
        if (!mtv) return null;

        mover.transform.position.x += mtv.x;
        mover.transform.position.y += mtv.y;
        return mtv;
    }

    /**
     * Tests whether two 3D `BrioObject3D` instances with active 3D colliders (`"box"` or `"sphere"`) are intersecting.
     * Supports Box vs Box, Sphere vs Sphere, and symmetric Sphere vs Box.
     *
     * @param one First 3D object
     * @param two Second 3D object
     * @returns `true` if the two 3D colliders intersect
     * @example
     * ```ts
     * if (BrioCollision.isColliding3D(ship, asteroid)) {
     *     console.log("3D collision detected!");
     * }
     * ```
     */
    public static isColliding3D(one: BrioObject3D, two: BrioObject3D): boolean {
        if (!one.collision || !two.collision) return false;
        if (!one.collision.enabled || !two.collision.enabled) return false;

        const s1 = one.collision.shape;
        const s2 = two.collision.shape;

        if (s1 === "sphere" && s2 === "sphere") {
            const r1 = one.collision.size.x * 0.5;
            const r2 = two.collision.size.x * 0.5;
            const c1x = one.transform.position.x + one.collision.pos.x + r1;
            const c1y = one.transform.position.y + one.collision.pos.y + r1;
            const c1z = one.transform.position.z + one.collision.pos.z + r1;

            const c2x = two.transform.position.x + two.collision.pos.x + r2;
            const c2y = two.transform.position.y + two.collision.pos.y + r2;
            const c2z = two.transform.position.z + two.collision.pos.z + r2;

            const dx = c1x - c2x;
            const dy = c1y - c2y;
            const dz = c1z - c2z;
            const rSum = r1 + r2;
            return dx * dx + dy * dy + dz * dz <= rSum * rSum;
        }

        if (s1 === "sphere" || s2 === "sphere") {
            const sphereObj = s1 === "sphere" ? one : two;
            const boxObj = s1 === "sphere" ? two : one;

            const r = sphereObj.collision!.size.x * 0.5;
            const cx = sphereObj.transform.position.x + sphereObj.collision!.pos.x + r;
            const cy = sphereObj.transform.position.y + sphereObj.collision!.pos.y + r;
            const cz = sphereObj.transform.position.z + sphereObj.collision!.pos.z + r;

            const minX = boxObj.transform.position.x + boxObj.collision!.pos.x;
            const maxX = minX + boxObj.collision!.size.x;
            const minY = boxObj.transform.position.y + boxObj.collision!.pos.y;
            const maxY = minY + boxObj.collision!.size.y;
            const minZ = boxObj.transform.position.z + boxObj.collision!.pos.z;
            const maxZ = minZ + boxObj.collision!.size.z;

            const closestX = Math.max(minX, Math.min(cx, maxX));
            const closestY = Math.max(minY, Math.min(cy, maxY));
            const closestZ = Math.max(minZ, Math.min(cz, maxZ));

            const dx = cx - closestX;
            const dy = cy - closestY;
            const dz = cz - closestZ;
            return dx * dx + dy * dy + dz * dz <= r * r;
        }

        // Box vs Box AABB 3D
        const aMinX = one.transform.position.x + one.collision.pos.x;
        const aMaxX = aMinX + one.collision.size.x;
        const aMinY = one.transform.position.y + one.collision.pos.y;
        const aMaxY = aMinY + one.collision.size.y;
        const aMinZ = one.transform.position.z + one.collision.pos.z;
        const aMaxZ = aMinZ + one.collision.size.z;

        const bMinX = two.transform.position.x + two.collision.pos.x;
        const bMaxX = bMinX + two.collision.size.x;
        const bMinY = two.transform.position.y + two.collision.pos.y;
        const bMaxY = bMinY + two.collision.size.y;
        const bMinZ = two.transform.position.z + two.collision.pos.z;
        const bMaxZ = bMinZ + two.collision.size.z;

        return !(
            aMaxX <= bMinX ||
            bMaxX <= aMinX ||
            aMaxY <= bMinY ||
            bMaxY <= aMinY ||
            aMaxZ <= bMinZ ||
            bMaxZ <= aMinZ
        );
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

