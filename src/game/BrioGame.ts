import { BrioSprite } from "../assets/BrioSprite";
import { BrioObject } from "../objects/BrioObject";
import { BrioKeyboard } from "../input/BrioKeyboard";
import { BrioMap } from "../not-implemented/BrioMap";
import { BrioCamera } from "../not-implemented/BrioCamera";
import { BrioAudio } from "../assets/BrioAudio";
import { BrioConsole } from "../debugging/BrioConsole";
import { BrioSpriteRenderer } from "./BrioSpriteRenderer";
import { BrioDebugger } from "../debugging/BrioDebugger";
import { BrioCanvasBackground, CanvasBackground } from "./BrioCanvasBackground";
import { BrioUpdater } from "./BrioUpdater";
import { BrioAssetManager } from "./BrioAssetManager";
import { create } from "../math/vec2";
import { BrioAtlas } from "../assets/BrioAtlas";

// #region --> TYPES-INTERFACES

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
    /** Logs the currently preloaded sprites, audios, and atlases to `BrioConsole`. */
    logAssets: () => void;
    /** Retrieves a preloaded `BrioSprite` by its `spriteName`, or an empty fallback instance if not found. */
    getSprite: (spriteName: string) => BrioSprite;
    /** Retrieves a preloaded `BrioAudio` by its `audioName`, or an empty fallback instance if not found. */
    getAudio: (audioName: string) => BrioAudio;
    /** Retrieves a preloaded `BrioAtlas` by its `atlasName`, or `undefined` if not found. */
    getAtlas: (atlasName: string) => BrioAtlas | undefined;
}

/**
 * Callback signature for `game.load()`, receiving `AssetLoaderParam` and returning initial scene entities.
 */
export type LoaderCallbackFunction = (
    assets: AssetLoaderParam,
) => Array<BrioObject | BrioMap | BrioCamera>;

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
 * entity initialization (`load`), the `requestAnimationFrame` game loop (`update`), input controllers,
 * and visual/console debugging tools.
 *
 * @example
 * ```ts
 * const container = document.getElementById("game_container")!;
 * const game = new BrioGame(640, 480, container);
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
    // #endregion - INPUT-LOGIC

    // #region - STORAGE-LOGIC
    /** Map holding checkpoint references created via `createCheckPoint()`. */
    public cachedObjects: Map<string, Map<string, any>> = new Map();
    #cacheExists: boolean = false;

    #cachedSprites: Map<string, string> = new Map();
    #cachedObjects: Map<string, string> = new Map();
    // #endregion - STORAGE-LOGIC
    // #endregion --> PROPERTIES

    // #region --> CONSTRUCTOR

    /**
     * Creates a new `BrioGame` instance and appends its `<canvas>` element to `appendToElement`.
     *
     * @param width Canvas viewport width in pixels (negative values are converted to positive)
     * @param height Canvas viewport height in pixels (negative values are converted to positive)
     * @param appendToElement Target DOM `HTMLElement` where the canvas will be mounted
     * @param canvasContextSettings Optional `CanvasRenderingContext2DSettings` passed to `getContext("2d")`
     * @throws {Error} When `appendToElement` is not a valid `HTMLElement`
     * @example
     * ```ts
     * const game = new BrioGame(640, 480, document.body);
     * ```
     */
    constructor(
        width: number,
        height: number,
        appendToElement: HTMLElement,
        canvasContextSettings: CanvasRenderingContext2DSettings = {},
    ) {
        // Initializing debugging tools
        this.#console = new BrioConsole();
        this.#debugger = new BrioDebugger(this.#console);

        if (width < 0 || height < 0) {
            this.#console.out(
                "warn",
                "BrioGame constructor: Negative values converted to positive.",
            );
        }
        if (!(appendToElement instanceof HTMLElement)) {
            throw this.#console.fatalError(
                "BrioGame constructor: A BrioGame should be appended to a working HTMLElement.",
            );
        }

        // Game dimensions
        this.#width = Math.abs(width);
        this.#height = Math.abs(height);

        // Canvas element configuration
        this.#canvas = document.createElement("canvas");
        this.#canvas.style.background = "transparent";
        this.#canvas.width = this.#width;
        this.#canvas.height = this.#height;

        // Canvas 2D context configuration
        this.#ctxSettings = canvasContextSettings;
        this.ctx = this.#canvas.getContext("2d", this.#ctxSettings);

        appendToElement.appendChild(this.#canvas);

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
    public preload(callbackFn: () => Array<BrioSprite | BrioAudio | BrioAtlas>): this {
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

            await Promise.all(spriteLoadPromises);
            await Promise.all(spriteAtlasPromises);
            await Promise.all(audioLoadPromises);

            this.#console.out("info", "Preload step complete!");
        });

        return this;
    }

    /**
     * Second stage of the `BrioGame` lifecycle: instantiates and registers initial `BrioObject`,
     * `BrioMap`, and `BrioCamera` instances using the preloaded assets.
     *
     * @param callbackFn Callback receiving `AssetLoaderParam` (`getSprite`, `getAudio`, `getAtlas`, `logAssets`) and returning initial scene entities
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
            };

            const objects = callbackFn(assetsManipulationObject);
            const gameObjects = objects.filter(
                (object): object is BrioObject => object instanceof BrioObject,
            );
            const gameMaps = objects.filter(
                (object): object is BrioMap => object instanceof BrioMap,
            );
            const gameCameras = objects.filter(
                (object): object is BrioCamera => object instanceof BrioCamera,
            );

            gameObjects.forEach((gameObject) => {
                if (gameObject.transform.size.x <= 0 && gameObject.transform.size.y <= 0) {
                    const sprite =
                        this.#assets.sprites.get(gameObject.sprite) ??
                        BrioSprite.getEmptyInstance();

                    gameObject.transform.size.x = sprite.size.x;
                    gameObject.transform.size.y = sprite.size.y;
                }

                this.#assets.objects.set(gameObject.name, gameObject);
            });

            gameMaps.forEach((gameMap) => {
                this.#assets.maps.set(gameMap.name, gameMap);
            });

            gameCameras.forEach((gameCamera) => {
                this.#assets.cameras.set(gameCamera.name, gameCamera);
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

                this.#renderDebuggingGrid();

                // Main user update callback
                callbackFn(this.#updater, deltaTime);

                // #region PRIMITIVE-LAYER-RENDERING
                const objects = Array.from(this.#assets.objects.values());
                objects.sort((a, b) => a.transform.layer - b.transform.layer);

                for (let i = 0; i < objects.length; ++i) {
                    this.#renderer.renderObject(objects[i]);
                }
                // #endregion PRIMITIVE-LAYER-RENDERING

                this.#renderDebuggingHelpers();

                // Snapshot current keyboard state into previous state for next frame's isPressed / isUp
                this.#keyboardPrevState.clear();
                for (const state of this.#keyboardState) {
                    this.#keyboardPrevState.set(state[0], state[1]);
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

    // #endregion --> GAME-STATES

    // #region --> METHODS

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
     * INTERNAL METHODS -----------------------------------------------------------------
     */

    /**
     * Captures a serialized snapshot of currently loaded objects and sprites.
     */
    public createSnapshot(): void {
        this.#assets.objects.forEach((object, key) => {
            this.#cachedObjects.set(key, JSON.stringify(object));
        });
        this.#assets.sprites.forEach((sprite, key) => {
            this.#cachedSprites.set(key, JSON.stringify(sprite));
        });
    }

    /**
     * Restores objects from the most recent snapshot captured via `createSnapshot()`.
     */
    public useSnapshot(): void {
        for (const [key, object] of this.#cachedObjects) {
            if (!this.#assets.objects.has(key)) {
                break;
            }
            this.#assets.objects.set(key, JSON.parse(object));
        }
    }

    /**
     * EXTERNAL METHODS -----------------------------------------------------------------
     */

    /**
     * Stores an in-memory checkpoint of all current scene maps, objects, sprites, audios, and cameras.
     *
     * @example
     * ```ts
     * game.createCheckPoint();
     * ```
     */
    public createCheckPoint(): void {
        this.cachedObjects.set("objects", new Map<string, BrioObject>());
        this.#assets.objects.forEach((object, id) => {
            this.cachedObjects.get("objects")?.set(id, object);
        });

        this.cachedObjects.set("sprites", this.#assets.sprites);
        this.cachedObjects.set("audios", this.#assets.audios);
        this.cachedObjects.set("cameras", this.#assets.cameras);
        this.cachedObjects.set("maps", this.#assets.maps);

        if (!this.#cacheExists) this.#cacheExists = true;
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

        // Removing keyboard listener
        if (this.#keyboardInstance) {
            this.#keyboardInstance.removeListener();
        }

        // Clearing asset and state registries
        this.#assets.audios.clear();
        this.#assets.cameras.clear();
        this.#assets.maps.clear();
        this.#assets.objects.clear();
        this.#assets.sprites.clear();
        this.#assets.atlases.clear();
        this.#keyboardState.clear();
        this.#keyboardPrevState.clear();
        this.#console.loggedErrors.clear();

        this.#console.out("info", "Game ended!");
    }

    /**
     * Placeholder for restarting the current game state from the initial snapshot.
     */
    public restart(): void {
        // Restart logic to be implemented via BrioSerializer
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
     * assigning it a sequential name (`"<name>-<instanceId>"`), copying its `transform` and `collision` mask,
     * and registering it in `game.gameObjects`.
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

        // Cloning object with sequential suffix
        const newObject = new BrioObject(
            `${registeredObject.name}-${registeredObject.clonesInstantiatedValue + 1}`,
            registeredObject.sprite,
            registeredObject.transform.layer,
        );
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
     * Destroys an active `BrioObject` instance, clearing its canvas region and removing it from `game.gameObjects`
     * without deleting shared `BrioSprite` assets.
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
     * Registers browser `gamepadconnected` and `gamepaddisconnected` event listeners.
     *
     * @example
     * ```ts
     * game.useGamepad();
     * ```
     */
    public useGamepad(): void {
        window.addEventListener("gamepadconnected", (event) => {
            this.#console.out("log", `gamepadconnected ${event}.`);
        });

        window.addEventListener("gamepaddisconnected", (event) => {
            this.#console.out("log", `gamepadisconnnected ${event}.`);
        });
    }

    // #endregion --> METHODS
}

