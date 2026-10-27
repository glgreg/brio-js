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
     * @param layer Rendering layer index (defaults to `1`)
     * @example
     * ```ts
     * const ship = new BrioObject3D("obj_ship", "mesh_fighter", "mat_hull");
     * ```
     */
    constructor(name: string, mesh: string = "", material: string = "", layer: number = 1) {
        this.#name = name;
        this.#mesh = mesh;
        this.#material = material;
        this.#transform.layer = Math.round(Math.abs(layer));
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
     * Creates a deep copy of a `BrioObject3D`, preserving its 3D transform, mesh, material, and 3D collider.
     *
     * @param source Source `BrioObject3D` to clone
     * @returns Cloned `BrioObject3D`
     * @example
     * ```ts
     * const clonedCrate = BrioObject3D.clone(cratePrefab);
     * ```
     */
    public static clone(source: BrioObject3D): BrioObject3D {
        const copy = new BrioObject3D(
            source.#name,
            source.#mesh,
            source.#material,
            source.#transform.layer,
        );
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
        return copy;
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
     * Returns a shared singleton fallback `BrioObject3D` instance.
     */
    public static getEmptyInstance(): BrioObject3D {
        if (!this.#emptyInstance) {
            this.#emptyInstance = new BrioObject3D("", "", "", 1);
        }
        return this.#emptyInstance;
    }
}
