import { BrioSprite } from "../assets/BrioSprite";
import { BrioModel } from "../assets/BrioModel";
import { BrioMesh } from "../assets/BrioMesh";
import { BrioMaterial } from "../assets/BrioMaterial";
import { BrioTileMap } from "../assets/BrioTileMap";
import { BrioObject2D, BrioObject2DState } from "../objects/BrioObject2D";
import { BrioObject3D, BrioObject3DState } from "../objects/BrioObject3D";
import { BrioLight } from "../objects/BrioLight";
import { BrioKeyboard } from "../input/BrioKeyboard";
import { BrioMouse } from "../input/BrioMouse";
import { BrioTouch } from "../input/BrioTouch";
import { BrioGamepad } from "../input/BrioGamepad";
import { BrioInputMap } from "../input/BrioInputMap";
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
import { BrioSpriteSheet } from "../assets/BrioSpriteSheet";
import type { BrioTexture } from "../assets/BrioTexture";
import { ECSWorld } from "../ecs/ECSWorld";
import { ComponentMask } from "../ecs/ComponentStorage";
import { BrioTimer } from "../core/BrioTimer";
import { BrioScene, BrioSceneState } from "../core/BrioScene";
import { BrioSerializer } from "../storage/BrioSerializer";
import { BrioCollision } from "../math/BrioCollision";
import { CollisionEventSystem } from "../physics/BrioCollisionEvents";

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
    /**
     * Canvas pixels per logical pixel. `"auto"` (the default) follows `window.devicePixelRatio`, capped at
     * `maxPixelRatio`, so the game stays sharp on high-DPI screens while gameplay coordinates stay in logical pixels.
     * `1` renders exactly `width x height` canvas pixels (the behavior of BrioJS 0.1).
     */
    pixelRatio?: number | "auto";
    /** Upper bound of the `"auto"` pixel ratio (defaults to `2`), limiting fill cost on very dense screens. */
    maxPixelRatio?: number;
    /** Pauses the game while its page is hidden and resumes it when visible (defaults to `true`). */
    pauseWhenHidden?: boolean;
}

/**
 * How `game.useFullScreen()` adapts the game to the browser window:
 * - `"resize"`: the logical size becomes the window size (more world is visible on bigger windows);
 * - `"fit"`: the logical size is kept and the canvas is scaled uniformly to the largest size that fits the window
 *   (letterboxed), rendering at the displayed resolution so it stays sharp.
 */
export type FullScreenMode = "resize" | "fit";

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
    /** Retrieves a preloaded `BrioSpriteSheet` by its name, or `undefined` if not found. */
    getSpriteSheet: (sheetName: string) => BrioSpriteSheet | undefined;
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
export type PreloadAsset =
    | BrioSprite
    | BrioSpriteSheet
    | BrioAudio
    | BrioAtlas
    | BrioModel
    | BrioMesh
    | BrioMaterial;

/**
 * Progress of a `preload()` (of the game or of a scene), reported by `game.onLoadProgress()` after every asset.
 */
export interface LoadProgress {
    /** Assets finished so far in this preload. */
    readonly loaded: number;
    /** Assets requested by this preload (procedural meshes and materials count as loaded immediately). */
    readonly total: number;
    /** `loaded / total`, from `0` to `1`. */
    readonly ratio: number;
    /** Name of the asset that just finished. */
    readonly asset: string;
    /** Name of the scene whose `preload()` is running, or `undefined` for the game's own `preload()`. */
    readonly scene: string | undefined;
}

/** Name of the layer every `BrioObject2D` joins when no other layer is specified. */
export const DEFAULT_LAYER_NAME = "default";

/** Captured ECS bytes plus the object handles needed to re-adopt them on restore. */
interface GameStateCapture {
    bytes: Uint8Array;
    /** Registered 2D objects with their slot, layer and the state kept outside the ECS (sprite, flip, ...). */
    objects2D: Array<{
        object: BrioObject2D;
        entityId: number;
        layer?: BrioLayer;
        state: BrioObject2DState;
    }>;
    objects3D: Array<{ object: BrioObject3D; entityId: number; state: BrioObject3DState }>;
    /** Descendant parts of the captured 3D objects (bound to the ECS, but not registered as roots). */
    parts3D: Array<{ object: BrioObject3D; entityId: number; state: BrioObject3DState }>;
    /** Tiles of every registered tile map (tiles changed by `setTile()` are restored too). */
    tileMaps: Array<{ map: BrioTileMap; tiles: Uint32Array }>;
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

/**
 * Transform values interpolated between fixed steps: position, rotation (2D angle in `rz`, 3D quaternion in
 * `qx..qw`) and scale. Used both for the state before the latest fixed step and, pooled, for the simulated state
 * temporarily replaced while rendering.
 */
interface InterpolatedRecord {
    object: BrioObject2D | BrioObject3D | undefined;
    x: number;
    y: number;
    z: number;
    rz: number;
    /** 3D Euler angles, restored exactly so interpolation never drifts the simulated rotation. */
    ex: number;
    ey: number;
    ez: number;
    qx: number;
    qy: number;
    qz: number;
    qw: number;
    sx: number;
    sy: number;
    sz: number;
}

/** Scratch quaternion written through `transform.quaternion` by interpolation (no allocation per frame). */
const SCRATCH_QUAT = { x: 0, y: 0, z: 0, w: 1 };
const SCRATCH_EULER = { x: 0, y: 0, z: 0 };

function createInterpolatedRecord(): InterpolatedRecord {
    return {
        object: undefined,
        x: 0,
        y: 0,
        z: 0,
        rz: 0,
        ex: 0,
        ey: 0,
        ez: 0,
        qx: 0,
        qy: 0,
        qz: 0,
        qw: 1,
        sx: 1,
        sy: 1,
        sz: 1,
    };
}

/** Copies the interpolated transform values of `object` into `record`. */
function readTransformState(object: BrioObject2D | BrioObject3D, record: InterpolatedRecord): void {
    if (object instanceof BrioObject3D) {
        const t = object.transform;
        record.x = t.position.x;
        record.y = t.position.y;
        record.z = t.position.z;
        record.qx = t.quaternion.x;
        record.qy = t.quaternion.y;
        record.qz = t.quaternion.z;
        record.qw = t.quaternion.w;
        record.ex = t.rotation.x;
        record.ey = t.rotation.y;
        record.ez = t.rotation.z;
        record.sx = t.scale.x;
        record.sy = t.scale.y;
        record.sz = t.scale.z;
    } else {
        const t = object.transform;
        record.x = t.position.x;
        record.y = t.position.y;
        record.rz = t.rotation;
        record.sx = t.scale.x;
        record.sy = t.scale.y;
    }
}

/** Whether the transform values in `a` and `b` are identical (nothing to interpolate). */
function sameTransformState(a: InterpolatedRecord, b: InterpolatedRecord): boolean {
    return (
        a.x === b.x &&
        a.y === b.y &&
        a.z === b.z &&
        a.rz === b.rz &&
        a.qx === b.qx &&
        a.qy === b.qy &&
        a.qz === b.qz &&
        a.qw === b.qw &&
        a.sx === b.sx &&
        a.sy === b.sy &&
        a.sz === b.sz
    );
}

/** Scratch world position of `colliderExtent2D`. */
const EXTENT_POSITION = { x: 0, y: 0 };

/** X extent of an enabled 2D collider (sweep of the collision event pass). */
function colliderExtent2D(object: BrioObject2D, out: { minX: number; maxX: number }): boolean {
    const collision = object.collision;
    if (!collision || !collision.enabled || object.entityId < 0) return false;
    const transform = object.transform;
    // Children are swept at their world position, like BrioCollision tests them
    const x = transform.parent
        ? transform.getWorldPosition(EXTENT_POSITION).x
        : transform.position.x;
    out.minX = x + collision.pos.x;
    out.maxX = out.minX + collision.size.x;
    return true;
}

/** X extent of an enabled 3D collider (sweep of the collision event pass). */
function colliderExtent3D(object: BrioObject3D, out: { minX: number; maxX: number }): boolean {
    const collision = object.collision;
    if (!collision || !collision.enabled || object.entityId < 0) return false;
    out.minX = object.transform.position.x + collision.pos.x;
    out.maxX = out.minX + collision.size.x;
    return true;
}

function isColliding2D(a: BrioObject2D, b: BrioObject2D): boolean {
    return BrioCollision.isColliding(a, b);
}

function isColliding3D(a: BrioObject3D, b: BrioObject3D): boolean {
    return BrioCollision.isColliding3D(a, b);
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
    /** Requested pixel ratio (`"auto"` follows `devicePixelRatio`). */
    #pixelRatioSetting: number | "auto" = "auto";
    #maxPixelRatio: number = 2;
    /** CSS scale applied by `useFullScreen("fit")` (`1` otherwise). */
    #displayScale: number = 1;
    /** Window listener installed by `useFullScreen()` (removed by `end()` or by the next call). */
    #fullScreenListener?: () => void;
    // #endregion - CANVAS

    // #region - GAME-STATE-LOGIC
    /** Current lifecycle stage (`UNSET -> PRELOAD -> LOAD -> UPDATE -> ERROR`). */
    #currentState: GameState = GameState.UNSET;
    /** Sequential Promise chain coordinating `preload() -> load() -> update()`. */
    #lifecyclePromise: Promise<void> = Promise.resolve();
    /** Error of the lifecycle stage that failed (rethrown by `ready()`). */
    #lifecycleError?: Error;
    readonly #errorListeners: Array<(error: Error) => void> = [];
    #pauseWhenHidden: boolean = true;
    /** Whether the current pause was taken by `pauseWhenHidden` (resumed when the page is visible again). */
    #hiddenPaused: boolean = false;
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
    /** Who requested each preloaded asset (the game itself or scenes); assets nobody owns any more are unloaded. */
    readonly #assetOwners = new Map<PreloadAsset, Set<BrioGame | BrioScene>>();
    readonly #progressListeners: Array<(progress: LoadProgress) => void> = [];
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
    /** Transform before the latest fixed step, per object (render interpolation). */
    #previousPositions = new WeakMap<BrioObject2D | BrioObject3D, InterpolatedRecord>();
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
    /** Contact trackers behind `onCollisionEnter` / `onCollisionStay` / `onCollisionExit`. */
    readonly #collisions2D = new CollisionEventSystem<BrioObject2D>(
        isColliding2D,
        colliderExtent2D,
    );
    readonly #collisions3D = new CollisionEventSystem<BrioObject3D>(
        isColliding3D,
        colliderExtent3D,
    );
    readonly #addCollider2DVisitor = (object: BrioObject2D): void => {
        this.#collisions2D.add(object);
    };
    readonly #addCollider3DVisitor = (object: BrioObject3D): void => {
        this.#collisions3D.add(object);
    };
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
    /** Action map over the controllers enabled by `useKeyboard()` / `useMouse()` / `useTouch()` / `useGamepad()`. */
    readonly #input = new BrioInputMap();
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
            this.#pixelRatioSetting = widthOrConfig.pixelRatio ?? "auto";
            this.#maxPixelRatio = Math.max(1, widthOrConfig.maxPixelRatio ?? 2);
            this.#pauseWhenHidden = widthOrConfig.pauseWhenHidden ?? true;
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
        // Touch gestures on the canvas belong to the game: no page scroll, pinch zoom or text selection
        this.#canvas.style.touchAction = "none";
        this.#canvas.style.userSelect = "none";
        this.#applyCanvasSize();

        // Canvas 2D context configuration
        this.ctx = this.#canvas.getContext("2d", this.#ctxSettings);

        container.appendChild(this.#canvas);
        if (typeof document !== "undefined") {
            document.addEventListener("visibilitychange", this.#onVisibilityChange);
        }

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
     * Canvas pixels per logical pixel actually used for rendering: the configured `pixelRatio` (or
     * `devicePixelRatio` capped at `maxPixelRatio` for `"auto"`) times the scale applied by `useFullScreen("fit")`.
     * Game logic, cameras, input and `game.width` / `game.height` always use logical pixels.
     *
     * @example
     * ```ts
     * console.log(game.pixelRatio); // 2 on a typical high-DPI laptop
     * game.pixelRatio = 1; // render exactly width x height canvas pixels
     * ```
     */
    public get pixelRatio(): number {
        return this.#basePixelRatio() * this.#displayScale;
    }
    public set pixelRatio(value: number | "auto") {
        this.#pixelRatioSetting = value === "auto" ? "auto" : Math.max(0.25, value);
        this.#applyCanvasSize();
    }

    /** Canvas element the game renders into (mounted in the container given to the constructor). */
    public get canvas(): HTMLCanvasElement {
        return this.#canvas;
    }

    #basePixelRatio(): number {
        if (this.#pixelRatioSetting !== "auto") return this.#pixelRatioSetting;
        const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
        return Math.min(Math.max(1, dpr), this.#maxPixelRatio);
    }

    /** Sizes the canvas backing store (logical size x pixel ratio) and its CSS size (logical size x display scale). */
    #applyCanvasSize(): void {
        const ratio = this.pixelRatio;
        const backingWidth = Math.max(1, Math.round(this.#width * ratio));
        const backingHeight = Math.max(1, Math.round(this.#height * ratio));
        if (this.#canvas.width !== backingWidth) this.#canvas.width = backingWidth;
        if (this.#canvas.height !== backingHeight) this.#canvas.height = backingHeight;
        this.#canvas.style.width = `${this.#width * this.#displayScale}px`;
        this.#canvas.style.height = `${this.#height * this.#displayScale}px`;
    }

    /** Maps logical pixels to canvas pixels on the main context (start of every frame). */
    #applyBaseTransform(): void {
        const ratio = this.pixelRatio;
        this.ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    /**
     * Changes the logical size of the game (`game.width` / `game.height`); the canvas, cameras without an explicit
     * size and `"static"` layer caches follow on the next frame.
     *
     * @param width New logical width in pixels
     * @param height New logical height in pixels
     * @example
     * ```ts
     * game.resize(1280, 720);
     * ```
     */
    public resize(width: number, height: number): void {
        this.#width = Math.max(1, Math.abs(width));
        this.#height = Math.max(1, Math.abs(height));
        this.#applyCanvasSize();
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
     * Map of preloaded `BrioSpriteSheet` assets keyed by name (their texture is decoded, ready for tile maps).
     */
    public get loadedSpriteSheets(): Map<string, BrioSpriteSheet> {
        return this.#assets.spriteSheets;
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
    /**
     * Action map (`BrioInputMap`) of this game: bind gameplay actions to keys, mouse buttons, gamepad buttons or
     * axes and touch, then query the action instead of the device. Controllers enabled with `useKeyboard()`,
     * `useMouse()`, `useTouch()` and `useGamepad()` are attached automatically, and edges (`isPressed` / `isUp`)
     * follow the same frame boundary as the controllers. Bindings can be changed at runtime and saved with
     * `toJSON()` / `load()`.
     *
     * @example
     * ```ts
     * game.useKeyboard();
     * game.useGamepad();
     * game.input
     *     .bind("jump", " ", "w", BrioInputMap.padButton("south"))
     *     .bind("left", "ArrowLeft", "a", BrioInputMap.padAxis(0, -1))
     *     .bind("right", "ArrowRight", "d", BrioInputMap.padAxis(0, 1));
     *
     * game.update((updater, dt) => {
     *     player.transform.position.x += game.input.axis("left", "right") * 200 * dt;
     *     if (game.input.isPressed("jump")) jump();
     * });
     * ```
     */
    public get input(): BrioInputMap {
        return this.#input;
    }

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
     * A game without external assets may return an empty array (or skip `preload()` entirely). When an asset fails
     * to load, the lifecycle enters `GameState.ERROR` with an `Error` naming the asset; `ready()` rejects with it.
     *
     * @param callbackFn Function returning the assets to preload (may be empty)
     * @returns This `BrioGame` instance for method chaining
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

            const assets = callbackFn() ?? [];
            if (assets.length > 0) await this.#preloadAssets(assets, this);

            this.#console.out("info", "Preload step complete!");
        });

        return this;
    }

    /**
     * Loads `assets` into the shared registries (used by `preload()` and by `BrioScene.preload()`), recording
     * `owner` so `removeScene()` can unload what no other owner still uses.
     */
    async #preloadAssets(assets: PreloadAsset[], owner: BrioGame | BrioScene): Promise<void> {
        for (const asset of assets) {
            let owners = this.#assetOwners.get(asset);
            if (!owners) {
                owners = new Set();
                this.#assetOwners.set(asset, owners);
            }
            owners.add(owner);
        }
        const sceneName = owner instanceof BrioScene ? owner.name : undefined;
        const total = assets.length;
        let loaded = 0;
        const progress = (name: string): void => {
            loaded++;
            if (this.#progressListeners.length === 0) return;
            const event: LoadProgress = {
                loaded,
                total,
                ratio: total > 0 ? loaded / total : 1,
                asset: name,
                scene: sceneName,
            };
            for (const listener of this.#progressListeners.slice()) listener(event);
        };

        const sprites = assets.filter((asset): asset is BrioSprite => asset instanceof BrioSprite);
        const audios = assets.filter((asset): asset is BrioAudio => asset instanceof BrioAudio);
        const spriteAtlases = assets.filter(
            (asset): asset is BrioAtlas => asset instanceof BrioAtlas,
        );
        const models = assets.filter((asset): asset is BrioModel => asset instanceof BrioModel);
        const sheets = assets.filter(
            (asset): asset is BrioSpriteSheet => asset instanceof BrioSpriteSheet,
        );

        for (const asset of assets) {
            if (asset instanceof BrioMesh) {
                this.#assets.meshes.set(asset.name, asset);
                progress(asset.name);
            } else if (asset instanceof BrioMaterial) {
                this.#assets.materials.set(asset.name, asset);
                progress(asset.name);
            }
        }

        const spriteLoadPromises = sprites.map((sprite) => {
            return new Promise<void>((resolve, reject) => {
                const onLoaded = () => {
                    sprite.size = create(sprite.element.width, sprite.element.height);
                    this.#assets.sprites.set(sprite.name, sprite);
                    this.#console.out("log", `Sprite: ${sprite.name} sucessfully preloaded.`);
                    progress(sprite.name);
                    resolve();
                };
                // Data URLs and cached images may already be decoded before the handler is attached
                if (sprite.element.complete && sprite.element.naturalWidth > 0) {
                    onLoaded();
                    return;
                }
                sprite.element.onload = onLoaded;
                sprite.element.onerror = () => {
                    reject(
                        new Error(
                            `Failed to load the sprite '${sprite.name}' from '${sprite.element.src}'.`,
                        ),
                    );
                };
            });
        });

        const spriteAtlasPromises = spriteAtlases.map(async (atlas) => {
            await atlas.mount();
            this.#assets.atlases.set(atlas.name, atlas);
            this.#console.out("log", `Atlas: ${atlas.name} sucessfully preloaded.`);
            progress(atlas.name);
        });

        const audioLoadPromises = audios.map(async (audio) => {
            await audio.load();
            this.#assets.audios.set(audio.name, audio);
            progress(audio.name);
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
            progress(model.name);
        });

        const sheetPromises = sheets.map(async (sheet) => {
            try {
                await sheet.texture.decode();
            } catch (err) {
                throw new Error(
                    `Failed to load the sprite sheet '${sheet.name}' from '${sheet.texture.src}'.`,
                    { cause: err },
                );
            }
            this.#assets.spriteSheets.set(sheet.name, sheet);
            progress(sheet.name);
        });

        await Promise.all(sheetPromises);
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
                    this.addTileMap(item);
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
            getSpriteSheet: (sheetName: string) => {
                const sheet = this.#assets.spriteSheets.get(sheetName);
                if (!sheet) {
                    this.#console.out(
                        "error",
                        `Named sprite sheet asset '${sheetName}' was not found in the preloaded resources, check if you preloaded it correctly and gave it the right name.`,
                    );
                }
                return sheet;
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
                    this.#maxDeltaTime > 0
                        ? Math.min(rawDeltaTime, this.#maxDeltaTime)
                        : rawDeltaTime;

                try {
                    this.#step(deltaTime, rawDeltaTime, callbackFn);
                } catch (err) {
                    // An exception would otherwise skip the next requestAnimationFrame and freeze the game silently
                    this.#handleRuntimeError(err);
                    return;
                }

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
     * Rejects with the `Error` of the stage that failed (for instance a sprite that could not be loaded); the game
     * then stays in `GameState.ERROR` and later stages are skipped.
     *
     * @returns Promise resolved after the current lifecycle chain
     * @example
     * ```ts
     * game.preload(...).load(...);
     * try {
     *     await game.ready();
     * } catch (error) {
     *     showLoadingError(error);
     * }
     * ```
     */
    public ready(): Promise<void> {
        return this.#lifecyclePromise.then(this.#throwLifecycleError);
    }

    /** `Error` that moved the lifecycle into `GameState.ERROR`, if any. */
    public get lifecycleError(): Error | undefined {
        return this.#lifecycleError;
    }

    /**
     * Registers a listener called when the running game stops because an exception escaped a callback of the frame
     * (`update()`, `fixedUpdate()`, a scene, a collision listener, ...). The game also logs the error to the browser
     * console with its stack and draws a short message over the canvas.
     *
     * @param listener Callback receiving the error
     * @returns Function that unregisters the listener
     * @example
     * ```ts
     * game.onError((error) => showCrashScreen(error.message));
     * ```
     */
    public onError(listener: (error: Error) => void): () => void {
        this.#errorListeners.push(listener);
        return () => {
            const index = this.#errorListeners.indexOf(listener);
            if (index >= 0) this.#errorListeners.splice(index, 1);
        };
    }

    /** Stops the loop after an exception in the frame, reports it and paints it over the canvas. */
    #handleRuntimeError(err: unknown): void {
        const error = err instanceof Error ? err : new Error(String(err));
        this.#currentState = GameState.ERROR;
        this.#updateIsRunning = false;
        this.#lifecycleError = error;
        cancelAnimationFrame(this.#updateFrameId);
        // Always visible, even with game.debugging.console disabled: this is the student's only clue
        console.error(
            "BrioJS: the game stopped because a frame callback threw an exception.",
            error,
        );
        const ctx = this.ctx;
        if (ctx) {
            const ratio = this.pixelRatio;
            ctx.save();
            ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
            ctx.globalAlpha = 0.85;
            ctx.fillStyle = "#111827";
            ctx.fillRect(0, 0, this.#width, Math.min(this.#height, 64));
            ctx.globalAlpha = 1;
            ctx.fillStyle = "#fca5a5";
            ctx.font = "bold 14px sans-serif";
            ctx.textBaseline = "top";
            ctx.fillText(
                `The game stopped: ${error.message}`.slice(0, 120),
                10,
                10,
                this.#width - 20,
            );
            ctx.fillStyle = "#e5e7eb";
            ctx.font = "12px sans-serif";
            ctx.fillText("See the browser console for the stack trace.", 10, 34, this.#width - 20);
            ctx.restore();
        }
        for (const listener of this.#errorListeners.slice()) {
            try {
                listener(error);
            } catch (listenerError) {
                console.error("BrioJS: an onError listener threw.", listenerError);
            }
        }
    }

    /**
     * Whether the game pauses while its page is hidden (another tab, minimized window) and resumes when it is
     * visible again, so music and simulation do not run in the background.
     *
     * @default true
     * @example
     * ```ts
     * game.pauseWhenHidden = false; // keep running (e.g. a networked game)
     * ```
     */
    public get pauseWhenHidden(): boolean {
        return this.#pauseWhenHidden;
    }
    public set pauseWhenHidden(value: boolean) {
        this.#pauseWhenHidden = value;
        if (!value && this.#hiddenPaused) {
            this.#hiddenPaused = false;
            this.resume();
        }
    }

    readonly #onVisibilityChange = (): void => {
        if (typeof document === "undefined") return;
        if (document.hidden) {
            if (this.#pauseWhenHidden && this.#updateIsRunning) {
                this.pause();
                this.#hiddenPaused = true;
            }
        } else if (this.#hiddenPaused) {
            this.#hiddenPaused = false;
            this.resume();
        }
    };

    /** Bound once so `ready()` passes no new closure per call. */
    readonly #throwLifecycleError = (): void => {
        if (this.#lifecycleError) throw this.#lifecycleError;
    };

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
        this.#applyBaseTransform();
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

        // Active scene update, then collision events, then game-level cameras (follow, bounds, shake)
        this.#activeScene?.step(deltaTime);
        this.#dispatchCollisionEvents();
        const cameras = this.#assets.cameras2D.list;
        for (let i = 0; i < cameras.length; i++) {
            cameras[i].update(deltaTime);
        }

        const interpolating = this.#interpolate && this.#fixedTimestep > 0;
        if (interpolating) this.#applyInterpolation();
        this.renderFrame();
        if (interpolating) this.#restoreInterpolation();

        // Close the input frame: the action map reads the controllers' latched edges first, then the controllers
        // consume them and snapshot the current state for next frame's isPressed / isUp
        this.#input.endFrame();
        this.#keyboardInstance?.endFrame();
        this.#mouseInstance?.endFrame();
        this.#gamepadInstance?.endFrame();
        // Global key states (BrioKeyboard.globalIsUp) roll over at the same point as the per-instance ones
        BrioKeyboard.syncGlobalFrame();
    }

    /** Detects contacts among the game and active-scene objects and calls their collision listeners. */
    #dispatchCollisionEvents(): void {
        const scene = this.#activeScene;
        const collisions2D = this.#collisions2D;
        collisions2D.begin();
        this.#assets.objects.forEach(this.#addCollider2DVisitor);
        scene?.objects2D.forEach(this.#addCollider2DVisitor);
        collisions2D.update();

        if (this.#dimension === "2d") return;
        const collisions3D = this.#collisions3D;
        collisions3D.begin();
        const objects3D = this.#assets.objects3d.list;
        for (let i = 0; i < objects3D.length; i++) collisions3D.add(objects3D[i]);
        scene?.objects3D.forEach(this.#addCollider3DVisitor);
        collisions3D.update();
    }

    /** Runs as many fixed steps as the accumulated time allows (at most `maxFixedSteps`). */
    #runFixedSteps(deltaTime: number): void {
        const scene = this.#activeScene;
        const sceneFixed = scene !== undefined && scene.hasFixedUpdate;
        if (!this.#fixedCallback && !sceneFixed) return;
        // A scene with onFixedUpdate() gets the default rate even when the game registered none (D-18)
        if (this.#fixedTimestep <= 0) {
            if (!sceneFixed) return;
            this.fixedTimestep = 1 / 60;
        }
        const step = this.#fixedTimestep;
        this.#fixedAccumulator += deltaTime;
        let steps = 0;
        while (this.#fixedAccumulator >= step && steps < this.#maxFixedSteps) {
            if (this.#interpolate) this.#forEachInterpolable(this.#rememberPositionVisitor);
            this.#fixedCallback?.(this.#updater, step);
            if (sceneFixed) scene.fixedStep(step);
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
        let previous = this.#previousPositions.get(object);
        if (!previous) {
            previous = createInterpolatedRecord();
            this.#previousPositions.set(object, previous);
        }
        readTransformState(object, previous);
    }

    /** Moves every object that changed during the last fixed step to `lerp(previous, current, alpha)` for rendering. */
    #applyInterpolation(): void {
        this.#interpolationFrameAlpha = this.interpolationAlpha;
        this.#interpolatedCount = 0;
        this.#forEachInterpolable(this.#applyInterpolationVisitor);
    }

    /**
     * Interpolates position, rotation and scale of one object (D-19) and records its simulated values in a pooled
     * record. 2D angles are interpolated linearly; 3D rotations by normalized quaternion lerp along the shortest arc.
     */
    #interpolateObject(object: BrioObject2D | BrioObject3D): void {
        const previous = this.#previousPositions.get(object);
        if (!previous) return;

        // Records are pooled: the array only grows when more objects move than in any earlier frame
        const records = this.#interpolated;
        let record = records[this.#interpolatedCount];
        if (!record) {
            record = createInterpolatedRecord();
            records.push(record);
        }
        readTransformState(object, record);
        if (sameTransformState(previous, record)) return;
        this.#interpolatedCount++;
        record.object = object;

        const a = this.#interpolationFrameAlpha;
        const ix = previous.x + (record.x - previous.x) * a;
        const iy = previous.y + (record.y - previous.y) * a;
        if (object instanceof BrioObject3D) {
            const t = object.transform;
            t.position.x = ix;
            t.position.y = iy;
            t.position.z = previous.z + (record.z - previous.z) * a;
            // Shortest arc: flip the previous quaternion when it points away from the current one
            const dot =
                previous.qx * record.qx +
                previous.qy * record.qy +
                previous.qz * record.qz +
                previous.qw * record.qw;
            const sign = dot < 0 ? -1 : 1;
            const qx = previous.qx * sign + (record.qx - previous.qx * sign) * a;
            const qy = previous.qy * sign + (record.qy - previous.qy * sign) * a;
            const qz = previous.qz * sign + (record.qz - previous.qz * sign) * a;
            const qw = previous.qw * sign + (record.qw - previous.qw * sign) * a;
            const len = Math.hypot(qx, qy, qz, qw) || 1;
            const q = SCRATCH_QUAT;
            q.x = qx / len;
            q.y = qy / len;
            q.z = qz / len;
            q.w = qw / len;
            // One write through the setter keeps the Euler angles and the ECS slot in sync
            t.quaternion = q;
            t.scale.x = previous.sx + (record.sx - previous.sx) * a;
            t.scale.y = previous.sy + (record.sy - previous.sy) * a;
            t.scale.z = previous.sz + (record.sz - previous.sz) * a;
        } else {
            const t = object.transform;
            // Silent write: the real position is restored right after rendering
            (t.position as BrioVec2).setSilent(ix, iy);
            if (previous.rz !== record.rz) t.rotation = previous.rz + (record.rz - previous.rz) * a;
            if (previous.sx !== record.sx || previous.sy !== record.sy) {
                t.scale.x = previous.sx + (record.sx - previous.sx) * a;
                t.scale.y = previous.sy + (record.sy - previous.sy) * a;
            }
        }
    }

    /** Restores the simulated transforms replaced by `#applyInterpolation()`. */
    #restoreInterpolation(): void {
        const records = this.#interpolated;
        const count = this.#interpolatedCount;
        for (let i = 0; i < count; i++) {
            const record = records[i];
            const object = record.object!;
            if (object instanceof BrioObject3D) {
                const t = object.transform;
                t.position.x = record.x;
                t.position.y = record.y;
                t.position.z = record.z;
                // The Euler angles are the exact simulated values (the quaternion follows from them)
                const e = SCRATCH_EULER;
                e.x = record.ex;
                e.y = record.ey;
                e.z = record.ez;
                t.rotation = e;
                t.scale.x = record.sx;
                t.scale.y = record.sy;
                t.scale.z = record.sz;
            } else {
                const t = object.transform;
                (t.position as BrioVec2).setSilent(record.x, record.y);
                if (t.rotation !== record.rz) t.rotation = record.rz;
                if (t.scale.x !== record.sx || t.scale.y !== record.sy) {
                    t.scale.x = record.sx;
                    t.scale.y = record.sy;
                }
                // Cached "static" layers rasterized the interpolated transform: redraw them next frame
                t.markDirty();
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
        this.#applyBaseTransform();

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
            this.pixelRatio,
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
            .catch((err: unknown) => {
                this.#currentState = GameState.ERROR;
                this.#lifecycleError = err instanceof Error ? err : new Error(String(err));
                this.#console.out(
                    "error",
                    `An error occurred during the game lifecycle: ${this.#lifecycleError.message}`,
                );
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
     * Registers a `BrioTileMap` (also done for maps returned by `load()`) and draws it in `layerName`, unless a
     * registered layer already holds it (`layer.addTileMap(map)`). Its tiles are part of checkpoints, `restart()`
     * and `useSnapshot()`. Give the map a `tileset` (`BrioSpriteSheet`, preloaded with `preload()`) to render it.
     *
     * @param map Tile map to register
     * @param layerName Layer that draws the map (defaults to `"default"`)
     * @returns This `BrioGame` instance
     * @throws {Error} When `layerName` is not registered
     * @example
     * ```ts
     * const tiles = new BrioSpriteSheet("sht_tiles", "./tiles.png", 16, 16, 8, 8);
     * game.preload(() => [tiles]);
     * game.load(() => {
     *     const level = BrioTileMap.fromTiled(levelJson, { tileset: tiles });
     *     return [level, ...level.createColliderObjects()];
     * });
     * ```
     */
    public addTileMap(map: BrioTileMap, layerName: string = DEFAULT_LAYER_NAME): this {
        this.#assets.tileMaps.set(map.name, map);
        const layers = this.#layers.list;
        for (let i = 0; i < layers.length; i++) {
            if (layers[i].hasTileMap(map)) return this;
        }
        const target = this.#layers.get(layerName);
        if (!target) {
            throw this.#console.fatalError(`Layer '${layerName}' is not registered in BrioGame.`);
        }
        target.addTileMap(map);
        return this;
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
     * ASSET LIFETIME -------------------------------------------------------------------
     */

    /**
     * Registers a listener called after every asset of a `preload()` (the game's or a scene's) finishes loading,
     * e.g. to drive a loading bar. Draw the bar with DOM elements or a scene that has no assets of its own.
     *
     * @param listener Callback receiving the current `LoadProgress`
     * @returns Function that unregisters the listener
     * @example
     * ```ts
     * game.onLoadProgress(({ ratio }) => {
     *     loadingBar.style.width = `${Math.round(ratio * 100)}%`;
     * });
     * ```
     */
    public onLoadProgress(listener: (progress: LoadProgress) => void): () => void {
        this.#progressListeners.push(listener);
        return () => {
            const index = this.#progressListeners.indexOf(listener);
            if (index >= 0) this.#progressListeners.splice(index, 1);
        };
    }

    /**
     * Unloads a preloaded asset (by instance or by name): removes it from the registries and frees what it holds:
     * decoded images, audio buffers, and the GPU copies of meshes and textures. A model also unloads its meshes and
     * materials. Textures shared with another registered sprite sheet, atlas or material are kept. Objects that
     * still reference the asset by name draw nothing (or the default material) afterwards.
     *
     * @param target Asset instance or asset name
     * @returns `true` when an asset was unloaded
     * @example
     * ```ts
     * game.unloadAsset("mod_boss"); // after the boss fight
     * ```
     */
    public unloadAsset(target: PreloadAsset | string): boolean {
        const asset = typeof target === "string" ? this.#findAsset(target) : target;
        if (!asset) return false;
        this.#assetOwners.delete(asset);
        const a = this.#assets;
        if (asset instanceof BrioSprite) {
            if (a.sprites.get(asset.name) !== asset) return false;
            a.sprites.delete(asset.name);
        } else if (asset instanceof BrioSpriteSheet) {
            if (a.spriteSheets.get(asset.name) !== asset) return false;
            a.spriteSheets.delete(asset.name);
            this.#releaseTextureIfUnused(asset.texture);
        } else if (asset instanceof BrioAtlas) {
            if (a.atlases.get(asset.name) !== asset) return false;
            a.atlases.delete(asset.name);
            this.#releaseTextureIfUnused(asset.texture);
        } else if (asset instanceof BrioAudio) {
            if (a.audios.get(asset.name) !== asset) return false;
            a.audios.delete(asset.name);
            asset.stop();
            asset.dispose();
        } else if (asset instanceof BrioModel) {
            if (a.models.get(asset.name) !== asset) return false;
            a.models.delete(asset.name);
            asset.meshes.forEach((mesh) => this.#unloadMesh(mesh));
            asset.materials.forEach((material) => this.#unloadMaterial(material));
        } else if (asset instanceof BrioMesh) {
            return this.#unloadMesh(asset);
        } else if (asset instanceof BrioMaterial) {
            return this.#unloadMaterial(asset);
        }
        return true;
    }

    #findAsset(name: string): PreloadAsset | undefined {
        const a = this.#assets;
        return (
            a.sprites.get(name) ??
            a.spriteSheets.get(name) ??
            a.atlases.get(name) ??
            a.audios.get(name) ??
            a.models.get(name) ??
            a.meshes.get(name) ??
            a.materials.get(name)
        );
    }

    #unloadMesh(mesh: BrioMesh): boolean {
        if (this.#assets.meshes.get(mesh.name) !== mesh) return false;
        this.#assets.meshes.delete(mesh.name);
        this.#backend3D?.releaseMesh?.(mesh);
        return true;
    }

    #unloadMaterial(material: BrioMaterial): boolean {
        if (this.#assets.materials.get(material.name) !== material) return false;
        this.#assets.materials.delete(material.name);
        if (material.texture) this.#releaseTextureIfUnused(material.texture);
        return true;
    }

    /** Frees `texture` (GPU copy and decoded bitmap) unless a registered sheet, atlas or material still uses it. */
    #releaseTextureIfUnused(texture: BrioTexture): void {
        for (const sheet of this.#assets.spriteSheets.values())
            if (sheet.texture === texture) return;
        for (const atlas of this.#assets.atlases.values()) if (atlas.texture === texture) return;
        for (const material of this.#assets.materials.values()) {
            if (material.texture === texture) return;
        }
        this.#backend3D?.releaseTexture?.(texture);
        texture.dispose();
    }

    /**
     * Unregisters a scene that is not active, destroys its content and unloads the assets its `preload()`
     * requested that neither the game nor another registered scene requested too (reference counting by owner).
     *
     * @param name Scene name
     * @returns `true` when the scene was registered and removed
     * @throws {Error} When `name` is the active scene (activate another one first)
     * @example
     * ```ts
     * game.setScene("scene_level_2");
     * await game.ready();
     * game.removeScene("scene_level_1"); // frees level 1 sprites and models
     * ```
     */
    public removeScene(name: string): boolean {
        const scene = this.#scenes.get(name);
        if (!scene) return false;
        if (scene === this.#activeScene) {
            throw this.#console.fatalError(
                `Scene '${name}' is active and cannot be removed; activate another scene first.`,
            );
        }
        if (this.#pendingScene === scene) this.#pendingScene = undefined;
        this.#scenes.delete(name);
        scene.destroy();
        const released: PreloadAsset[] = [];
        this.#assetOwners.forEach((owners, asset) => {
            if (owners.delete(scene) && owners.size === 0) released.push(asset);
        });
        for (const asset of released) this.unloadAsset(asset);
        return true;
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
            if (assets.length > 0) await this.#preloadAssets(assets, nextScene);
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
        // Scene cameras shake with game.random too, so a fixed seed reproduces them (unless they have their own)
        scene.cameras2D.forEach((camera) => {
            if (!camera.random) camera.random = this.#random;
        });
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
            objects2D.push({
                object,
                entityId: object.entityId,
                layer: this.#findLayerOf(object),
                state: object.captureState(),
            });
        });
        const objects3D: GameStateCapture["objects3D"] = [];
        const parts3D: GameStateCapture["parts3D"] = [];
        for (const object of this.#assets.objects3d.list) {
            this.#bindObject3DToECS(object);
            objects3D.push({ object, entityId: object.entityId, state: object.captureState() });
            object.forEachDescendant((part) =>
                parts3D.push({ object: part, entityId: part.entityId, state: part.captureState() }),
            );
        }
        const tileMaps: GameStateCapture["tileMaps"] = [];
        this.#assets.tileMaps.forEach((map) => tileMaps.push({ map, tiles: map.captureTiles() }));
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
            tileMaps,
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
        // Contacts restart from scratch: objects that overlap after the restore report a fresh "enter"
        this.#collisions2D.clear();
        this.#collisions3D.clear();
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
        for (const { object, entityId, layer, state: objectState } of state.objects2D) {
            object.entityId = entityId;
            object.entityGeneration = this.#ecsWorld.generationOf(entityId);
            object.transform.bindECS(storage, entityId, true);
            object.restoreState(objectState);
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
        // Hierarchies first, so parts detached after the capture are attached again before they rebind
        for (const { object, state: objectState } of state.objects3D)
            object.restoreState(objectState);
        for (const { object, state: objectState } of state.parts3D)
            object.restoreState(objectState);
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
        for (const { map, tiles } of state.tileMaps) {
            if (this.#assets.tileMaps.get(map.name) === map) map.restoreTiles(tiles);
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

        this.#removeFullScreenListener();
        if (typeof document !== "undefined") {
            document.removeEventListener("visibilitychange", this.#onVisibilityChange);
        }
        this.#hiddenPaused = false;

        // Removing input listeners (and releasing a pointer lock held by the canvas)
        this.#input.cancelCapture();
        this.#mouseInstance?.exitPointerLock();
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
        this.#assets.spriteSheets.clear();
        this.#assetOwners.clear();
        this.#layers.clear();
        this.#layers.add(new BrioLayer({ name: DEFAULT_LAYER_NAME, order: 0, policy: "dynamic" }));
        this.#lights.clear();
        this.#cloneCounters.clear();
        this.#keyboardState.clear();
        this.#keyboardPrevState.clear();
        this.#interpolated.length = 0;
        this.#interpolatedCount = 0;
        this.#timer.clear();
        this.#collisions2D.clear();
        this.#collisions3D.clear();
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
     * Spawns a new clone of a prefab (e.g. a projectile or enemy), naming it `"<name>-<index>"` (skipping names
     * already in use) and registering it like `addObject()`:
     * - a `BrioObject2D` (or subclass such as `BrioText`) copies the prefab transform, `tag`, collider and collision
     *   listeners, takes a pooled ECS slot in $O(1)$ and joins the prefab's `BrioLayer`;
     * - a `BrioObject3D` is deep-cloned with its child parts (`BrioObject3D.clone`), each part bound to its own slot.
     *
     * The prefab does not need to be registered: an unregistered template is a common way to keep it off screen.
     *
     * @param targetObject Template/prefab object to instantiate
     * @returns The newly spawned object, of the same concrete type as the prefab
     * @throws {Error} When instantiating a `BrioObject3D` in a `"2d"` game
     * @example
     * ```ts
     * const bullet = game.instantiate(projectilePrefab);
     * bullet.transform.position = { x: player.transform.position.x, y: player.transform.position.y };
     *
     * const crate = game.instantiate(cratePrefab3D);
     * crate.transform.position.x = 4;
     * ```
     */
    public instantiate<T extends BrioObject2D | BrioObject3D>(targetObject: T): T {
        if (targetObject instanceof BrioObject3D) {
            return this.#instantiate3D(targetObject) as T;
        }
        return this.#instantiate2D(targetObject as BrioObject2D) as T;
    }

    /** Next `"<prefab>-<n>"` name not used by `isTaken`, advancing the prefab's clone counter. */
    #nextCloneName(prefabName: string, isTaken: (name: string) => boolean): [string, number] {
        let index = this.#cloneCounters.get(prefabName) ?? 0;
        let cloneName: string;
        do {
            index++;
            cloneName = `${prefabName}-${index}`;
        } while (isTaken(cloneName));
        this.#cloneCounters.set(prefabName, index);
        return [cloneName, index];
    }

    #instantiate2D(targetObject: BrioObject2D): BrioObject2D {
        const prefab = this.#assets.objects.get(targetObject.name) ?? targetObject;
        this.#bindObjectToECS(prefab);

        const [cloneName, index] = this.#nextCloneName(prefab.name, (name) =>
            this.#assets.objects.has(name),
        );
        const newObject = BrioObject2D.clone(prefab, cloneName);
        newObject.copyCollisionListenersFrom(prefab);

        // Allocate pooled ECS slot, copy template component data in O(1), then bind the facade to it
        const pooledEntityId = this.#ecsWorld.instantiateFrom(prefab.entityId);
        newObject.entityId = pooledEntityId;
        newObject.entityGeneration = this.#ecsWorld.generationOf(pooledEntityId);
        newObject.transform.bindECS(this.#ecsWorld.storage, pooledEntityId);

        newObject.instanceId = index;
        this.#assets.objects.set(newObject.name, newObject);

        const layer = this.#findLayerOf(prefab) ?? this.#layers.get(DEFAULT_LAYER_NAME)!;
        layer.addObject(newObject);
        this.#objectLayers.set(newObject, layer);

        return newObject;
    }

    #instantiate3D(targetObject: BrioObject3D): BrioObject3D {
        const prefab = this.#assets.objects3d.get(targetObject.name) ?? targetObject;
        const [cloneName, index] = this.#nextCloneName(
            prefab.name,
            (name) => this.#assets.objects3d.get(name) !== undefined,
        );
        const newObject = BrioObject3D.clone(prefab, cloneName);
        newObject.instanceId = index;
        return this.addObject(newObject);
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
            const ratio = this.pixelRatio;
            this.ctx.setTransform(ratio, 0, 0, ratio, px * ratio, py * ratio);
        }
    }

    // -> GAME UTILITIES

    /**
     * Adapts the game to the browser window now and on every window resize:
     * - `"resize"` (the default): the logical size becomes `window.innerWidth x window.innerHeight`;
     * - `"fit"`: the logical size is kept and the canvas is scaled uniformly to the largest size that fits the
     *   window (center it with CSS on the container, e.g. `display: grid; place-items: center`). It renders at the
     *   displayed resolution, so it stays sharp.
     *
     * Calling it again replaces the previous mode; `end()` removes the window listener.
     *
     * @param mode How the game follows the window size
     * @example
     * ```ts
     * game.useFullScreen("fit"); // 640x360 game scaled to the window, letterboxed
     * ```
     */
    public useFullScreen(mode: FullScreenMode = "resize"): void {
        this.#removeFullScreenListener();
        const apply = (): void => {
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            if (windowWidth <= 0 || windowHeight <= 0) return;
            if (mode === "fit") {
                this.#displayScale = Math.min(
                    windowWidth / this.#width,
                    windowHeight / this.#height,
                );
                this.#applyCanvasSize();
            } else {
                this.#displayScale = 1;
                this.resize(windowWidth, windowHeight);
            }
        };
        apply();
        this.#fullScreenListener = apply;
        window.addEventListener("resize", apply);
    }

    #removeFullScreenListener(): void {
        if (!this.#fullScreenListener) return;
        window.removeEventListener("resize", this.#fullScreenListener);
        this.#fullScreenListener = undefined;
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
        this.#input.keyboard = this.#keyboardInstance;
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
        // Positions are reported in logical game pixels, whatever the canvas CSS size or pixel ratio
        this.#mouseInstance = new BrioMouse(this.#canvas, true, this);
        this.#input.mouse = this.#mouseInstance;
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
        this.#touchInstance = new BrioTouch(this.#canvas, this);
        this.#input.touch = this.#touchInstance;
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
        this.#input.gamepad = this.#gamepadInstance;
    }

    // #endregion --> METHODS
}
