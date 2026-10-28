import { BrioSprite } from "../assets/BrioSprite";
import { BrioModel } from "../assets/BrioModel";
import { BrioMesh } from "../assets/BrioMesh";
import { BrioMaterial } from "../assets/BrioMaterial";
import { BrioTileMap } from "../assets/BrioTileMap";
import { BrioObject2D } from "../objects/BrioObject2D";
import { BrioObject3D } from "../objects/BrioObject3D";
import { BrioLight } from "../objects/BrioLight";
import { BrioKeyboard } from "../input/BrioKeyboard";
import { BrioMouse } from "../input/BrioMouse";
import { BrioTouch } from "../input/BrioTouch";
import { BrioGamepad } from "../input/BrioGamepad";
import { BrioCamera2D } from "../cameras/BrioCamera2D";
import { BrioCamera3D } from "../cameras/BrioCamera3D";
import { BrioLayer } from "../core/BrioLayer";
import { BrioRegistry } from "../core/BrioRegistry";
import {
    BrioCompositor,
    CompositorDebugOptions,
    CompositorSource,
    CompositorStats,
} from "../rendering/BrioCompositor";
import { BrioRenderer } from "../rendering/BrioRenderer";
import { RenderBackend, RenderBackendType } from "../rendering/contracts/RenderBackend";
import { BrioAudio } from "../assets/BrioAudio";
import { BrioAudioMixer } from "../audio/BrioAudioMixer";
import { BrioConsole } from "../debugging/BrioConsole";
import { BrioSpriteRenderer } from "./BrioSpriteRenderer";
import { BrioDebugger } from "../debugging/BrioDebugger";
import { BrioCanvasBackground, CanvasBackground } from "./BrioCanvasBackground";
import { BrioUpdater } from "./BrioUpdater";
import { BrioAssetManager } from "./BrioAssetManager";
import { BrioVec2, create } from "../math/vec2";
import { BrioRandom, BrioRandomSeed } from "../math/BrioRandom";
import { BrioAtlas } from "../assets/BrioAtlas";
import { ECSWorld } from "../ecs/ECSWorld";
import { ComponentMask } from "../ecs/ComponentStorage";
import { BrioTimer } from "../core/BrioTimer";
import { BrioScene, BrioSceneState } from "../core/BrioScene";
import { BrioSerializer } from "../storage/BrioSerializer";

// #region --> TYPES-INTERFACES

/**
 * Dimension preset or mode for a `BrioGame` instance.
 */
export type BrioGameDimension = "2d" | "3d" | "hybrid";

/**
 * Full configuration object for initializing a `BrioGame` instance.
 */
export interface BrioGameConfig {
    /** Logical width of the canvas viewport in pixels. */
    width: number;
    /** Logical height of the canvas viewport in pixels. */
    height: number;
    /** Target DOM `HTMLElement` where the canvas will be mounted. */
    container: HTMLElement;
    /** Spatial dimension preset (`"2d"`, `"3d"`, or `"hybrid"`). Defaults to `"2d"`. */
    dimension?: BrioGameDimension;
    /** Maximum ECS entity capacity. Defaults to `4096`. */
    maxEntities?: number;
    /**
     * Upper bound in seconds for the `deltaTime` passed to `update()` (defaults to `0.1`; `0` disables clamping).
     * Prevents huge simulation steps after the tab was throttled or hidden.
     */
    maxDeltaTime?: number;
    /**
     * Preferred graphics backend for 3D passes (`"auto"` by default). The preferred backend is tried first when it
     * is implemented and supported; if it is unavailable or fails to initialize, `BrioRenderer.initBackend()` tries
     * every other usable backend of the cascade (`webgpu -> webgl2 -> webgl1 -> canvas2d`) in order. When none
     * initializes, 3D passes stay disabled.
     */
    renderBackend?: RenderBackendType | "auto";
    /**
     * Fixed simulation step in seconds for `fixedUpdate()` callbacks (e.g. `1 / 60`). Defaults to `1 / 60` once a
     * `fixedUpdate()` callback is registered; `0` disables fixed stepping.
     */
    fixedTimestep?: number;
    /** Maximum fixed steps per frame before the remaining time is dropped (defaults to `5`, avoids the spiral of death). */
    maxFixedSteps?: number;
    /**
     * Renders object positions interpolated between the last two fixed steps (`game.interpolationAlpha`), so motion
     * simulated in `fixedUpdate()` looks smooth at any refresh rate (defaults to `false`).
     */
    interpolate?: boolean;
    /** Seed of `game.random` (defaults to a time-based seed); fix it for reproducible runs and replays. */
    seed?: BrioRandomSeed;
    /** Optional Canvas 2D context settings. */
    contextSettings?: CanvasRenderingContext2DSettings;
}

/**
 * Lifecycle state machine stages of a `BrioGame` instance.
 */
export enum GameState {
    /** Initial state before `preload()`, or when paused. */
    UNSET = 0,
    /** Asynchronous asset loading stage (`preload()`). */
    PRELOAD = 1,
    /** Synchronous scene and entity setup stage (`load()`). */
    LOAD = 2,
    /** Active 60 FPS game loop stage (`update()`). */
    UPDATE = 3,
    /** Unrecoverable lifecycle error state. */
    ERROR = 4,
}

/**
 * Contract for the `assets` helper passed into `game.load((assets) => { ... })`.
 */
export interface AssetLoaderParam {
    /** Logs the currently preloaded sprites, audios, atlases, and models to `BrioConsole`. */
    logAssets: () => void;
    /** Retrieves a preloaded `BrioSprite` by its `spriteName`, or an empty fallback instance if not found. */
    getSprite: (spriteName: string) => BrioSprite;
    /** Retrieves a preloaded `BrioAudio` by its `audioName`, or an empty fallback instance if not found. */
    getAudio: (audioName: string) => BrioAudio;
    /** Retrieves a preloaded `BrioAtlas` by its `atlasName`, or `undefined` if not found. */
    getAtlas: (atlasName: string) => BrioAtlas | undefined;
    /** Retrieves a preloaded `BrioModel` by its `modelName`, or an empty fallback instance if not found. */
    getModel: (modelName: string) => BrioModel;
    /** Instantiates a preloaded `BrioModel` into a configured `BrioObject3D` scene entity. */
    instantiateModel: (modelName: string, objectName: string) => BrioObject3D;
}

/**
 * Callback signature for `game.load()`, receiving `AssetLoaderParam` and returning initial scene entities.
 */
export type LoaderCallbackFunction = (
    assets: AssetLoaderParam,
) => Array<
    BrioObject2D | BrioObject3D | BrioCamera2D | BrioCamera3D | BrioLayer | BrioTileMap | BrioLight
>;

/**
 * Assets accepted by `game.preload()`. `BrioMesh` and `BrioMaterial` instances are registered as-is
 * (procedural geometry), while `BrioModel` meshes and materials are registered after loading.
 */
export type PreloadAsset = BrioSprite | BrioAudio | BrioAtlas | BrioModel | BrioMesh | BrioMaterial;

/** Name of the layer every `BrioObject2D` joins when no other layer is specified. */
export const DEFAULT_LAYER_NAME = "default";

/** Captured ECS bytes plus the object handles needed to re-adopt them on restore. */
interface GameStateCapture {
    bytes: Uint8Array;
    objects2D: Array<{ object: BrioObject2D; entityId: number; layer?: BrioLayer }>;
    objects3D: Array<{ object: BrioObject3D; entityId: number }>;
    /** Descendant parts of the captured 3D objects (bound to the ECS, but not registered as roots). */
    parts3D: Array<{ object: BrioObject3D; entityId: number }>;
    /** `game.random` state, so restoring replays the same random sequence. */
    random: Uint32Array;
    /** Active scene at capture time and its own state (scenes own a separate `ECSWorld`). */
    scene?: { scene: BrioScene; state: BrioSceneState };
}

/**
 * Canvas 2D image interpolation settings exposed via `game.rendering`.
 */
export interface CanvasRendering {
    /** Interpolation mode (`"smooth"` for bilinear/bicubic filtering, `"pixelated"` for nearest-neighbor pixel art). */
    mode: "smooth" | "pixelated";
    /** Browser smoothing quality level when `mode === "smooth"`. */
    smoothness: ImageSmoothingQuality;
}

/** Simulated position of an object temporarily replaced by its interpolated one (pooled, reused every frame). */
interface InterpolatedRecord {
    object: BrioObject2D | BrioObject3D | undefined;
    x: number;
    y: number;
    z: number;
}

/** Stops every voice of `audio` (module-level so `end()` passes no new closure to `Map.forEach`). */
function stopAudio(audio: BrioAudio): void {
    audio.stop();
}

// #endregion --> TYPES-INTERFACES

/**
 * Central entrypoint of BrioJS that manages the HTML5 Canvas, asset preloading (`preload`),
 * entity initialization (`load`), the `requestAnimationFrame` game loop (`update`), ECS world storage,
 * scenes, timers, input controllers, and visual/console debugging tools.
 *
 * Every frame is composed by `BrioCompositor`: one 2D pass per `BrioCamera2D` (clipped to its `BrioViewport`)
 * drawing each `BrioLayer` by `order`, one 3D pass per `BrioCamera3D` through the selected `RenderBackend`,
 * and finally all `"ui"` layers in screen space. The active `BrioScene` is composed after the game content.
 *
 * @example
 * ```ts
 * const container = document.getElementById("game_container")!;
 * const game = new BrioGame(640, 480, container, "2d");
 *
 * game.useKeyboard();
 *
 * game.preload(() => [
 *     new BrioSprite("spr_player", "./assets/sprites/soldier.png"),
 * ]);
 *
 * game.load((assets) => {
 *     const player = new BrioObject2D("obj_player", assets.getSprite("spr_player").name, 1);
 *     return [player];
 * });
 *
 * game.update((updater, dt) => {
 *     const player = updater.getObject("obj_player");
 *     if (game.keyboard.isDown("ArrowRight")) {
 *         player.transform.position.x += 200 * dt;
 *     }
 * });
 * ```
 */
export class BrioGame {
    // #region --> PROPERTIES
    // #region - CANVAS
    /** Underlying `HTMLCanvasElement` mounted into the DOM container. */
    #canvas: HTMLCanvasElement;
    /** Active 2D rendering context of the canvas element. */
    public ctx: CanvasRenderingContext2D | null = null;
    /** Context initialization attributes passed to `canvas.getContext("2d")`. */
    #ctxSettings: CanvasRenderingContext2DSettings = {};
    /** Logical width of the canvas viewport in pixels. */
    #width: number;
    /** Logical height of the canvas viewport in pixels. */
    #height: number;
    /** Spatial dimension preset (`"2d"`, `"3d"`, or `"hybrid"`). */
    #dimension: BrioGameDimension = "2d";
    /** Canvas image interpolation settings (`mode` and `smoothness`). */
    #rendering: CanvasRendering = { mode: "smooth", smoothness: "medium" };
    /** Global scale multiplier applied to all rendered objects. */
    #scale: number = 1;
    // #endregion - CANVAS

    // #region - GAME-STATE-LOGIC
    /** Current lifecycle stage (`UNSET -> PRELOAD -> LOAD -> UPDATE -> ERROR`). */
    #currentState: GameState = GameState.UNSET;
    /** Sequential Promise chain coordinating `preload() -> load() -> update()`. */
    #lifecyclePromise: Promise<void> = Promise.resolve();
    // #endregion - GAME-STATE-LOGIC

    // #region - COMPOSITION-OBJECTS
    #renderer: BrioSpriteRenderer;
    #compositor: BrioCompositor;
    /**
     * 3D backend initialized by `BrioRenderer.initBackend()` through the backend cascade (only for `"3d"` and
     * `"hybrid"` games; disposed by `end()`).
     */
    #backend3D?: RenderBackend;
    /** Incremented by `end()`, so a backend that finishes initializing after the game ended is disposed. */
    #session: number = 0;
    #debugger: BrioDebugger;
    #console: BrioConsole;
    #updater: BrioUpdater;
    #assets: BrioAssetManager = new BrioAssetManager();
    #assetAccess?: AssetLoaderParam;
    /** Lights of the game-level 3D passes. */
    #lights = new BrioRegistry<BrioLight>();
    /** Registered `BrioLayer` composition planes (always contains `DEFAULT_LAYER_NAME`). */
    #layers = new BrioRegistry<BrioLayer>();
    /** Layer currently holding each registered `BrioObject2D`. */
    #objectLayers = new WeakMap<BrioObject2D, BrioLayer>();
    /** Next clone index per prefab name used by `instantiate()`. */
    #cloneCounters = new Map<string, number>();
    /** Reactive CSS background controller for the canvas element. */
    #canvasBackground: BrioCanvasBackground;
    /** Internal Structure-of-Arrays (SoA) ECS world backing entities and binary snapshots. */
    #ecsWorld: ECSWorld;
    /** Renderable view of the game-level content consumed by the compositor. */
    #source: CompositorSource;
    /** Per-frame list of sources (game + active scene), reused to avoid allocations. */
    #frameSources: CompositorSource[] = [];
    /** Per-frame debug overlay flags, reused to avoid allocations. */
    #frameDebug: CompositorDebugOptions = { showRenderBounds: false, showCollisionBounds: false };
    /** Frame-synchronized `deltaTime` timer scheduler. */
    #timer: BrioTimer = new BrioTimer();
    /** Registered `BrioScene` instances keyed by scene name. */
    #scenes: Map<string, BrioScene> = new Map();
    /** Currently active `BrioScene`. */
    #activeScene?: BrioScene;
    /** Scene requested by `setScene()` whose `preload()` / `load()` is still running. */
    #pendingScene?: BrioScene;
    // #endregion - COMPOSITION-OBJECTS

    // #region - UPDATE-LOGIC
    /** Active `requestAnimationFrame` handle used to cancel the update loop on `pause()` or `end()`. */
    #updateFrameId: number = 0;
    /** Timestamp (in milliseconds) of the previous animation frame for `deltaTime` computation. */
    #deltaTimePreviousTime: number = 0;
    #updateIsRunning: boolean = false;
    #updateLoopLogic?: (currentTime: number) => void;
    #gameLastFPS: number = 0;
    #maxDeltaTime: number = 0.1;
    /** Per-frame callback registered by `update()`, also used by `step()`. */
    #updateCallback?: (updater: BrioUpdater, deltaTime: number) => void;
    #fixedCallback?: (updater: BrioUpdater, fixedDeltaTime: number) => void;
    #fixedTimestep: number = 0;
    #maxFixedSteps: number = 5;
    #fixedAccumulator: number = 0;
    #interpolate: boolean = false;
    /** Position before the latest fixed step, per object (render interpolation). */
    #previousPositions = new WeakMap<BrioObject2D | BrioObject3D, { x: number; y: number; z: number }>();
    /** Objects whose position was replaced by an interpolated one for the current render, with the real value. */
    #interpolated: InterpolatedRecord[] = [];
    /** Number of live records in `#interpolated` this frame (records past it are pooled for reuse). */
    #interpolatedCount: number = 0;
    /** `interpolationAlpha` of the frame being rendered, read by `#applyInterpolationVisitor`. */
    #interpolationFrameAlpha: number = 0;
    /** Visitors bound once, so `#forEachInterpolable` creates no closures per frame. */
    readonly #rememberPositionVisitor = (object: BrioObject2D | BrioObject3D): void => {
        this.#rememberPosition(object);
    };
    readonly #applyInterpolationVisitor = (object: BrioObject2D | BrioObject3D): void => {
        this.#interpolateObject(object);
    };
    #random: BrioRandom = new BrioRandom();
    /** Whether `pause()` suspended the shared `BrioAudioMixer`, so `resume()` / `end()` release it. */
    #audioSuspended: boolean = false;
    // #endregion - UPDATE-LOGIC

    // #region - INPUT-LOGIC
    #keyboardState: Map<string, boolean> = new Map<string, boolean>();
    #keyboardPrevState: Map<string, boolean> = new Map<string, boolean>();
    #keyboardInstance?: BrioKeyboard;
    #mouseInstance?: BrioMouse;
    #touchInstance?: BrioTouch;
    #gamepadInstance?: BrioGamepad;
    // #endregion - INPUT-LOGIC

    // #region - STORAGE-LOGIC
    /** Initial state captured after `load()` for `useSnapshot()` and `restart()`. */
    #initialState?: GameStateCapture;
    /** State captured via `createCheckPoint()`. */
    #checkpointState?: GameStateCapture;
    // #endregion - STORAGE-LOGIC
    // #endregion --> PROPERTIES

    // #region --> CONSTRUCTOR

    /**
     * Creates a new `BrioGame` instance and appends its `<canvas>` element to the target container.
     * Supports both `(width, height, appendToElement, presetOrSettings?)` and a single `BrioGameConfig` object.
     * The `"2d"` preset allocates no 3D transform memory and does not accept `BrioObject3D`;
     * `"3d"` and `"hybrid"` allocate both and enable 3D passes.
     *
     * @param widthOrConfig Canvas viewport width in pixels, or a `BrioGameConfig` object
     * @param height Canvas viewport height in pixels (when first argument is `width`)
     * @param appendToElement Target DOM `HTMLElement` where the canvas will be mounted
     * @param optionsOrSettings Optional dimension preset (`"2d" | "3d" | "hybrid"`) or `CanvasRenderingContext2DSettings`
     * @throws {Error} When the target container is not a valid `HTMLElement`
     * @example
     * ```ts
     * const game = new BrioGame(640, 480, document.body, "2d");
     * ```
     */
    constructor(
        widthOrConfig: number | BrioGameConfig,
        height?: number,
        appendToElement?: HTMLElement,
        optionsOrSettings: BrioGameDimension | CanvasRenderingContext2DSettings = {},
    ) {
        // Initializing debugging tools
        this.#console = new BrioConsole();
        this.#debugger = new BrioDebugger(this.#console);

        let rawWidth: number;
        let rawHeight: number;
        let container: HTMLElement | undefined;
        let maxEntities = 4096;
        let preferredBackend: RenderBackendType | "auto" = "auto";

        if (typeof widthOrConfig === "object" && widthOrConfig !== null) {
            rawWidth = widthOrConfig.width;
            rawHeight = widthOrConfig.height;
            container = widthOrConfig.container;
            this.#dimension = widthOrConfig.dimension ?? "2d";
            maxEntities = widthOrConfig.maxEntities ?? 4096;
            this.#ctxSettings = widthOrConfig.contextSettings ?? {};
            preferredBackend = widthOrConfig.renderBackend ?? "auto";
            this.maxDeltaTime = widthOrConfig.maxDeltaTime ?? 0.1;
            this.fixedTimestep = widthOrConfig.fixedTimestep ?? 0;
            this.#maxFixedSteps = Math.max(1, Math.floor(widthOrConfig.maxFixedSteps ?? 5));
            this.#interpolate = widthOrConfig.interpolate ?? false;
            if (widthOrConfig.seed !== undefined) this.#random.reseed(widthOrConfig.seed);
        } else {
            rawWidth = widthOrConfig;
            rawHeight = height ?? 0;
            container = appendToElement;
            if (typeof optionsOrSettings === "string") {
                this.#dimension = optionsOrSettings;
            } else {
                this.#ctxSettings = optionsOrSettings;
            }
        }

        if (rawWidth < 0 || rawHeight < 0) {
            this.#console.out(
                "warn",
                "BrioGame constructor: Negative values converted to positive.",
            );
        }
        if (!(container instanceof HTMLElement)) {
            throw this.#console.fatalError(
                "BrioGame constructor: A BrioGame should be appended to a working HTMLElement.",
            );
        }

        // Game dimensions
        this.#width = Math.abs(rawWidth);
        this.#height = Math.abs(rawHeight);

        // ECS world allocation (pure 2D games skip the 3D transform buffer, ADR-0004)
        this.#ecsWorld = new ECSWorld(maxEntities, false, {
            transform2D: true,
            transform3D: this.#dimension !== "2d",
        });

        // Canvas element configuration
        this.#canvas = document.createElement("canvas");
        this.#canvas.style.background = "transparent";
        this.#canvas.width = this.#width;
        this.#canvas.height = this.#height;

        // Canvas 2D context configuration
        this.ctx = this.#canvas.getContext("2d", this.#ctxSettings);

        container.appendChild(this.#canvas);

        // Composing engine subsystems
        this.#canvasBackground = new BrioCanvasBackground(this.#canvas);
        this.#renderer = new BrioSpriteRenderer(
            this,
            this.#assets,
            this.ctx!,
            this.#scale,
            this.#width,
            this.#height,
            this.#gameLastFPS,
        );
        this.#compositor = new BrioCompositor(this.#renderer);
        this.#updater = new BrioUpdater(this.#assets, this.#renderer, this.#console);

        this.#layers.add(new BrioLayer({ name: DEFAULT_LAYER_NAME, order: 0, policy: "dynamic" }));
        this.#source = {
            world: this.#ecsWorld,
            layers: this.#layers,
            cameras2D: this.#assets.cameras2D.list,
            cameras3D: this.#assets.cameras3D.list,
            objects3D: this.#assets.objects3d.list,
            lights: this.#lights.list,
        };

        if (this.#dimension !== "2d") {
            // Captured now: end() may run before the queued stage starts
            const session = this.#session;
            this.#chainLifecycle(async () => {
                if (session !== this.#session) return;
                // Walks the cascade: a backend that fails to initialize (blocklisted driver, context limit,
                // test doubles) hands over to the next one instead of jumping straight to the software rasterizer
                const backend = await BrioRenderer.initBackend(
                    this.#canvas,
                    preferredBackend,
                    (type, error) => {
                        this.#console.out(
                            "warn",
                            `3D backend '${type}' failed to initialize${error ? ` (${error})` : ""}; trying the next one.`,
                        );
                    },
                );
                if (backend && session !== this.#session) {
                    // end() ran while the backend was initializing: release it instead of rendering with it
                    backend.dispose();
                } else if (backend) {
                    this.#backend3D = backend;
                    this.#compositor.configure3D(
                        backend,
                        this.#assets.meshes,
                        this.#assets.materials,
                    );
                    this.#console.out("info", `3D backend '${backend.backendType}' ready.`);
                } else {
                    this.#console.out(
                        "error",
                        "No 3D backend could be initialized; 3D passes are disabled.",
                    );
                }
            });
        }
    }

    // #endregion --> CONSTRUCTOR

    // #region --> GETTERS-SETTERS

    /**
     * Spatial dimension preset of this game instance (`"2d"`, `"3d"`, or `"hybrid"`).
     *
     * @example
     * ```ts
     * console.log(game.dimension); // "2d"
     * ```
     */
    public get dimension(): BrioGameDimension {
        return this.#dimension;
    }

    /**
     * Internal Structure-of-Arrays (SoA) `ECSWorld` instance backing entities and binary snapshots.
     *
     * @example
     * ```ts
     * console.log(game.ecsWorld.activeCount);
     * ```
     */
    public get ecsWorld(): ECSWorld {
        return this.#ecsWorld;
    }

    /**
     * Graphics backend used by the 3D passes (`undefined` for `"2d"` games or before initialization).
     *
     * @example
     * ```ts
     * console.log(game.renderBackend?.backendType); // "canvas2d"
     * ```
     */
    public get renderBackend(): RenderBackend | undefined {
        return this.#backend3D;
    }

    /**
     * Rendering counters of the most recent frame (2D/3D passes, objects drawn and culled, static cache redraws).
     *
     * @example
     * ```ts
     * console.log(game.renderStats.objectsCulled);
     * ```
     */
    public get renderStats(): Readonly<CompositorStats> {
        return this.#compositor.stats;
    }

    /**
     * Upper bound in seconds for the `deltaTime` passed to `update()` (`0` disables clamping).
     * Background tabs and occluded windows throttle `requestAnimationFrame` (often to ~1 Hz); without a clamp,
     * the next frame would advance physics, cameras, and timers by a full second at once.
     *
     * @default 0.1
     * @example
     * ```ts
     * game.maxDeltaTime = 1 / 30;
     * ```
     */
    public get maxDeltaTime(): number {
        return this.#maxDeltaTime;
    }
    public set maxDeltaTime(seconds: number) {
        this.#maxDeltaTime = Math.max(0, seconds);
    }

    /**
     * Frame-synchronized `BrioTimer` scheduler that pauses automatically when the game is paused.
     *
     * @example
     * ```ts
     * game.timer.after(2.0, () => console.log("2 seconds of gameplay elapsed!"));
     * ```
     */
    public get timer(): BrioTimer {
        return this.#timer;
    }

    /**
     * Map of registered `BrioScene` instances keyed by scene name.
     */
    public get scenes(): Map<string, BrioScene> {
        return this.#scenes;
    }

    /**
     * Currently active `BrioScene`, if any. Its layers, cameras, and 3D objects are composed after the game content.
     */
    public get activeScene(): BrioScene | undefined {
        return this.#activeScene;
    }

    /**
     * Map of registered `BrioLayer` composition planes keyed by name (always contains `"default"`).
     *
     * @example
     * ```ts
     * game.layers.get("default")!.visible = false;
     * ```
     */
    public get layers(): ReadonlyMap<string, BrioLayer> {
        return this.#layers.map;
    }

    /**
     * Map of registered `BrioCamera2D` instances keyed by name. Each camera renders into its own `viewport`;
     * when none is registered, a full-screen camera at the world origin is used.
     */
    public get cameras2D(): ReadonlyMap<string, BrioCamera2D> {
        return this.#assets.cameras2D.map;
    }

    /**
     * Map of registered `BrioCamera3D` instances keyed by name.
     */
    public get cameras3D(): ReadonlyMap<string, BrioCamera3D> {
        return this.#assets.cameras3D.map;
    }

    /**
     * Map of all preloaded `BrioSprite` assets keyed by `sprite.name`.
     *
     * @example
     * ```ts
     * console.log(game.loadedGameSprites.has("spr_player"));
     * ```
     */
    public get loadedGameSprites(): Map<string, BrioSprite> {
        return this.#assets.sprites;
    }

    /**
     * Logical width of the game canvas in pixels.
     *
     * @example
     * ```ts
     * const centerX = game.width / 2;
     * ```
     */
    public get width(): number {
        return this.#width;
    }

    /**
     * Logical height of the game canvas in pixels.
     *
     * @example
     * ```ts
     * const centerY = game.height / 2;
     * ```
     */
    public get height(): number {
        return this.#height;
    }

    /**
     * Reactive CSS background configuration of the game canvas.
     * Supports both individual property mutations (`game.background.color = "#000"`)
     * and full object assignment (`game.background = { color: "#000", repeat: "no-repeat" }`).
     *
     * @example
     * ```ts
     * game.background.color = "#020319";
     * game.background.repeat = "no-repeat";
     * game.background.size = "cover";
     * ```
     */
    public set background(backgroundValue: CanvasBackground) {
        this.#canvasBackground.apply(backgroundValue);
    }
    public get background(): CanvasBackground {
        return this.#canvasBackground;
    }

    /**
     * Global scale multiplier applied to all rendered objects and collision helpers.
     * Negative values are automatically converted to their absolute value.
     *
     * @default 1
     * @example
     * ```ts
     * const game = new BrioGame(640, 480, document.body);
     * game.scale = 2; // 32x32 sprites are rendered at 64x64 pixels
     * ```
     */
    public set scale(scaleValue: number) {
        this.#scale = Math.abs(scaleValue);
    }
    public get scale(): number {
        return this.#scale;
    }

    /**
     * Read-only map of all active `BrioObject2D` entities keyed by `object.name`.
     * Register objects through `load()`, `addObject()`, or `instantiate()` so they are bound to the ECS and to a layer.
     *
     * @example
     * ```ts
     * console.log(game.gameObjects.size);
     * ```
     */
    public get gameObjects(): ReadonlyMap<string, BrioObject2D> {
        return this.#assets.objects;
    }

    /**
     * Read-only map of all active `BrioObject3D` entities keyed by `object.name`.
     *
     * @example
     * ```ts
     * console.log(game.gameObjects3D.size);
     * ```
     */
    public get gameObjects3D(): ReadonlyMap<string, BrioObject3D> {
        return this.#assets.objects3d.map;
    }

    /**
     * Map of all preloaded `BrioModel` 3D model assets keyed by `model.name`.
     *
     * @example
     * ```ts
     * const ship = game.loadedModels.get("mod_ship");
     * ```
     */
    public get loadedModels(): Map<string, BrioModel> {
        return this.#assets.models;
    }

    /**
     * Map of registered `BrioMesh` geometries keyed by `mesh.name` (preloaded directly or extracted from models).
     */
    public get loadedMeshes(): Map<string, BrioMesh> {
        return this.#assets.meshes;
    }

    /**
     * Map of registered `BrioMaterial` surfaces keyed by `material.name` (preloaded directly or extracted from models).
     */
    public get loadedMaterials(): Map<string, BrioMaterial> {
        return this.#assets.materials;
    }

    /**
     * Map of `BrioTileMap` instances returned from `load()`, keyed by `tileMap.name`.
     */
    public get tileMaps(): Map<string, BrioTileMap> {
        return this.#assets.tileMaps;
    }

    /**
     * Indicates whether the `update()` loop is currently running (`true`) or paused/stopped (`false`).
     *
     * @example
     * ```ts
     * if (game.isRunning) {
     *     game.pause();
     * }
     * ```
     */
    public get isRunning(): boolean {
        return this.#updateIsRunning;
    }

    /**
     * Fixed simulation step in seconds used by `fixedUpdate()` callbacks (`0` = disabled).
     *
     * @example
     * ```ts
     * game.fixedTimestep = 1 / 120;
     * ```
     */
    public get fixedTimestep(): number {
        return this.#fixedTimestep;
    }
    public set fixedTimestep(seconds: number) {
        this.#fixedTimestep = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
        this.#fixedAccumulator = 0;
    }

    /**
     * Fraction `[0, 1)` of a fixed step left in the accumulator after the last frame's fixed steps; the blend factor
     * between the previous and current simulated states (used automatically when `interpolate` is enabled).
     */
    public get interpolationAlpha(): number {
        return this.#fixedTimestep > 0 ? this.#fixedAccumulator / this.#fixedTimestep : 0;
    }

    /** Whether rendered positions are interpolated between fixed steps. */
    public get interpolate(): boolean {
        return this.#interpolate;
    }
    public set interpolate(value: boolean) {
        this.#interpolate = value;
    }

    /**
     * Seeded random generator of this game. Use it instead of `Math.random()` in gameplay code so runs can be
     * reproduced with the `seed` option; its state is part of checkpoints and snapshots.
     *
     * @example
     * ```ts
     * const spawnX = game.random.float(0, game.width);
     * ```
     */
    public get random(): BrioRandom {
        return this.#random;
    }

    /**
     * Canvas 2D rendering interpolation settings (`mode: "smooth" | "pixelated"` and `smoothness`).
     *
     * @example
     * ```ts
     * game.rendering.mode = "pixelated";
     * ```
     */
    public get rendering(): CanvasRendering {
        return this.#rendering;
    }

    /**
     * Visual and console debugging configuration controller (`game.debugging.console` and `game.debugging.render`).
     *
     * @example
     * ```ts
     * game.debugging.console.enabled = true;
     * game.debugging.render.showCollisionBounds = true;
     * ```
     */
    public get debugging(): BrioDebugger {
        return this.#debugger;
    }

    /**
     * Active `BrioKeyboard` input controller.
     * Requires `game.useKeyboard()` to be called before accessing.
     *
     * @throws {Error} When accessed before calling `game.useKeyboard()`
     * @example
     * ```ts
     * game.useKeyboard();
     * if (game.keyboard.isDown("ArrowLeft")) {
     *     player.transform.position.x -= 200 * dt;
     * }
     * ```
     */
    public get keyboard(): BrioKeyboard {
        if (!this.#keyboardInstance) {
            throw this.#console.fatalError(
                "Keyboard instance doesn't exist. Try using the useKeyboard() method in the game object.",
            );
        }

        return this.#keyboardInstance;
    }

    /**
     * Active `BrioMouse` input controller.
     * Requires `game.useMouse()` to be called before accessing.
     *
     * @throws {Error} When accessed before calling `game.useMouse()`
     * @example
     * ```ts
     * game.useMouse();
     * if (game.mouse.isPressed("left")) {
     *     console.log(game.mouse.position);
     * }
     * ```
     */
    public get mouse(): BrioMouse {
        if (!this.#mouseInstance) {
            throw this.#console.fatalError(
                "Mouse instance doesn't exist. Try using the useMouse() method in the game object.",
            );
        }
        return this.#mouseInstance;
    }

    /**
     * Active `BrioTouch` multi-touch input controller.
     * Requires `game.useTouch()` to be called before accessing.
     *
     * @throws {Error} When accessed before calling `game.useTouch()`
     * @example
     * ```ts
     * game.useTouch();
     * if (game.touch.isTouching) {
     *     console.log(game.touch.primaryPosition);
     * }
     * ```
     */
    public get touch(): BrioTouch {
        if (!this.#touchInstance) {
            throw this.#console.fatalError(
                "Touch instance doesn't exist. Try using the useTouch() method in the game object.",
            );
        }
        return this.#touchInstance;
    }

    /**
     * Active `BrioGamepad` controller.
     * Requires `game.useGamepad()` to be called before accessing.
     *
     * @throws {Error} When accessed before calling `game.useGamepad()`
     * @example
     * ```ts
     * game.useGamepad();
     * const move = game.gamepad.getLeftStick(0);
     * ```
     */
    public get gamepad(): BrioGamepad {
        if (!this.#gamepadInstance) {
            throw this.#console.fatalError(
                "Gamepad instance doesn't exist. Try using the useGamepad() method in the game object.",
            );
        }
        return this.#gamepadInstance;
    }

    // #endregion --> GETTERS-SETTERS

    // #region --> GAME-STATES

    /**
     * First stage of the `BrioGame` lifecycle: asynchronously preloads `BrioSprite`, `BrioAudio`,
     * `BrioAtlas`, and `BrioModel` assets, and registers `BrioMesh` / `BrioMaterial` instances, before `load()` executes.
     *
     * @param callbackFn Function returning a non-empty array of assets to preload
     * @returns This `BrioGame` instance for method chaining
     * @throws {Error} When `callbackFn` returns an empty array
     * @example
     * ```ts
     * game.preload(() => {
     *     const sprPlayer = new BrioSprite("spr_player", "./assets/sprites/soldier.png");
     *     const audLaser = new BrioAudio("aud_laser", "./assets/audios/laser.wav");
     *     return [sprPlayer, audLaser, BrioMesh.createBox("mesh_crate", 1, 1, 1)];
     * });
     * ```
     */
    public preload(callbackFn: () => Array<PreloadAsset>): this {
        this.#chainLifecycle(async () => {
            this.#currentState = GameState.PRELOAD;

            const assets = callbackFn();

            if (assets.length === 0) {
                throw new Error("Zero assets returned. You must return at least one asset.");
            }

            await this.#preloadAssets(assets);

            this.#console.out("info", "Preload step complete!");
        });

        return this;
    }

    /** Loads `assets` into the shared registries (used by `preload()` and by `BrioScene.preload()`). */
    async #preloadAssets(assets: PreloadAsset[]): Promise<void> {
        const sprites = assets.filter(
            (asset): asset is BrioSprite => asset instanceof BrioSprite,
        );
        const audios = assets.filter((asset): asset is BrioAudio => asset instanceof BrioAudio);
        const spriteAtlases = assets.filter(
            (asset): asset is BrioAtlas => asset instanceof BrioAtlas,
        );
        const models = assets.filter((asset): asset is BrioModel => asset instanceof BrioModel);

        for (const asset of assets) {
            if (asset instanceof BrioMesh) this.#assets.meshes.set(asset.name, asset);
            else if (asset instanceof BrioMaterial) this.#assets.materials.set(asset.name, asset);
        }

        const spriteLoadPromises = sprites.map((sprite) => {
            return new Promise<void>((resolve, reject) => {
                const onLoaded = () => {
                    sprite.size = create(sprite.element.width, sprite.element.height);
                    this.#assets.sprites.set(sprite.name, sprite);
                    this.#console.out("log", `Sprite: ${sprite.name} sucessfully preloaded.`);
                    resolve();
                };
                // Data URLs and cached images may already be decoded before the handler is attached
                if (sprite.element.complete && sprite.element.naturalWidth > 0) {
                    onLoaded();
                    return;
                }
                sprite.element.onload = onLoaded;
                sprite.element.onerror = (_event, _source, _lineno, _colno, err) => {
                    reject(`Error loading the Sprite '${sprite.name}': ${err?.message}`);
                };
            });
        });

        const spriteAtlasPromises = spriteAtlases.map(async (atlas) => {
            await atlas.mount();
            this.#assets.atlases.set(atlas.name, atlas);
            this.#console.out("log", `Atlas: ${atlas.name} sucessfully preloaded.`);
        });

        const audioLoadPromises = audios.map(async (audio) => {
            await audio.load();
            this.#assets.audios.set(audio.name, audio);
            this.#console.out(
                "log",
                `Audio: ${audio.name} sucessfully preloaded (${audio.usesWebAudio ? "Web Audio" : "HTMLAudioElement"}).`,
            );
        });

        const modelLoadPromises = models.map(async (model) => {
            await model.load();
            this.#assets.models.set(model.name, model);
            model.meshes.forEach((mesh) => this.#assets.meshes.set(mesh.name, mesh));
            model.materials.forEach((mat) => this.#assets.materials.set(mat.name, mat));
            for (const warning of model.warnings) {
                this.#console.out("warn", `Model '${model.name}': ${warning}`);
            }
            this.#console.out("log", `Model: ${model.name} sucessfully preloaded.`);
        });

        await Promise.all(spriteLoadPromises);
        await Promise.all(spriteAtlasPromises);
        await Promise.all(audioLoadPromises);
        await Promise.all(modelLoadPromises);
    }

    /**
     * Second stage of the `BrioGame` lifecycle: registers the initial scene content returned by `callbackFn`:
     * `BrioLayer` planes first, then `BrioCamera2D` / `BrioCamera3D`, `BrioTileMap`, and finally `BrioObject2D` /
     * `BrioObject3D` entities. A `BrioObject2D` already added to a returned layer stays there; otherwise it joins `"default"`.
     *
     * @param callbackFn Callback receiving `AssetLoaderParam` (`getSprite`, `getAudio`, `getAtlas`, `getModel`, `logAssets`) and returning initial scene content
     * @returns This `BrioGame` instance for method chaining
     * @example
     * ```ts
     * game.load((assets) => {
     *     const hud = new BrioLayer({ name: "hud", order: 100, policy: "ui" });
     *     const score = new BrioObject2D("obj_score", "spr_score", 1);
     *     hud.addObject(score);
     *     const player = new BrioObject2D("obj_player", assets.getSprite("spr_player").name, 1);
     *     return [hud, score, player];
     * });
     * ```
     */
    public load(callbackFn: LoaderCallbackFunction): this {
        this.#chainLifecycle(() => {
            this.#currentState = GameState.LOAD;

            const content = callbackFn(this.#assetLoaderParam());

            for (const item of content) {
                if (item instanceof BrioLayer) this.addLayer(item);
            }
            for (const item of content) {
                if (item instanceof BrioCamera2D || item instanceof BrioCamera3D) {
                    this.addCamera(item);
                } else if (item instanceof BrioTileMap) {
                    this.#assets.tileMaps.set(item.name, item);
                } else if (item instanceof BrioLight) {
                    this.addLight(item);
                }
            }
            for (const item of content) {
                if (item instanceof BrioObject2D || item instanceof BrioObject3D) {
                    this.addObject(item);
                }
            }

            this.createSnapshot();
            this.#console.out("info", "Load step complete!");
        });

        return this;
    }

    /** Asset accessors handed to `load()` callbacks of the game and of every `BrioScene` (created once). */
    #assetLoaderParam(): AssetLoaderParam {
        if (this.#assetAccess) return this.#assetAccess;
        this.#assetAccess = {
            logAssets: () => {
                this.#console.out("log", `Currently loaded sprites: ${this.#assets.sprites}.`);
                this.#console.out("log", `Currently loaded audios: ${this.#assets.audios}.`);
                this.#console.out("log", `Currently loaded atlases: ${this.#assets.atlases}.`);
                this.#console.out("log", `Currently loaded models: ${this.#assets.models}.`);
            },
            getSprite: (spriteName: string) => {
                if (!this.#assets.sprites.has(spriteName)) {
                    this.#console.out(
                        "error",
                        `Named sprite asset '${spriteName}' was not found in the preloaded resources, check if you preloaded it correctly and gave it the right name.`,
                    );
                }

                const spr = this.#assets.sprites.get(spriteName);
                if (spr !== undefined) {
                    return spr;
                }

                return BrioSprite.getEmptyInstance();
            },
            getAudio: (audioName: string) => {
                if (!this.#assets.audios.has(audioName)) {
                    this.#console.out(
                        "error",
                        `Named audio asset '${audioName}' was not found in the preloaded resources, check if you preloaded it correctly and gave it the right name.`,
                    );
                }

                const aud = this.#assets.audios.get(audioName);
                if (aud !== undefined) {
                    return aud;
                }

                return BrioAudio.getEmptyInstance();
            },
            getAtlas: (atlasName: string) => {
                if (!this.#assets.atlases.has(atlasName)) {
                    this.#console.out(
                        "error",
                        `Named atlas asset '${atlasName}' was not found in the preloaded resources, check if you preloaded it correctly and gave it the right name.`,
                    );
                }

                return this.#assets.atlases.get(atlasName);
            },
            getModel: (modelName: string) => {
                if (!this.#assets.models.has(modelName)) {
                    this.#console.out(
                        "error",
                        `Named model asset '${modelName}' was not found in the preloaded resources, check if you preloaded it correctly and gave it the right name.`,
                    );
                }

                const mod = this.#assets.models.get(modelName);
                if (mod !== undefined) {
                    return mod;
                }

                return BrioModel.getEmptyInstance();
            },
            instantiateModel: (modelName: string, objectName: string) => {
                const mod = this.#assets.models.get(modelName);
                if (!mod) {
                    this.#console.out(
                        "error",
                        `Model asset '${modelName}' was not found in preloaded resources.`,
                    );
                    return BrioObject3D.getEmptyInstance();
                }
                return mod.instantiate(objectName);
            },
        };
        return this.#assetAccess;
    }

    /**
     * Third stage of the `BrioGame` lifecycle: starts the `requestAnimationFrame` loop, invoking
     * `callbackFn(updater, deltaTime)` on every frame, advancing the active scene and every `BrioCamera2D`
     * (follow, bounds, shake), and composing the frame through `BrioCompositor`.
     *
     * @param callbackFn Per-frame callback receiving the `BrioUpdater` instance and `deltaTime` (in seconds)
     * @returns This `BrioGame` instance for method chaining
     * @example
     * ```ts
     * game.update((updater, dt) => {
     *     const player = updater.getObject("obj_player");
     *     if (game.keyboard.isDown("ArrowUp")) {
     *         player.transform.position.y -= 300 * dt;
     *     }
     * });
     * ```
     */
    public update(callbackFn: (updater: BrioUpdater, deltaTime: number) => void): this {
        this.#updateCallback = callbackFn;
        this.#chainLifecycle(() => {
            this.#currentState = GameState.UPDATE;
            this.#updateIsRunning = true;

            this.#console.out("info", "Update step started!");

            this.#updateLoopLogic = (currentTime: number) => {
                if (this.#currentState !== GameState.UPDATE) {
                    return;
                }

                if (this.#deltaTimePreviousTime === 0) {
                    this.#deltaTimePreviousTime = currentTime;
                }
                const rawDeltaTime = (currentTime - this.#deltaTimePreviousTime) / 1000;
                const deltaTime =
                    this.#maxDeltaTime > 0 ? Math.min(rawDeltaTime, this.#maxDeltaTime) : rawDeltaTime;

                this.#step(deltaTime, rawDeltaTime, callbackFn);

                this.#deltaTimePreviousTime = currentTime;

                if (this.#updateLoopLogic) {
                    this.#updateFrameId = requestAnimationFrame(this.#updateLoopLogic);
                }
            };
            this.#updateFrameId = requestAnimationFrame(this.#updateLoopLogic);
        });

        return this;
    }

    /**
     * Registers a callback run at a **fixed** rate (`fixedTimestep`, `1 / 60` by default) independent of the display
     * refresh rate: zero, one, or several times per frame, before the `update()` callback. Put physics and other
     * framerate-sensitive simulation here; enable `interpolate` to render smooth motion between steps.
     *
     * @param callbackFn Callback receiving the `BrioUpdater` and the fixed step in seconds
     * @returns This `BrioGame` instance for method chaining
     * @example
     * ```ts
     * game.fixedUpdate((updater, fixedDt) => {
     *     ball.transform.position.y += velocityY * fixedDt;
     * });
     * ```
     */
    public fixedUpdate(callbackFn: (updater: BrioUpdater, fixedDeltaTime: number) => void): this {
        this.#fixedCallback = callbackFn;
        if (this.#fixedTimestep === 0) this.fixedTimestep = 1 / 60;
        return this;
    }

    /**
     * Advances the game by exactly `deltaTime` seconds (fixed steps, `update()` callback, scene, cameras) and
     * renders one frame, without `requestAnimationFrame`. Useful for tests, tools, and deterministic replays.
     *
     * @param deltaTime Simulated frame time in seconds (clamped by `maxDeltaTime`)
     * @example
     * ```ts
     * for (let i = 0; i < 60; i++) game.step(1 / 60);
     * ```
     */
    public step(deltaTime: number): void {
        const dt = Math.max(0, deltaTime);
        const clamped = this.#maxDeltaTime > 0 ? Math.min(dt, this.#maxDeltaTime) : dt;
        this.#step(clamped, dt, this.#updateCallback);
    }

    /**
     * Resolves once every lifecycle stage queued so far (`preload`, `load`, `update` start) has settled.
     *
     * @returns Promise resolved after the current lifecycle chain
     * @example
     * ```ts
     * game.preload(...).load(...);
     * await game.ready();
     * ```
     */
    public ready(): Promise<void> {
        return this.#lifecyclePromise;
    }

    // #endregion --> GAME-STATES

    // #region --> METHODS

    /**
     * Executes one simulation + render step of `deltaTime` seconds (the body of the `update()` loop).
     */
    #step(
        deltaTime: number,
        rawDeltaTime: number,
        callbackFn: ((updater: BrioUpdater, deltaTime: number) => void) | undefined,
    ): void {
        this.#renderer.clearScreen();

        // Debug FPS calculation uses the real (unclamped) frame time
        this.#gameLastFPS = this.#renderer.gameLastFPS = rawDeltaTime > 0 ? 1 / rawDeltaTime : 60;

        // Poll gamepads and advance frame-synchronized timers
        this.#gamepadInstance?.poll();
        this.#timer.update(deltaTime);

        this.#renderDebuggingGrid();

        this.#runFixedSteps(deltaTime);

        // Main user update callback
        callbackFn?.(this.#updater, deltaTime);

        // Active scene update, then game-level cameras (follow, bounds, shake)
        this.#activeScene?.step(deltaTime);
        const cameras = this.#assets.cameras2D.list;
        for (let i = 0; i < cameras.length; i++) {
            cameras[i].update(deltaTime);
        }

        const interpolating = this.#interpolate && this.#fixedTimestep > 0;
        if (interpolating) this.#applyInterpolation();
        this.renderFrame();
        if (interpolating) this.#restoreInterpolation();

        // Close the input frame: consume latched edges and snapshot the current state into the previous-frame
        // state for next frame's isPressed / isUp (without a keyboard controller the maps never change)
        this.#keyboardInstance?.endFrame();
        this.#mouseInstance?.endFrame();
        // Global key states (BrioKeyboard.globalIsUp) roll over at the same point as the per-instance ones
        BrioKeyboard.syncGlobalFrame();
    }

    /** Runs as many fixed steps as the accumulated time allows (at most `maxFixedSteps`). */
    #runFixedSteps(deltaTime: number): void {
        if (this.#fixedTimestep <= 0 || !this.#fixedCallback) return;
        const step = this.#fixedTimestep;
        this.#fixedAccumulator += deltaTime;
        let steps = 0;
        while (this.#fixedAccumulator >= step && steps < this.#maxFixedSteps) {
            if (this.#interpolate) this.#forEachInterpolable(this.#rememberPositionVisitor);
            this.#fixedCallback(this.#updater, step);
            this.#fixedAccumulator -= step;
            steps++;
        }
        // Too far behind (slow device, breakpoint): drop the backlog instead of simulating it all next frame
        if (steps === this.#maxFixedSteps && this.#fixedAccumulator >= step) {
            this.#fixedAccumulator = this.#fixedAccumulator % step;
        }
    }

    /** Calls `visit` for every object of the game and of the active scene. */
    #forEachInterpolable(visit: (object: BrioObject2D | BrioObject3D) => void): void {
        this.#assets.objects.forEach(visit);
        const objects3D = this.#assets.objects3d.list;
        for (let i = 0; i < objects3D.length; i++) visit(objects3D[i]);
        const scene = this.#activeScene;
        if (scene) {
            scene.objects2D.forEach(visit);
            scene.objects3D.forEach(visit);
        }
    }

    #rememberPosition(object: BrioObject2D | BrioObject3D): void {
        const position = object.transform.position as { x: number; y: number; z?: number };
        let previous = this.#previousPositions.get(object);
        if (!previous) {
            previous = { x: 0, y: 0, z: 0 };
            this.#previousPositions.set(object, previous);
        }
        previous.x = position.x;
        previous.y = position.y;
        previous.z = position.z ?? 0;
    }

    /** Moves every object that moved during the last fixed step to `lerp(previous, current, alpha)` for rendering. */
    #applyInterpolation(): void {
        this.#interpolationFrameAlpha = this.interpolationAlpha;
        this.#interpolatedCount = 0;
        this.#forEachInterpolable(this.#applyInterpolationVisitor);
    }

    /** Interpolates one object and records its simulated position in a pooled record. */
    #interpolateObject(object: BrioObject2D | BrioObject3D): void {
        const previous = this.#previousPositions.get(object);
        if (!previous) return;
        const position = object.transform.position as { x: number; y: number; z?: number };
        const z = position.z ?? 0;
        if (previous.x === position.x && previous.y === position.y && previous.z === z) return;

        // Records are pooled: the array only grows when more objects move than in any earlier frame
        const records = this.#interpolated;
        let record = records[this.#interpolatedCount];
        if (!record) {
            record = { object: undefined, x: 0, y: 0, z: 0 };
            records.push(record);
        }
        this.#interpolatedCount++;
        record.object = object;
        record.x = position.x;
        record.y = position.y;
        record.z = z;

        const alpha = this.#interpolationFrameAlpha;
        const ix = previous.x + (position.x - previous.x) * alpha;
        const iy = previous.y + (position.y - previous.y) * alpha;
        if (object instanceof BrioObject3D) {
            object.transform.position.x = ix;
            object.transform.position.y = iy;
            object.transform.position.z = previous.z + (z - previous.z) * alpha;
        } else {
            // Silent write: the real position is restored right after rendering
            (object.transform.position as BrioVec2).setSilent(ix, iy);
        }
    }

    /** Restores the simulated positions replaced by `#applyInterpolation()`. */
    #restoreInterpolation(): void {
        const records = this.#interpolated;
        const count = this.#interpolatedCount;
        for (let i = 0; i < count; i++) {
            const record = records[i];
            const object = record.object!;
            if (object instanceof BrioObject3D) {
                object.transform.position.x = record.x;
                object.transform.position.y = record.y;
                object.transform.position.z = record.z;
            } else {
                (object.transform.position as BrioVec2).setSilent(record.x, record.y);
                // Cached "static" layers rasterized the interpolated position: redraw them next frame
                object.transform.markDirty();
            }
            // Drop the reference so a pooled record does not keep a destroyed object alive
            record.object = undefined;
        }
        this.#interpolatedCount = 0;
    }

    /**
     * Composes the current frame (game content, then the active scene) onto the canvas without advancing the simulation.
     * Called automatically by the `update()` loop; useful for rendering a paused game or for tests.
     *
     * @example
     * ```ts
     * game.pause();
     * player.transform.position.x = 0;
     * game.renderFrame();
     * ```
     */
    public renderFrame(): void {
        if (!this.ctx) return;

        const renderConfig = this.#debugger.render;
        this.#frameDebug.showRenderBounds = renderConfig.showRenderBounds;
        this.#frameDebug.showCollisionBounds = renderConfig.showCollisionBounds;

        const sources = this.#frameSources;
        sources.length = 0;
        sources.push(this.#source);
        if (this.#activeScene) sources.push(this.#activeScene.compositorSource);

        this.#compositor.renderFrame(
            this.ctx,
            this.#width,
            this.#height,
            this.#scale,
            sources,
            this.#frameDebug,
        );

        if (renderConfig.fpsOverlay.enabled) {
            const overlay = renderConfig.fpsOverlay;
            this.#renderer.renderFPSOverlay(
                overlay.position,
                overlay.offset,
                overlay.size,
                overlay.backgroundColor,
                overlay.textColor,
            );
        }
    }

    /**
     * Appends `stage` to the lifecycle chain; stages after a failure are skipped and the error is reported once.
     */
    #chainLifecycle(stage: () => void | Promise<void>): void {
        this.#lifecyclePromise = this.#lifecyclePromise
            .then(() => {
                if (this.#currentState === GameState.ERROR) return;
                return stage();
            })
            .catch((err) => {
                this.#currentState = GameState.ERROR;
                this.#console.out("error", `An error occurred during the game lifecycle: ${err}.`);
            });
    }

    #bindObjectToECS(gameObject: BrioObject2D): void {
        if (!this.#ecsWorld.isAlive(gameObject.entityId, gameObject.entityGeneration)) {
            const entityId = this.#ecsWorld.createEntity(ComponentMask.TRANSFORM_2D);
            gameObject.entityId = entityId;
            gameObject.entityGeneration = this.#ecsWorld.generationOf(entityId);
            gameObject.transform.bindECS(this.#ecsWorld.storage, entityId);
        }
    }

    #bindObject3DToECS(gameObject3d: BrioObject3D): void {
        if (!this.#ecsWorld.storage.has3D) {
            throw this.#console.fatalError(
                `BrioObject3D '${gameObject3d.name}' cannot be added to a "2d" BrioGame; use the "3d" or "hybrid" preset.`,
            );
        }
        const bind = (object: BrioObject3D): void => {
            if (this.#ecsWorld.isAlive(object.entityId, object.entityGeneration)) return;
            const entityId = this.#ecsWorld.createEntity(ComponentMask.TRANSFORM_3D);
            object.entityId = entityId;
            object.entityGeneration = this.#ecsWorld.generationOf(entityId);
            object.transform.bindECS(this.#ecsWorld.storage, entityId);
        };
        // Parts (e.g. the children created by `BrioModel.instantiate`) get their own slots, so checkpoints cover them
        bind(gameObject3d);
        gameObject3d.forEachDescendant(bind);
    }

    /** Detaches a 3D object and its parts from their ECS slots without recycling them (used by restores). */
    #detachObject3D(object: BrioObject3D): void {
        const detach = (o: BrioObject3D): void => {
            o.transform.unbindECS();
            o.entityId = -1;
        };
        detach(object);
        object.forEachDescendant(detach);
    }

    /** Recycles the ECS slot of `object` (if still owned) and detaches its transform from the slot. */
    #releaseFromECS(object: BrioObject2D | BrioObject3D): void {
        if (this.#ecsWorld.isAlive(object.entityId, object.entityGeneration)) {
            this.#ecsWorld.destroyEntity(object.entityId);
        }
        object.transform.unbindECS();
        object.entityId = -1;
    }

    /** Finds the registered layer holding `object`, scanning layers only when the fast lookup misses. */
    #findLayerOf(object: BrioObject2D): BrioLayer | undefined {
        const known = this.#objectLayers.get(object);
        if (known && known.hasObject(object)) return known;
        const layers = this.#layers.list;
        for (let i = 0; i < layers.length; i++) {
            if (layers[i].hasObject(object)) {
                this.#objectLayers.set(object, layers[i]);
                return layers[i];
            }
        }
        return undefined;
    }

    #renderDebuggingGrid(): void {
        const render = this.#renderer;
        const renderConfig = this.#debugger.render;
        const gridWidth = renderConfig.grid.width;
        const gridHeight = renderConfig.grid.height;

        if (renderConfig.grid.enabled) render.renderGrid(gridWidth ?? 32, gridHeight ?? 32);
        if (renderConfig.grid.showAxisRulers) render.renderAxisRulers();
    }

    /**
     * LAYERS, CAMERAS & OBJECTS --------------------------------------------------------
     */

    /**
     * Registers a `BrioLayer` composition plane (replacing a layer with the same name).
     * Objects already added to the layer are rendered with it.
     *
     * @param layer Layer to register
     * @returns This `BrioGame` instance
     * @example
     * ```ts
     * game.addLayer(new BrioLayer({ name: "bg_far", order: -10, policy: "parallax", scrollFactor: { x: 0.2, y: 0.2 } }));
     * game.addLayer(new BrioLayer({ name: "hud", order: 100, policy: "ui" }));
     * ```
     */
    public addLayer(layer: BrioLayer): this {
        const previous = this.#layers.get(layer.name);
        if (previous && previous !== layer) {
            for (const obj of previous.getSortedObjects()) {
                if (!layer.hasObject(obj)) layer.addObject(obj);
            }
        }
        this.#layers.add(layer);
        for (const obj of layer.getSortedObjects()) {
            this.#objectLayers.set(obj, layer);
        }
        return this;
    }

    /**
     * Retrieves a registered `BrioLayer` by name.
     *
     * @param name Layer name
     * @returns Matching layer or `undefined`
     */
    public getLayer(name: string): BrioLayer | undefined {
        return this.#layers.get(name);
    }

    /**
     * Moves a registered `BrioObject2D` to the layer named `layerName`.
     *
     * @param object Object to move
     * @param layerName Destination layer name
     * @throws {Error} When `layerName` is not registered
     * @example
     * ```ts
     * game.setObjectLayer(dialogBox, "hud");
     * ```
     */
    public setObjectLayer(object: BrioObject2D, layerName: string): void {
        const target = this.#layers.get(layerName);
        if (!target) {
            throw this.#console.fatalError(`Layer '${layerName}' is not registered in BrioGame.`);
        }
        const current = this.#findLayerOf(object);
        if (current === target) return;
        current?.removeObject(object);
        target.addObject(object);
        this.#objectLayers.set(object, target);
    }

    /**
     * Registers a `BrioCamera2D` (one 2D pass per camera, clipped to `camera.viewport`) or a `BrioCamera3D`
     * (one 3D pass per camera). Registering 2D cameras enables split-screen and picture-in-picture layouts.
     *
     * @param camera Camera to register
     * @returns This `BrioGame` instance
     * @example
     * ```ts
     * game.addCamera(new BrioCamera2D("cam_p1", { x: 0, y: 0 }, { x: 640, y: 360 }, BrioViewport.fromPreset("split-horizontal-top")));
     * ```
     */
    public addCamera(camera: BrioCamera2D | BrioCamera3D): this {
        if (camera instanceof BrioCamera2D && !camera.random) camera.random = this.#random;
        if (camera instanceof BrioCamera3D) {
            this.#assets.cameras3D.add(camera);
        } else {
            this.#assets.cameras2D.add(camera);
        }
        return this;
    }

    /**
     * Unregisters a camera.
     *
     * @param camera Camera to remove
     * @returns `true` if the camera was registered
     */
    public removeCamera(camera: BrioCamera2D | BrioCamera3D): boolean {
        return camera instanceof BrioCamera3D
            ? this.#assets.cameras3D.remove(camera)
            : this.#assets.cameras2D.remove(camera);
    }

    /** Map of game-level `BrioLight` sources keyed by name (scenes keep their own lights). */
    public get lights(): ReadonlyMap<string, BrioLight> {
        return this.#lights.map;
    }

    /**
     * Registers a `BrioLight` used by the game-level 3D passes (replacing a light with the same name).
     * Without lights, 3D passes use the default rig (`BrioLight.createDefaultRig()`).
     *
     * @param light Light to add
     * @returns This `BrioGame` instance
     * @example
     * ```ts
     * game.addLight(new BrioLight("light_sun", "directional", { intensity: 1.5 }));
     * ```
     */
    public addLight(light: BrioLight): this {
        this.#lights.add(light);
        return this;
    }

    /**
     * Removes a game-level `BrioLight`.
     *
     * @param light Light to remove
     * @returns `true` if the light was registered
     */
    public removeLight(light: BrioLight): boolean {
        return this.#lights.remove(light);
    }

    /**
     * Registers a `BrioObject2D` or `BrioObject3D`, binding its transform to the ECS.
     * A `BrioObject2D` joins `layerName`, or keeps the registered layer it is already in, or joins `"default"`.
     * A `BrioObject2D` with zero size inherits the size of its preloaded sprite.
     *
     * @param object Object to register
     * @param layerName Optional destination layer name
     * @returns The registered object
     * @throws {Error} When `layerName` is not registered, or when adding a `BrioObject3D` to a `"2d"` game
     * @example
     * ```ts
     * const coin = game.addObject(new BrioObject2D("obj_coin", "spr_coin"), "pickups");
     * ```
     */
    public addObject<T extends BrioObject2D | BrioObject3D>(object: T, layerName?: string): T {
        if (object instanceof BrioObject3D) {
            this.#bindObject3DToECS(object);
            this.#assets.objects3d.add(object);
            return object;
        }

        const obj2D = object as BrioObject2D;
        if (obj2D.transform.size.x <= 0 && obj2D.transform.size.y <= 0) {
            const sprite = this.#assets.sprites.get(obj2D.sprite) ?? BrioSprite.getEmptyInstance();
            obj2D.transform.size.x = sprite.size.x;
            obj2D.transform.size.y = sprite.size.y;
        }

        this.#bindObjectToECS(obj2D);
        this.#assets.objects.set(obj2D.name, obj2D);

        if (layerName !== undefined) {
            this.setObjectLayer(obj2D, layerName);
        } else if (!this.#findLayerOf(obj2D)) {
            const fallback = this.#layers.get(DEFAULT_LAYER_NAME)!;
            fallback.addObject(obj2D);
            this.#objectLayers.set(obj2D, fallback);
        }
        return object;
    }

    /**
     * SCENE MANAGEMENT -----------------------------------------------------------------
     */

    /**
     * Registers a `BrioScene` instance in the game. If no scene is currently active, activates it
     * (running its `preload()` / `load()` first, see `setScene()`).
     *
     * @param scene `BrioScene` instance to register
     * @returns This `BrioGame` instance
     * @example
     * ```ts
     * const level1 = new BrioScene("scene_level_1");
     * game.addScene(level1);
     * ```
     */
    public addScene(scene: BrioScene): this {
        // Narrows the scene world to the preset so "2d" scenes allocate no 3D buffer (ADR 0004).
        scene.useLayout({ transform2D: true, transform3D: this.#dimension !== "2d" });
        this.#scenes.set(scene.name, scene);
        if (!this.#activeScene && !this.#pendingScene) {
            this.setScene(scene.name);
        }
        return this;
    }

    /**
     * Transitions from the currently active scene to the registered scene named `name`.
     * A scene without `preload()` / `load()` callbacks (or already loaded) is activated immediately. Otherwise
     * its assets are preloaded into the shared registries and its `load()` content is created first, after
     * every lifecycle stage queued before (`await game.ready()` resolves once the scene is active); the previous
     * scene keeps running meanwhile.
     *
     * @param name Target scene name
     * @returns This `BrioGame` instance
     * @throws {Error} When `name` is not registered in `game.scenes`
     * @example
     * ```ts
     * game.setScene("scene_game_over");
     * await game.ready();
     * ```
     */
    public setScene(name: string): this {
        const nextScene = this.#scenes.get(name);
        if (!nextScene) {
            throw this.#console.fatalError(`Scene '${name}' is not registered in BrioGame.`);
        }
        if (nextScene.isLoaded) {
            this.#pendingScene = undefined;
            this.#activateScene(nextScene);
            return this;
        }
        this.#pendingScene = nextScene;
        this.#chainLifecycle(async () => {
            const assets = nextScene.collectPreloadAssets();
            if (assets.length > 0) await this.#preloadAssets(assets);
            nextScene.mount(this.#assetLoaderParam());
            this.#console.out("info", `Scene '${nextScene.name}' loaded.`);
            // A later setScene() call wins over this one
            if (this.#pendingScene !== nextScene) return;
            this.#pendingScene = undefined;
            this.#activateScene(nextScene);
        });
        return this;
    }

    /** Makes `scene` the active scene, pausing the previous one; mounts a scene without callbacks on first use. */
    #activateScene(scene: BrioScene): void {
        // Scenes without load() still get an initial state, so restart() works for hand-built scenes
        scene.mount(this.#assetLoaderParam());
        if (this.#activeScene && this.#activeScene !== scene) {
            this.#activeScene.pause();
        }
        this.#activeScene = scene;
        scene.resume();
    }

    /**
     * INTERNAL & BINARY SNAPSHOT METHODS -----------------------------------------------
     */

    /** Captures the ECS bytes together with the handle of every registered object. */
    #captureState(): GameStateCapture {
        const objects2D: GameStateCapture["objects2D"] = [];
        this.#assets.objects.forEach((object) => {
            this.#bindObjectToECS(object);
            objects2D.push({ object, entityId: object.entityId, layer: this.#findLayerOf(object) });
        });
        const objects3D: GameStateCapture["objects3D"] = [];
        const parts3D: GameStateCapture["parts3D"] = [];
        for (const object of this.#assets.objects3d.list) {
            this.#bindObject3DToECS(object);
            objects3D.push({ object, entityId: object.entityId });
            object.forEachDescendant((part) => parts3D.push({ object: part, entityId: part.entityId }));
        }
        const scene = this.#activeScene
            ? { scene: this.#activeScene, state: this.#activeScene.captureState() }
            : undefined;
        return {
            bytes: BrioSerializer.captureSnapshot(this.#ecsWorld),
            objects2D,
            objects3D,
            parts3D,
            random: this.#random.state,
            scene,
        };
    }

    /**
     * Restores ECS bytes and re-adopts every captured object handle. Objects registered after the capture
     * are detached and unregistered; objects destroyed after the capture are registered again.
     * With `includeScene`, the scene active at capture time is reactivated and restored as well.
     */
    #restoreState(state: GameStateCapture, includeScene: boolean = true): void {
        this.#random.state = state.random;
        this.#fixedAccumulator = 0;
        if (includeScene && state.scene) {
            const { scene, state: sceneState } = state.scene;
            if (this.#scenes.get(scene.name) === scene) {
                this.#pendingScene = undefined;
                this.#activateScene(scene);
                scene.restoreState(sceneState);
            }
        }

        const captured2D = new Set<BrioObject2D>();
        for (const entry of state.objects2D) captured2D.add(entry.object);
        const captured3D = new Set<BrioObject3D>();
        for (const entry of state.objects3D) captured3D.add(entry.object);

        this.#assets.objects.forEach((object) => {
            if (captured2D.has(object)) return;
            this.#findLayerOf(object)?.removeObject(object);
            object.transform.unbindECS();
            object.entityId = -1;
        });
        for (const object of this.#assets.objects3d.list) {
            if (captured3D.has(object)) continue;
            this.#detachObject3D(object);
        }

        BrioSerializer.restoreSnapshot(this.#ecsWorld, state.bytes);
        const storage = this.#ecsWorld.storage;

        this.#assets.objects.clear();
        for (const { object, entityId, layer } of state.objects2D) {
            object.entityId = entityId;
            object.entityGeneration = this.#ecsWorld.generationOf(entityId);
            object.transform.bindECS(storage, entityId, true);
            this.#assets.objects.set(object.name, object);
            const target = layer && this.#layers.get(layer.name) === layer ? layer : undefined;
            const current = this.#findLayerOf(object);
            if (target && current !== target) {
                current?.removeObject(object);
                target.addObject(object);
                this.#objectLayers.set(object, target);
            } else if (!current) {
                const fallback = target ?? this.#layers.get(DEFAULT_LAYER_NAME)!;
                fallback.addObject(object);
                this.#objectLayers.set(object, fallback);
            }
        }

        this.#assets.objects3d.clear();
        for (const { object, entityId } of state.objects3D) {
            object.entityId = entityId;
            object.entityGeneration = this.#ecsWorld.generationOf(entityId);
            object.transform.bindECS(storage, entityId, true);
            this.#assets.objects3d.add(object);
        }
        for (const { object, entityId } of state.parts3D) {
            if (entityId < 0) continue;
            object.entityId = entityId;
            object.entityGeneration = this.#ecsWorld.generationOf(entityId);
            object.transform.bindECS(storage, entityId, true);
        }
    }

    /**
     * Captures a high-speed binary snapshot (`Uint8Array`) of the current `ECSWorld` state via `BrioSerializer`,
     * remembered as the state restored by `useSnapshot()` and `restart()`.
     *
     * @returns The captured `Uint8Array` binary snapshot
     * @example
     * ```ts
     * const snapshot = game.createSnapshot();
     * ```
     */
    public createSnapshot(): Uint8Array {
        this.#initialState = this.#captureState();
        return this.#initialState.bytes;
    }

    /**
     * Restores the `ECSWorld` and every registered object from the snapshot captured via `createSnapshot()`
     * (automatically captured after `load()`).
     *
     * @example
     * ```ts
     * game.useSnapshot();
     * ```
     */
    public useSnapshot(): void {
        if (this.#initialState) {
            this.#restoreState(this.#initialState);
        }
    }

    /**
     * EXTERNAL METHODS -----------------------------------------------------------------
     */

    /**
     * Stores an in-memory binary checkpoint of the ECS state and of the set of registered 2D/3D objects,
     * including the state of the active `BrioScene`.
     *
     * @example
     * ```ts
     * game.createCheckPoint();
     * ```
     */
    public createCheckPoint(): void {
        this.#checkpointState = this.#captureState();
    }

    /**
     * Restores all entities and `ECSWorld` state from the most recent checkpoint created via `createCheckPoint()`.
     * Objects spawned after the checkpoint are unregistered; objects destroyed after it are registered again.
     *
     * @returns `true` if a checkpoint existed and was restored, or `false` otherwise
     * @example
     * ```ts
     * game.restoreCheckPoint();
     * ```
     */
    public restoreCheckPoint(): boolean {
        if (!this.#checkpointState) {
            return false;
        }
        this.#restoreState(this.#checkpointState);
        return true;
    }

    /**
     * Pauses the active `update()` game loop and resets the frame timer so resuming does not cause a `deltaTime` spike.
     * Also suspends the shared `BrioAudioMixer` context (`BrioAudioMixer.suspend()`), so music and effects stop with
     * the game and a user gesture does not auto-unlock audio while the game stays paused.
     *
     * @example
     * ```ts
     * game.useKeyboard();
     * game.keyboard.customActions.set("Escape", () => {
     *     if (game.isRunning) game.pause();
     *     else game.resume();
     * });
     * ```
     */
    public pause(): void {
        if (this.#updateIsRunning) {
            this.#currentState = GameState.UNSET;
            this.#updateIsRunning = false;
            this.#deltaTimePreviousTime = 0;
            cancelAnimationFrame(this.#updateFrameId);
            this.#audioSuspended = true;
            BrioAudioMixer.suspend().catch(() => {});
            this.#console.out("info", "Game stopped!");
        }
    }

    /**
     * Resumes the `update()` game loop if it was previously paused, and resumes the `BrioAudioMixer` context that
     * `pause()` suspended (`BrioAudioMixer.resume()`). Browsers only allow resuming audio during or after a user
     * gesture: when called outside one, audio starts on the next gesture instead.
     *
     * @example
     * ```ts
     * game.useKeyboard();
     * game.keyboard.customActions.set("Escape", () => {
     *     if (game.isRunning) game.pause();
     *     else game.resume();
     * });
     * ```
     */
    public resume(): void {
        if (!this.#updateIsRunning) {
            this.#currentState = GameState.UPDATE;
            this.#updateIsRunning = true;
            this.#deltaTimePreviousTime = 0;
            if (this.#updateLoopLogic) {
                this.#updateFrameId = requestAnimationFrame(this.#updateLoopLogic);
            }
            this.#releaseAudio();
            this.#console.out("info", "Game resumed!");
        }
    }

    /**
     * Terminates the game session: cancels the animation loop, detaches input listeners, stops every registered
     * `BrioAudio`, clears all registered assets (sprites, atlases, audios, models, meshes, materials), layers,
     * cameras, lights and entities, and disposes the 3D backend (3D passes stay disabled afterwards). The shared
     * `BrioAudioMixer` is left unsuspended so another game can play audio.
     *
     * @example
     * ```ts
     * game.update((updater, dt) => {
     *     if (gameOver) game.end();
     * });
     * ```
     */
    public end(): void {
        // Disabling logs to prevent error messages during teardown
        this.#console.enabled = false;

        // Pausing the game update loop
        this.pause();

        // Removing input listeners
        this.#keyboardInstance?.removeListener();
        this.#mouseInstance?.removeListener();
        this.#touchInstance?.removeListener();

        // Detaching handles before the world is cleared
        this.#assets.objects.forEach((object) => {
            object.transform.unbindECS();
            object.entityId = -1;
        });
        for (const object of this.#assets.objects3d.list) {
            this.#detachObject3D(object);
        }

        // Silencing this session's sounds, then releasing the mixer hold taken by pause()
        this.#assets.audios.forEach(stopAudio);
        this.#releaseAudio();

        // Releasing the 3D backend (GPU buffers, textures, programs); a backend still initializing is
        // disposed when it resolves, because the session counter no longer matches
        this.#session++;
        if (this.#backend3D) {
            this.#backend3D.dispose();
            this.#backend3D = undefined;
            this.#compositor.configure3D(undefined, this.#assets.meshes, this.#assets.materials);
        }

        // Clearing asset and state registries
        this.#assets.audios.clear();
        this.#assets.models.clear();
        this.#assets.meshes.clear();
        this.#assets.materials.clear();
        this.#assets.cameras2D.clear();
        this.#assets.cameras3D.clear();
        this.#assets.tileMaps.clear();
        this.#assets.objects.clear();
        this.#assets.objects3d.clear();
        this.#assets.sprites.clear();
        this.#assets.atlases.clear();
        this.#layers.clear();
        this.#layers.add(new BrioLayer({ name: DEFAULT_LAYER_NAME, order: 0, policy: "dynamic" }));
        this.#lights.clear();
        this.#cloneCounters.clear();
        this.#keyboardState.clear();
        this.#keyboardPrevState.clear();
        this.#interpolated.length = 0;
        this.#interpolatedCount = 0;
        this.#timer.clear();
        this.#ecsWorld.clear();
        this.#initialState = undefined;
        this.#checkpointState = undefined;
        this.#console.loggedErrors.clear();

        this.#console.out("info", "Game ended!");
    }

    /** Resumes the mixer context if this game's `pause()` suspended it. */
    #releaseAudio(): void {
        if (!this.#audioSuspended) return;
        this.#audioSuspended = false;
        BrioAudioMixer.resume().catch(() => {});
    }

    /**
     * Restarts the game content from the initial binary snapshot captured after `load()`, and the active
     * `BrioScene` from the state captured after its own `load()` (`scene.restart()`).
     *
     * @example
     * ```ts
     * game.restart();
     * ```
     */
    public restart(): void {
        if (this.#initialState) this.#restoreState(this.#initialState, false);
        this.#activeScene?.restart();
        this.#deltaTimePreviousTime = 0;
    }

    /**
     * Removes a `BrioObject2D` / `BrioObject3D` (same as `destroy()`, with a console warning) or a preloaded `BrioSprite`
     * from the active game registries.
     *
     * @param target Object or sprite to remove
     * @example
     * ```ts
     * game.removeObject(enemy);
     * ```
     */
    public removeObject(target: BrioObject2D | BrioObject3D | BrioSprite): void {
        if (target instanceof BrioSprite) {
            if (this.#assets.sprites.delete(target.name)) {
                this.#console.out("warn", `${target.name} was removed from the loaded sprites!`);
            }
            return;
        }
        const registered =
            target instanceof BrioObject3D
                ? this.#assets.objects3d.get(target.name) === target
                : this.#assets.objects.get(target.name) === target;
        this.destroy(target);
        if (registered) {
            this.#console.out("warn", `${target.name} was removed from the scene!`);
        }
    }

    /**
     * Checks whether `targetObject` has moved completely outside the game screen bounds (scaled by `screenThreshold`).
     * Invokes `callbackFn` if provided, or pauses the game by default when `callbackFn` is omitted.
     *
     * @param targetObject The `BrioObject2D` to check against the viewport boundaries
     * @param screenThreshold Multiplier for the viewport boundary margin (`1` = exact screen edges, `2` = one screen width/height margin outside)
     * @param callbackFn Optional callback executed when `targetObject` is out of bounds
     * @example
     * ```ts
     * game.outbound(projectile, 1, () => {
     *     game.destroy(projectile);
     * });
     * ```
     */
    public outbound(
        targetObject: BrioObject2D,
        screenThreshold: number = 1,
        callbackFn?: () => void,
    ): void {
        if (!targetObject) {
            return;
        }

        const marginX = this.#width * (screenThreshold - 1);
        const marginY = this.#height * (screenThreshold - 1);
        const objWidth =
            (targetObject.transform.renderSize.x || targetObject.transform.size.x) * this.#scale;
        const objHeight =
            (targetObject.transform.renderSize.y || targetObject.transform.size.y) * this.#scale;

        if (
            targetObject.transform.position.x > this.#width + marginX ||
            targetObject.transform.position.x + objWidth < -marginX ||
            targetObject.transform.position.y > this.#height + marginY ||
            targetObject.transform.position.y + objHeight < -marginY
        ) {
            if (callbackFn) {
                callbackFn();
            } else {
                this.pause();
            }
        }
    }

    /**
     * Spawns a new clone of `targetObject` (e.g. a projectile or enemy prefab), naming it `"<name>-<index>"`
     * (skipping names already in use), copying its `transform` and collider through $O(1)$ ECS slot pooling,
     * registering it in `game.gameObjects`, and placing it in the same `BrioLayer` as the prefab.
     *
     * @param targetObject Template/prefab `BrioObject2D` to instantiate
     * @returns The newly spawned `BrioObject2D` instance
     * @example
     * ```ts
     * const bullet = game.instantiate(projectilePrefab);
     * bullet.transform.position = { x: player.transform.position.x, y: player.transform.position.y };
     * ```
     */
    public instantiate(targetObject: BrioObject2D): BrioObject2D {
        const prefab = this.#assets.objects.get(targetObject.name) ?? targetObject;
        this.#bindObjectToECS(prefab);

        let index = this.#cloneCounters.get(prefab.name) ?? 0;
        let cloneName: string;
        do {
            index++;
            cloneName = `${prefab.name}-${index}`;
        } while (this.#assets.objects.has(cloneName));
        this.#cloneCounters.set(prefab.name, index);

        const newObject = new BrioObject2D(cloneName, prefab.sprite, prefab.transform.layer);
        BrioObject2D.copyTransform(prefab, newObject);

        // Allocate pooled ECS slot, copy template component data in O(1), then bind the facade to it
        const pooledEntityId = this.#ecsWorld.instantiateFrom(prefab.entityId);
        newObject.entityId = pooledEntityId;
        newObject.entityGeneration = this.#ecsWorld.generationOf(pooledEntityId);
        newObject.transform.bindECS(this.#ecsWorld.storage, pooledEntityId);

        // Cloning collider
        if (prefab.collision) {
            newObject.addCollisionMask(
                prefab.collision.shape,
                prefab.collision.colliderType,
                prefab.collision.pos.x,
                prefab.collision.pos.y,
                prefab.collision.size.x,
                prefab.collision.size.y,
            );
            if (newObject.collision) {
                newObject.collision.enabled = prefab.collision.enabled;
            }
        }

        newObject.instanceId = index;
        this.#assets.objects.set(newObject.name, newObject);

        const layer = this.#findLayerOf(prefab) ?? this.#layers.get(DEFAULT_LAYER_NAME)!;
        layer.addObject(newObject);
        this.#objectLayers.set(newObject, layer);

        return newObject;
    }

    /**
     * Destroys an active `BrioObject2D` or `BrioObject3D`: removes it from the game registries and its `BrioLayer`,
     * returns its `entityId` to the `ECSWorld` pool, and detaches its transform so later writes through a stale
     * reference cannot corrupt the entity that reuses the slot. Shared `BrioSprite` assets are never deleted.
     *
     * @param targetObject The object instance to destroy
     * @example
     * ```ts
     * if (BrioCollision.isColliding(enemy, projectile)) {
     *     game.destroy(projectile);
     * }
     * ```
     */
    public destroy(targetObject: BrioObject2D | BrioObject3D): void {
        if (!targetObject) return;

        if (targetObject instanceof BrioObject3D) {
            this.#assets.objects3d.remove(targetObject);
            targetObject.forEachDescendant((part) => this.#releaseFromECS(part));
        } else {
            if (this.#assets.objects.get(targetObject.name) === targetObject) {
                this.#assets.objects.delete(targetObject.name);
            }
            this.#findLayerOf(targetObject)?.removeObject(targetObject);
            this.#objectLayers.delete(targetObject);
        }
        this.#releaseFromECS(targetObject);
    }

    /**
     * Translates the global 2D canvas transformation matrix to `(px, py)`.
     * Prefer `BrioCamera2D` for scrolling: cameras also drive culling, parallax, and split-screen viewports.
     *
     * @param px Horizontal translation in pixels
     * @param py Vertical translation in pixels
     * @example
     * ```ts
     * game.translate(-camera.pos.x, -camera.pos.y);
     * ```
     */
    public translate(px: number, py: number): void {
        if (this.ctx) {
            this.ctx.setTransform(1, 0, 0, 1, px, py);
        }
    }

    // -> GAME UTILITIES

    /**
     * Resizes the game canvas to match `window.innerWidth` and `window.innerHeight` immediately
     * and automatically updates the dimensions whenever the browser window is loaded or resized.
     *
     * @example
     * ```ts
     * game.useFullScreen();
     * ```
     */
    public useFullScreen(): void {
        const applyFullScreen = () => {
            if (window.innerWidth > 0 && window.innerHeight > 0) {
                this.#width = window.innerWidth;
                this.#height = window.innerHeight;
                this.#canvas.width = this.#width;
                this.#canvas.height = this.#height;
            }
        };

        applyFullScreen();
        window.addEventListener("load", applyFullScreen);
        window.addEventListener("resize", applyFullScreen);
    }

    /**
     * Resets the entire 2D canvas rendering context state and clears all drawn pixels.
     *
     * @example
     * ```ts
     * game.useClearScreen();
     * ```
     */
    public useClearScreen(): void {
        if (this.ctx) {
            this.ctx.reset();
        }
    }

    /**
     * Initializes the `BrioKeyboard` input subsystem and registers keyboard event listeners on `window`.
     * Must be called before accessing `game.keyboard`.
     *
     * @example
     * ```ts
     * game.useKeyboard();
     * ```
     */
    public useKeyboard(): void {
        this.#keyboardInstance = new BrioKeyboard(
            this.#keyboardState,
            this.#keyboardPrevState,
            this.#console,
        );
    }

    /**
     * Initializes the `BrioMouse` input subsystem on the game canvas.
     * Must be called before accessing `game.mouse`.
     *
     * @example
     * ```ts
     * game.useMouse();
     * ```
     */
    public useMouse(): void {
        this.#mouseInstance = new BrioMouse(this.#canvas);
    }

    /**
     * Initializes the `BrioTouch` multi-touch input subsystem on the game canvas.
     * Must be called before accessing `game.touch`.
     *
     * @example
     * ```ts
     * game.useTouch();
     * ```
     */
    public useTouch(): void {
        this.#touchInstance = new BrioTouch(this.#canvas);
    }

    /**
     * Initializes the `BrioGamepad` input subsystem. Connected gamepads are polled once per frame, at the start of
     * the frame step, so `game.gamepad` reads a consistent snapshot during fixed steps and the `update()` callback.
     * Must be called before accessing `game.gamepad`.
     *
     * @example
     * ```ts
     * game.useGamepad();
     * ```
     */
    public useGamepad(): void {
        this.#gamepadInstance = new BrioGamepad();
    }

    // #endregion --> METHODS
}
