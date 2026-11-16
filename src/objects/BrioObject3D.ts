import { CollisionListener, CollisionListeners } from "../physics/BrioCollisionEvents";
import { Vec3 } from "../math/vec3";
import { CollisionColliderType } from "./BrioObject2D";
import { BrioTransform3D } from "./BrioTransform3D";

/**
 * Geometric primitive shapes supported by 3D collision detection.
 */
export type CollisionShape3DType = "box" | "sphere";

/**
 * Represents a 3D collision volume (`"box"` or `"sphere"`) attached to a `BrioObject3D`.
 */
export interface Collision3DType {
    /** Controls whether 3D collision detection is active for this collider. */
    enabled: boolean;
    /** Physical interaction behavior (`"solid"` blocks movement, `"trigger"` detects overlap without physical blocking). */
    colliderType: CollisionColliderType;
    /** 3D geometric primitive (`"box"` or `"sphere"`). */
    shape: CollisionShape3DType;
    /** Local offset `{ x, y, z }` relative to `transform.position`. */
    pos: Vec3;
    /** Dimensions `{ x, y, z }` of the collider (for `"sphere"`, `size.x` stores the diameter). */
    size: Vec3;
}

/**
 * Properties of a `BrioObject3D` that live outside the ECS buffers (mesh, material, tag, collider and the list of
 * child parts). Captured by checkpoints next to the ECS bytes.
 */
export interface BrioObject3DState {
    readonly mesh: string;
    readonly material: string;
    readonly tag: string;
    readonly collision: Collision3DType | undefined;
    readonly children: readonly BrioObject3D[];
}

/** Deep copy of a 3D collider (or `undefined`). */
function copyCollision3D(collision: Collision3DType | undefined): Collision3DType | undefined {
    if (!collision) return undefined;
    return {
        enabled: collision.enabled,
        shape: collision.shape,
        colliderType: collision.colliderType,
        pos: { x: collision.pos.x, y: collision.pos.y, z: collision.pos.z },
        size: { x: collision.size.x, y: collision.size.y, z: collision.size.z },
    };
}

/**
 * Concrete 3D interactive entity within a scene (`BrioObject3D`).
 * Possesses a 3D spatial transform (`BrioTransform3D`), optional mesh and material identifiers,
 * an optional 3D collider (`Collision3DType`), an ECS entity handle (`entityId` + `entityGeneration`),
 * and child `BrioObject3D` parts (`children`) rendered with the parent world matrix (e.g. multi-mesh models).
 *
 * @example
 * ```ts
 * const crate = new BrioObject3D("obj_crate", "mesh_box", "mat_wood");
 * crate.transform.position.set(0, 1, -5);
 * crate.addCollider3D("box", "solid", { x: 0, y: 0, z: 0 }, { x: 2, y: 2, z: 2 });
 * ```
 */
export class BrioObject3D {
    #name: string;
    #mesh: string;
    #material: string;
    #transform: BrioTransform3D = new BrioTransform3D();
    #entityId: number = -1;
    #parent?: BrioObject3D;
    readonly #children: BrioObject3D[] = [];
    /** Sequential 1-based instance ID when spawned via `game.instantiate()`, or `0` for a manually created object. */
    public instanceId: number = 0;
    /**
     * Free-form group label (e.g. `"enemy"`, `"pickup"`), copied to clones by `game.instantiate()`; handy to tell
     * objects apart in collision callbacks without parsing names.
     */
    public tag: string = "";
    /** Whether this object casts shadows from a shadow-casting directional light (defaults to `true`). */
    public castShadow: boolean = true;
    /** Whether shadows are drawn on this object (defaults to `true`). */
    public receiveShadow: boolean = true;

    /** Collision listeners of this object (`undefined` until one is registered). */
    #collisionListeners?: CollisionListeners<BrioObject3D>;

    /**
     * Collision listeners registered through `onCollisionEnter` / `onCollisionStay` / `onCollisionExit`
     * (`undefined` when none was registered). Read by the engine's collision event pass.
     */
    public get collisionListeners(): CollisionListeners<BrioObject3D> | undefined {
        return this.#collisionListeners;
    }

    #listeners(): CollisionListeners<BrioObject3D> {
        return (this.#collisionListeners ??= new CollisionListeners<BrioObject3D>());
    }

    /**
     * Registers `listener` for the first frame this object's collider overlaps another enabled collider
     * (`"solid"` or `"trigger"`). Both objects must be registered in the game or in the active scene. Events fire
     * once per frame, after the `update()` callback; they only report contacts (there is no 3D contact solver yet), tested
     * with `BrioCollision.isColliding3D` on the colliders added by `addCollider3D()`. Clones made by `game.instantiate()` inherit the
     * prefab's listeners, so use the `self` argument instead of the prefab variable inside a shared listener.
     *
     * @param listener Callback receiving the other object and this object
     * @returns Function that unregisters the listener
     * @example
     * ```ts
     * ship.onCollisionEnter((other) => {
     *     if (other.tag === "asteroid") game.destroy(other);
     * });
     * ```
     */
    public onCollisionEnter(listener: CollisionListener<BrioObject3D>): () => void {
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
     * ship.onCollisionStay((other) => {
     *     if (other.tag === "lava") health -= 10 * dt;
     * });
     * ```
     */
    public onCollisionStay(listener: CollisionListener<BrioObject3D>): () => void {
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
     *     if (other === ship) hint.transform.visibility = false;
     * });
     * ```
     */
    public onCollisionExit(listener: CollisionListener<BrioObject3D>): () => void {
        return this.#listeners().add("exit", listener);
    }

    /**
     * Copies every collision listener of `source` onto this object (`game.instantiate()` does it for clones).
     *
     * @param source Object whose listeners are copied
     */
    public copyCollisionListenersFrom(source: BrioObject3D): void {
        const listeners = source.collisionListeners;
        if (listeners && !listeners.isEmpty) this.#listeners().copyFrom(listeners);
    }
    /** Generation of the `ECSWorld` slot captured when `entityId` was assigned. */
    public entityGeneration: number = 0;
    /** Optional 3D collider configuration. */
    public collision?: Collision3DType;

    static #emptyInstance?: BrioObject3D;

    /**
     * Creates a new `BrioObject3D` instance.
     *
     * @param name Unique identifier for the 3D object
     * @param mesh Identifier of the `BrioMesh` geometry asset (defaults to `""`)
     * @param material Identifier of the `BrioMaterial` asset (defaults to `""`)
     * @param depth Non-negative drawing order (`transform.depth`, defaults to `1`)
     * @example
     * ```ts
     * const ship = new BrioObject3D("obj_ship", "mesh_fighter", "mat_hull");
     * ```
     */
    constructor(name: string, mesh: string = "", material: string = "", depth: number = 1) {
        this.#name = name;
        this.#mesh = mesh;
        this.#material = material;
        this.#transform.depth = Math.round(Math.abs(depth));
    }

    /** Unique identifier of this `BrioObject3D`. */
    public get name(): string {
        return this.#name;
    }

    /** Spatial 3D transformation component (`BrioTransform3D`). */
    public get transform(): BrioTransform3D {
        return this.#transform;
    }

    /** Name of the 3D `BrioMesh` asset attached to this entity. */
    public get mesh(): string {
        return this.#mesh;
    }
    public set mesh(value: string) {
        this.#mesh = value;
    }

    /** Name of the 3D `BrioMaterial` asset attached to this entity. */
    public get material(): string {
        return this.#material;
    }
    public set material(value: string) {
        this.#material = value;
    }

    /** Numeric entity ID allocated in `ECSWorld` (`-1` if unbound). */
    public get entityId(): number {
        return this.#entityId;
    }
    public set entityId(id: number) {
        this.#entityId = id;
    }

    /**
     * Attaches a 3D collider (`"box"` or `"sphere"`) to this `BrioObject3D`.
     *
     * @param shape 3D collider shape (`"box"` or `"sphere"`)
     * @param colliderType Interaction mode (`"solid"` or `"trigger"`)
     * @param pos Local offset `{ x, y, z }` from `transform.position`
     * @param size Extents `{ x, y, z }` (or diameter on `x` for `"sphere"`)
     * @example
     * ```ts
     * sphereObj.addCollider3D("sphere", "trigger", { x: 0, y: 0, z: 0 }, { x: 4, y: 4, z: 4 });
     * ```
     */
    public addCollider3D(
        shape: CollisionShape3DType = "box",
        colliderType: CollisionColliderType = "solid",
        pos: Vec3 = { x: 0, y: 0, z: 0 },
        size: Vec3 = { x: 1, y: 1, z: 1 },
    ): void {
        this.collision = {
            enabled: true,
            shape,
            colliderType,
            pos: { x: pos.x, y: pos.y, z: pos.z },
            size: { x: size.x, y: size.y, z: size.z },
        };
    }

    /**
     * Creates a deep copy of a `BrioObject3D`, preserving its 3D transform, mesh, material, `tag`, 3D collider and
     * (recursively) its child parts. Child names that start with the source name are renamed to start with `name`
     * (`"ship/hull"` becomes `"ship-2/hull"`), so parts of different copies stay distinguishable.
     *
     * @param source Source `BrioObject3D` to clone
     * @param name Name of the copy (defaults to the source name)
     * @returns Cloned `BrioObject3D`
     * @example
     * ```ts
     * const clonedCrate = BrioObject3D.clone(cratePrefab, "obj_crate_2");
     * ```
     */
    public static clone(source: BrioObject3D, name: string = source.#name): BrioObject3D {
        const copy = new BrioObject3D(
            name,
            source.#mesh,
            source.#material,
            source.#transform.depth,
        );
        copy.tag = source.tag;
        copy.castShadow = source.castShadow;
        copy.receiveShadow = source.receiveShadow;
        copy.transform.position = {
            x: source.transform.position.x,
            y: source.transform.position.y,
            z: source.transform.position.z,
        };
        copy.transform.scale = {
            x: source.transform.scale.x,
            y: source.transform.scale.y,
            z: source.transform.scale.z,
        };
        copy.transform.quaternion = {
            x: source.transform.quaternion.x,
            y: source.transform.quaternion.y,
            z: source.transform.quaternion.z,
            w: source.transform.quaternion.w,
        };
        copy.transform.visibility = source.transform.visibility;
        copy.transform.opacity = source.transform.opacity;

        if (source.collision) {
            copy.collision = {
                enabled: source.collision.enabled,
                shape: source.collision.shape,
                colliderType: source.collision.colliderType,
                pos: {
                    x: source.collision.pos.x,
                    y: source.collision.pos.y,
                    z: source.collision.pos.z,
                },
                size: {
                    x: source.collision.size.x,
                    y: source.collision.size.y,
                    z: source.collision.size.z,
                },
            };
        }
        for (const child of source.#children) {
            const childName = child.#name.startsWith(source.#name)
                ? name + child.#name.slice(source.#name.length)
                : child.#name;
            copy.addChild(BrioObject3D.clone(child, childName));
        }
        return copy;
    }

    /**
     * Captures the properties of this object that are not stored in the ECS (see `BrioObject3DState`).
     *
     * @returns Plain state accepted by `restoreState()`
     * @example
     * ```ts
     * const saved = ship.captureState();
     * ship.material = "mat_damaged";
     * ship.restoreState(saved);
     * ```
     */
    public captureState(): BrioObject3DState {
        return {
            mesh: this.#mesh,
            material: this.#material,
            tag: this.tag,
            collision: copyCollision3D(this.collision),
            children: this.#children.slice(),
        };
    }

    /**
     * Restores the properties captured by `captureState()`, re-attaching captured child parts that were removed
     * and detaching parts added afterwards.
     *
     * @param state State captured from this object
     */
    public restoreState(state: BrioObject3DState): void {
        this.#mesh = state.mesh;
        this.#material = state.material;
        this.tag = state.tag;
        this.collision = copyCollision3D(state.collision);
        for (let i = this.#children.length - 1; i >= 0; i--) {
            const child = this.#children[i];
            if (!state.children.includes(child)) this.removeChild(child);
        }
        for (const child of state.children) {
            if (child.#parent !== this) this.addChild(child);
        }
    }

    /** Parent `BrioObject3D`, if this object is a child part. */
    public get parent(): BrioObject3D | undefined {
        return this.#parent;
    }

    /** Read-only list of child `BrioObject3D` parts attached via `addChild()`. */
    public get children(): readonly BrioObject3D[] {
        return this.#children;
    }

    /**
     * Attaches `child` as a part of this object, linking both the object tree and the `BrioTransform3D` hierarchy.
     * Children are rendered by `BrioGame` together with their root; they do not need to be returned from `load()`.
     *
     * @param child Child `BrioObject3D` part
     * @returns This `BrioObject3D` instance
     * @example
     * ```ts
     * ship.addChild(new BrioObject3D("obj_ship_wing", "mesh_wing", "mat_hull"));
     * ```
     */
    public addChild(child: BrioObject3D): this {
        if (child === this) {
            throw new Error("BrioObject3D cannot be a child of itself.");
        }
        if (child.#parent === this) return this;
        child.#parent?.removeChild(child);
        child.#parent = this;
        this.#children.push(child);
        this.#transform.addChild(child.transform);
        return this;
    }

    /**
     * Detaches `child` from this object's parts.
     *
     * @param child Child `BrioObject3D` to remove
     * @returns This `BrioObject3D` instance
     */
    public removeChild(child: BrioObject3D): this {
        const idx = this.#children.indexOf(child);
        if (idx !== -1) {
            this.#children.splice(idx, 1);
            child.#parent = undefined;
            this.#transform.removeChild(child.transform);
        }
        return this;
    }

    /**
     * Calls `visit` for every descendant part (children, grandchildren, ...), depth-first, excluding this object.
     *
     * @param visit Callback receiving each descendant
     * @example
     * ```ts
     * ship.forEachDescendant((part) => (part.transform.visibility = false));
     * ```
     */
    public forEachDescendant(visit: (part: BrioObject3D) => void): void {
        for (let i = 0; i < this.#children.length; i++) {
            const child = this.#children[i];
            visit(child);
            child.forEachDescendant(visit);
        }
    }

    /**
     * Returns a shared singleton fallback `BrioObject3D` instance.
     */
    public static getEmptyInstance(): BrioObject3D {
        if (!this.#emptyInstance) {
            this.#emptyInstance = new BrioObject3D("", "", "", 1);
        }
        return this.#emptyInstance;
    }
}
