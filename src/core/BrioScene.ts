import { BrioCamera2D } from "../cameras/BrioCamera2D";
import { BrioCamera3D } from "../cameras/BrioCamera3D";
import { ComponentMask, ComponentStorageLayout, StorageLayoutFlag } from "../ecs/ComponentStorage";
import { ECSWorld } from "../ecs/ECSWorld";
import { BrioObject2D } from "../objects/BrioObject2D";
import { BrioObject3D } from "../objects/BrioObject3D";
import { BrioLight } from "../objects/BrioLight";
import { BrioSerializer } from "../storage/BrioSerializer";
import { CompositorSource } from "../rendering/BrioCompositor";
import { BrioLayer } from "./BrioLayer";
import { BrioRegistry } from "./BrioRegistry";
import { BrioTimer } from "./BrioTimer";
import type { AssetLoaderParam, PreloadAsset } from "../game/BrioGame";

/** Content a `BrioScene.load()` callback can return (layers are registered first, then cameras, then objects). */
export type SceneContent =
    | BrioObject2D
    | BrioObject3D
    | BrioCamera2D
    | BrioCamera3D
    | BrioLayer
    | BrioLight;

/**
 * Captured state of a `BrioScene`: the `ECSWorld` bytes plus the handle of every registered object, so a
 * restore also unregisters objects added after the capture and registers again the ones removed after it.
 */
export interface BrioSceneState {
    /** Binary `ECSWorld` snapshot (`BrioSerializer`). */
    readonly bytes: Uint8Array;
    /** 2D objects registered at capture time, with their slot and layer. */
    readonly objects2D: ReadonlyArray<{ object: BrioObject2D; entityId: number; layer?: BrioLayer }>;
    /** 3D objects registered at capture time, with their slot. */
    readonly objects3D: ReadonlyArray<{ object: BrioObject3D; entityId: number }>;
    /** Descendant parts of the captured 3D objects, with their slot. */
    readonly parts3D: ReadonlyArray<{ object: BrioObject3D; entityId: number }>;
}

/**
 * Isolated, self-contained game stage (`BrioScene`) that owns its own `ECSWorld`, `BrioTimer`,
 * `BrioLayer` composition planes, 2D/3D cameras (`BrioCamera2D`, `BrioCamera3D`), active objects,
 * and instant binary checkpoint snapshots (`createCheckpoint`, `restoreCheckpoint`, `restart`).
 *
 * A scene follows the same lifecycle as `BrioGame`: `preload()` declares its assets and `load()` its initial
 * content. Both run when `BrioGame` first activates the scene (`addScene` / `setScene`); the state right after
 * `load()` is what `restart()` returns to. While active, the scene also takes part in
 * `game.createCheckPoint()`, `game.restoreCheckPoint()`, and `game.restart()`.
 *
 * @example
 * ```ts
 * const level1 = new BrioScene("scene_level_1")
 *     .preload(() => [new BrioSprite("spr_enemy", "./assets/enemy.png")])
 *     .load(() => [new BrioObject2D("obj_enemy", "spr_enemy", 1)]);
 * game.addScene(level1);
 * game.setScene("scene_level_1"); // preloads, loads, then activates
 * ```
 */
export class BrioScene {
    readonly #name: string;
    #world: ECSWorld;
    readonly #timer: BrioTimer = new BrioTimer();
    readonly #layers = new BrioRegistry<BrioLayer>();
    readonly #objects2D = new Map<string, BrioObject2D>();
    readonly #objects3D = new BrioRegistry<BrioObject3D>();
    readonly #cameras2D = new BrioRegistry<BrioCamera2D>();
    readonly #cameras3D = new BrioRegistry<BrioCamera3D>();
    readonly #lights = new BrioRegistry<BrioLight>();
    readonly #source: { -readonly [K in keyof CompositorSource]: CompositorSource[K] };

    #checkpointState?: BrioSceneState;
    /** State right after `load()` (or at first activation), restored by `restart()`. */
    #initialState?: BrioSceneState;
    #paused: boolean = false;
    #loaded: boolean = false;
    #preloadFn?: () => PreloadAsset[];
    #loadFn?: (assets: AssetLoaderParam, scene: BrioScene) => SceneContent[];
    #onUpdate?: (scene: BrioScene, dt: number) => void;

    /**
     * Creates a new `BrioScene` instance.
     *
     * @param name Unique scene identifier (e.g. `"main_menu"`, `"level_1"`)
     * @param maxEntities Maximum ECS entity capacity for this scene (defaults to `4096`)
     * @param layout Transform buffers of the scene world (defaults to both 2D and 3D). `useLayout()` narrows it
     * to the preset of the owning game while the scene is still uncaptured.
     * @example
     * ```ts
     * const hud = new BrioScene("hud", 512, { transform2D: true, transform3D: false });
     * ```
     */
    constructor(name: string, maxEntities: number = 4096, layout: ComponentStorageLayout = {}) {
        this.#name = name;
        this.#world = new ECSWorld(maxEntities, false, layout);
        this.#source = {
            world: this.#world,
            layers: this.#layers,
            cameras2D: this.#cameras2D.list,
            cameras3D: this.#cameras3D.list,
            objects3D: this.#objects3D.list,
            lights: this.#lights.list,
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

    /**
     * Whether the scene content is ready: `load()` already ran, or no `preload()` / `load()` callback was declared.
     */
    public get isLoaded(): boolean {
        return this.#loaded || (!this.#preloadFn && !this.#loadFn);
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

    /**
     * Rebuilds the scene world with `layout` (same capacity) so the scene matches the preset of the game that
     * owns it; a `"2d"` game passes `{ transform3D: false }` so its scenes do not pay for 3D memory (ADR 0004).
     * Registered objects move into slots of the new world with their current values. The switch is refused
     * (returning `false`, world unchanged) when a registered object needs a buffer the layout drops, or once a
     * checkpoint or the `restart()` state was captured, because those bytes encode the old layout.
     *
     * @param layout Transform buffers to allocate (missing fields default to `true`)
     * @returns `true` when the scene world now uses `layout`
     * @example
     * ```ts
     * scene.useLayout({ transform2D: true, transform3D: false });
     * ```
     */
    public useLayout(layout: ComponentStorageLayout): boolean {
        const has2D = layout.transform2D ?? true;
        const has3D = layout.transform3D ?? true;
        const flags =
            (has2D ? StorageLayoutFlag.TRANSFORM_2D : 0) |
            (has3D ? StorageLayoutFlag.TRANSFORM_3D : 0);
        const oldStorage = this.#world.storage;
        if (flags === oldStorage.layoutFlags) return true;
        if (!has2D && this.#objects2D.size > 0) return false;
        if (!has3D && this.#objects3D.list.length > 0) return false;
        if (this.#checkpointState || this.#initialState) return false;

        for (const object of this.#objects2D.values()) this.#detach(object);
        for (const object of this.#objects3D.list) {
            this.#detach(object);
            object.forEachDescendant((part) => this.#detach(part));
        }
        this.#world = new ECSWorld(oldStorage.capacity, oldStorage.isSharedMemory, {
            transform2D: has2D,
            transform3D: has3D,
        });
        this.#source.world = this.#world;
        for (const object of this.#objects2D.values()) this.#bind2D(object);
        for (const object of this.#objects3D.list) {
            this.#bind3D(object);
            object.forEachDescendant((part) => this.#bind3D(part));
        }
        return true;
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
     * Declares the assets this scene needs. They are preloaded into the shared `BrioGame` registries the first
     * time the game activates the scene, before `load()` runs.
     *
     * @param callbackFn Function returning the assets to preload (sprites, audios, atlases, models, meshes, materials)
     * @returns This `BrioScene` instance
     * @example
     * ```ts
     * scene.preload(() => [new BrioSprite("spr_boss", "./assets/boss.png")]);
     * ```
     */
    public preload(callbackFn: () => PreloadAsset[]): this {
        this.#preloadFn = callbackFn;
        this.#loaded = false;
        return this;
    }

    /**
     * Declares the initial content of this scene, created the first time the game activates it (after `preload()`).
     * Returned layers are registered first, then cameras, then 2D/3D objects (a `BrioObject2D` already added to a
     * returned layer stays there; otherwise it joins `"default"`).
     *
     * @param callbackFn Callback receiving the game asset accessors and this scene, returning the initial content
     * @returns This `BrioScene` instance
     * @example
     * ```ts
     * scene.load((assets) => [new BrioObject2D("obj_boss", assets.getSprite("spr_boss").name, 1)]);
     * ```
     */
    public load(callbackFn: (assets: AssetLoaderParam, scene: BrioScene) => SceneContent[]): this {
        this.#loadFn = callbackFn;
        this.#loaded = false;
        return this;
    }

    /**
     * Assets declared by `preload()` (empty when there is none or the scene is already loaded).
     * Called by `BrioGame` while activating the scene.
     *
     * @internal
     */
    public collectPreloadAssets(): PreloadAsset[] {
        return this.#loaded || !this.#preloadFn ? [] : this.#preloadFn();
    }

    /**
     * Runs the `load()` callback (once) and captures the state restored by `restart()`.
     * Called by `BrioGame` after the scene assets were preloaded.
     *
     * @param assets Asset accessors of the owning game
     * @internal
     */
    public mount(assets: AssetLoaderParam): void {
        if (this.#loaded) return;
        if (this.#loadFn) {
            const content = this.#loadFn(assets, this);
            for (const item of content) {
                if (item instanceof BrioLayer) this.addLayer(item);
            }
            for (const item of content) {
                if (item instanceof BrioCamera2D) this.addCamera2D(item);
                else if (item instanceof BrioCamera3D) this.addCamera3D(item);
                else if (item instanceof BrioLight) this.addLight(item);
            }
            for (const item of content) {
                if (item instanceof BrioObject3D) {
                    if (!this.#objects3D.has(item.name)) this.addObject3D(item);
                } else if (item instanceof BrioObject2D) {
                    if (this.#objects2D.get(item.name) !== item) {
                        this.addObject2D(item, this.#layerHolding(item)?.name ?? "default");
                    }
                }
            }
        }
        this.#loaded = true;
        this.#initialState = this.captureState();
    }

    /**
     * Restores the scene to the state captured right after `load()` (or at its first activation).
     *
     * @returns `true` if an initial state existed and was restored
     * @example
     * ```ts
     * if (player.hp <= 0) scene.restart();
     * ```
     */
    public restart(): boolean {
        if (!this.#initialState) return false;
        this.restoreState(this.#initialState);
        return true;
    }

    /**
     * Captures the `ECSWorld` bytes together with the handle of every registered object.
     *
     * @returns Opaque `BrioSceneState` accepted by `restoreState()`
     */
    public captureState(): BrioSceneState {
        const objects2D: Array<{ object: BrioObject2D; entityId: number; layer?: BrioLayer }> = [];
        for (const object of this.#objects2D.values()) {
            objects2D.push({ object, entityId: object.entityId, layer: this.#layerHolding(object) });
        }
        const objects3D: Array<{ object: BrioObject3D; entityId: number }> = [];
        const parts3D: Array<{ object: BrioObject3D; entityId: number }> = [];
        for (const object of this.#objects3D.list) {
            objects3D.push({ object, entityId: object.entityId });
            object.forEachDescendant((part) => parts3D.push({ object: part, entityId: part.entityId }));
        }
        return { bytes: BrioSerializer.captureSnapshot(this.#world), objects2D, objects3D, parts3D };
    }

    /**
     * Restores a state captured by `captureState()`: objects registered after the capture are detached and
     * unregistered, objects removed after it are registered again, and every handle re-adopts its restored slot.
     *
     * @param state State captured from this scene
     */
    public restoreState(state: BrioSceneState): void {
        const captured2D = new Set<BrioObject2D>();
        for (const entry of state.objects2D) captured2D.add(entry.object);
        const captured3D = new Set<BrioObject3D>();
        for (const entry of state.objects3D) captured3D.add(entry.object);

        for (const object of this.#objects2D.values()) {
            if (captured2D.has(object)) continue;
            this.#layerHolding(object)?.removeObject(object);
            object.transform.unbindECS();
            object.entityId = -1;
        }
        for (const object of this.#objects3D.list) {
            if (captured3D.has(object)) continue;
            object.transform.unbindECS();
            object.entityId = -1;
            object.forEachDescendant((part) => {
                part.transform.unbindECS();
                part.entityId = -1;
            });
        }

        BrioSerializer.restoreSnapshot(this.#world, state.bytes);
        const storage = this.#world.storage;

        this.#objects2D.clear();
        for (const { object, entityId, layer } of state.objects2D) {
            object.entityId = entityId;
            object.entityGeneration = this.#world.generationOf(entityId);
            object.transform.bindECS(storage, entityId, true);
            this.#objects2D.set(object.name, object);
            const target = layer && this.#layers.get(layer.name) === layer ? layer : undefined;
            const current = this.#layerHolding(object);
            if (target && current !== target) {
                current?.removeObject(object);
                target.addObject(object);
            } else if (!current) {
                (target ?? this.#layers.get("default"))?.addObject(object);
            }
        }

        this.#objects3D.clear();
        for (const { object, entityId } of state.objects3D) {
            object.entityId = entityId;
            object.entityGeneration = this.#world.generationOf(entityId);
            object.transform.bindECS(storage, entityId, true);
            this.#objects3D.add(object);
        }
        for (const { object, entityId } of state.parts3D) {
            if (entityId < 0) continue;
            object.entityId = entityId;
            object.entityGeneration = this.#world.generationOf(entityId);
            object.transform.bindECS(storage, entityId, true);
        }
    }

    /** Allocates a 2D slot in the scene world and binds `object` to it, pushing its current values. */
    #bind2D(object: BrioObject2D): void {
        const entityId = this.#world.createEntity(ComponentMask.TRANSFORM_2D);
        object.entityId = entityId;
        object.entityGeneration = this.#world.generationOf(entityId);
        object.transform.bindECS(this.#world.storage, entityId);
    }

    /** Allocates a 3D slot in the scene world and binds `object` (a root or a part) to it. */
    #bind3D(object: BrioObject3D): void {
        const entityId = this.#world.createEntity(ComponentMask.TRANSFORM_3D);
        object.entityId = entityId;
        object.entityGeneration = this.#world.generationOf(entityId);
        object.transform.bindECS(this.#world.storage, entityId);
    }

    /** Copies the slot values back into `object` and detaches it, without touching the world allocator. */
    #detach(object: BrioObject2D | BrioObject3D): void {
        object.transform.unbindECS();
        object.entityId = -1;
    }

    /**
     * Recycles every slot of `object` (and of its 3D parts) and removes it from the layers, without touching
     * the object registries, so a same-name replacement can keep the registry position.
     */
    #release(object: BrioObject2D | BrioObject3D): void {
        if (object instanceof BrioObject2D) {
            const layers = this.#layers.list;
            for (let i = 0; i < layers.length; i++) layers[i].removeObject(object);
        }
        if (object.entityId >= 0 && this.#world.isAlive(object.entityId, object.entityGeneration)) {
            this.#world.destroyEntity(object.entityId);
        }
        this.#detach(object);
        if (object instanceof BrioObject3D) {
            object.forEachDescendant((part) => {
                if (part.entityId >= 0 && this.#world.isAlive(part.entityId, part.entityGeneration)) {
                    this.#world.destroyEntity(part.entityId);
                }
                this.#detach(part);
            });
        }
    }

    /** Layer of this scene currently holding `object`. */
    #layerHolding(object: BrioObject2D): BrioLayer | undefined {
        const layers = this.#layers.list;
        for (let i = 0; i < layers.length; i++) {
            if (layers[i].hasObject(object)) return layers[i];
        }
        return undefined;
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
     * An object already registered under the same name (or the same object added again) is released first: its
     * slot is recycled and it leaves its layer, so names stay unique and no slot leaks.
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
        const previous = this.#objects2D.get(object.name);
        if (previous) this.#release(previous);
        this.#bind2D(object);
        this.#objects2D.set(object.name, object);

        const targetLayer = this.#layers.get(layerName) ?? this.#layers.get("default");
        if (targetLayer) {
            targetLayer.addObject(object);
        }
        return object;
    }

    /**
     * Registers a 3D `BrioObject3D` in this scene and binds its `transform` (and one slot per descendant part)
     * to the scene's `ECSWorld`. An object already registered under the same name is released first and
     * replaced at the same registry position.
     *
     * @param object 3D entity to register
     * @returns Registered `BrioObject3D`
     * @throws {Error} When the scene world has no 3D transform buffer (`useLayout({ transform3D: false })`)
     * @example
     * ```ts
     * scene.addObject3D(crate3D);
     * ```
     */
    public addObject3D(object: BrioObject3D): BrioObject3D {
        if (!this.#world.storage.has3D) {
            throw new Error(
                `BrioObject3D '${object.name}' cannot be added to scene "${this.#name}": its world has no 3D transform buffer ("2d" layout).`,
            );
        }
        const previous = this.#objects3D.get(object.name);
        if (previous) this.#release(previous);
        // Parts get their own slots too, so checkpoints and restart() cover them
        this.#bind3D(object);
        object.forEachDescendant((part) => this.#bind3D(part));
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
        }
        this.#release(object);
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

    /** Map of registered lights in this scene. */
    public get lights(): ReadonlyMap<string, BrioLight> {
        return this.#lights.map;
    }

    /**
     * Registers a `BrioLight` used by this scene's 3D passes (replacing a light with the same name).
     *
     * @param light Light to add
     * @returns This `BrioScene` instance
     */
    public addLight(light: BrioLight): this {
        this.#lights.add(light);
        return this;
    }

    /**
     * Removes a `BrioLight` from this scene.
     *
     * @param light Light to remove
     * @returns `true` if the light was registered
     */
    public removeLight(light: BrioLight): boolean {
        return this.#lights.remove(light);
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
     * Captures a high-speed binary snapshot (`Uint8Array`) of the scene's `ECSWorld` for instant restoration,
     * remembering the set of registered objects for `restoreCheckpoint()`.
     *
     * @returns Captured binary `Uint8Array` snapshot
     * @example
     * ```ts
     * const bytes = scene.createCheckpoint();
     * ```
     */
    public createCheckpoint(): Uint8Array {
        this.#checkpointState = this.captureState();
        return this.#checkpointState.bytes;
    }

    /**
     * Restores the scene from the last `createCheckpoint()` call (including objects added or removed since).
     *
     * With an explicit `snapshot`: the byte array returned by the last `createCheckpoint()` restores the full
     * state, as without argument. Other bytes restore only the `ECSWorld` values: every registered object and
     * 3D part whose slot is alive in the snapshot re-adopts it, and registered objects whose slot is not alive
     * there (added after the capture) are unregistered and detached. Bytes alone cannot bring back objects
     * removed after the capture nor tell which object owned a recycled slot; `captureState()` / `restoreState()`
     * keep that information. A snapshot rejected by `BrioSerializer` leaves the scene unchanged.
     *
     * @param snapshot Optional explicit binary snapshot to restore
     * @throws {Error} When no snapshot is given and no checkpoint exists
     * @example
     * ```ts
     * scene.restoreCheckpoint();
     * ```
     */
    public restoreCheckpoint(snapshot?: Uint8Array): void {
        if (!snapshot) {
            if (!this.#checkpointState) {
                throw new Error(`No checkpoint snapshot available to restore in scene "${this.#name}".`);
            }
            this.restoreState(this.#checkpointState);
            return;
        }
        if (snapshot === this.#checkpointState?.bytes) {
            this.restoreState(this.#checkpointState);
            return;
        }
        // Every check runs before the world is touched, so a rejected snapshot changes nothing
        BrioSerializer.restoreSnapshot(this.#world, snapshot);

        // Restoring advances every slot generation: re-adopt the restored slot values in each handle
        const world = this.#world;
        const readopt = (obj: BrioObject2D | BrioObject3D): boolean => {
            if (obj.entityId < 0 || !world.isAlive(obj.entityId)) {
                this.#detach(obj);
                return false;
            }
            obj.entityGeneration = world.generationOf(obj.entityId);
            obj.transform.bindECS(world.storage, obj.entityId, true);
            return true;
        };
        for (const obj of Array.from(this.#objects2D.values())) {
            if (readopt(obj)) continue;
            this.#objects2D.delete(obj.name);
            this.#layerHolding(obj)?.removeObject(obj);
        }
        for (const obj of Array.from(this.#objects3D.list)) {
            const alive = readopt(obj);
            obj.forEachDescendant((part) => {
                if (!alive || !readopt(part)) this.#detach(part);
            });
            if (!alive) this.#objects3D.remove(obj);
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
            this.#detach(obj);
            obj.forEachDescendant((part) => this.#detach(part));
        }
        this.#world.clear();
        this.#objects2D.clear();
        this.#objects3D.clear();
        this.#cameras2D.clear();
        this.#cameras3D.clear();
        this.#lights.clear();
        this.#layers.clear();
        this.addLayer(new BrioLayer({ name: "default", order: 0, policy: "dynamic" }));
        this.#checkpointState = undefined;
        this.#initialState = undefined;
        this.#loaded = false;
    }
}
