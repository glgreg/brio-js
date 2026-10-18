import { BrioCamera2D } from "../cameras/BrioCamera2D";
import { BrioCamera3D } from "../cameras/BrioCamera3D";
import { ComponentMask } from "../ecs/ComponentStorage";
import { ECSWorld } from "../ecs/ECSWorld";
import { BrioObject } from "../objects/BrioObject";
import { BrioObject2D } from "../objects/BrioObject2D";
import { BrioObject3D } from "../objects/BrioObject3D";
import { BrioSerializer } from "../storage/BrioSerializer";
import { BrioLayer } from "./BrioLayer";
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
    readonly #layers = new Map<string, BrioLayer>();
    readonly #objects2D = new Map<string, BrioObject>();
    readonly #objects3D = new Map<string, BrioObject3D>();
    readonly #cameras2D = new Map<string, BrioCamera2D>();
    readonly #cameras3D = new Map<string, BrioCamera3D>();

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
        return this.#layers;
    }

    /** Map of registered 2D objects in this scene. */
    public get objects2D(): ReadonlyMap<string, BrioObject> {
        return this.#objects2D;
    }

    /** Map of registered 3D objects in this scene. */
    public get objects3D(): ReadonlyMap<string, BrioObject3D> {
        return this.#objects3D;
    }

    /** Map of registered 2D cameras in this scene. */
    public get cameras2D(): ReadonlyMap<string, BrioCamera2D> {
        return this.#cameras2D;
    }

    /** Map of registered 3D cameras in this scene. */
    public get cameras3D(): ReadonlyMap<string, BrioCamera3D> {
        return this.#cameras3D;
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
        this.#layers.set(layer.name, layer);
        return this;
    }

    /**
     * Registers a 2D `BrioObject` or `BrioObject2D` in this scene and binds its `transform` to the scene's `ECSWorld`.
     *
     * @param object 2D entity to register
     * @param layerName Optional layer name (defaults to `"default"`)
     * @returns Registered object
     * @example
     * ```ts
     * scene.addObject2D(player);
     * ```
     */
    public addObject2D<T extends BrioObject>(object: T, layerName: string = "default"): T {
        const entityId = this.#world.createEntity(ComponentMask.TRANSFORM_2D);
        if (object instanceof BrioObject2D) {
            object.entityId = entityId;
        }
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
        object.transform.bindECS(this.#world.storage, entityId);
        this.#objects3D.set(object.name, object);
        return object;
    }

    /**
     * Registers a `BrioCamera2D` in this scene (supporting multi-viewport split-screen).
     *
     * @param camera 2D camera to add
     * @returns This `BrioScene` instance
     */
    public addCamera2D(camera: BrioCamera2D): this {
        this.#cameras2D.set(camera.name, camera);
        return this;
    }

    /**
     * Registers a `BrioCamera3D` in this scene (supporting multi-viewport split-screen).
     *
     * @param camera 3D camera to add
     * @returns This `BrioScene` instance
     */
    public addCamera3D(camera: BrioCamera3D): this {
        this.#cameras3D.set(camera.name, camera);
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
        for (const cam2D of this.#cameras2D.values()) {
            cam2D.update(dt);
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
        this.#world.clear();
        this.#objects2D.clear();
        this.#objects3D.clear();
        this.#cameras2D.clear();
        this.#cameras3D.clear();
        this.#layers.clear();
    }
}
