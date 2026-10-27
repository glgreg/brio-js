import { BrioSprite } from "../assets/BrioSprite";
import { BrioCollision } from "../math/BrioCollision";
import { Vec2 } from "../math/index";
import { create } from "../math/vec2";
import { BrioTransform2D } from "./BrioTransform2D";

/**
 * Dictionary mapping keyboard keys to action callbacks.
 */
export type KeyActions = {
    [key: string]: () => void;
};

/**
 * Represents the 2D collider attached to a `BrioObject2D`.
 */
export interface CollisionType {
    /** Controls whether collision detection is active for this collider. */
    enabled: boolean;
    /** Physical interaction behavior (`"solid"` blocks movement, `"trigger"` detects overlap without physical blocking). */
    colliderType: CollisionColliderType;
    /** Geometric primitive used for intersection checks (`"square"`, `"rectangle"`, or `"circle"`). */
    shape: CollisionShapeType;
    /** Local offset `{ x, y }` of the collider relative to `transform.position`. */
    pos: Vec2;
    /** Dimensions `{ x, y }` of the collider in pixels (for `"circle"`, `size.x` and `size.y` store the diameter). */
    size: Vec2;
}

/**
 * Defines how a collider interacts during collision checks:
 * - `"solid"`: Represents a physical obstacle or body.
 * - `"trigger"`: Represents a non-blocking area that detects overlap without physical obstruction.
 */
export type CollisionColliderType = "solid" | "trigger";

/**
 * Geometric primitive shapes supported by 2D collision detection.
 */
export type CollisionShapeType = "square" | "circle" | "rectangle";

/**
 * Concrete 2D interactive entity within a scene (`BrioObject2D`).
 * Possesses a 2D spatial transform (`BrioTransform2D`), a `BrioSprite` reference, an optional 2D collider
 * (`CollisionType`), and an ECS entity handle (`entityId` + `entityGeneration`).
 *
 * @example
 * ```ts
 * game.load((assets) => {
 *     const player = new BrioObject2D("obj_player", assets.getSprite("spr_player").name, 1);
 *     player.transform.position = { x: 100, y: 200 };
 *     return [player];
 * });
 * ```
 */
export class BrioObject2D {
    #transform: BrioTransform2D = new BrioTransform2D(create(0, 0), create(0, 0));
    /** Unique identifier of the game object. */
    #name: string;
    /** Name of the `BrioSprite` asset attached to this game object. */
    #sprite: BrioSprite["name"];
    /** Numeric entity ID allocated in `ECSWorld` (`-1` if not bound). */
    #entityId: number = -1;
    /** Singleton fallback empty object instance. */
    static #emptyInstance?: BrioObject2D;

    /** Sequential 1-based instance ID when spawned via `game.instantiate()`, or `0` for a manually created object. */
    public instanceId: number = 0;

    /**
     * Generation of the `ECSWorld` slot captured when `entityId` was assigned.
     * Compared against `world.generationOf(entityId)` to detect stale handles.
     */
    public entityGeneration: number = 0;

    /** Optional 2D collider configuration (`shape`, `colliderType`, `pos`, `size`, `enabled`). */
    public collision?: CollisionType;

    /**
     * Creates a new `BrioObject2D` entity.
     *
     * @param name Unique identifier for the 2D object
     * @param sprite Name of the `BrioSprite` asset attached to this entity (defaults to `""`)
     * @param layer Non-negative depth order inside its `BrioLayer` (defaults to `1`)
     * @example
     * ```ts
     * const player = new BrioObject2D("obj_player", "spr_player", 1);
     * ```
     */
    constructor(name: string, sprite: BrioSprite["name"] = "", layer: number = 1) {
        this.#name = name;
        this.#sprite = sprite;
        this.transform.layer = Math.round(Math.abs(layer));
    }

    /**
     * Spatial 2D transformation component (`position`, `size`, `scale`, `rotation`, `pivot`, `skew`, `flip`, `visibility`, `opacity`, `layer`).
     *
     * @example
     * ```ts
     * player.transform.position.x += 150 * dt;
     * player.transform.scale = { x: 2, y: 2 };
     * ```
     */
    public get transform(): BrioTransform2D {
        return this.#transform;
    }

    /**
     * Name of the `BrioSprite` asset attached to this game object.
     * Changing it marks the transform dirty so cached `"static"` layers redraw.
     *
     * @example
     * ```ts
     * player.sprite = "spr_player_run";
     * ```
     */
    public get sprite(): string {
        return this.#sprite;
    }
    public set sprite(newSprite: string) {
        this.#sprite = newSprite;
        this.#transform.markDirty();
    }

    /**
     * Unique identifier of this `BrioObject2D`.
     *
     * @example
     * ```ts
     * console.log(player.name); // "obj_player"
     * ```
     */
    public get name(): string {
        return this.#name;
    }

    /**
     * Numeric entity ID allocated in `ECSWorld` (`-1` if not bound).
     */
    public get entityId(): number {
        return this.#entityId;
    }
    public set entityId(id: number) {
        this.#entityId = id;
    }

    /**
     * Attaches a 2D collider to this `BrioObject2D` if one is not already present.
     *
     * @param shape Geometric shape (`"square"`, `"rectangle"`, or `"circle"`)
     * @param collisionType Collider interaction mode (`"solid"` or `"trigger"`)
     * @param px Local horizontal offset from `transform.position.x`
     * @param py Local vertical offset from `transform.position.y`
     * @param sw Width (or diameter for `"circle"`) of the collider in pixels
     * @param sh Height (or diameter for `"circle"`) of the collider in pixels
     * @example
     * ```ts
     * player.addCollisionMask("rectangle", "solid", 4, 2, 24, 60);
     * ```
     */
    public addCollisionMask(
        shape: CollisionShapeType = "square",
        collisionType: CollisionColliderType = "solid",
        px: number = 0,
        py: number = 0,
        sw: number = this.transform.size.x,
        sh: number = shape === "square" || shape === "circle" ? sw : this.transform.size.y,
    ): void {
        if (this.collision) {
            return;
        }

        this.collision = {
            enabled: true,
            shape: shape,
            colliderType: collisionType,
            pos: { x: px, y: py },
            size: { x: sw, y: sh },
        };
    }

    /**
     * Returns a shared singleton fallback `BrioObject2D` when a requested object is not found.
     *
     * @returns Fallback empty `BrioObject2D` instance
     */
    public static getEmptyInstance(): BrioObject2D {
        if (!this.#emptyInstance) {
            this.#emptyInstance = new BrioObject2D("", "", 1);
        }
        return this.#emptyInstance;
    }

    /**
     * Creates a deep copy of a `BrioObject2D`, preserving all `transform` properties and its collider.
     * The copy is not bound to any `ECSWorld`.
     *
     * @param gameObject Source `BrioObject2D` to clone
     * @param name Name of the copy (defaults to the source name)
     * @returns A new `BrioObject2D` with identical transform and collider configuration
     * @example
     * ```ts
     * const enemyCopy = BrioObject2D.clone(enemyTemplate, "obj_enemy_copy");
     * ```
     */
    public static clone(gameObject: BrioObject2D, name: string = gameObject.#name): BrioObject2D {
        const object = new BrioObject2D(name, gameObject.#sprite, gameObject.transform.layer);
        BrioObject2D.copyTransform(gameObject, object);

        if (gameObject.collision) {
            switch (gameObject.collision.shape) {
                case "square":
                    BrioCollision.addSquare({
                        object: object,
                        colliderType: gameObject.collision.colliderType,
                        pos: { x: gameObject.collision.pos.x, y: gameObject.collision.pos.y },
                        size: gameObject.collision.size.x,
                    });
                    break;
                case "rectangle":
                    BrioCollision.addRectangle({
                        object: object,
                        colliderType: gameObject.collision.colliderType,
                        pos: { x: gameObject.collision.pos.x, y: gameObject.collision.pos.y },
                        size: { x: gameObject.collision.size.x, y: gameObject.collision.size.y },
                    });
                    break;
                case "circle":
                    BrioCollision.addCircle({
                        object: object,
                        colliderType: gameObject.collision.colliderType,
                        pos: { x: gameObject.collision.pos.x, y: gameObject.collision.pos.y },
                        size: gameObject.collision.size.x,
                    });
                    break;
            }
            if (object.collision) {
                object.collision.enabled = gameObject.collision.enabled;
            }
        }

        return object;
    }

    /**
     * Copies every local transform property from `source` into `target`.
     *
     * @param source Object whose transform is read
     * @param target Object whose transform is written
     */
    public static copyTransform(source: BrioObject2D, target: BrioObject2D): void {
        const from = source.transform;
        const to = target.transform;
        to.position = { x: from.position.x, y: from.position.y };
        to.size = { x: from.size.x, y: from.size.y };
        to.scale = { x: from.scale.x, y: from.scale.y };
        to.rotation = from.rotation;
        to.pivot = { x: from.pivot.x, y: from.pivot.y };
        to.skew = { x: from.skew.x, y: from.skew.y };
        to.flip = { x: from.flip.x, y: from.flip.y };
        to.visibility = from.visibility;
        to.opacity = from.opacity;
        to.layer = from.layer;
    }
}
