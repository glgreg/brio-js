import { CollisionListener, CollisionListeners } from "../physics/BrioCollisionEvents";
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
 * Properties of a `BrioObject2D` that live outside the ECS buffers (sprite, flip, hierarchy, tag, collider, plus
 * subclass settings such as the text of a `BrioText`). Captured by checkpoints next to the ECS bytes, so
 * `restoreCheckPoint()` / `restart()` bring them back too.
 */
export interface BrioObject2DState {
    readonly sprite: string;
    readonly flipX: boolean;
    readonly flipY: boolean;
    readonly parent: BrioTransform2D | undefined;
    readonly tag: string;
    readonly collision: CollisionType | undefined;
    /** Subclass state (see `captureExtraState()`). */
    readonly extra: unknown;
}

/** Deep copy of a 2D collider (or `undefined`). */
function copyCollision(collision: CollisionType | undefined): CollisionType | undefined {
    if (!collision) return undefined;
    return {
        enabled: collision.enabled,
        colliderType: collision.colliderType,
        shape: collision.shape,
        pos: { x: collision.pos.x, y: collision.pos.y },
        size: { x: collision.size.x, y: collision.size.y },
    };
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
     * Free-form group label (e.g. `"enemy"`, `"pickup"`), copied to clones by `game.instantiate()` and
     * `BrioObject2D.clone()`; handy to tell objects apart in collision callbacks without parsing names.
     *
     * @example
     * ```ts
     * player.onCollisionEnter((other) => {
     *     if (other.tag === "coin") game.destroy(other);
     * });
     * ```
     */
    public tag: string = "";

    /** Collision listeners of this object (`undefined` until one is registered). */
    #collisionListeners?: CollisionListeners<BrioObject2D>;

    /**
     * Collision listeners registered through `onCollisionEnter` / `onCollisionStay` / `onCollisionExit`
     * (`undefined` when none was registered). Read by the engine's collision event pass.
     */
    public get collisionListeners(): CollisionListeners<BrioObject2D> | undefined {
        return this.#collisionListeners;
    }

    #listeners(): CollisionListeners<BrioObject2D> {
        return (this.#collisionListeners ??= new CollisionListeners<BrioObject2D>());
    }

    /**
     * Registers `listener` for the first frame this object's collider overlaps another enabled collider
     * (`"solid"` or `"trigger"`). Both objects must be registered in the game or in the active scene. Events fire
     * once per frame, after the `update()` callback; they only report contacts, they do not separate solid objects
     * (call `BrioCollision.resolveCollision(self, other)` for that). Clones made by `game.instantiate()` inherit the
     * prefab's listeners, so use the `self` argument instead of the prefab variable inside a shared listener.
     *
     * @param listener Callback receiving the other object and this object
     * @returns Function that unregisters the listener
     * @example
     * ```ts
     * player.onCollisionEnter((other) => {
     *     if (other.tag === "coin") {
     *         score++;
     *         game.destroy(other);
     *     }
     * });
     * ```
     */
    public onCollisionEnter(listener: CollisionListener<BrioObject2D>): () => void {
        return this.#listeners().add("enter", listener);
    }

    /**
     * Registers `listener` for every frame after the first one in which this object keeps overlapping another
     * collider (see `onCollisionEnter` for the rules).
     *
     * @param listener Callback receiving the other object and this object
     * @returns Function that unregisters the listener
     * @example
     * ```ts
     * player.onCollisionStay((other, self) => {
     *     if (other.tag === "wall") BrioCollision.resolveCollision(self, other);
     * });
     * ```
     */
    public onCollisionStay(listener: CollisionListener<BrioObject2D>): () => void {
        return this.#listeners().add("stay", listener);
    }

    /**
     * Registers `listener` for the first frame this object stops overlapping another collider, including when the
     * other object is destroyed or its collider disabled (see `onCollisionEnter` for the rules).
     *
     * @param listener Callback receiving the other object and this object
     * @returns Function that unregisters the listener
     * @example
     * ```ts
     * zone.onCollisionExit((other) => {
     *     if (other === player) hint.transform.visibility = false;
     * });
     * ```
     */
    public onCollisionExit(listener: CollisionListener<BrioObject2D>): () => void {
        return this.#listeners().add("exit", listener);
    }

    /**
     * Copies every collision listener of `source` onto this object (`game.instantiate()` does it for clones).
     *
     * @param source Object whose listeners are copied
     */
    public copyCollisionListenersFrom(source: BrioObject2D): void {
        const listeners = source.collisionListeners;
        if (listeners && !listeners.isEmpty) this.#listeners().copyFrom(listeners);
    }

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
     * @param depth Non-negative drawing order inside its `BrioLayer` (`transform.depth`, defaults to `1`)
     * @example
     * ```ts
     * const player = new BrioObject2D("obj_player", "spr_player", 1);
     * ```
     */
    constructor(name: string, sprite: BrioSprite["name"] = "", depth: number = 1) {
        this.#name = name;
        this.#sprite = sprite;
        this.transform.depth = Math.round(Math.abs(depth));
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
     * Creates a deep copy of a `BrioObject2D`, preserving its concrete type, all `transform` properties, its `tag`
     * and its collider. The copy is not bound to any `ECSWorld`.
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
        const object = gameObject.createCopy(name);
        BrioObject2D.copyTransform(gameObject, object);
        object.tag = gameObject.tag;

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
     * Captures the properties of this object that are not stored in the ECS (see `BrioObject2DState`).
     * Checkpoints call it for every registered object; game code rarely needs it directly.
     *
     * @returns Plain state accepted by `restoreState()`
     * @example
     * ```ts
     * const saved = door.captureState();
     * door.sprite = "spr_door_open";
     * door.restoreState(saved); // back to "spr_door_closed"
     * ```
     */
    public captureState(): BrioObject2DState {
        const flip = this.transform.flip;
        return {
            sprite: this.#sprite,
            flipX: flip.x,
            flipY: flip.y,
            parent: this.transform.parent,
            tag: this.tag,
            collision: copyCollision(this.collision),
            extra: this.captureExtraState(),
        };
    }

    /**
     * Restores the properties captured by `captureState()`.
     *
     * @param state State captured from this object
     */
    public restoreState(state: BrioObject2DState): void {
        if (this.#sprite !== state.sprite) this.sprite = state.sprite;
        const flip = this.transform.flip;
        if (flip.x !== state.flipX || flip.y !== state.flipY) {
            this.transform.flip = { x: state.flipX, y: state.flipY };
        }
        if (this.transform.parent !== state.parent) this.transform.parent = state.parent;
        this.tag = state.tag;
        this.collision = copyCollision(state.collision);
        this.restoreExtraState(state.extra);
    }

    /**
     * Subclass hook of `captureState()`: returns the subclass settings to keep in checkpoints.
     *
     * @returns Subclass state (`undefined` for a plain `BrioObject2D`)
     */
    protected captureExtraState(): unknown {
        return undefined;
    }

    /**
     * Subclass hook of `restoreState()`.
     *
     * @param _extra Value returned by `captureExtraState()`
     */
    protected restoreExtraState(_extra: unknown): void {}

    /**
     * Creates the unbound object `clone()` fills in. Subclasses (such as `BrioText`) override it so clones keep
     * their concrete type and its own settings.
     *
     * @param name Name of the copy
     * @returns A new, unregistered object of the same concrete type
     */
    protected createCopy(name: string): BrioObject2D {
        return new BrioObject2D(name, this.#sprite, this.transform.depth);
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
        to.depth = from.depth;
    }
}
