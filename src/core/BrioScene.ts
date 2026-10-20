import { BrioCamera2D } from "../cameras/BrioCamera2D";
import { BrioCamera3D } from "../cameras/BrioCamera3D";
import { ComponentMask } from "../ecs/ComponentStorage";
import { ECSWorld } from "../ecs/ECSWorld";
import { BrioObject2D } from "../objects/BrioObject2D";
import { BrioObject3D } from "../objects/BrioObject3D";
import { BrioSerializer } from "../storage/BrioSerializer";
import { CompositorSource } from "../rendering/BrioCompositor";
import { BrioLayer } from "./BrioLayer";
import { BrioRegistry } from "./BrioRegistry";
import { BrioTimer } from "./BrioTimer";

/**
 * Isolated, self-contained game stage (`BrioScene`) that owns its own `ECSWorld`, `BrioTimer`,
 * `BrioLayer` composition planes, 2D/3D cameras (`BrioCamera2D`, `BrioCamera3D`), active objects,
 * and instant binary checkpoint snapshots (`createCheckpoint`, `restoreCheckpoint`, `restart`).
 *
 * @example
 * ```ts
 * const level1 = new BrioScene("scene_level_1");
 * const player = new BrioObject2D("obj_player", "spr_player", 1);
 * level1.addObject2D(player);
 * level1.createCheckpoint();
 * ```
 */
export class BrioScene {
    readonly #name: string;
    readonly #world: ECSWorld;
    readonly #timer: BrioTimer = new BrioTimer();
    readonly #layers = new BrioRegistry<BrioLayer>();
    readonly #objects2D = new Map<string, BrioObject2D>();
    readonly #objects3D = new BrioRegistry<BrioObject3D>();
    readonly #cameras2D = new BrioRegistry<BrioCamera2D>();
    readonly #cameras3D = new BrioRegistry<BrioCamera3D>();
    readonly #source: CompositorSource;

    #checkpointSnapshot?: Uint8Array;
    #paused: boolean = false;
    #onUpdate?: (scene: BrioScene, dt: number) => void;

    /**
     * Creates a new `BrioScene` instance.
     *
     * @param name Unique scene identifier (e.g. `"main_menu"`, `"level_1"`)
     * @param maxEntities Maximum ECS entity capacity for this scene (defaults to `4096`)
     */
    constructor(name: string, maxEntities: number = 4096) {
        this.#name = name;
        this.#world = new ECSWorld(maxEntities);
        this.#source = {
            world: this.#world,
            layers: this.#layers,
            cameras2D: this.#cameras2D.list,
            cameras3D: this.#cameras3D.list,
            objects3D: this.#objects3D.list,
        };
        this.addLayer(new BrioLayer({ name: "default", order: 0, policy: "dynamic" }));
    }

    /** Unique identifier of the scene. */
    public get name(): string {
        return this.#name;
    }

    /** Dedicated `ECSWorld` for this scene. */
    public get world(): ECSWorld {
        return this.#world;
    }

    /** Dedicated `BrioTimer` synchronized to this scene's update loop and pause state. */
    public get timer(): BrioTimer {
        return this.#timer;
    }

    /** Indicates whether this scene is currently paused. */
    public get isPaused(): boolean {
        return this.#paused;
    }

    /** Map of registered `BrioLayer` instances in this scene. */
    public get layers(): ReadonlyMap<string, BrioLayer> {
        return this.#layers.map;
    }

    /**
     * Renderable view of this scene consumed by `BrioGame` while the scene is active
     * (layers, cameras, and 3D objects backed by allocation-free arrays).
     */
    public get compositorSource(): CompositorSource {
        return this.#source;
    }

    /** Map of registered 2D objects in this scene. */
    public get objects2D(): ReadonlyMap<string, BrioObject2D> {
        return this.#objects2D;
    }

    /** Map of registered 3D objects in this scene. */
    public get objects3D(): ReadonlyMap<string, BrioObject3D> {
        return this.#objects3D.map;
    }

    /** Map of registered 2D cameras in this scene. */
    public get cameras2D(): ReadonlyMap<string, BrioCamera2D> {
        return this.#cameras2D.map;
    }

    /** Map of registered 3D cameras in this scene. */
    public get cameras3D(): ReadonlyMap<string, BrioCamera3D> {
        return this.#cameras3D.map;
    }

    /**
     * Registers a `BrioLayer` in this scene.
     *
     * @param layer `BrioLayer` instance to add
     * @returns This `BrioScene` instance
     * @example
     * ```ts
     * scene.addLayer(new BrioLayer({ name: "ui_hud", order: 100, policy: "ui" }));
     * ```
     */
    public addLayer(layer: BrioLayer): this {
        this.#layers.add(layer);
        return this;
    }

    /**
     * Registers a `BrioObject2D` in this scene, binds its `transform` to the scene's `ECSWorld`, and assigns it to a `BrioLayer`.
     *
     * @param object 2D entity to register
     * @param layerName Optional layer name (defaults to `"default"`)
     * @returns Registered object
     * @example
     * ```ts
     * scene.addObject2D(player);
     * ```
     */
    public addObject2D<T extends BrioObject2D>(object: T, layerName: string = "default"): T {
        const entityId = this.#world.createEntity(ComponentMask.TRANSFORM_2D);
        object.entityId = entityId;
        object.entityGeneration = this.#world.generationOf(entityId);
        object.transform.bindECS(this.#world.storage, entityId);
        this.#objects2D.set(object.name, object);

        const targetLayer = this.#layers.get(layerName) ?? this.#layers.get("default");
        if (targetLayer) {
            targetLayer.addObject(object);
        }
        return object;
    }

    /**
     * Registers a 3D `BrioObject3D` in this scene and binds its `transform` to the scene's `ECSWorld`.
     *
     * @param object 3D entity to register
     * @returns Registered `BrioObject3D`
     * @example
     * ```ts
     * scene.addObject3D(crate3D);
     * ```
     */
    public addObject3D(object: BrioObject3D): BrioObject3D {
        const entityId = this.#world.createEntity(ComponentMask.TRANSFORM_3D);
        object.entityId = entityId;
        object.entityGeneration = this.#world.generationOf(entityId);
        object.transform.bindECS(this.#world.storage, entityId);
        this.#objects3D.add(object);
        return object;
    }

    /**
     * Removes `object` from this scene, recycling its ECS slot and detaching its transform so stale references
     * cannot write into a recycled slot.
     *
     * @param object 2D or 3D object to remove
     * @returns `true` if the object was registered in this scene
     * @example
     * ```ts
     * scene.removeObject(projectile);
     * ```
     */
    public removeObject(object: BrioObject2D | BrioObject3D): boolean {
        if (object instanceof BrioObject3D) {
            if (!this.#objects3D.remove(object)) return false;
        } else {
            if (this.#objects2D.get(object.name) !== object) return false;
            this.#objects2D.delete(object.name);
            const layers = this.#layers.list;
            for (let i = 0; i < layers.length; i++) {
                layers[i].removeObject(object);
            }
        }
        this.#world.destroyEntity(object.entityId);
        object.transform.unbindECS();
        object.entityId = -1;
        return true;
    }

    /**
     * Registers a `BrioCamera2D` in this scene (supporting multi-viewport split-screen).
     *
     * @param camera 2D camera to add
     * @returns This `BrioScene` instance
     */
    public addCamera2D(camera: BrioCamera2D): this {
        this.#cameras2D.add(camera);
        return this;
    }

    /**
     * Registers a `BrioCamera3D` in this scene (supporting multi-viewport split-screen).
     *
     * @param camera 3D camera to add
     * @returns This `BrioScene` instance
     */
    public addCamera3D(camera: BrioCamera3D): this {
        this.#cameras3D.add(camera);
        return this;
    }

    /**
     * Registers the per-frame update callback for this scene.
     *
     * @param callback Function called with `(scene, dt)` on each active frame
     * @returns This `BrioScene` instance
     */
    public onUpdate(callback: (scene: BrioScene, dt: number) => void): this {
        this.#onUpdate = callback;
        return this;
    }

    /**
     * Advances the scene's `BrioTimer`, cameras, and user `onUpdate` callback by `dt` seconds.
     *
     * @param dt Elapsed frame delta time in seconds
     */
    public step(dt: number): void {
        if (this.#paused || dt <= 0) return;

        this.#timer.update(dt);
        const cameras = this.#cameras2D.list;
        for (let i = 0; i < cameras.length; i++) {
            cameras[i].update(dt);
        }
        if (this.#onUpdate) {
            this.#onUpdate(this, dt);
        }
    }

    /**
     * Captures a high-speed binary snapshot (`Uint8Array`) of the scene's `ECSWorld` for instant restoration.
     *
     * @returns Captured binary `Uint8Array` snapshot
     * @example
     * ```ts
     * const bytes = scene.createCheckpoint();
     * ```
     */
    public createCheckpoint(): Uint8Array {
        this.#checkpointSnapshot = BrioSerializer.captureSnapshot(this.#world);
        return this.#checkpointSnapshot;
    }

    /**
     * Restores the scene's `ECSWorld` from `snapshot` (or from the last `createCheckpoint()` call).
     *
     * @param snapshot Optional explicit binary snapshot to restore
     * @example
     * ```ts
     * scene.restoreCheckpoint();
     * ```
     */
    public restoreCheckpoint(snapshot?: Uint8Array): void {
        const target = snapshot ?? this.#checkpointSnapshot;
        if (!target) {
            throw new Error(`No checkpoint snapshot available to restore in scene "${this.#name}".`);
        }
        BrioSerializer.restoreSnapshot(this.#world, target);

        // Restoring advances every slot generation: re-adopt the restored slot values in each handle
        for (const obj of this.#objects2D.values()) {
            if (obj.entityId < 0) continue;
            obj.entityGeneration = this.#world.generationOf(obj.entityId);
            obj.transform.bindECS(this.#world.storage, obj.entityId, true);
        }
        for (const obj of this.#objects3D.list) {
            if (obj.entityId < 0) continue;
            obj.entityGeneration = this.#world.generationOf(obj.entityId);
            obj.transform.bindECS(this.#world.storage, obj.entityId, true);
        }
    }

    /**
     * Pauses this scene and its `BrioTimer`.
     */
    public pause(): void {
        this.#paused = true;
        this.#timer.pause();
    }

    /**
     * Resumes this scene and its `BrioTimer`.
     */
    public resume(): void {
        this.#paused = false;
        this.#timer.resume();
    }

    /**
     * Destroys all entities, timers, and layers in this scene.
     */
    public destroy(): void {
        this.#timer.clear();
        for (const obj of this.#objects2D.values()) {
            obj.transform.unbindECS();
            obj.entityId = -1;
        }
        for (const obj of this.#objects3D.list) {
            obj.transform.unbindECS();
            obj.entityId = -1;
        }
        this.#world.clear();
        this.#objects2D.clear();
        this.#objects3D.clear();
        this.#cameras2D.clear();
        this.#cameras3D.clear();
        this.#layers.clear();
    }
}
