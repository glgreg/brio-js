import { Sprite } from "./Sprite.js";
import { GameObject } from "./GameObject.js";
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
    /** @type {0 | 1 | 2 | 3 | 4} States in which the game will run throught the development process (unset->preload->load->update->error) */
    #currentState = GameState.unset;
    /** @type {boolean} A boolean for knowing when to use utility logs */
    #logsEnabled = false;
    /** @type {"smooth" | "pixelated"} The type of rendering that the canvas will use */
    #renderingType = "smooth";
    /** @type {"low" | "medium" | "high"} The quality of smoothing that will be used if using the "smooth" type */
    #smoothRenderingValue = "low";
    /** @type {number} Id created in the update step, used for stoping the update loop */
    #updateFrameId = 0;
    /** @type {Set<string>} A set that holds the logged erros so they don't appear multiple times in the console when using the update loop */
    #loggedErros = new Set();
    /** @type {Promise<void>} A promise that resolves the lyfecicle of the game, going to preload -> load -> update */
    #lifecyclePromise = Promise.resolve();
    /** @type {Set<string>} A set that holds keys for events that run only once in the update step */
    #updaterRunOnceKeys = new Set();
    /** @type {number} A variable that holds the previous time of a animation frame, used to get the deltaTime in the update step */
    #deltaTimePreviousTime = 0;
    // keyboard
    #keyboardEnabled = false;
    #keyboardState = new Map();
    #keyboardInstance = null;
    ctx = this.#context;
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
        appendTo.appendChild(this.#canvas);
        this.#lifecyclePromise.catch((err) => {
            this.#currentState = GameState.error;
            console.error("An error occurred during the game lifecycle: ", err);
        });
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
            throw new Error(`The current rendering type is set to '${this.renderingType}', set it to 'smooth' to use the 'smoothingQuality' attribute`);
        }
        this.#smoothRenderingValue = smoothingQuality;
    }
    get gameObjects() {
        return this.#loadedGameObjects;
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
        this.#lifecyclePromise = this.#lifecyclePromise.then(async () => {
            this.#currentState = GameState.preload;
            const assets = [].concat(callbackFn() || []);
            if (assets.length === 0) {
                throw new Error("Zero assets returned. You must return at least one asset.");
            }
            const sprites = assets.filter((asset) => asset instanceof Sprite);
            const spriteLoadPromises = sprites.map((sprite) => {
                return new Promise((resolve, reject) => {
                    sprite.element.onload = () => {
                        this.#loadedSprites.set(sprite.name, sprite);
                        if (this.#logsEnabled) {
                            console.log(`${sprite.name} was sucessfully preloaded`);
                        }
                        resolve();
                    };
                    sprite.element.onerror = (event, source, lineno, colno, err) => {
                        reject(err);
                    };
                });
            });
            await Promise.all(spriteLoadPromises);
            if (this.#logsEnabled)
                console.info("Preload step complete!");
        });
        return this;
    }
    /**
     * @typedef {object} AssetsObject The object passed as a param into the callbackFn
     * @property {() => void} logSprites Logs the available sprites that were preloaded
     * @property {(assetName: string) => Sprite} preloaded Returns the Sprite object of the given name
     **/
    /** @param {(assets: AssetsObject) => Array<GameObject>} callbackFn A callback function that passes, by param, an object for assets manipulation */
    load(callbackFn) {
        this.#lifecyclePromise = this.#lifecyclePromise.then(() => {
            this.#currentState = GameState.load;
            const assets = {
                logSprites: () => {
                    console.log("currently loaded sprites: ", this.loadedSprites);
                },
                preloaded: (assetName) => {
                    if (this.#logsEnabled && !this.#loadedSprites.has(assetName)) {
                        console.error(`Named asset '${assetName}' was not found in the preloaded resources, check if you preloaded it correctly and gave it the right name`);
                    }
                    if (this.#loadedSprites.has(assetName)) {
                        return this.#loadedSprites.get(assetName);
                    }
                },
            };
            const gameObjects = callbackFn(assets);
            gameObjects.forEach((gameObject) => {
                this.#loadedGameObjects.set(gameObject.name, gameObject);
            });
            if (this.#logsEnabled)
                console.info("Load step complete!");
        });
        return this;
    }
    /**
     * @typedef {object} UpdaterObject The object passed as a param into the callbackFn
     * @property {() => void} logGameObjects Logs the available game objects that were loaded
     * @property {(gameObjectName: string) => GameObject} loaded Returns the game object with the given name
     * @property {(gameObjectName: string) => void} animateFromName Animates a given named game object and its properties
     * @property {(gameObject: GameObject) => void} animate Animates the given game object
     * @property {(gameObjects: GameObject[]) => void} animateMany Animates instances of a given array of game objects
     * @property {() => void} stop Stops the update animation loop, essencialy freezing the game
     * @property {(identifier: string, callbackFn: () => any) => void} runOnce Runs only once time the logic inside the block code
     */
    /**
     * @param {(updater: UpdaterObject, deltaTime: number) => void } callbackFn A callback function that passes, by param, an object for game objects manipulation and the time elapsed since the last frame (delta time)
     * @param {UpdaterObject} callbackFn.updater An object providing methods to manipulate game objects and work around the update loop
     * @param {number} callbackFn.deltaTime The time elapsed since the last frame, in seconds, used for frame-rate independent updates
     */
    update(callbackFn) {
        this.#lifecyclePromise = this.#lifecyclePromise.then(() => {
            this.#currentState = GameState.update;
            const updater = {
                logGameObjects: () => {
                    console.log("Currently loaded game objects: ", this.#loadedGameObjects);
                },
                loaded: (gameObjectName) => {
                    if (this.#logsEnabled &&
                        !this.#loadedGameObjects.has(gameObjectName) &&
                        !this.#loggedErros.has(`loadError: ${gameObjectName}`)) {
                        console.error(`Named game object '${gameObjectName}' was not found in the loaded resources, check if you loaded it correctly and gave it the right name`);
                        this.#loggedErros.add(`loadError: ${gameObjectName}`);
                        return;
                    }
                    if (this.#loadedGameObjects.has(gameObjectName)) {
                        return this.#loadedGameObjects.get(gameObjectName);
                    }
                },
                animateFromName: (gameObjectName) => {
                    if (!this.#loadedGameObjects.has(gameObjectName) &&
                        this.#logsEnabled &&
                        !this.#loggedErros.has(`loadError: ${gameObjectName}`)) {
                        console.error(`Named game object '${gameObjectName}' was not found in the loaded resources, check if you loaded it correctly and gave it the right name`);
                        this.#loggedErros.add(`loadError: ${gameObjectName}`);
                    }
                    if (this.#loadedGameObjects.has(gameObjectName)) {
                        const gameObject = this.#loadedGameObjects.get(gameObjectName);
                        if (gameObject) {
                            this.#drawSprite(gameObject);
                        }
                    }
                },
                animate: (gameObjec) => {
                    const gameObject = this.#loadedGameObjects.get(gameObjec.name);
                    if (gameObject) {
                        this.#drawSprite(gameObject);
                    }
                },
                animateMany: (gameObjects) => {
                    for (let i = 0; i < gameObjects.length; i++) {
                        if (this.#loadedGameObjects.has(gameObjects[i].name)) {
                            const gameObject = this.#loadedGameObjects.get(gameObjects[i].name);
                            if (gameObject) {
                                this.#drawSprite(gameObject);
                            }
                        }
                    }
                },
                runOnce: (identifier, callbackFn) => {
                    if (!this.#updaterRunOnceKeys.has(identifier)) {
                        callbackFn();
                        if (this.#logsEnabled) {
                            console.info(`Runned once with the ID: ${identifier}`);
                        }
                        this.#updaterRunOnceKeys.add(identifier);
                    }
                },
            };
            if (this.#logsEnabled)
                console.info("Update step started!");
            const loop = (currentTime) => {
                if (this.#currentState === GameState.unset) {
                    return;
                }
                this.#loadedGameObjects.forEach((gameObject, key) => {
                    this.#clearSprite(gameObject);
                });
                const deltaTime = (currentTime - this.#deltaTimePreviousTime) / 1000;
                callbackFn(updater, deltaTime);
                this.#deltaTimePreviousTime = currentTime;
                this.#updateFrameId = requestAnimationFrame(loop);
            };
            requestAnimationFrame(loop);
        });
        return this;
    }
    /**
     * INTERNAL METHODS -----------------------------------------------------------------
     */
    /** A function that draws an object into the canvas element while considering scale and rendering type
     * @private */
    #drawSprite(gameObject) {
        if (!this.#context || !gameObject) {
            return;
        }
        if (this.#renderingType === "smooth") {
            this.#context.imageSmoothingEnabled = true;
            this.#context.imageSmoothingQuality = this.#smoothRenderingValue;
        }
        else if (this.#renderingType === "pixelated") {
            this.#context.imageSmoothingEnabled = false;
        }
        this.#context.drawImage(gameObject.sprite.element, gameObject.pos.x, gameObject.pos.y, gameObject.size.x * this.#scale, gameObject.size.y * this.#scale);
    }
    #clearSprite(gameObject) {
        if (!this.#context || !gameObject) {
            return;
        }
        this.#context.clearRect(gameObject.pos.x, gameObject.pos.y, gameObject.size.x * this.#scale, gameObject.size.y * this.#scale);
    }
    /**
     * EXTERNAL METHODS -----------------------------------------------------------------
     */
    stopGame(waitingTime) {
        const stop = () => {
            this.#currentState = GameState.unset;
            cancelAnimationFrame(this.#updateFrameId);
            if (this.#logsEnabled)
                console.info("Game stopped!");
        };
        if (waitingTime) {
            setTimeout(() => {
                stop();
            }, waitingTime);
        }
        else {
            stop();
        }
    }
    removeObject(targetObject) {
        let objectExists = false;
        if (targetObject instanceof Sprite && this.#loadedSprites.has(targetObject.name)) {
            objectExists = true;
            this.#loadedSprites.delete(targetObject.name);
        }
        else if (targetObject instanceof GameObject &&
            this.#loadedGameObjects.has(targetObject.name)) {
            objectExists = true;
            this.#loadedGameObjects.delete(targetObject.name);
        }
        if (this.#context && objectExists) {
            this.#context.clearRect(targetObject.pos.x, targetObject.pos.y, targetObject.size.x * this.#scale, targetObject.size.y * this.#scale);
        }
        if (objectExists && this.#logsEnabled) {
            console.warn(`${targetObject.name} was removed from the scene!`);
        }
    }
    outbound(targetObject, screenThreshold = 1, callbackFn) {
        if (!targetObject) {
            return;
        }
        let auxWidth = screenThreshold !== 1 ? this.#width : 0;
        let auxHeight = screenThreshold !== 1 ? this.#width : 0;
        if (targetObject.pos.x > this.#width * screenThreshold ||
            targetObject.pos.x + targetObject.size.x * this.#scale < 0 * auxWidth * screenThreshold ||
            targetObject.pos.y > this.#height * screenThreshold ||
            targetObject.pos.y + targetObject.size.y * this.#scale < 0 * auxHeight * screenThreshold) {
            // this.stopGame();
            // this.removeObject(targetObject);
            if (callbackFn) {
                callbackFn();
            }
            else {
                this.stopGame();
            }
        }
    }
    instantiate(targetObject, quantity = 1) {
        const instances = [];
        GameObject.instanceOfObject = true;
        for (let i = 0; i < quantity; i++) {
            const newObject = new GameObject(`${targetObject.name}-${i + 1}`, Sprite.clone(targetObject.sprite), targetObject.layer);
            newObject.instanceId++;
            // add instantiated object to map
            if (!this.#loadedGameObjects.has(newObject.name)) {
                this.#loadedGameObjects.set(newObject.name, newObject);
            }
            if (this.#loadedGameObjects.has(newObject.name)) {
                instances.push(newObject);
            }
        }
        GameObject.instanceOfObject = false;
        return instances;
    }
    destroy(targetObject) {
        if (this.#context && this.#loadedSprites.has(targetObject.sprite.name)) {
            this.#context.clearRect(targetObject.pos.x, targetObject.pos.y, targetObject.size.x * this.scale, targetObject.size.y * this.scale);
        }
    }
    colliding(object1, object2) {
        if (typeof object1.collision.x === "number" &&
            typeof object1.collision.y === "number" &&
            typeof object1.collision.w === "number" &&
            typeof object1.collision.h === "number" &&
            typeof object2.collision.x === "number" &&
            typeof object2.collision.y === "number" &&
            typeof object2.collision.w === "number" &&
            typeof object2.collision.h === "number") {
            if (object1.pos.x <= object2.pos.x + object2.collision.w &&
                object1.pos.x + object1.collision.w >= object2.pos.x &&
                object1.pos.y <= object2.pos.y + object2.collision.h &&
                object1.pos.y + object1.collision.h >= object2.pos.y) {
                if (this.#logsEnabled) {
                    console.log(`Collision between ${object1.name} and ${object2.name}`);
                }
                return true;
            }
        }
        return false;
    }
    translate(px, py) {
        if (this.#context) {
            this.#context.setTransform(1, 0, 0, 1, px, py);
        }
    }
    /**
     * GAME UTILITIES -------------------------------------------------------------------
     */
    /** Automatically resizes the game screen into Fullscreen Mode using an EventListener */
    useFullScreen() {
        window.addEventListener("load", () => {
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
            console.info("Utility logs are now enabled");
            this.#logsEnabled = true;
        }
    }
    useShowCollisions() {
        this.#loadedGameObjects.forEach((gameObject, key) => {
            if (this.#context &&
                typeof gameObject.collision.x === "number" &&
                typeof gameObject.collision.y === "number" &&
                typeof gameObject.collision.w === "number" &&
                typeof gameObject.collision.h === "number") {
                this.#context.beginPath();
                this.#context.rect(gameObject.pos.x + gameObject.collision.x, gameObject.pos.y + gameObject.collision.y, gameObject.collision.w, gameObject.collision.h);
                this.#context.lineWidth = 2;
                this.#context.strokeStyle = "#F00";
                this.#context.stroke();
                this.#context.closePath();
            }
        });
    }
    useShowBorders() {
        this.#loadedGameObjects.forEach((gameObject, key) => {
            if (this.#context) {
                this.#context.beginPath();
                this.#context.rect(gameObject.pos.x, gameObject.pos.y, gameObject.size.x * this.#scale, gameObject.size.y * this.#scale);
                this.#context.lineWidth = 2;
                this.#context.strokeStyle = "#0F0";
                this.#context.stroke();
                this.#context.closePath();
            }
        });
    }
    useKeyboard() {
        window.addEventListener("keydown", (event) => {
            event.preventDefault();
            if (!this.#keyboardState.has(event.key)) {
                this.#keyboardState.set(event.key, true);
            }
            if (this.#keyboardState.get(event.key) === false) {
                this.#keyboardState.set(event.key, true);
            }
        });
        window.addEventListener("keyup", (event) => {
            event.preventDefault();
            if (this.#keyboardState.get(event.key) === true) {
                this.#keyboardState.set(event.key, false);
            }
        });
    }
    useGamepad() {
        window.addEventListener("gamepadconnected", (event) => {
            console.log("gamepadconnected", event);
        });
        window.addEventListener("gamepaddisconnected", (event) => {
            console.log("gamepadisconnnected", event);
        });
    }
    // public intersection(gameObject1: GameObject, gameObject2: GameObject) {
    // 	if(gameObject1.pos.x)
    // }
    get keyboard() {
        return {
            isDown: (key) => {
                if (this.#keyboardState.has(key)) {
                    if (this.#keyboardState.get(key) === true) {
                        return true;
                    }
                }
                return false;
            },
        };
    }
}
