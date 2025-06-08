import { Sprite } from "./Sprite.js";
var GameState;
(function (GameState) {
    GameState[GameState["unset"] = 0] = "unset";
    GameState[GameState["preload"] = 1] = "preload";
    GameState[GameState["load"] = 2] = "load";
    GameState[GameState["update"] = 3] = "update";
    GameState[GameState["error"] = 4] = "error";
})(GameState || (GameState = {}));
export class Game {
    /** @type {HTMLCanvasElement} Canvas element that serves as the game sandbox */
    #canvas;
    /** @type {CanvasRenderingContext2D} Context of the Canvas element */
    #context = null;
    /** @type {CanvasRenderingContext2DSettings} Settings of the Context from the Canvas element */
    #contextSettings = {};
    /** @type {number} Width of the Canvas element */
    #width;
    /** @type {number} Height of the Canvas element */
    #height;
    /** @type {Map<string, Sprite>} A map that contains loaded sprites (returned in the preload state) */
    #loadedSprites = new Map();
    /** @type {Map<string, GameObject>} A map that contains loaded gameobjects (returned in the load state) */
    #loadedGameObjects = new Map();
    /** @type {number} Global scale multiplier for all sprites in-game */
    #scale = 1;
    /** @type {0 | 1 | 2 | 3 | 4} States in which the game will run throught the development process (unset->preload->load->update) */
    #currentState = GameState.unset;
    /** @type {boolean} A boolean for knowing when to use utility logs */
    #logsEnabled = false;
    /** @type {"smooth" | "pixelated"} The type of rendering that the canvas will use */
    #renderingType = "smooth";
    /** @type {"low" | "medium" | "high"} The quality of smoothing that will be used if using the "smooth" type */
    #smoothRenderingValue = "low";
    /**
     * @param {number} width The game screen width size
     * @param {number} height The game screen height size
     * @param {HTMLElement} appendTo The elements whom the game will be appended
     * @param {CanvasRenderingContext2DSettings} [canvasContextSettings={}] An object for canvas context configurations
     */
    constructor(width, height, appendTo, canvasContextSettings = {}) {
        this.#width = width;
        this.#height = height;
        this.#contextSettings = canvasContextSettings;
        this.#canvas = document.createElement("canvas");
        this.#context = this.#canvas.getContext("2d", this.#contextSettings);
        this.#canvas.width = this.#width;
        this.#canvas.height = this.#height;
        this.#canvas.style.background = "#DDD";
        appendTo.appendChild(this.#canvas);
    }
    /**
     * GETTERS AND SETTERS --------------------------------------------------------------
     */
    /** Returns the loaded sprites that were returned in the preload step
     * @example game.load(() => {
     * return new Sprite("spr_player", "./spr_player.png", "img");
     * })
     * console.log(game.loadedSprites); // Map(spr_player -> {})
     */
    get loadedSprites() {
        return this.#loadedSprites;
    }
    /** Returns the width size of the game screen */
    get width() {
        return this.#width;
    }
    /** Returns the height size of the game screen */
    get height() {
        return this.#height;
    }
    /** Sets the background of the game screen using common CSS logic */
    set background(backgroundValue) {
        this.#canvas.style.background = backgroundValue;
    }
    /** The global scale of the canvas object. All objects are scaled according to this property
     * @type {number}
     * @example const game = new Game(600, 400, document.body);
     * game.scale = 2; // 128px sprites are now 256px
     */
    get scale() {
        return this.#scale;
    }
    set scale(scaleValue) {
        this.#scale = Math.abs(scaleValue);
    }
    /** The rendering type used in the game
     * @example const game = new Game(600, 400, document.body);
     * game.renderingType = "pixelated"; // makes the sprites crispy looking
     * @default "smooth"
     */
    get renderingType() {
        return this.#renderingType;
    }
    /** @param {"smooth" | "pixelated"} renderingType */
    set renderingType(renderingType) {
        this.#renderingType = renderingType;
    }
    /** The quality of the smoothness of game sprites. Only works when renderingType is set to "smooth"
     * @example const game = new Game(600, 400, document.body);
     * game.renderingType = "smooth";
     * game.smoothingQuality = "high"; // makes the sprites more smooth
     * @default "low"
     */
    get smoothingQuality() {
        return this.#smoothRenderingValue;
    }
    /** @param {"low" | "medium" | "high"} smoothingQuality */
    set smoothingQuality(smoothingQuality) {
        if (this.#renderingType !== "smooth") {
            throw new Error(`The current rendering type is set to '${this.renderingType}', set it to 'smooth' to use this attribute`);
        }
        this.#smoothRenderingValue = smoothingQuality;
    }
    /**
     * GAME STEPS -----------------------------------------------------------------------
     */
    /**
     * The first step into the game logic responsible for preloading assets
     * such as Sprites, Audios and Videos. Those assets loads in an
     * assyncronous manner, that's why this step in needed
     * @param {() => Array<any> | any} callbackFn
     */
    preload(callbackFn) {
        const assets = callbackFn();
        if (assets.length === 0) {
            throw new Error("Zero assets returned. You must return at least one asset.");
        }
        const sprites = assets.filter((asset) => asset instanceof Sprite);
        sprites.forEach((sprite) => {
            sprite.element.onload = () => {
                this.#loadedSprites.set(sprite.name, sprite);
                if (this.#logsEnabled) {
                    console.info(`${sprite.name} was sucessfully preloaded`);
                }
            };
            sprite.element.onerror = (event, source, lineno, colno, error) => {
                console.log(event, source, lineno, colno);
                console.error(error);
            };
        });
        this.#currentState = GameState.preload;
    }
    /**
     * @typedef {object} AssetsObject The object passed as a param into the callbackFn
     * @property {() => void} logSprites Logs the available sprites that were preloaded
     * @property {(assetName: string) => Sprite} preloaded Returns the Sprite object of the given name
     **/
    /** @param {(assets: AssetsObject) => Array<GameObject>} callbackFn A callback function that passes, by param, an object for assets manipulation */
    load(callbackFn) {
        setTimeout(() => {
            const assets = {
                logSprites: () => {
                    console.log("currently loaded sprites: ", this.loadedSprites);
                },
                preloaded: (assetName) => {
                    if (this.#logsEnabled && !this.#loadedSprites.has(assetName)) {
                        console.error(`Named asset '${assetName}' was not found in the preloaded resources, check if you preloaded it correctly and gave it the right name`);
                    }
                    if (this.#loadedSprites.has(assetName))
                        return this.#loadedSprites.get(assetName);
                },
            };
            const gameObjects = callbackFn(assets);
            gameObjects.forEach((gameObject) => {
                this.#drawSprite(gameObject);
                this.#loadedGameObjects.set(gameObject.name, gameObject);
            });
        }, 300);
    }
    /**
     * @typedef {object} UpdaterObject The object passed as a param into the callbackFn
     * @property {() => void} logGameObjects Logs the available game objects that were loaded
     * @property {(gameObjectName: string) => GameObject} loaded Returns the game object with the given name
     * @property {(gameObjectName: string) => void} animate Animates a given game object and its properties
     * @property {(gameObjectInstances: GameObject[]) => void} animateInstance Animates instances of a given array of cloned objects
     * @property {() => void} stop Stops the update animation loop, essencialy freezing the game
     */
    /** @param {(updater: UpdaterObject) => void } callbackFn A callback function that passes, by param, an object for game objects manipulation */
    update(callbackFn) {
        setTimeout(() => {
            const updater = {
                logGameObjects: () => {
                    console.log("Currently loaded game objects: ", this.#loadedGameObjects);
                },
                loaded: (gameObjectName) => {
                    if (this.#logsEnabled && !this.#loadedGameObjects.has(gameObjectName)) {
                        console.error(`Named game object '${gameObjectName}' was not found in the loaded resources, check if you loaded it correctly and gave it the right name`);
                    }
                    if (this.#loadedGameObjects.has(gameObjectName)) {
                        return this.#loadedGameObjects.get(gameObjectName);
                    }
                },
                animate: (gameObjectName) => {
                    if (this.#context && this.#loadedGameObjects.has(gameObjectName)) {
                        const gameObject = this.#loadedGameObjects.get(gameObjectName);
                        if (gameObject) {
                            this.#drawSprite(gameObject);
                        }
                    }
                },
                animateInstance: (gameObjectInstance) => {
                    gameObjectInstance.forEach((gameObject, index) => {
                        this.#drawSprite(gameObject);
                    });
                },
                stop: () => {
                    cancelAnimationFrame(1);
                },
            };
            const loop = () => {
                callbackFn(updater);
                requestAnimationFrame(loop);
            };
            loop();
        }, 350);
    }
    /**
     * INTERNAL METHODS -----------------------------------------------------------------
     */
    /** A function that draws an object into the canvas element while considering scale and rendering type
     * @private */
    #drawSprite(gameObject) {
        if (this.#context) {
            if (this.#renderingType === "smooth") {
                this.#context.imageSmoothingEnabled = true;
                this.#context.imageSmoothingQuality = this.#smoothRenderingValue;
            }
            else if (this.#renderingType === "pixelated") {
                this.#context.imageSmoothingEnabled = false;
            }
            this.#context.drawImage(gameObject.sprite.element, gameObject.pos.x, gameObject.pos.y, gameObject.size.w * this.#scale, gameObject.size.h * this.#scale);
        }
    }
    /**
     * GAME UTILITIES -------------------------------------------------------------------
     */
    /** Automatically resizes the game screen into Fullscreen Mode using an EventListener */
    useFullScreen() {
        window.addEventListener("resize", () => {
            this.#canvas.width = window.innerWidth;
            this.#canvas.height = window.innerHeight;
        });
    }
    /** Clears the entire canvas context. Beware of things that you don't want to clear! */
    useClearScreen() {
        if (this.#context) {
            this.#context.reset();
        }
    }
    /** Allows utility logs into the console, such as assets and objects being loaded */
    useUtilityLogs() {
        if (!this.#logsEnabled) {
            console.warn("Utility logs are now enabled, be carefull of what you're going to show into your console!");
            this.#logsEnabled = true;
        }
    }
}
