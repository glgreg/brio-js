import { GameSprite } from "./asset/GameSprite.js";
import { GameObject } from "./GameObject.js";
import { GameKeyboard } from "./input/GameKeyboard.js";
import { GameMap } from "./GameMap.js";
import { GameCamera } from "./GameCamera.js";
import { GameAudio } from "./asset/GameAudio.js";
import { GameLogger } from "./logging/GameLogger.js";
// Used for managing the game-state step process
var GameState;
(function (GameState) {
    GameState[GameState["unset"] = 0] = "unset";
    GameState[GameState["preload"] = 1] = "preload";
    GameState[GameState["load"] = 2] = "load";
    GameState[GameState["update"] = 3] = "update";
    GameState[GameState["error"] = 4] = "error";
})(GameState || (GameState = {}));
export class Game {
    // CANVAS
    /** @type {HTMLCanvasElement} Canvas element that serves as the game sandbox */
    #canvas;
    /** @type {CanvasRenderingContext2D} Context of the Canvas element */
    ctx = null;
    /** @type {CanvasRenderingContext2DSettings} Settings of the Context from the Canvas element */
    #ctxSettings = {};
    /** @type {number} Width of the Canvas element */
    #width;
    /** @type {number} Height of the Canvas element */
    #height;
    /** @type {"smooth" | "pixelated"} The type of rendering that the canvas will use */
    #renderingType = "smooth";
    /** @type {"low" | "medium" | "high"} The quality of smoothing that will be used if using the "smooth" type */
    #smoothRenderingValue = "low";
    /** @type {number} Global scale multiplier for all sprites in-game */
    #scale = 1;
    #background = {};
    // STORED OBJECTS
    /** @type {Map<string, GameSprite>} A map that stores loaded sprites (returned in the preload state) */
    #loadedSprites = new Map();
    /** @type {Map<string, GameObject>} A map that stores loaded gameobjects (returned in the load state) */
    #loadedGameObjects = new Map();
    /** @type {Map<string, GameAudio>} A map that stores loaded game audios (returned in the preload state) */
    #loadedAudios = new Map();
    /** @type {Map<string, GameMap>} A map that stores loaded game maps (returned in the preload state) */
    #loadedGameMaps = new Map();
    /** @type {Map<string, GameCamera>} A map that stores loaded game maps (returned in the preload state) */
    #loadedGameCameras = new Map();
    // LOGS
    /** @type {Set<string>} A set that holds the logged erros so they don't appear multiple times in the console when using the update loop */
    #loggedErros = new Set();
    #loggedErrors = new Set();
    #loggedExceptions = new Set();
    // GAME STATE LOGIC
    /** @type {0 | 1 | 2 | 3 | 4} States in which the game will run throught the development process (unset->preload->load->update->error) */
    #currentState = GameState.unset;
    /** @type {Promise<void>} A promise that resolves the lyfecicle of the game, going to preload -> load -> update */
    #lifecyclePromise = Promise.resolve();
    // UPDATE LOGIC
    /** @type {number} Id created in the update step, used for stoping the update loop */
    #updateFrameId = 0;
    /** @type {Set<string>} A set that holds keys for events that run only once in the update step */
    #updaterRunOnceKeys = new Set();
    /** @type {number} A variable that holds the previous time of a animation frame, used to get the deltaTime in the update step */
    #deltaTimePreviousTime = 0;
    #updateIsRunning = false;
    #updateLoopLogic;
    // KEYBOARD
    #keyboardEnabled = false;
    #keyboardState = new Map();
    #keyboardInstance;
    // RESTAR LOGIC
    #gameStartingState;
    // CHECKPOINT LOGIC
    cachedObjects = new Map();
    #cacheExists = false;
    /**
     * CONSTRUCTOR ----------------------------------------------------------------------
     */
    /**
     * @param {number} width The game screen width size
     * @param {number} height The game screen height size
     * @param {HTMLElement} appendToElement The elements whom the game will be appended
     * @param {CanvasRenderingContext2DSettings} [canvasContextSettings={}] An object for canvas context configurations
     */
    constructor(width, height, appendToElement, canvasContextSettings = {}) {
        if (width < 0 || height < 0) {
            GameLogger.out("warn", "Game constructor: Negative values converted into positive.");
        }
        if (!(appendToElement instanceof HTMLElement)) {
            GameLogger.fatalError("Game constructor: A Game should be appended to a working HTMLElement.");
        }
        this.#width = Math.abs(width);
        this.#height = Math.abs(height);
        this.#ctxSettings = canvasContextSettings;
        this.#canvas = document.createElement("canvas");
        this.ctx = this.#canvas.getContext("2d", this.#ctxSettings);
        this.#canvas.width = this.#width;
        this.#canvas.height = this.#height;
        appendToElement.appendChild(this.#canvas);
        this.#lifecyclePromise.catch((err) => {
            this.#currentState = GameState.error;
            GameLogger.out("error", `An error occurred during the game object creation: ${err}.`);
        });
        this.#gameStartingState = this;
    }
    /**
     * GETTERS AND SETTERS --------------------------------------------------------------
     */
    /** Returns the loaded sprites that were returned in the preload step
     * @example game.load(() => {
     * return new GameSprite("spr_player", "./spr_player.png", "img");
     * })
     * console.log(game.loadedGameSprites); // Map(spr_player -> {})
     */
    get loadedGameSprites() {
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
    /**
     * Sets the background of the game screen using CSS logic
     * @param {CanvasBackgroundParam} value
     */
    set background(value) {
        if (value.image)
            this.#canvas.style.backgroundImage = `url('${value.image}')`;
        if (value.color)
            this.#canvas.style.backgroundColor = value.color;
        if (value.position && value.position.x && value.position.y) {
            this.#canvas.style.backgroundPositionX = value.position.x;
            this.#canvas.style.backgroundPositionY = value.position.y;
        }
        if (value.repeat)
            this.#canvas.style.backgroundRepeat = value.repeat;
        if (value.size)
            this.#canvas.style.backgroundSize = value.size;
        if (value.blendMode)
            this.#canvas.style.backgroundBlendMode = value.blendMode;
        this.#background = value;
    }
    get background() {
        return this.#background;
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
    get isRunning() {
        return this.#updateIsRunning;
    }
    /**
     * GAME STATES -----------------------------------------------------------------------
     */
    /**
     * The first step into the game logic responsible for preloading assets
     * such as GameSprites, Audios and Videos. Those assets are loaded in an
     * assyncronous manner, that's why this step in needed
     * @param {() => Array<GameSprite | GameAudio>} callbackFn
     */
    preload(callbackFn) {
        this.#lifecyclePromise = this.#lifecyclePromise.then(async () => {
            this.#currentState = GameState.preload;
            const assets = callbackFn();
            if (assets.length === 0) {
                throw new Error("Zero assets returned. You must return at least one asset.");
            }
            const sprites = assets.filter((asset) => asset instanceof GameSprite);
            const audios = assets.filter((asset) => asset instanceof GameAudio);
            const spriteLoadPromises = sprites.map((sprite) => {
                return new Promise((resolve, reject) => {
                    sprite.element.onload = () => {
                        this.#loadedSprites.set(sprite.name, sprite);
                        GameLogger.out("log", `GameSprite: ${sprite.name} sucessfully preloaded.`);
                        resolve();
                    };
                    sprite.element.onerror = (event, source, lineno, colno, err) => {
                        reject(`Error loading the sprite '${sprite.name}': ${err?.message}`);
                    };
                });
            });
            const audioLoadPromises = audios.map((audio) => {
                return new Promise((resolve, reject) => {
                    const onCanPlayThrough = () => {
                        this.#loadedAudios.set(audio.name, audio);
                        GameLogger.out("log", `Audio: ${audio.name} sucessfully preloaded.`);
                        resolve();
                        audio.element.removeEventListener("canplaythrough", onCanPlayThrough);
                    };
                    const onErrorPlay = (e) => {
                        reject(`Error loading the audio '${audio.name}': ${e.message}`);
                        audio.element.removeEventListener("error", onErrorPlay);
                    };
                    audio.element.addEventListener("canplaythrough", onCanPlayThrough);
                    audio.element.addEventListener("error", onErrorPlay);
                });
            });
            await Promise.all(spriteLoadPromises);
            await Promise.all(audioLoadPromises);
            GameLogger.out("info", "Preload step complete!");
        });
        return this;
    }
    /**
     * @typedef {object} AssetsObject The object passed as a param into the callbackFn
     * @property {() => void} logAssets Logs the available sprites that were preloaded
     * @property {(spriteName: string) => GameSprite} getSprite Returns the GameSprite object with the given name
     * @property {(audioName: string) => GameAudio} getAudio Returns the GameAudio object with the given name
     **/
    /** @param {(assets: AssetsObject) => Array<GameObject | GameMap>} callbackFn A callback function that passes, by param, an object for assets manipulation */
    load(callbackFn) {
        this.#lifecyclePromise = this.#lifecyclePromise.then(() => {
            this.#currentState = GameState.load;
            const assetsManipulationObject = {
                logAssets: () => {
                    GameLogger.out("log", `Currently loaded sprites: ${this.#loadedSprites}.`);
                    GameLogger.out("log", `Currently loaded audios: ${this.#loadedAudios}.`);
                },
                getSprite: (spriteName) => {
                    if (!this.#loadedSprites.has(spriteName)) {
                        GameLogger.out("error", `Named sprite asset '${spriteName}' was not found in the preloaded resources, check if you preloaded it correctly and gave it the right name.`);
                    }
                    if (this.#loadedSprites.has(spriteName)) {
                        const spr = this.#loadedSprites.get(spriteName);
                        if (spr !== undefined) {
                            return spr;
                        }
                    }
                    return GameSprite.getEmptyInstance();
                },
                getAudio: (audioName) => {
                    if (!this.#loadedAudios.has(audioName)) {
                        GameLogger.out("error", `Named audio asset '${audioName}' was not found in the preloaded resources, check if you preloaded it correctly and gave it the right name.`);
                    }
                    if (this.#loadedAudios.has(audioName)) {
                        const aud = this.#loadedAudios.get(audioName);
                        if (aud !== undefined) {
                            return aud;
                        }
                    }
                    return GameAudio.getEmptyInstance();
                },
            };
            const objects = callbackFn(assetsManipulationObject);
            const gameObjects = objects.filter((object) => object instanceof GameObject);
            const gameMaps = objects.filter((object) => object instanceof GameMap);
            const gameCameras = objects.filter((object) => object instanceof GameCamera);
            gameObjects.forEach((gameObject) => {
                this.#loadedGameObjects.set(gameObject.name, gameObject);
            });
            gameMaps.forEach((gameMap) => {
                this.#loadedGameMaps.set(gameMap.name, gameMap);
            });
            gameCameras.forEach((gameCamera) => {
                this.#loadedGameCameras.set(gameCamera.name, gameCamera);
            });
            GameLogger.out("info", "Load step complete!");
        });
        return this;
    }
    /**
     * Type for the updater object used inside callbackFn in the update step
     * @typedef {object} UpdaterObject The object passed as a param into the callbackFn
     * @property {() => void} logObjectKeys Logs the available objects that were loaded
     * @property {(spriteName: string) => GameSprite} getSprite Returns the GameSprite object with the given name
     * @property {(audioName: string) => GameAudio} getAudio Returns the GameAudio object with the given name
     * @property {(gameObjectName: string) => GameObject} getObject Returns the GameObject with the given name
     * @property {(mapName: string) => GameObject} getMap Returns the GameMap with the given name
     * @property {(cameraName: string) => GameObject} getCamera Returns the GameCamera with the given name
     * @property {(gameObjectName: string) => void} animateFromName Animates a given named game object and its properties
     * @property {(gameObject: GameObject) => void} animate Animates the given game object
     * @property {(gameObjects: GameObject[]) => void} animateMany Animates instances of a given array of game objects
     * @property {() => void} pause Pauses the update animation loop, essencialy freezing the game
     * @property {() => void} resume Resumes the update animation loop
     * @property {boolean} isRunning Returns true if the update loop is running and false if it is paused
     * @property {(identifier: string, callbackFn: () => any) => void} runOnce Runs only once time the logic inside the block code
     */
    /**
     * A method that loops through given logic inside it many times per second, be it for
     * changing GameObject coordinates or checking if a key was pressed.
     * @param {(updater: UpdaterObject, deltaTime: number) => void } callbackFn A callback function that passes, by param, an object for game objects manipulation and the time elapsed since the last frame (delta time)
     * @param {UpdaterObject} callbackFn.updater An object providing methods to manipulate game objects and work around the update loop
     * @param {number} callbackFn.deltaTime The time elapsed since the last frame, in seconds, used for frame-rate independent updates
     *
     * @example game.update((updater, dt) => {
     * const obj_player = updater.loaded("obj_player"); // returns the GameObject for Player
     *
     * if(game.keyboard.isDown("ArrowUp")) {
     * obj_player.pos.y += -300 * dt; // makes the player go up (multiplying it by DeltaTime for FPS consistency)
     * }});
     */
    update(callbackFn) {
        this.#lifecyclePromise = this.#lifecyclePromise.then(() => {
            this.#currentState = GameState.update;
            this.#updateIsRunning = true;
            const updater = {
                logObjectKeys: () => {
                    let loadedObjects = "";
                    let loadedCameras = "";
                    let loadedMaps = "";
                    this.#loadedGameObjects.forEach((_, key) => {
                        loadedObjects += key + "\n";
                    });
                    this.#loadedGameCameras.forEach((_, key) => {
                        loadedCameras += key + "\n";
                    });
                    this.#loadedGameMaps.forEach((_, key) => {
                        loadedMaps += key + "\n";
                    });
                    loadedObjects = loadedObjects.slice(0, -1);
                    loadedCameras = loadedCameras.slice(0, -1);
                    loadedMaps = loadedMaps.slice(0, -1);
                    GameLogger.out("info", `Currently loaded game objects: \n\n${loadedObjects}`);
                    GameLogger.out("info", `Currently loaded game maps: \n\n${loadedMaps}`);
                    GameLogger.out("info", `Currently loaded game cameras: \n\n${loadedCameras}`);
                },
                getSprite: (spriteName) => {
                    if (!this.#loadedSprites.has(spriteName) &&
                        !this.#loggedErros.has(`loadError: ${spriteName}`)) {
                        GameLogger.out("error", `Named sprite asset '${spriteName}' was not found in the preloaded resources, check if you preloaded it correctly and gave it the right name.`);
                        this.#loggedErros.add(`loadError: ${spriteName}`);
                    }
                    if (this.#loadedSprites.has(spriteName)) {
                        const spr = this.#loadedSprites.get(spriteName);
                        if (spr !== undefined) {
                            return spr;
                        }
                    }
                    return GameSprite.getEmptyInstance();
                },
                getAudio: (audioName) => {
                    if (!this.#loadedAudios.has(audioName) &&
                        !this.#loggedErros.has(`loadError: ${audioName}`)) {
                        GameLogger.out("error", `Named audio asset '${audioName}' was not found in the preloaded resources, check if you preloaded it correctly and gave it the right name.`);
                        this.#loggedErros.add(`loadError: ${audioName}`);
                    }
                    if (this.#loadedAudios.has(audioName)) {
                        const aud = this.#loadedAudios.get(audioName);
                        if (aud !== undefined) {
                            return aud;
                        }
                    }
                    return GameAudio.getEmptyInstance();
                },
                getObject: (gameObjectName) => {
                    if (!this.#loadedGameObjects.has(gameObjectName) &&
                        !this.#loggedErros.has(`loadError: ${gameObjectName}`)) {
                        GameLogger.out("error", `Named game object '${gameObjectName}' was not found in the loaded resources, check if you loaded it correctly and gave it the right name.`);
                        this.#loggedErros.add(`loadError: ${gameObjectName}`);
                    }
                    if (this.#loadedGameObjects.has(gameObjectName)) {
                        const obj = this.#loadedGameObjects.get(gameObjectName);
                        if (obj !== undefined) {
                            return obj;
                        }
                    }
                    return GameObject.getEmptyInstance();
                },
                getMap: (gameMapName) => {
                    if (!this.#loadedGameMaps.has(gameMapName) &&
                        !this.#loggedErros.has(`loadError: ${gameMapName}`)) {
                        GameLogger.out("error", `Named game map '${gameMapName}' was not found in the loaded resources, check if you loaded it correctly and gave it the right name.`);
                        this.#loggedErros.add(`loadError: ${gameMapName}`);
                    }
                    if (this.#loadedGameMaps.has(gameMapName)) {
                        const map = this.#loadedGameMaps.get(gameMapName);
                        if (map !== undefined) {
                            return map;
                        }
                    }
                    return GameMap.getEmptyInstance();
                },
                animateFromName: (gameObjectName) => {
                    if (!this.#loadedGameObjects.has(gameObjectName) &&
                        !this.#loggedErros.has(`loadError: ${gameObjectName}`)) {
                        GameLogger.out("error", `Named game object '${gameObjectName}' was not found in the loaded resources, check if you loaded it correctly and gave it the right name.`);
                        this.#loggedErros.add(`loadError: ${gameObjectName}`);
                    }
                    if (this.#loadedGameObjects.has(gameObjectName)) {
                        const gameObject = this.#loadedGameObjects.get(gameObjectName);
                        if (gameObject) {
                            this.#renderGameObject(gameObject);
                        }
                    }
                },
                animate: (targetObject) => {
                    if (!targetObject)
                        return;
                    let object = null;
                    if (targetObject instanceof GameObject) {
                        object = this.#loadedGameObjects.get(targetObject.name);
                    }
                    if (object) {
                        this.#renderGameObject(object);
                    }
                },
                animateMany: (gameObjects) => {
                    if (!gameObjects)
                        return;
                    for (let i = 0; i < gameObjects.length; i++) {
                        if (this.#loadedGameObjects.has(gameObjects[i].name)) {
                            const gameObject = this.#loadedGameObjects.get(gameObjects[i].name);
                            if (gameObject) {
                                this.#renderGameObject(gameObject);
                            }
                        }
                    }
                },
                runOnce: (identifier, callbackFn) => {
                    if (!this.#updaterRunOnceKeys.has(identifier)) {
                        callbackFn();
                        GameLogger.out("info", `Runned once with the ID: ${identifier}.`);
                        this.#updaterRunOnceKeys.add(identifier);
                    }
                },
                pause: () => {
                    if (this.#updateIsRunning) {
                        this.#currentState = GameState.unset;
                        this.#updateIsRunning = false;
                        GameLogger.out("info", "Game stopped!");
                        cancelAnimationFrame(this.#updateFrameId);
                    }
                },
                resume: () => {
                    if (!this.#updateIsRunning) {
                        this.#currentState = GameState.update;
                        this.#updateIsRunning = true;
                        GameLogger.out("info", "Game resumed!");
                        if (this.#updateLoopLogic) {
                            requestAnimationFrame(this.#updateLoopLogic);
                        }
                    }
                },
                endgame: () => { },
            };
            GameLogger.out("info", "Update step started!");
            // runs the update loop for the first time (so it can be paused and resumed after that)
            this.#updateLoopLogic = (currentTime) => {
                if (this.#currentState !== GameState.update) {
                    return;
                }
                this.#loadedGameCameras.forEach((gameCamera) => {
                    if (!this.ctx) {
                        return;
                    }
                    this.ctx.drawImage(gameCamera.map.sprite.element, gameCamera.pos.x, gameCamera.pos.y, gameCamera.size.x, gameCamera.size.y, 0, 0, this.#width, this.#height);
                });
                this.#loadedGameObjects.forEach((gameObject) => {
                    this.#clearGameObject(gameObject);
                });
                const deltaTime = (currentTime - this.#deltaTimePreviousTime) / 1000;
                callbackFn(updater, deltaTime);
                this.#deltaTimePreviousTime = currentTime;
                if (this.#updateLoopLogic) {
                    this.#updateFrameId = requestAnimationFrame(this.#updateLoopLogic);
                }
            };
            requestAnimationFrame(this.#updateLoopLogic);
        });
        return this;
    }
    /**
     * INTERNAL METHODS -----------------------------------------------------------------
     */
    /** A function that draws an object into the canvas element while considering scale and rendering type */
    #renderGameObject(object) {
        if (!this.ctx || !object) {
            return;
        }
        if (this.#renderingType === "smooth") {
            this.ctx.imageSmoothingEnabled = true;
            this.ctx.imageSmoothingQuality = this.#smoothRenderingValue;
        }
        else if (this.#renderingType === "pixelated") {
            this.ctx.imageSmoothingEnabled = false;
        }
        this.ctx.save();
        // scale or flipped scale for sprites
        const scaleX = (object.sprite.flip.x ? -1 : 1) * this.#scale;
        const scaleY = (object.sprite.flip.y ? -1 : 1) * this.#scale;
        // offset for flipped sprites
        const offsetX = object.sprite.flip.x ? object.size.x * this.#scale : 0;
        const offsetY = object.sprite.flip.y ? object.size.y * this.#scale : 0;
        this.ctx.translate(object.pos.x * this.#scale + offsetX, object.pos.y * this.#scale + offsetY);
        this.ctx.scale(scaleX, scaleY);
        let translated = false;
        if (object.sprite.rotate !== 0) {
            this.ctx.translate(object.size.x / 2, object.size.y / 2);
            this.ctx.rotate((object.sprite.rotate * Math.PI) / 180);
            translated = true;
        }
        if (object.sprite.skew.x !== 0 || object.sprite.skew.y !== 0) {
            if (!translated) {
                this.ctx.translate(object.size.x / 2, object.size.y / 2);
            }
            this.ctx.transform(1, // scaleX
            (object.sprite.skew.x * Math.PI) / 180, // rotateX
            (object.sprite.skew.y * Math.PI) / 180, // rotateY
            1, // scaleY
            0, // translateX
            0);
            translated = true;
        }
        this.ctx.drawImage(object.sprite.element, translated ? -object.size.x / 2 : 0, translated ? -object.size.y / 2 : 0, object.size.x, object.size.y);
        this.ctx.restore();
    }
    #clearGameObject(gameObject) {
        if (!this.ctx || !gameObject) {
            return;
        }
        this.ctx.save();
        this.ctx.scale(this.#scale, this.#scale);
        this.ctx.clearRect(gameObject.pos.x, gameObject.pos.y, gameObject.size.x, gameObject.size.y);
        this.ctx.restore();
    }
    /**
     * EXTERNAL METHODS -----------------------------------------------------------------
     */
    createCheckPoint() {
        this.cachedObjects.set("objects", new Map());
        this.#loadedGameObjects.forEach((object, id) => {
            this.cachedObjects.get("objects")?.set(id, object);
        });
        this.cachedObjects.set("sprites", this.#loadedSprites);
        this.cachedObjects.set("audios", this.#loadedAudios);
        this.cachedObjects.set("cameras", this.#loadedGameCameras);
        this.cachedObjects.set("maps", this.#loadedGameMaps);
        if (!this.#cacheExists)
            this.#cacheExists = true;
    }
    gotoCheckPoint() {
        // if (!this.#cacheExists) return;
        let cachedValue;
        let currentValue;
        const cachedGato = this.cachedObjects.get("objects")?.get("obj_gato");
        const currentGato = this.#loadedGameObjects.get("obj_gato");
        console.log("cached: ", cachedGato?.pos.x, currentGato?.pos.y);
        console.log("current: ", currentGato?.pos.x, currentGato?.pos.y);
        console.log(cachedGato === currentGato);
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
    pause() {
        if (this.#updateIsRunning) {
            this.#currentState = GameState.unset;
            this.#updateIsRunning = false;
            cancelAnimationFrame(this.#updateFrameId);
            GameLogger.out("info", "Game stopped!");
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
    resume() {
        if (!this.#updateIsRunning) {
            this.#currentState = GameState.update;
            this.#updateIsRunning = true;
            if (this.#updateLoopLogic) {
                requestAnimationFrame(this.#updateLoopLogic);
            }
            GameLogger.out("info", "Game resumed!");
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
    end() {
        // disabling logs to prevent error messages
        GameLogger.logsEnabled = false;
        // pausing the game update loop
        this.pause();
        // removing listener
        if (this.#keyboardInstance) {
            this.#keyboardInstance?.removeListener();
        }
        // clearing data
        this.#loadedAudios.clear();
        this.#loadedGameCameras.clear();
        this.#loadedGameMaps.clear();
        this.#loadedGameObjects.clear();
        this.#loadedSprites.clear();
        this.#keyboardState.clear();
        this.#loggedErros.clear();
        GameLogger.out("info", "Game ended!");
    }
    restart() {
        // restart logic
    }
    removeObject(targetObject) {
        let objectExists = false;
        if (targetObject instanceof GameSprite && this.#loadedSprites.has(targetObject.name)) {
            objectExists = true;
            this.#loadedSprites.delete(targetObject.name);
        }
        else if (targetObject instanceof GameObject &&
            this.#loadedGameObjects.has(targetObject.name)) {
            objectExists = true;
            this.#loadedGameObjects.delete(targetObject.name);
        }
        if (this.ctx && objectExists && targetObject) {
            this.#clearGameObject(targetObject);
        }
        if (objectExists) {
            GameLogger.out("warn", `${targetObject.name} was removed from the scene!`);
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
                this.pause();
            }
        }
    }
    instantiate(targetObject) {
        GameObject.instanceOfObject = true;
        // cloning object
        const newObject = new GameObject(`${targetObject.name}-${targetObject.clonesInstantiated + 1}`, targetObject.sprite, targetObject.layer);
        // increasing the amount of clones created
        targetObject.clonesInstantiated = 1;
        // cloning collider
        if (targetObject.collision) {
            newObject.addCollisionMask(targetObject.collision.shape, targetObject.collision.colliderType, targetObject.collision.pos.x, targetObject.collision.pos.y, targetObject.collision.size.x, targetObject.collision.size.y);
        }
        // setting an id
        newObject.instanceId = targetObject.clonesInstantiated;
        // add instantiated object to map
        if (!this.#loadedGameObjects.has(newObject.name)) {
            this.#loadedGameObjects.set(newObject.name, newObject);
        }
        GameObject.instanceOfObject = false;
        return newObject;
    }
    instantiateMany(targetObject, quantity = 1) {
        const instances = [];
        GameObject.instanceOfObject = true;
        for (let i = 0; i < quantity; i++) {
            // cloning object
            const newObject = new GameObject(`${targetObject.name}-${targetObject.clonesInstantiated + 1}`, targetObject.sprite, targetObject.layer);
            // increasing the amount of clones created
            targetObject.clonesInstantiated = 1;
            // cloning collider
            if (targetObject.collision) {
                newObject.addCollisionMask(targetObject.collision.shape, targetObject.collision.colliderType, targetObject.collision.pos.x, targetObject.collision.pos.y, targetObject.collision.size.x, targetObject.collision.size.y);
            }
            // setting an id
            newObject.instanceId = targetObject.clonesInstantiated;
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
        if (this.#loadedGameObjects.has(targetObject.name)) {
            this.#loadedGameObjects.delete(targetObject.name);
        }
        if (this.#loadedSprites.has(targetObject.sprite.name)) {
            this.#clearGameObject(targetObject);
            this.#loadedSprites.delete(targetObject.name);
        }
    }
    isColliding(obj1, obj2) {
        let result = false;
        if (!obj1.collision || !obj2.collision) {
            console.info("not");
            return false;
        }
        if (obj1.pos.x <= obj2.pos.x + obj2.collision.size.x &&
            obj1.pos.x + obj1.collision.size.x >= obj2.pos.x &&
            obj1.pos.y <= obj2.pos.y + obj2.collision.size.y &&
            obj1.pos.y + obj1.collision.size.y >= obj2.pos.y) {
            result = true;
        }
        return result;
    }
    translate(px, py) {
        if (this.ctx) {
            this.ctx.setTransform(1, 0, 0, 1, px, py);
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
        if (this.ctx) {
            this.ctx.reset();
        }
    }
    /**
     * @typedef {object} LogsParamObject
     * @property {boolean} showStackCaller If true, enables stack traces for archives that are calling logs
     * @property {boolean} showStackInGameClasses If true, enables stack traces in the BrioClasses
     */
    /** Allows utility logs into the console, such as assets and objects being loaded
     * @param {LogsParamObject} logsObjectParam
     */
    useLogs(logsObjectParam) {
        GameLogger.setErrorsStore(this.#loggedErrors);
        GameLogger.setExceptionsStore(this.#loggedExceptions);
        GameLogger.logsEnabled = true;
        if (logsObjectParam.showStackCaller === true)
            GameLogger.logsCallerEnabled = true;
        if (logsObjectParam.showStackInGameClasses === true)
            GameLogger.logsCallerClassesEnabled = true;
        GameLogger.out("info", "Utility logs are now enabled.");
    }
    useShowCollisions() {
        this.#loadedGameObjects.forEach((gameObject, key) => {
            if (this.ctx && gameObject.collision) {
                this.ctx.save();
                this.ctx.scale(this.#scale, this.#scale);
                this.ctx.beginPath();
                this.ctx.rect(gameObject.pos.x + gameObject.collision.pos.x, gameObject.pos.y + gameObject.collision.pos.y, gameObject.collision.size.x, gameObject.collision.size.y);
                this.ctx.lineWidth = 2 / this.#scale;
                this.ctx.strokeStyle = "#F00";
                this.ctx.stroke();
                this.ctx.closePath();
                this.ctx.restore();
            }
        });
    }
    useShowBorders() {
        this.#loadedGameObjects.forEach((gameObject, key) => {
            if (this.ctx) {
                this.ctx.save();
                this.ctx.scale(this.#scale, this.#scale);
                this.ctx.beginPath();
                this.ctx.rect(gameObject.pos.x, gameObject.pos.y, gameObject.size.x, gameObject.size.y);
                this.ctx.lineWidth = 2 / this.#scale;
                this.ctx.strokeStyle = "#0F0";
                this.ctx.stroke();
                this.ctx.closePath();
                this.ctx.restore();
            }
        });
    }
    useShowCenteredAxis() {
        if (!this.ctx) {
            return;
        }
        // Draws the mid Y line
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.#height / 2);
        this.ctx.lineTo(this.#width, this.#height / 2);
        this.ctx.strokeStyle = "#F00";
        this.ctx.stroke();
        this.ctx.closePath();
        // Draws the mid X line
        this.ctx.beginPath();
        this.ctx.moveTo(this.#width / 2, 0);
        this.ctx.lineTo(this.#width / 2, this.#height);
        this.ctx.strokeStyle = "#F00";
        this.ctx.stroke();
        this.ctx.closePath();
    }
    useKeyboard() {
        this.#keyboardInstance = new GameKeyboard(this.#keyboardState);
        this.#keyboardEnabled = true;
    }
    useGamepad() {
        window.addEventListener("gamepadconnected", (event) => {
            GameLogger.out("log", `gamepadconnected ${event}.`);
        });
        window.addEventListener("gamepaddisconnected", (event) => {
            GameLogger.out("log", `gamepadisconnnected ${event}.`);
        });
    }
    /**
     * An object that contains logic related to keyboard input
     * @returns {GameKeyboard}
     */
    get keyboard() {
        if (this.#keyboardInstance !== undefined) {
            return this.#keyboardInstance;
        }
        throw GameLogger.fatalError("Keyboard instance doesn't exist. Try using the useKeyboard() method in the game object.");
    }
}
