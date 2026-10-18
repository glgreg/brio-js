import { BrioSprite } from "../assets/BrioSprite";
import BrioTransform from "../base/BrioTransform";
import { BrioCollision } from "../math/BrioCollision";
import { Vec2 } from "../math/index";
import { create } from "../math/vec2";

/**
 * Dictionary mapping keyboard keys to action callbacks.
 */
export type KeyActions = {
    [key: string]: () => void;
};

/**
 * Represents the 2D collision mask attached to a `BrioObject`.
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
 * - `"trigger"`: Represents a non-blocking sensor or area that detects overlap without physical obstruction.
 */
export type CollisionColliderType = "solid" | "trigger";

/**
 * Geometric primitive shapes supported by 2D collision detection.
 */
export type CollisionShapeType = "square" | "circle" | "rectangle";

/**
 * Core 2D entity class in BrioJS encapsulating a spatial `BrioTransform`, a `BrioSprite` reference,
 * an optional `CollisionType` mask, and prefab instantiation metadata.
 *
 * @example
 * ```ts
 * game.load((assets) => {
 *     const sprPlayer = assets.getSprite("spr_player");
 *     const player = new BrioObject("obj_player", sprPlayer.name, 1);
 *     player.transform.position = { x: 100, y: 200 };
 *     return [player];
 * });
 * ```
 */
export class BrioObject {
    // Basic properties
    #transform: BrioTransform = new BrioTransform(create(0, 0), create(0, 0));
    /** Unique identifier of the game object. */
    #name: string;
    /** Name of the `BrioSprite` asset attached to this game object. */
    #sprite: BrioSprite["name"];

    // Cloning and identification logic
    /** Internal flag indicating whether `BrioGame.instantiate` is currently creating a clone. */
    public static instanceOfObject: boolean = false;
    /** Sequential 1-based instance ID when spawned via `game.instantiate()`, or `0` for the original template object. */
    public instanceId: number;
    /** Total number of clones instantiated from this object template. */
    #clonesInstantiatedValue: number = 0;
    /** Singleton fallback empty object instance. */
    static #emptyInstance?: BrioObject;

    // COLLISION LOGIC
    /** Optional 2D collision mask configuration (`shape`, `colliderType`, `pos`, `size`, `enabled`). */
    public collision?: CollisionType;

    /**
     * Creates a new `BrioObject` instance.
     *
     * @param name Unique identifier for the object (cannot end with `-[0-9]+` unless instantiated via `game.instantiate()`)
     * @param sprite Name of the preloaded `BrioSprite` asset to render
     * @param layer Non-negative rendering depth layer (defaults to `1`)
     * @throws {Error} When a manually created object's `name` ends with `-[0-9]+`
     * @example
     * ```ts
     * game.load((assets) => {
     *     const sprPlayer = assets.getSprite("spr_player");
     *     const player = new BrioObject("obj_player", sprPlayer.name, 1);
     *     return [player];
     * });
     * ```
     */
    constructor(name: string, sprite: BrioSprite["name"], layer: number = 1) {
        // Checks if the given name has -[0-9] at the end (so it doesn't conflict with instances of the same game object)
        if (/-[0-9]+$/.test(name) && !BrioObject.instanceOfObject) {
            throw new Error(
                "Game objects can't end with '-number', try using underline instead (bot-5 -> bot_5)",
            );
        }

        this.#name = name;
        this.#sprite = sprite;
        this.transform.layer = Math.round(Math.abs(layer));
        this.instanceId = 0;
    }

    /**
     * GETTERS AND SETTERS --------------------------------------------------------------
     */

    /**
     * Spatial 2D transformation component (`position`, `size`, `scale`, `rotation`, `pivot`, `skew`, `flip`, `visibility`, `opacity`, `layer`).
     *
     * @example
     * ```ts
     * player.transform.position.x += 150 * dt;
     * player.transform.scale = { x: 2, y: 2 };
     * ```
     */
    public get transform(): BrioTransform {
        return this.#transform;
    }

    /**
     * Name of the `BrioSprite` asset attached to this game object.
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
    }

    /**
     * Unique identifier of this `BrioObject`.
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
     * Increments the count of clones instantiated from this object template.
     * Can only be modified internally during `game.instantiate()`.
     *
     * @throws {Error} When modified outside `game.instantiate()`
     */
    public set clonesInstantiatedValue(value: number) {
        if (!BrioObject.instanceOfObject) {
            throw new Error(
                "The number of clones can't be hard coded, their amount increases automatically when new instances are created.",
            );
        }

        this.#clonesInstantiatedValue += value;
    }

    public get clonesInstantiatedValue(): number {
        return this.#clonesInstantiatedValue;
    }

    /**
     * METHODS --------------------------------------------------------------------------
     */

    /**
     * Attaches a 2D collision mask to this `BrioObject` if one is not already present.
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
     * Returns a shared singleton fallback `BrioObject` when a requested object is not found.
     *
     * @returns Fallback empty `BrioObject` instance
     */
    public static getEmptyInstance(): BrioObject {
        if (!this.#emptyInstance) {
            const instance = new BrioObject("", "", 1);

            this.#emptyInstance = instance;
        }

        return this.#emptyInstance;
    }

    /**
     * Creates a deep copy of a `BrioObject`, preserving all `transform` properties and its `collision` mask.
     *
     * @param gameObject Source `BrioObject` to clone
     * @returns A new `BrioObject` with identical transform and collider configuration
     * @example
     * ```ts
     * const enemyCopy = BrioObject.clone(enemyTemplate);
     * ```
     */
    public static clone(gameObject: BrioObject): BrioObject {
        const object = new BrioObject(
            gameObject.#name,
            gameObject.#sprite,
            gameObject.transform.layer,
        );
        object.transform.position = {
            x: gameObject.transform.position.x,
            y: gameObject.transform.position.y,
        };
        object.transform.size = {
            x: gameObject.transform.size.x,
            y: gameObject.transform.size.y,
        };
        object.transform.scale = {
            x: gameObject.transform.scale.x,
            y: gameObject.transform.scale.y,
        };
        object.transform.rotation = gameObject.transform.rotation;
        object.transform.pivot = {
            x: gameObject.transform.pivot.x,
            y: gameObject.transform.pivot.y,
        };
        object.transform.skew = {
            x: gameObject.transform.skew.x,
            y: gameObject.transform.skew.y,
        };
        object.transform.flip = {
            x: gameObject.transform.flip.x,
            y: gameObject.transform.flip.y,
        };
        object.transform.visibility = gameObject.transform.visibility;
        object.transform.opacity = gameObject.transform.opacity;

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
}

