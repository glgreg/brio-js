import { BrioSprite } from "../assets/BrioSprite";
import { BrioObject } from "../objects/BrioObject";
import { BrioKeyboard } from "../input/BrioKeyboard";
import { BrioMap } from "../not-implemented/BrioMap";
import { BrioCamera } from "../not-implemented/BrioCamera";
import { BrioAudio } from "../assets/BrioAudio";
import { BrioConsole } from "../debugging/BrioConsole";
import { BrioRender } from "./BrioRender";
import { BrioDebugger } from "../debugging/BrioDebugger";
import { BrioCanvasBackground, CanvasBackground } from "./BrioCanvasBackground";
import { BrioUpdater } from "./BrioUpdater";
import { BrioAssetManager } from "./BrioAssetManager";
import { create } from "../math/vec2";

// #region --> TYPES-INTERFACES

/** Used for managing the game-state step process */
export enum GameState {
    UNSET = 0,
    PRELOAD = 1,
    LOAD = 2,
    UPDATE = 3,
    ERROR = 4,
}

// -> Used in the "load" step method, in the param of the callbackFn
/** The object passed as a param into the callbackFn */
interface AssetLoaderParam {
    /** Logs the available sprites that were preloaded */
    logAssets: () => void;
    /** Returns the BrioSprite object with the given name */
    getSprite: (spriteName: string) => BrioSprite;
    /** Returns the BrioAudio object with the given name */
    getAudio: (audioName: string) => BrioAudio;
}
type LoaderCallbackFunction = (assets: AssetLoaderParam) => Array<BrioObject | BrioMap>;

// -> Log related types
interface CanvasRendering {
    mode: "smooth" | "pixelated";
    smoothness: ImageSmoothingQuality;
}

// #endregion --> TYPES-INTERFACES

export class BrioGame {
    // #region --> PROPERTIES
    // #region - CANVAS
    /** Canvas element that serves as the game sandbox */
    #canvas: HTMLCanvasElement;
    /** Context of the Canvas element */
    ctx: CanvasRenderingContext2D | null = null;
    /** Settings of the Context from the Canvas element */
    #ctxSettings: CanvasRenderingContext2DSettings = {};
    /** Width of the Canvas element */
    #width: number;
    /** Height of the Canvas element */
    #height: number;
    /** A configuration module for canvas rendering options */
    #rendering: CanvasRendering = { mode: "smooth", smoothness: "medium" };
    /** Global scale multiplier for all sprites in-game */
    #scale: number = 1;
    // #endregion - CANVAS
    // #region - STORED-OBJECTS
    /** A map that stores loaded sprites (returned in the preload state) */
    // #assets.sprites: Map<string, BrioSprite> = new Map<string, BrioSprite>();
    /** A map that stores loaded gameobjects (returned in the load state) */
    // #assets.objects: Map<string, BrioObject> = new Map<string, BrioObject>();
    /** A map that stores loaded game audios (returned in the preload state) */
    // #assets.audios: Map<string, BrioAudio> = new Map();
    /** A map that stores loaded game maps (returned in the preload state) */
    // #assets.maps: Map<string, BrioMap> = new Map<string, BrioMap>();
    /** A map that stores loaded game maps (returned in the preload state) */
    // #assets.cameras: Map<string, BrioCamera> = new Map<string, BrioCamera>();
    // #endregion - STORED-OBJECTS
    // #region - LOGS
    // LOGS
    /** A set that holds the logged erros so they don't appear multiple times in the console when using the update loop */
    #loggedErros: Set<string> = new Set<string>();
    #storedErrors: Set<number> = new Set<number>();
    #storedExceptions: Set<number> = new Set<number>();
    // #endregion - LOGS
    // #region - GAME-STATE-LOGIC
    /** States in which the game will run throught the development process (unset->preload->load->update->error) */
    #currentState: GameState = GameState.UNSET;
    /** A promise that resolves the lyfecicle of the game, going to preload -> load -> update */
    #lifecyclePromise: Promise<void> = Promise.resolve();
    // #endregion - GAME-STATE-LOGIC
    // #region - COMPOSITION-OBJECTS
    #render: BrioRender;
    #debugger: BrioDebugger;
    #console: BrioConsole;
    #updater: BrioUpdater;
    #assets: BrioAssetManager = new BrioAssetManager();
    /** An object containing configuration the canvas background using CSS logic */
    #canvasBackground: CanvasBackground;
    // #endregion - COMPOSITION-OBJECTS
    // #region - UPDATE-LOGIC
    /** Id created in the update step, used for stoping the update loop */
    #updateFrameId: number = 0;
    /** A set that holds keys for events that run only once in the update step */
    #updaterRunOnceKeys: Set<string> = new Set<string>();
    /** A variable that holds the previous time of a animation frame, used to get the deltaTime in the update step */
    #deltaTimePreviousTime: number = 0;
    #updateIsRunning: boolean = false;
    #updateLoopLogic?: (currentTime: number) => void;
    #gameLastFPS: number = 0;
    // #endregion - UPDATE-LOGIC
    // #region - INPUT-LOGIC
    #keyboardEnabled: boolean = false;
    #keyboardState: Map<string, boolean> = new Map<string, boolean>();
    #keyboardPrevState: Map<string, boolean> = new Map<string, boolean>();
    #keyboardInstance?: BrioKeyboard;
    // #endregion - INPUT-LOGIC
    // #region - STORAGE-LOGIC
    // RESTART

    // CHECKPOINT LOGIC
    cachedObjects: Map<string, Map<string, any>> = new Map();
    #cacheExists: boolean = false;

    // TEMPORARY CACHING LOGIC
    #cachedSprites: Map<string, string> = new Map();
    #cachedAudios: Map<string, string> = new Map();
    #cachedObjects: Map<string, string> = new Map();
    // #endregion - STORAGE-LOGIC
    // #endregion --> PROPERTIES
    // #region - MISC-PROPERTIES
    #objectsMaxLayer: number = 0;
    // #endregion - MISC-PROPERTIES

    // #region --> CONSTRUCTOR

    /**
     * @param width The game screen width size
     * @param height The game screen height size
     * @param appendToElement The elements whom the game will be appended
     * @param canvasContextSettings An object for canvas context configurations
     */
    constructor(
        width: number,
        height: number,
        appendToElement: HTMLElement,
        canvasContextSettings: CanvasRenderingContext2DSettings = {},
    ) {
        // initializing necessary debugging tools
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

        // game POD properties
        this.#width = Math.abs(width);
        this.#height = Math.abs(height);

        // canvas configuration
        this.#canvas = document.createElement("canvas");
        this.#canvas.style.background = "transparent";
        this.#canvas.width = this.#width;
        this.#canvas.height = this.#height;

        // canvas context configuration
        this.#ctxSettings = canvasContextSettings;
        this.ctx = this.#canvas.getContext("2d", this.#ctxSettings);

        appendToElement.appendChild(this.#canvas);

        // composing game object modules
        this.#canvasBackground = new BrioCanvasBackground(this.#canvas);
        this.#render = new BrioRender(
            this,
            this.#assets,
            this.ctx!,
            this.#scale,
            this.#width,
            this.#height,
            this.#gameLastFPS,
        );

        this.#updater = new BrioUpdater(this.#assets, this.#render, this.#console);

        // game lifecicle promise
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

    /** Returns the loaded sprites that were returned in the preload step
     * @example game.load(() => {
     * return new BrioSprite("spr_player", "./spr_player.png", "img");
     * })
     * console.log(game.loadedGameSprites); // Map(spr_player -> {})
     */
    public get loadedGameSprites() {
        return this.#assets.sprites;
    }

    /** Returns the width size of the game screen */
    public get width() {
        return this.#width;
    }

    /** Returns the height size of the game screen */
    public get height() {
        return this.#height;
    }

    /**
     * Sets the background of the game screen using CSS logic
     * @param backgroundValue
     */
    public set background(backgroundValue: CanvasBackground) {
        this.#canvasBackground = backgroundValue;
    }
    public get background(): CanvasBackground {
        return this.#canvasBackground;
    }

    /** The global scale of the canvas object. All objects are scaled according to this property
     * @example const game = new BrioGame(600, 400, document.body);
     * game.scale = 2; // 128px sprites are now 256px
     */
    public set scale(scaleValue: number) {
        this.#scale = Math.abs(scaleValue);
    }
    public get scale() {
        return this.#scale;
    }

    public get gameObjects() {
        return this.#assets.objects;
    }

    public get isRunning(): boolean {
        return this.#updateIsRunning;
    }

    public get rendering() {
        return this.#rendering;
    }

    public get debugging() {
        return this.#debugger;
    }

    /**
     * An object that contains logic related to keyboard input
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
     * The first step into the game logic responsible for preloading assets
     * such as GameSprites, Audios and Videos. Those assets are loaded in an
     * assyncronous manner, that's why this step in needed
     * @param callbackFn
     */
    public preload(callbackFn: () => Array<BrioSprite | BrioAudio>): this {
        this.#lifecyclePromise = this.#lifecyclePromise.then(async () => {
            this.#currentState = GameState.PRELOAD;

            const assets = callbackFn();

            if (assets.length === 0) {
                throw new Error("Zero assets returned. You must return at least one asset.");
            }

            const sprites = assets.filter((asset) => asset instanceof BrioSprite);
            const audios = assets.filter((asset) => asset instanceof BrioAudio);

            const spriteLoadPromises = sprites.map((sprite) => {
                return new Promise<void>((resolve, reject) => {
                    sprite.element.onload = () => {
                        sprite.size = create(sprite.element.width, sprite.element.height);
                        console.log(sprite);
                        this.#assets.sprites.set(sprite.name, sprite);
                        this.#console.out("log", `Sprite: ${sprite.name} sucessfully preloaded.`);
                        resolve();
                    };
                    sprite.element.onerror = (event, source, lineno, colno, err) => {
                        reject(`Error loading the Sprite '${sprite.name}': ${err?.message}`);
                    };
                });
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
            await Promise.all(audioLoadPromises);

            this.#console.out("info", "Preload step complete!");
        });

        return this;
    }

    /** @param callbackFn A callback function that passes, by param, an object for assets manipulation */
    public load(callbackFn: LoaderCallbackFunction): this {
        this.#lifecyclePromise = this.#lifecyclePromise.then(() => {
            this.#currentState = GameState.LOAD;

            const assetsManipulationObject: AssetLoaderParam = {
                logAssets: () => {
                    this.#console.out("log", `Currently loaded sprites: ${this.#assets.sprites}.`);
                    this.#console.out("log", `Currently loaded audios: ${this.#assets.audios}.`);
                },
                getSprite: (spriteName: string) => {
                    if (!this.#assets.sprites.has(spriteName)) {
                        this.#console.out(
                            "error",
                            `Named sprite asset '${spriteName}' was not found in the preloaded resources, check if you preloaded it correctly and gave it the right name.`,
                        );
                    }

                    if (this.#assets.sprites.has(spriteName)) {
                        const spr = this.#assets.sprites.get(spriteName);
                        if (spr !== undefined) {
                            return spr;
                        }
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

                    if (this.#assets.audios.has(audioName)) {
                        const aud = this.#assets.audios.get(audioName);
                        if (aud !== undefined) {
                            return aud;
                        }
                    }

                    return BrioAudio.getEmptyInstance();
                },
            };

            const objects = callbackFn(assetsManipulationObject);
            const gameObjects = objects.filter((object) => object instanceof BrioObject);
            const gameMaps = objects.filter((object) => object instanceof BrioMap);
            const gameCameras = objects.filter((object) => object instanceof BrioCamera);

            gameObjects.forEach((gameObject) => {
                // prettier-ignore
                if (gameObject.transform.size.x <= 0 && gameObject.transform.size.y <= 0) {
                    const sprite = this.#assets.sprites.get(gameObject.sprite) ?? BrioSprite.getEmptyInstance();

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
     * A method that loops through given logic inside it many times per second, be it for
     * changing BrioObject coordinates or checking if a key was pressed.
     * @param callbackFn A callback function that passes, by param, an object for game objects manipulation and the time elapsed since the last frame (delta time)
     * @param callbackFn.updater An object providing methods to manipulate game objects and work around the update loop
     * @param callbackFn.deltaTime The time elapsed since the last frame, in seconds, used for frame-rate independent updates
     *
     * @example game.update((updater, dt) => {
     * const obj_player = updater.loaded("obj_player"); // returns the BrioObject for Player
     *
     * if(game.keyboard.isDown("ArrowUp")) {
     * obj_player.pos.y += -300 * dt; // makes the player go up (multiplying it by DeltaTime for FPS consistency)
     * }});
     */
    public update(callbackFn: (updater: BrioUpdater, deltaTime: number) => void): this {
        this.#lifecyclePromise = this.#lifecyclePromise.then(() => {
            this.#currentState = GameState.UPDATE;
            this.#updateIsRunning = true;

            this.#console.out("info", "Update step started!");

            // runs the update loop for the first time (so it can be paused and resumed after that)
            this.#updateLoopLogic = (currentTime: number) => {
                if (this.#currentState !== GameState.UPDATE) {
                    return;
                }

                this.#assets.objects.forEach((gameObject) => {
                    this.#render.clearObject(gameObject);
                });

                const deltaTime = (currentTime - this.#deltaTimePreviousTime) / 1000;

                // -> debug PFS
                this.#gameLastFPS = this.#render.gameLastFPS = 1 / deltaTime;

                this.#renderDebuggingGrid();

                // main callback call
                callbackFn(this.#updater, deltaTime);

                // #region PRIMITIVE-LAYER-RENDERING
                const objects = Array.from(this.#assets.objects.values());
                objects.sort((a, b) => a.transform.layer - b.transform.layer);

                for (let i = 0; i < objects.length; ++i) {
                    this.#render.renderObject(objects[i]);
                }
                // #endregion PRIMITIVE-LAYER-RENDERING

                this.#renderDebuggingHelpers();

                // storing the keyboard prev state before it changes
                this.#keyboardPrevState.clear();
                for (const state of this.#keyboardState) {
                    this.#keyboardPrevState.set(state[0], state[1]);
                }

                this.#deltaTimePreviousTime = currentTime;

                if (this.#updateLoopLogic) {
                    this.#updateFrameId = requestAnimationFrame(this.#updateLoopLogic);
                }
            };
            requestAnimationFrame(this.#updateLoopLogic);
        });

        return this;
    }

    // #endregion --> GAME-STATES

    // #region --> METHODS

    #renderDebuggingGrid() {
        const render = this.#render;
        const renderConfig = this.#debugger.render;
        const gridWidth = renderConfig.grid.width;
        const gridHeight = renderConfig.grid.height;

        if (renderConfig.grid.enabled) render.renderGrid(gridWidth ?? 32, gridHeight ?? 32);
        if (renderConfig.grid.showAxisRulers) render.renderAxisRulers();
    }

    #renderDebuggingHelpers() {
        const render = this.#render;
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

    public createSnapshot() {
        this.#assets.objects.forEach((object, key) => {
            this.#cachedObjects.set(key, JSON.stringify(object));
        });
        this.#assets.sprites.forEach((sprite, key) => {
            this.#cachedSprites.set(key, JSON.stringify(sprite));
        });
    }

    public useSnapshot() {
        for (const [key, object] of this.#cachedObjects) {
            if (!this.#assets.objects.has(key)) {
                //this.#assets.objects.delete(key);
                break;
            }
            this.#assets.objects.set(key, JSON.parse(object));
        }
    }

    /**
     * EXTERNAL METHODS -----------------------------------------------------------------
     */

    public createCheckPoint() {
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
     * Pauses the game.
     *
     * @example game.useKeyboard(); // enables the keyboard
     * game.keyboard.globalCustomEvents.set("Escape", () => {
     *
     * if(game.isRunning) game.pause(); // pausing the game
     * else game.resume(); // resuming the game
     * });
     */
    public pause() {
        if (this.#updateIsRunning) {
            this.#currentState = GameState.UNSET;
            this.#updateIsRunning = false;
            cancelAnimationFrame(this.#updateFrameId);
            this.#console.out("info", "Game stopped!");
        }
    }

    /**
     * Resumes the game.
     *
     * @example game.useKeyboard(); // enables the keyboard
     * game.keyboard.globalCustomEvents.set("Escape", () => {
     *
     * if(game.isRunning) game.pause(); // pausing the game
     * else game.resume(); // resuming the game
     * });
     */
    public resume() {
        if (!this.#updateIsRunning) {
            this.#currentState = GameState.UPDATE;
            this.#updateIsRunning = true;
            if (this.#updateLoopLogic) {
                requestAnimationFrame(this.#updateLoopLogic);
            }
            this.#console.out("info", "Game resumed!");
        }
    }

    /**
     * Ends the game, cleaning listeners and game data in the current run.
     * @example game.update((updater, dt) => {
     * // game logic
     *
     * if(gameReachedEndGoal) game.end();
     * });
     */
    public end() {
        // disabling logs to prevent error messages
        this.#console.enabled = false;

        // pausing the game update loop
        this.pause();

        // removing listener
        if (this.#keyboardInstance) {
            this.#keyboardInstance?.removeListener();
        }

        // clearing data
        this.#assets.audios.clear();
        this.#assets.cameras.clear();
        this.#assets.maps.clear();
        this.#assets.objects.clear();
        this.#assets.sprites.clear();
        this.#keyboardState.clear();
        this.#loggedErros.clear();

        this.#console.out("info", "Game ended!");
    }

    public restart() {
        // restart logic
    }

    public removeObject<T extends BrioObject>(targetObject: T) {
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
            this.#render.clearObject(targetObject);
        }

        if (objectExists) {
            this.#console.out("warn", `${targetObject.name} was removed from the scene!`);
        }
    }

    public outbound(
        targetObject: BrioObject,
        screenThreshold: number = 1,
        callbackFn?: () => void,
    ) {
        if (!targetObject) {
            return;
        }

        let auxWidth = screenThreshold !== 1 ? this.#width : 0;
        let auxHeight = screenThreshold !== 1 ? this.#width : 0;
        if (
            targetObject.transform.position.x > this.#width * screenThreshold ||
            targetObject.transform.position.x + targetObject.transform.size.x * this.#scale <
                0 * auxWidth * screenThreshold ||
            targetObject.transform.position.y > this.#height * screenThreshold ||
            targetObject.transform.position.y + targetObject.transform.size.y * this.#scale <
                0 * auxHeight * screenThreshold
        ) {
            // this.stopGame();
            // this.removeObject(targetObject);
            if (callbackFn) {
                callbackFn();
            } else {
                this.pause();
            }
        }
    }

    public instantiate(targetObject: BrioObject): BrioObject {
        BrioObject.instanceOfObject = true;

        // prettier-ignore
        const registeredObject = this.#assets.objects.get(targetObject.name) ?? BrioObject.getEmptyInstance();

        // cloning object
        const newObject = new BrioObject(
            `${registeredObject.name}-${registeredObject.clonesInstantiatedValue + 1}`,
            registeredObject.sprite,
            registeredObject.transform.layer,
        );
        newObject.transform.size.x = registeredObject.transform.size.x;
        newObject.transform.size.y = registeredObject.transform.size.y;

        // increasing the amount of clones created
        registeredObject.clonesInstantiatedValue = 1;

        // cloning collider
        if (registeredObject.collision) {
            newObject.addCollisionMask(
                registeredObject.collision.shape,
                registeredObject.collision.colliderType,
                registeredObject.collision.pos.x,
                registeredObject.collision.pos.y,
                registeredObject.collision.size.x,
                registeredObject.collision.size.y,
            );
        }

        // setting an id
        newObject.instanceId = targetObject.clonesInstantiatedValue;

        // add instantiated object to map
        if (!this.#assets.objects.has(newObject.name)) {
            this.#assets.objects.set(newObject.name, newObject);
        }

        BrioObject.instanceOfObject = false;

        return newObject;
    }

    public destroy(targetObject: BrioObject) {
        if (this.#assets.objects.has(targetObject.name)) {
            this.#assets.objects.delete(targetObject.name);
        }
        if (this.#assets.sprites.has(targetObject.sprite)) {
            this.#render.clearObject(targetObject);
            this.#assets.sprites.delete(targetObject.name);
        }
    }

    public isColliding(obj1: BrioObject, obj2: BrioObject): boolean {
        let result: boolean = false;

        if (!obj1.collision || !obj2.collision) {
            console.info("not");
            return false;
        }

        if (
            obj1.transform.position.x <= obj2.transform.position.x + obj2.collision.size.x &&
            obj1.transform.position.x + obj1.collision.size.x >= obj2.transform.position.x &&
            obj1.transform.position.y <= obj2.transform.position.y + obj2.collision.size.y &&
            obj1.transform.position.y + obj1.collision.size.y >= obj2.transform.position.y
        ) {
            result = true;
        }

        return result;
    }

    public translate(px: number, py: number) {
        if (this.ctx) {
            this.ctx.setTransform(1, 0, 0, 1, px, py);
        }
    }

    // -> GAME UTILITIES

    /** Automatically resizes the game screen into Fullscreen Mode using an EventListener */
    public useFullScreen() {
        window.addEventListener("load", () => {
            this.#canvas.width = window.innerWidth;
            this.#canvas.height = window.innerHeight;
        });
    }

    /** Clears the entire canvas context. Beware of things that you don't want to clear! */
    public useClearScreen() {
        if (this.ctx) {
            this.ctx.reset();
        }
    }

    public useKeyboard() {
        this.#keyboardInstance = new BrioKeyboard(
            this.#keyboardState,
            this.#keyboardPrevState,
            this.#console,
        );
        this.#keyboardEnabled = true;
    }

    public useGamepad() {
        window.addEventListener("gamepadconnected", (event) => {
            this.#console.out("log", `gamepadconnected ${event}.`);
        });

        window.addEventListener("gamepaddisconnected", (event) => {
            this.#console.out("log", `gamepadisconnnected ${event}.`);
        });
    }

    // #endregion --> METHODS
}
