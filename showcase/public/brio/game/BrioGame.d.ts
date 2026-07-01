import { BrioSprite } from "../assets/BrioSprite.js";
import { BrioObject } from "../objects/BrioObject.js";
import { BrioKeyboard } from "../input/BrioKeyboard.js";
import { BrioMap } from "../not-implemented/BrioMap.js";
import { BrioAudio } from "../assets/BrioAudio.js";
import { BrioDebugger } from "../debugging/BrioDebugger.js";
import { CanvasBackground } from "./BrioCanvasBackground.js";
import { BrioUpdater } from "./BrioUpdater.js";
/** Used for managing the game-state step process */
export declare enum GameState {
    UNSET = 0,
    PRELOAD = 1,
    LOAD = 2,
    UPDATE = 3,
    ERROR = 4
}
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
interface CanvasRendering {
    mode: "smooth" | "pixelated";
    smoothness: ImageSmoothingQuality;
}
export declare class BrioGame {
    #private;
    /** Context of the Canvas element */
    ctx: CanvasRenderingContext2D | null;
    cachedObjects: Map<string, Map<string, any>>;
    /**
     * @param width The game screen width size
     * @param height The game screen height size
     * @param appendToElement The elements whom the game will be appended
     * @param canvasContextSettings An object for canvas context configurations
     */
    constructor(width: number, height: number, appendToElement: HTMLElement, canvasContextSettings?: CanvasRenderingContext2DSettings);
    /** Returns the loaded sprites that were returned in the preload step
     * @example game.load(() => {
     * return new BrioSprite("spr_player", "./spr_player.png", "img");
     * })
     * console.log(game.loadedGameSprites); // Map(spr_player -> {})
     */
    get loadedGameSprites(): Map<string, BrioSprite>;
    /** Returns the width size of the game screen */
    get width(): number;
    /** Returns the height size of the game screen */
    get height(): number;
    /**
     * Sets the background of the game screen using CSS logic
     * @param backgroundValue
     */
    set background(backgroundValue: CanvasBackground);
    get background(): CanvasBackground;
    /** The global scale of the canvas object. All objects are scaled according to this property
     * @example const game = new BrioGame(600, 400, document.body);
     * game.scale = 2; // 128px sprites are now 256px
     */
    set scale(scaleValue: number);
    get scale(): number;
    get gameObjects(): Map<string, BrioObject>;
    get isRunning(): boolean;
    get rendering(): CanvasRendering;
    get debugging(): BrioDebugger;
    /**
     * An object that contains logic related to keyboard input
     */
    get keyboard(): BrioKeyboard;
    /**
     * The first step into the game logic responsible for preloading assets
     * such as GameSprites, Audios and Videos. Those assets are loaded in an
     * assyncronous manner, that's why this step in needed
     * @param callbackFn
     */
    preload(callbackFn: () => Array<BrioSprite | BrioAudio>): this;
    /** @param callbackFn A callback function that passes, by param, an object for assets manipulation */
    load(callbackFn: LoaderCallbackFunction): this;
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
    update(callbackFn: (updater: BrioUpdater, deltaTime: number) => void): this;
    /**
     * INTERNAL METHODS -----------------------------------------------------------------
     */
    createSnapshot(): void;
    useSnapshot(): void;
    /**
     * EXTERNAL METHODS -----------------------------------------------------------------
     */
    createCheckPoint(): void;
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
    pause(): void;
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
    resume(): void;
    /**
     * Ends the game, cleaning listeners and game data in the current run.
     * @example game.update((updater, dt) => {
     * // game logic
     *
     * if(gameReachedEndGoal) game.end();
     * });
     */
    end(): void;
    restart(): void;
    removeObject<T extends BrioObject>(targetObject: T): void;
    outbound(targetObject: BrioObject, screenThreshold?: number, callbackFn?: () => void): void;
    instantiate(targetObject: BrioObject): BrioObject;
    destroy(targetObject: BrioObject): void;
    isColliding(obj1: BrioObject, obj2: BrioObject): boolean;
    translate(px: number, py: number): void;
    /** Automatically resizes the game screen into Fullscreen Mode using an EventListener */
    useFullScreen(): void;
    /** Clears the entire canvas context. Beware of things that you don't want to clear! */
    useClearScreen(): void;
    useKeyboard(): void;
    useGamepad(): void;
}
export {};
//# sourceMappingURL=BrioGame.d.ts.map
