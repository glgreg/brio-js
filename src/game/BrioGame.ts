import { BrioSprite } from "../assets/BrioSprite";
import { BrioModel } from "../assets/BrioModel";
import { BrioObject } from "../objects/BrioObject";
import { BrioObject3D } from "../objects/BrioObject3D";
import { BrioKeyboard } from "../input/BrioKeyboard";
import { BrioMouse } from "../input/BrioMouse";
import { BrioTouch } from "../input/BrioTouch";
import { BrioGamepad } from "../input/BrioGamepad";
import { BrioMap } from "../not-implemented/BrioMap";
import { BrioCamera } from "../not-implemented/BrioCamera";
import { BrioCamera3D } from "../cameras/BrioCamera3D";
import { BrioAudio } from "../assets/BrioAudio";
import { BrioConsole } from "../debugging/BrioConsole";
import { BrioSpriteRenderer } from "./BrioSpriteRenderer";
import { BrioDebugger } from "../debugging/BrioDebugger";
import { BrioCanvasBackground, CanvasBackground } from "./BrioCanvasBackground";
import { BrioUpdater } from "./BrioUpdater";
import { BrioAssetManager } from "./BrioAssetManager";
import { create } from "../math/vec2";
import { BrioAtlas } from "../assets/BrioAtlas";
import { ECSWorld } from "../ecs/ECSWorld";
import { ComponentMask } from "../ecs/ComponentStorage";
import { BrioTimer } from "../core/BrioTimer";
import { BrioScene } from "../core/BrioScene";
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
) => Array<BrioObject | BrioObject3D | BrioMap | BrioCamera | BrioCamera3D>;

/**
 * Canvas 2D image interpolation settings exposed via `game.rendering`.
 */
export interface CanvasRendering {
    /** Interpolation mode (`"smooth"` for bilinear/bicubic filtering, `"pixelated"` for nearest-neighbor pixel art). */
    mode: "smooth" | "pixelated";
    /** Browser smoothing quality level when `mode === "smooth"`. */
    smoothness: ImageSmoothingQuality;
}

// #endregion --> TYPES-INTERFACES

/**
 * Central entrypoint of BrioJS that manages the HTML5 Canvas, asset preloading (`preload`),
 * entity initialization (`load`), the `requestAnimationFrame` game loop (`update`), ECS world storage,
 * scenes, timers, input controllers, and visual/console debugging tools.
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
 *     const player = new BrioObject("obj_player", assets.getSprite("spr_player").name, 1);
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
    #debugger: BrioDebugger;
    #console: BrioConsole;
    #updater: BrioUpdater;
    #assets: BrioAssetManager = new BrioAssetManager();
    /** Reactive CSS background controller for the canvas element. */
    #canvasBackground: BrioCanvasBackground;
    /** Internal Structure-of-Arrays (SoA) ECS world backing entities and binary snapshots. */
    #ecsWorld: ECSWorld;
    /** Frame-synchronized `deltaTime` timer scheduler. */
    #timer: BrioTimer = new BrioTimer();
    /** Registered `BrioScene` instances keyed by scene name. */
    #scenes: Map<string, BrioScene> = new Map();
    /** Currently active `BrioScene`. */
    #activeScene?: BrioScene;
    // #endregion - COMPOSITION-OBJECTS

    // #region - UPDATE-LOGIC
    /** Active `requestAnimationFrame` handle used to cancel the update loop on `pause()` or `end()`. */
    #updateFrameId: number = 0;
    /** Timestamp (in milliseconds) of the previous animation frame for `deltaTime` computation. */
    #deltaTimePreviousTime: number = 0;
    #updateIsRunning: boolean = false;
    #updateLoopLogic?: (currentTime: number) => void;
    #gameLastFPS: number = 0;
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
    /** Map holding checkpoint references created via `createCheckPoint()`. */
    public cachedObjects: Map<string, Map<string, any>> = new Map();
    #cacheExists: boolean = false;
    /** Initial binary ECS snapshot captured after `load()` for `useSnapshot()` and `restart()`. */
    #initialBinarySnapshot?: Uint8Array;
    /** Binary ECS snapshot captured via `createCheckPoint()`. */
    #checkpointBinarySnapshot?: Uint8Array;
    // #endregion - STORAGE-LOGIC
    // #endregion --> PROPERTIES

    // #region --> CONSTRUCTOR

    /**
     * Creates a new `BrioGame` instance and appends its `<canvas>` element to the target container.
     * Supports both `(width, height, appendToElement, presetOrSettings?)` and a single `BrioGameConfig` object.
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

        if (typeof widthOrConfig === "object" && widthOrConfig !== null) {
            rawWidth = widthOrConfig.width;
            rawHeight = widthOrConfig.height;
            container = widthOrConfig.container;
            this.#dimension = widthOrConfig.dimension ?? "2d";
            maxEntities = widthOrConfig.maxEntities ?? 4096;
            this.#ctxSettings = widthOrConfig.contextSettings ?? {};
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

        // ECS world allocation
        this.#ecsWorld = new ECSWorld(maxEntities);

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

        this.#updater = new BrioUpdater(this.#assets, this.#renderer, this.#console);

        // Game lifecycle promise error boundary
        this.#lifecyclePromise.catch((err) => {
            this.#currentState = GameState.ERROR;
            this.#console.out(
                "error",
                `An error occurred during the game object creation: ${err}.`,
            );
        });
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
     * Currently active `BrioScene`, if any.
     */
    public get activeScene(): BrioScene | undefined {
        return this.#activeScene;
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
     * Map of all active `BrioObject` entities in the current scene keyed by `object.name`.
     *
     * @example
     * ```ts
     * console.log(game.gameObjects.size);
     * ```
     */
    public get gameObjects(): Map<string, BrioObject> {
        return this.#assets.objects;
    }

    /**
     * Map of all active `BrioObject3D` entities in the current scene keyed by `object.name`.
     *
     * @example
     * ```ts
     * console.log(game.gameObjects3D.size);
     * ```
     */
    public get gameObjects3D(): Map<string, BrioObject3D> {
        return this.#assets.objects3d;
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
     * if (game.mouse.isPressed(0)) {
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
     * and `BrioAtlas` assets before `load()` executes.
     *
     * @param callbackFn Function returning a non-empty array of assets to preload
     * @returns This `BrioGame` instance for method chaining
     * @throws {Error} When `callbackFn` returns an empty array
     * @example
     * ```ts
     * game.preload(() => {
     *     const sprPlayer = new BrioSprite("spr_player", "./assets/sprites/soldier.png");
     *     const audLaser = new BrioAudio("aud_laser", "./assets/audios/laser.wav");
     *     return [sprPlayer, audLaser];
     * });
     * ```
     */
    public preload(callbackFn: () => Array<BrioSprite | BrioAudio | BrioAtlas | BrioModel>): this {
        this.#lifecyclePromise = this.#lifecyclePromise.then(async () => {
            this.#currentState = GameState.PRELOAD;

            const assets = callbackFn();

            if (assets.length === 0) {
                throw new Error("Zero assets returned. You must return at least one asset.");
            }

            const sprites = assets.filter(
                (asset): asset is BrioSprite => asset instanceof BrioSprite,
            );
            const audios = assets.filter((asset): asset is BrioAudio => asset instanceof BrioAudio);
            const spriteAtlases = assets.filter(
                (asset): asset is BrioAtlas => asset instanceof BrioAtlas,
            );
            const models = assets.filter((asset): asset is BrioModel => asset instanceof BrioModel);

            const spriteLoadPromises = sprites.map((sprite) => {
                return new Promise<void>((resolve, reject) => {
                    sprite.element.onload = () => {
                        sprite.size = create(sprite.element.width, sprite.element.height);
                        this.#assets.sprites.set(sprite.name, sprite);
                        this.#console.out("log", `Sprite: ${sprite.name} sucessfully preloaded.`);
                        resolve();
                    };
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

            const audioLoadPromises = audios.map((audio) => {
                return new Promise<void>((resolve, reject) => {
                    const onCanPlayThrough = () => {
                        this.#assets.audios.set(audio.name, audio);
                        this.#console.out("log", `Audio: ${audio.name} sucessfully preloaded.`);
                        resolve();
                        audio.element.removeEventListener("canplaythrough", onCanPlayThrough);
                    };
                    const onErrorPlay = (e: ErrorEvent) => {
                        reject(`Error loading the audio '${audio.name}': ${e.message}`);
                        audio.element.removeEventListener("error", onErrorPlay);
                    };

                    audio.element.addEventListener("canplaythrough", onCanPlayThrough);
                    audio.element.addEventListener("error", onErrorPlay);
                });
            });

            const modelLoadPromises = models.map(async (model) => {
                await model.load();
                this.#assets.models.set(model.name, model);
                this.#console.out("log", `Model: ${model.name} sucessfully preloaded.`);
            });

            await Promise.all(spriteLoadPromises);
            await Promise.all(spriteAtlasPromises);
            await Promise.all(audioLoadPromises);
            await Promise.all(modelLoadPromises);

            this.#console.out("info", "Preload step complete!");
        });

        return this;
    }

    /**
     * Second stage of the `BrioGame` lifecycle: instantiates and registers initial `BrioObject`,
     * `BrioMap`, and `BrioCamera` instances using the preloaded assets.
     *
     * @param callbackFn Callback receiving `AssetLoaderParam` (`getSprite`, `getAudio`, `getAtlas`, `getModel`, `logAssets`) and returning initial scene entities
     * @returns This `BrioGame` instance for method chaining
     * @example
     * ```ts
     * game.load((assets) => {
     *     const sprPlayer = assets.getSprite("spr_player");
     *     const player = new BrioObject("obj_player", sprPlayer.name, 1);
     *     return [player];
     * });
     * ```
     */
    public load(callbackFn: LoaderCallbackFunction): this {
        this.#lifecyclePromise = this.#lifecyclePromise.then(() => {
            this.#currentState = GameState.LOAD;

            const assetsManipulationObject: AssetLoaderParam = {
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

            const objects = callbackFn(assetsManipulationObject);
            const gameObjects = objects.filter(
                (object): object is BrioObject => object instanceof BrioObject,
            );
            const gameObjects3D = objects.filter(
                (object): object is BrioObject3D => object instanceof BrioObject3D,
            );
            const gameMaps = objects.filter(
                (object): object is BrioMap => object instanceof BrioMap,
            );
            const gameCameras = objects.filter(
                (object): object is BrioCamera => object instanceof BrioCamera,
            );
            const gameCameras3D = objects.filter(
                (object): object is BrioCamera3D => object instanceof BrioCamera3D,
            );

            gameObjects.forEach((gameObject) => {
                if (gameObject.transform.size.x <= 0 && gameObject.transform.size.y <= 0) {
                    const sprite =
                        this.#assets.sprites.get(gameObject.sprite) ??
                        BrioSprite.getEmptyInstance();

                    gameObject.transform.size.x = sprite.size.x;
                    gameObject.transform.size.y = sprite.size.y;
                }

                this.#bindObjectToECS(gameObject);
                this.#assets.objects.set(gameObject.name, gameObject);
            });

            gameObjects3D.forEach((gameObject3d) => {
                this.#bindObject3DToECS(gameObject3d);
                this.#assets.objects3d.set(gameObject3d.name, gameObject3d);
            });

            gameMaps.forEach((gameMap) => {
                this.#assets.maps.set(gameMap.name, gameMap);
            });

            gameCameras.forEach((gameCamera) => {
                this.#assets.cameras.set(gameCamera.name, gameCamera);
            });

            gameCameras3D.forEach((gameCamera3d) => {
                this.#assets.cameras.set(gameCamera3d.name, gameCamera3d as any);
            });

            this.createSnapshot();
            this.#console.out("info", "Load step complete!");
        });

        return this;
    }

    /**
     * Third stage of the `BrioGame` lifecycle: starts the `requestAnimationFrame` loop,
     * invoking `callbackFn(updater, deltaTime)` on every frame and rendering all active `BrioObject` entities sorted by `transform.layer`.
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
        this.#lifecyclePromise = this.#lifecyclePromise.then(() => {
            this.#currentState = GameState.UPDATE;
            this.#updateIsRunning = true;

            this.#console.out("info", "Update step started!");

            this.#updateLoopLogic = (currentTime: number) => {
                if (this.#currentState !== GameState.UPDATE) {
                    return;
                }

                this.#renderer.clearScreen();

                if (this.#deltaTimePreviousTime === 0) {
                    this.#deltaTimePreviousTime = currentTime;
                }
                const deltaTime = (currentTime - this.#deltaTimePreviousTime) / 1000;

                // Debug FPS calculation
                this.#gameLastFPS = this.#renderer.gameLastFPS =
                    deltaTime > 0 ? 1 / deltaTime : 60;

                // Poll gamepads and advance frame-synchronized timers
                this.#gamepadInstance?.poll();
                this.#timer.update(deltaTime);

                this.#renderDebuggingGrid();

                // Main user update callback
                callbackFn(this.#updater, deltaTime);

                // Active scene update
                this.#activeScene?.step(deltaTime);

                // #region PRIMITIVE-LAYER-RENDERING
                const objects = Array.from(this.#assets.objects.values());
                objects.sort((a, b) => a.transform.layer - b.transform.layer);

                for (let i = 0; i < objects.length; ++i) {
                    this.#renderer.renderObject(objects[i]);
                }
                // #endregion PRIMITIVE-LAYER-RENDERING

                this.#renderDebuggingHelpers();

                // Snapshot current keyboard/mouse state into previous state for next frame's isPressed / isUp
                this.#keyboardPrevState.clear();
                for (const state of this.#keyboardState) {
                    this.#keyboardPrevState.set(state[0], state[1]);
                }
                this.#mouseInstance?.endFrame();
                this.#ecsWorld.storage.clearAllDirty();

                this.#deltaTimePreviousTime = currentTime;

                if (this.#updateLoopLogic) {
                    this.#updateFrameId = requestAnimationFrame(this.#updateLoopLogic);
                }
            };
            this.#updateFrameId = requestAnimationFrame(this.#updateLoopLogic);
        });

        return this;
    }

    // #endregion --> GAME-STATES

    // #region --> METHODS

    #bindObjectToECS(gameObject: BrioObject): void {
        if (gameObject.entityId < 0 || !this.#ecsWorld.isAlive(gameObject.entityId)) {
            const entityId = this.#ecsWorld.createEntity();
            gameObject.entityId = entityId;
            this.#ecsWorld.addComponent(entityId, ComponentMask.TRANSFORM_2D);
            gameObject.transform.bindECS(this.#ecsWorld.storage, entityId);
        }
    }

    #bindObject3DToECS(gameObject3d: BrioObject3D): void {
        if (gameObject3d.entityId < 0 || !this.#ecsWorld.isAlive(gameObject3d.entityId)) {
            const entityId = this.#ecsWorld.createEntity();
            gameObject3d.entityId = entityId;
            this.#ecsWorld.addComponent(entityId, ComponentMask.TRANSFORM_3D);
            gameObject3d.transform.bindECS(this.#ecsWorld.storage, entityId);
        }
    }

    #renderDebuggingGrid(): void {
        const render = this.#renderer;
        const renderConfig = this.#debugger.render;
        const gridWidth = renderConfig.grid.width;
        const gridHeight = renderConfig.grid.height;

        if (renderConfig.grid.enabled) render.renderGrid(gridWidth ?? 32, gridHeight ?? 32);
        if (renderConfig.grid.showAxisRulers) render.renderAxisRulers();
    }

    #renderDebuggingHelpers(): void {
        const render = this.#renderer;
        const renderConfig = this.#debugger.render;

        if (renderConfig.showRenderBounds) render.renderBounds();
        if (renderConfig.showCollisionBounds) render.renderCollisions();

        if (renderConfig.fpsOverlay.enabled) {
            const overlay = renderConfig.fpsOverlay;

            render.renderFPSOverlay(
                overlay.position,
                overlay.offset,
                overlay.size,
                overlay.backgroundColor,
                overlay.textColor,
            );
        }
    }

    /**
     * SCENE MANAGEMENT -----------------------------------------------------------------
     */

    /**
     * Registers a `BrioScene` instance in the game. If no scene is currently active, activates it immediately.
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
        this.#scenes.set(scene.name, scene);
        if (!this.#activeScene) {
            this.#activeScene = scene;
            scene.resume();
        }
        return this;
    }

    /**
     * Transitions from the currently active scene to the registered scene named `name`.
     *
     * @param name Target scene name
     * @returns This `BrioGame` instance
     * @throws {Error} When `name` is not registered in `game.scenes`
     * @example
     * ```ts
     * game.setScene("scene_game_over");
     * ```
     */
    public setScene(name: string): this {
        const nextScene = this.#scenes.get(name);
        if (!nextScene) {
            throw this.#console.fatalError(`Scene '${name}' is not registered in BrioGame.`);
        }
        if (this.#activeScene && this.#activeScene !== nextScene) {
            this.#activeScene.pause();
        }
        this.#activeScene = nextScene;
        nextScene.resume();
        return this;
    }

    /**
     * INTERNAL & BINARY SNAPSHOT METHODS -----------------------------------------------
     */

    /**
     * Captures a high-speed binary snapshot (`Uint8Array`) of the current `ECSWorld` state via `BrioSerializer`.
     *
     * @returns The captured `Uint8Array` binary snapshot
     * @example
     * ```ts
     * const snapshot = game.createSnapshot();
     * ```
     */
    public createSnapshot(): Uint8Array {
        this.#assets.objects.forEach((obj) => this.#bindObjectToECS(obj));
        this.#assets.objects3d.forEach((obj3d) => this.#bindObject3DToECS(obj3d));
        this.#initialBinarySnapshot = BrioSerializer.captureSnapshot(this.#ecsWorld);
        return this.#initialBinarySnapshot;
    }

    /**
     * Restores the `ECSWorld` and all bound `BrioObject` transforms from the most recent snapshot captured via `createSnapshot()`.
     *
     * @example
     * ```ts
     * game.useSnapshot();
     * ```
     */
    public useSnapshot(): void {
        if (this.#initialBinarySnapshot) {
            BrioSerializer.restoreSnapshot(this.#ecsWorld, this.#initialBinarySnapshot);
        }
    }

    /**
     * EXTERNAL METHODS -----------------------------------------------------------------
     */

    /**
     * Stores an in-memory binary checkpoint of all current scene entities, maps, sprites, audios, models, and cameras.
     *
     * @example
     * ```ts
     * game.createCheckPoint();
     * ```
     */
    public createCheckPoint(): void {
        this.#assets.objects.forEach((obj) => this.#bindObjectToECS(obj));
        this.#assets.objects3d.forEach((obj3d) => this.#bindObject3DToECS(obj3d));
        this.#checkpointBinarySnapshot = BrioSerializer.captureSnapshot(this.#ecsWorld);

        const clonedMap = new Map<string, BrioObject>();
        this.#assets.objects.forEach((object, id) => {
            clonedMap.set(id, object);
        });
        const clonedMap3D = new Map<string, BrioObject3D>();
        this.#assets.objects3d.forEach((object, id) => {
            clonedMap3D.set(id, object);
        });
        this.cachedObjects.set("objects", clonedMap);
        this.cachedObjects.set("objects3d", clonedMap3D);
        this.cachedObjects.set("sprites", this.#assets.sprites);
        this.cachedObjects.set("audios", this.#assets.audios);
        this.cachedObjects.set("models", this.#assets.models);
        this.cachedObjects.set("cameras", this.#assets.cameras);
        this.cachedObjects.set("maps", this.#assets.maps);

        this.#cacheExists = true;
    }

    /**
     * Restores all entities and `ECSWorld` state from the most recent checkpoint created via `createCheckPoint()`.
     *
     * @returns `true` if a checkpoint existed and was restored, or `false` otherwise
     * @example
     * ```ts
     * game.restoreCheckPoint();
     * ```
     */
    public restoreCheckPoint(): boolean {
        if (!this.#cacheExists || !this.#checkpointBinarySnapshot) {
            return false;
        }
        BrioSerializer.restoreSnapshot(this.#ecsWorld, this.#checkpointBinarySnapshot);
        const savedObjects = this.cachedObjects.get("objects");
        if (savedObjects) {
            this.#assets.objects.clear();
            savedObjects.forEach((obj: BrioObject, id: string) => {
                this.#assets.objects.set(id, obj);
            });
        }
        const savedObjects3D = this.cachedObjects.get("objects3d");
        if (savedObjects3D) {
            this.#assets.objects3d.clear();
            savedObjects3D.forEach((obj: BrioObject3D, id: string) => {
                this.#assets.objects3d.set(id, obj);
            });
        }
        return true;
    }

    /**
     * Pauses the active `update()` game loop and resets the frame timer so resuming does not cause a `deltaTime` spike.
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
            this.#console.out("info", "Game stopped!");
        }
    }

    /**
     * Resumes the `update()` game loop if it was previously paused.
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
            this.#console.out("info", "Game resumed!");
        }
    }

    /**
     * Terminates the game session, cancelling the animation loop, detaching input listeners,
     * and clearing all registered assets and entities.
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

        // Clearing asset and state registries
        this.#assets.audios.clear();
        this.#assets.cameras.clear();
        this.#assets.maps.clear();
        this.#assets.objects.clear();
        this.#assets.sprites.clear();
        this.#assets.atlases.clear();
        this.#keyboardState.clear();
        this.#keyboardPrevState.clear();
        this.#timer.clear();
        this.#ecsWorld.clear();
        this.#console.loggedErrors.clear();

        this.#console.out("info", "Game ended!");
    }

    /**
     * Restarts the current game state from the initial binary snapshot captured after `load()`.
     *
     * @example
     * ```ts
     * game.restart();
     * ```
     */
    public restart(): void {
        this.useSnapshot();
        this.#deltaTimePreviousTime = 0;
    }

    /**
     * Removes a `BrioObject` or `BrioSprite` from the active game registries and clears its rendered area.
     *
     * @param targetObject The `BrioObject` or `BrioSprite` to remove
     * @example
     * ```ts
     * game.removeObject(enemy);
     * ```
     */
    public removeObject<T extends BrioObject>(targetObject: T): void {
        let objectExists: boolean = false;

        if (targetObject instanceof BrioSprite && this.#assets.sprites.has(targetObject.name)) {
            objectExists = true;
            this.#assets.sprites.delete(targetObject.name);
        } else if (
            targetObject instanceof BrioObject &&
            this.#assets.objects.has(targetObject.name)
        ) {
            objectExists = true;
            this.#assets.objects.delete(targetObject.name);
            if (targetObject.entityId >= 0) {
                this.#ecsWorld.destroyEntity(targetObject.entityId);
                targetObject.entityId = -1;
            }
        }
        if (this.ctx && objectExists && targetObject) {
            this.#renderer.clearObject(targetObject);
        }

        if (objectExists) {
            this.#console.out("warn", `${targetObject.name} was removed from the scene!`);
        }
    }

    /**
     * Checks whether `targetObject` has moved completely outside the game screen bounds (scaled by `screenThreshold`).
     * Invokes `callbackFn` if provided, or pauses the game by default when `callbackFn` is omitted.
     *
     * @param targetObject The `BrioObject` to check against the viewport boundaries
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
        targetObject: BrioObject,
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
     * Spawns a new clone instance of `targetObject` (e.g. a projectile or enemy prefab),
     * assigning it a sequential name (`"<name>-<instanceId>"`), copying its `transform` and `collision` mask
     * via $O(1)$ ECS entity pooling, and registering it in `game.gameObjects`.
     *
     * @param targetObject Template/prefab `BrioObject` to instantiate
     * @returns The newly spawned `BrioObject` instance
     * @example
     * ```ts
     * const bullet = game.instantiate(projectilePrefab);
     * bullet.transform.position = { x: player.transform.position.x, y: player.transform.position.y };
     * ```
     */
    public instantiate(targetObject: BrioObject): BrioObject {
        BrioObject.instanceOfObject = true;

        const registeredObject = this.#assets.objects.get(targetObject.name) ?? targetObject;
        this.#bindObjectToECS(registeredObject);

        // Cloning object with sequential suffix
        const newObject = new BrioObject(
            `${registeredObject.name}-${registeredObject.clonesInstantiatedValue + 1}`,
            registeredObject.sprite,
            registeredObject.transform.layer,
        );

        // Allocate pooled ECS slot and copy template data in O(1)
        const pooledEntityId = this.#ecsWorld.instantiateFrom(registeredObject.entityId);
        newObject.entityId = pooledEntityId;

        newObject.transform.position = {
            x: registeredObject.transform.position.x,
            y: registeredObject.transform.position.y,
        };
        newObject.transform.size = {
            x: registeredObject.transform.size.x,
            y: registeredObject.transform.size.y,
        };
        newObject.transform.scale = {
            x: registeredObject.transform.scale.x,
            y: registeredObject.transform.scale.y,
        };
        newObject.transform.rotation = registeredObject.transform.rotation;
        newObject.transform.pivot = {
            x: registeredObject.transform.pivot.x,
            y: registeredObject.transform.pivot.y,
        };
        newObject.transform.skew = {
            x: registeredObject.transform.skew.x,
            y: registeredObject.transform.skew.y,
        };
        newObject.transform.flip = {
            x: registeredObject.transform.flip.x,
            y: registeredObject.transform.flip.y,
        };
        newObject.transform.visibility = registeredObject.transform.visibility;
        newObject.transform.opacity = registeredObject.transform.opacity;
        newObject.transform.bindECS(this.#ecsWorld.storage, pooledEntityId);

        // Incrementing the prefab clone counter
        registeredObject.clonesInstantiatedValue = 1;

        // Cloning collider
        if (registeredObject.collision) {
            newObject.addCollisionMask(
                registeredObject.collision.shape,
                registeredObject.collision.colliderType,
                registeredObject.collision.pos.x,
                registeredObject.collision.pos.y,
                registeredObject.collision.size.x,
                registeredObject.collision.size.y,
            );
            if (newObject.collision) {
                newObject.collision.enabled = registeredObject.collision.enabled;
            }
        }

        // Assigning sequential 1-based instanceId
        newObject.instanceId = registeredObject.clonesInstantiatedValue;

        // Registering instantiated object in the scene map
        if (!this.#assets.objects.has(newObject.name)) {
            this.#assets.objects.set(newObject.name, newObject);
        }

        BrioObject.instanceOfObject = false;

        return newObject;
    }

    /**
     * Destroys an active `BrioObject` instance, clearing its canvas region, returning its `entityId`
     * to the `ECSWorld` object pool, and removing it from `game.gameObjects` without deleting shared `BrioSprite` assets.
     *
     * @param targetObject The `BrioObject` instance to destroy
     * @example
     * ```ts
     * if (BrioCollision.isColliding(enemy, projectile)) {
     *     game.destroy(projectile);
     * }
     * ```
     */
    public destroy(targetObject: BrioObject): void {
        if (!targetObject) return;

        if (this.#assets.objects.has(targetObject.name)) {
            this.#renderer.clearObject(targetObject);
            this.#assets.objects.delete(targetObject.name);
        }
        if (targetObject.entityId >= 0) {
            this.#ecsWorld.destroyEntity(targetObject.entityId);
            targetObject.entityId = -1;
        }
    }

    /**
     * Translates the global 2D canvas transformation matrix to `(px, py)`.
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
     * Initializes the `BrioGamepad` input subsystem and registers browser `gamepadconnected` / `gamepaddisconnected` listeners.
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

