import {
    BrioObject,
    CollisionColliderType,
    CollisionShapeType,
    CollisionType,
    KeyActions,
} from "./BrioObject";

/**
 * Concrete 2D interactive entity within a scene (`BrioObject2D`).
 * Possesses a 2D spatial transform (`BrioTransform2D`), sprite reference, optional 2D collider (`CollisionType`),
 * and ECS entity handle support.
 *
 * @example
 * ```ts
 * const player = new BrioObject2D("obj_player", "spr_player", 1);
 * player.transform.position = { x: 100, y: 200 };
 * ```
 */
export class BrioObject2D extends BrioObject {
    /**
     * Creates a new `BrioObject2D` entity.
     *
     * @param name Unique identifier for the 2D object
     * @param sprite Name of the `BrioSprite` asset attached to this entity
     * @param layer Rendering layer index (defaults to `1`)
     */
    constructor(name: string, sprite: string = "", layer: number = 1) {
        super(name, sprite, layer);
    }

    /**
     * Creates a deep copy of a `BrioObject2D`, preserving all `transform` properties and its `collision` mask.
     *
     * @param gameObject Source 2D object to clone
     * @returns New `BrioObject2D` instance
     * @example
     * ```ts
     * const cloned = BrioObject2D.clone(template2D);
     * ```
     */
    public static override clone(gameObject: BrioObject): BrioObject2D {
        const baseClone = super.clone(gameObject);
        const obj2D = new BrioObject2D(
            baseClone.name,
            baseClone.sprite,
            baseClone.transform.layer,
        );
        obj2D.transform.position = {
            x: baseClone.transform.position.x,
            y: baseClone.transform.position.y,
        };
        obj2D.transform.size = {
            x: baseClone.transform.size.x,
            y: baseClone.transform.size.y,
        };
        obj2D.transform.scale = {
            x: baseClone.transform.scale.x,
            y: baseClone.transform.scale.y,
        };
        obj2D.transform.rotation = baseClone.transform.rotation;
        obj2D.transform.pivot = {
            x: baseClone.transform.pivot.x,
            y: baseClone.transform.pivot.y,
        };
        obj2D.transform.skew = {
            x: baseClone.transform.skew.x,
            y: baseClone.transform.skew.y,
        };
        obj2D.transform.flip = {
            x: baseClone.transform.flip.x,
            y: baseClone.transform.flip.y,
        };
        obj2D.transform.visibility = baseClone.transform.visibility;
        obj2D.transform.opacity = baseClone.transform.opacity;
        if (baseClone.collision) {
            obj2D.collision = {
                enabled: baseClone.collision.enabled,
                shape: baseClone.collision.shape,
                colliderType: baseClone.collision.colliderType,
                pos: { x: baseClone.collision.pos.x, y: baseClone.collision.pos.y },
                size: { x: baseClone.collision.size.x, y: baseClone.collision.size.y },
            };
        }
        return obj2D;
    }
}

export type { CollisionColliderType, CollisionShapeType, CollisionType, KeyActions };
