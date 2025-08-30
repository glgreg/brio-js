import { BrioSprite } from "./asset/BrioSprite";
import { BrioObject, KeyActions } from "./BrioObject";
import { BrioKeyboard } from "./input/BrioKeyboard";
import { BrioMap } from "./BrioMap";
import { BrioCamera } from "./BrioCamera";
import { BrioAudio } from "./asset/BrioAudio";
import { BrioLogger } from "./logging/BrioLogger";

// Used for managing the game-state step process
enum GameState {
	unset = 0,
	preload = 1,
	load = 2,
	update = 3,
	error = 4,
}

type CanvasBackgroundParam = {
	color?: string;
	image?: string;
	repeat?: "no-repeat" | "repeat-x" | "repeat-y";
	position?: { x: string; y: string };
	size?: string;
	blendMode?: "normal" | "multiply" | "hard-light" | "difference";
};

// Used in the "load" step method, in the param of the callbackFn
type AssetLoaderParam = {
	logAssets: () => void;
	getSprite: (spriteName: string) => BrioSprite;
	getAudio: (audioName: string) => BrioAudio;
};

// Used in the "update" step method, in the param of the callbackFn
export type UpdaterObjectParam = {
	logObjectKeys: () => void;
	getSprite: (spriteName: string) => BrioSprite;
	getAudio: (audioName: string) => BrioAudio;
	getObject: (gameObjectName: string) => BrioObject;
	getMap: (mapName: string) => BrioMap;

	animateFromName: (gameObjectName: string) => void;
	animate: <T>(object: T) => void;
	animateMany: (gameObjects: BrioObject[]) => void;

	runOnce: (identifier: string, callbackFn: () => void) => void;
	pause: () => void;
	resume: () => void;
	endgame: () => void;
};

// Literal types for image rendering in the canvas context
type CanvasImageRenderingOptions = "smooth" | "pixelated";
type CanvasImageSmoothingOptions = "low" | "medium" | "high";

// Log related types
type UseLogsParam = {
	showStackCaller?: boolean;
	showStackInGameClasses?: boolean;
};

export class BrioGame {
	// CANVAS
	/** @type {HTMLCanvasElement} Canvas element that serves as the game sandbox */
	#canvas: HTMLCanvasElement;
	/** @type {CanvasRenderingContext2D} Context of the Canvas element */
	ctx: CanvasRenderingContext2D | null = null;
	/** @type {CanvasRenderingContext2DSettings} Settings of the Context from the Canvas element */
	#ctxSettings: CanvasRenderingContext2DSettings = {};
	/** @type {number} Width of the Canvas element */
	#width: number;
	/** @type {number} Height of the Canvas element */
	#height: number;
	/** @type {"smooth" | "pixelated"} The type of rendering that the canvas will use */
	#renderingType: CanvasImageRenderingOptions = "smooth";
	/** @type {"low" | "medium" | "high"} The quality of smoothing that will be used if using the "smooth" type */
	#smoothRenderingValue: CanvasImageSmoothingOptions = "low";
	/** @type {number} Global scale multiplier for all sprites in-game */
	#scale: number = 1;
	#background: CanvasBackgroundParam = {};

	// STORED OBJECTS
	/** @type {Map<string, BrioSprite>} A map that stores loaded sprites (returned in the preload state) */
	#loadedSprites: Map<string, BrioSprite> = new Map<string, BrioSprite>();
	/** @type {Map<string, BrioObject>} A map that stores loaded gameobjects (returned in the load state) */
	#loadedGameObjects: Map<string, BrioObject> = new Map<string, BrioObject>();
	/** @type {Map<string, BrioAudio>} A map that stores loaded game audios (returned in the preload state) */
	#loadedAudios: Map<string, BrioAudio> = new Map();
	/** @type {Map<string, GameMap>} A map that stores loaded game maps (returned in the preload state) */
	#loadedGameMaps: Map<string, BrioMap> = new Map<string, BrioMap>();
	/** @type {Map<string, GameCamera>} A map that stores loaded game maps (returned in the preload state) */
	#loadedGameCameras: Map<string, BrioCamera> = new Map<string, BrioCamera>();

	// LOGS
	/** @type {Set<string>} A set that holds the logged erros so they don't appear multiple times in the console when using the update loop */
	#loggedErros: Set<string> = new Set<string>();

	#loggedErrors: Set<number> = new Set<number>();
	#loggedExceptions: Set<number> = new Set<number>();

	// GAME STATE LOGIC
	/** @type {0 | 1 | 2 | 3 | 4} States in which the game will run throught the development process (unset->preload->load->update->error) */
	#currentState: GameState = GameState.unset;
	/** @type {Promise<void>} A promise that resolves the lyfecicle of the game, going to preload -> load -> update */
	#lifecyclePromise: Promise<void> = Promise.resolve();

	// UPDATE LOGIC
	/** @type {number} Id created in the update step, used for stoping the update loop */
	#updateFrameId: number = 0;
	/** @type {Set<string>} A set that holds keys for events that run only once in the update step */
	#updaterRunOnceKeys: Set<string> = new Set<string>();
	/** @type {number} A variable that holds the previous time of a animation frame, used to get the deltaTime in the update step */
	#deltaTimePreviousTime: number = 0;
	#updateIsRunning: boolean = false;
	#updateLoopLogic?: (currentTime: number) => void;

	// KEYBOARD
	#keyboardEnabled: boolean = false;
	#keyboardState: Map<string, boolean> = new Map<string, boolean>();
	#keyboardInstance?: BrioKeyboard;

	// RESTAR LOGIC
	#gameStartingState: BrioGame;

	// CHECKPOINT LOGIC
	cachedObjects: Map<string, Map<string, any>> = new Map();
	#cacheExists: boolean = false;

	/**
	 * CONSTRUCTOR ----------------------------------------------------------------------
	 */
	/**
	 * @param {number} width The game screen width size
	 * @param {number} height The game screen height size
	 * @param {HTMLElement} appendToElement The elements whom the game will be appended
	 * @param {CanvasRenderingContext2DSettings} [canvasContextSettings={}] An object for canvas context configurations
	 */
	constructor(
		width: number,
		height: number,
		appendToElement: HTMLElement,
		canvasContextSettings: CanvasRenderingContext2DSettings = {},
	) {
		if (width < 0 || height < 0) {
			BrioLogger.out("warn", "BrioGame constructor: Negative values converted into positive.");
		}
		if (!(appendToElement instanceof HTMLElement)) {
			BrioLogger.fatalError(
				"BrioGame constructor: A BrioGame should be appended to a working HTMLElement.",
			);
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
			BrioLogger.out("error", `An error occurred during the game object creation: ${err}.`);
		});

		this.#gameStartingState = this;
	}

	/**
	 * GETTERS AND SETTERS --------------------------------------------------------------
	 */

	/** Returns the loaded sprites that were returned in the preload step
	 * @example game.load(() => {
	 * return new BrioSprite("spr_player", "./spr_player.png", "img");
	 * })
	 * console.log(game.loadedGameSprites); // Map(spr_player -> {})
	 */
	public get loadedGameSprites() {
		return this.#loadedSprites;
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
	 * @param {CanvasBackgroundParam} value
	 */
	public set background(value: CanvasBackgroundParam) {
		if (value.image) this.#canvas.style.backgroundImage = `url('${value.image}')`;
		if (value.color) this.#canvas.style.backgroundColor = value.color;
		if (value.position && value.position.x && value.position.y) {
			this.#canvas.style.backgroundPositionX = value.position.x;
			this.#canvas.style.backgroundPositionY = value.position.y;
		}
		if (value.repeat) this.#canvas.style.backgroundRepeat = value.repeat;
		if (value.size) this.#canvas.style.backgroundSize = value.size;
		if (value.blendMode) this.#canvas.style.backgroundBlendMode = value.blendMode;

		this.#background = value;
	}
	public get background() {
		return this.#background;
	}

	/** The global scale of the canvas object. All objects are scaled according to this property
	 * @type {number}
	 * @example const game = new BrioGame(600, 400, document.body);
	 * game.scale = 2; // 128px sprites are now 256px
	 */
	public get scale() {
		return this.#scale;
	}
	public set scale(scaleValue: number) {
		this.#scale = Math.abs(scaleValue);
	}

	/** The rendering type used in the game
	 * @example const game = new BrioGame(600, 400, document.body);
	 * game.renderingType = "pixelated"; // makes the sprites crispy looking
	 * @default "smooth"
	 */
	public get renderingType() {
		return this.#renderingType;
	}
	/** @param {"smooth" | "pixelated"} renderingType */
	public set renderingType(renderingType: CanvasImageRenderingOptions) {
		this.#renderingType = renderingType;
	}

	/** The quality of the smoothness of game sprites. Only works when renderingType is set to "smooth"
	 * @example const game = new BrioGame(600, 400, document.body);
	 * game.renderingType = "smooth";
	 * game.smoothingQuality = "high"; // makes the sprites more smooth
	 * @default "low"
	 */
	public get smoothingQuality() {
		return this.#smoothRenderingValue;
	}
	/** @param {"low" | "medium" | "high"} smoothingQuality */
	public set smoothingQuality(smoothingQuality: CanvasImageSmoothingOptions) {
		if (this.#renderingType !== "smooth") {
			throw new Error(
				`The current rendering type is set to '${this.renderingType}', set it to 'smooth' to use the 'smoothingQuality' attribute`,
			);
		}
		this.#smoothRenderingValue = smoothingQuality;
	}

	public get gameObjects() {
		return this.#loadedGameObjects;
	}

	public get isRunning(): boolean {
		return this.#updateIsRunning;
	}

	/**
	 * GAME STATES -----------------------------------------------------------------------
	 */

	/**
	 * The first step into the game logic responsible for preloading assets
	 * such as GameSprites, Audios and Videos. Those assets are loaded in an
	 * assyncronous manner, that's why this step in needed
	 * @param {() => Array<BrioSprite | BrioAudio>} callbackFn
	 */
	public preload(callbackFn: () => Array<BrioSprite | BrioAudio>): this {
		this.#lifecyclePromise = this.#lifecyclePromise.then(async () => {
			this.#currentState = GameState.preload;

			const assets = callbackFn();

			if (assets.length === 0) {
				throw new Error("Zero assets returned. You must return at least one asset.");
			}

			const sprites = assets.filter((asset) => asset instanceof BrioSprite);
			const audios = assets.filter((asset) => asset instanceof BrioAudio);

			const spriteLoadPromises = sprites.map((sprite) => {
				return new Promise<void>((resolve, reject) => {
					sprite.element.onload = () => {
						this.#loadedSprites.set(sprite.name, sprite);
						BrioLogger.out("log", `BrioSprite: ${sprite.name} sucessfully preloaded.`);
						resolve();
					};
					sprite.element.onerror = (event, source, lineno, colno, err) => {
						reject(`Error loading the sprite '${sprite.name}': ${err?.message}`);
					};
				});
			});

			const audioLoadPromises = audios.map((audio) => {
				return new Promise<void>((resolve, reject) => {
					const onCanPlayThrough = () => {
						this.#loadedAudios.set(audio.name, audio);
						BrioLogger.out("log", `Audio: ${audio.name} sucessfully preloaded.`);
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

			BrioLogger.out("info", "Preload step complete!");
		});

		return this;
	}

	/**
	 * @typedef {object} AssetsObject The object passed as a param into the callbackFn
	 * @property {() => void} logAssets Logs the available sprites that were preloaded
	 * @property {(spriteName: string) => BrioSprite} getSprite Returns the BrioSprite object with the given name
	 * @property {(audioName: string) => BrioAudio} getAudio Returns the BrioAudio object with the given name
	 **/
	/** @param {(assets: AssetsObject) => Array<BrioObject | GameMap>} callbackFn A callback function that passes, by param, an object for assets manipulation */
	public load(callbackFn: (assets: AssetLoaderParam) => Array<BrioObject | BrioMap>): this {
		this.#lifecyclePromise = this.#lifecyclePromise.then(() => {
			this.#currentState = GameState.load;

			const assetsManipulationObject: AssetLoaderParam = {
				logAssets: () => {
					BrioLogger.out("log", `Currently loaded sprites: ${this.#loadedSprites}.`);
					BrioLogger.out("log", `Currently loaded audios: ${this.#loadedAudios}.`);
				},
				getSprite: (spriteName: string) => {
					if (!this.#loadedSprites.has(spriteName)) {
						BrioLogger.out(
							"error",
							`Named sprite asset '${spriteName}' was not found in the preloaded resources, check if you preloaded it correctly and gave it the right name.`,
						);
					}

					if (this.#loadedSprites.has(spriteName)) {
						const spr = this.#loadedSprites.get(spriteName);
						if (spr !== undefined) {
							return spr;
						}
					}

					return BrioSprite.getEmptyInstance();
				},
				getAudio: (audioName: string) => {
					if (!this.#loadedAudios.has(audioName)) {
						BrioLogger.out(
							"error",
							`Named audio asset '${audioName}' was not found in the preloaded resources, check if you preloaded it correctly and gave it the right name.`,
						);
					}

					if (this.#loadedAudios.has(audioName)) {
						const aud = this.#loadedAudios.get(audioName);
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
				this.#loadedGameObjects.set(gameObject.name, gameObject);
			});

			gameMaps.forEach((gameMap) => {
				this.#loadedGameMaps.set(gameMap.name, gameMap);
			});

			gameCameras.forEach((gameCamera) => {
				this.#loadedGameCameras.set(gameCamera.name, gameCamera);
			});

			BrioLogger.out("info", "Load step complete!");
		});

		return this;
	}

	/**
	 * Type for the updater object used inside callbackFn in the update step
	 * @typedef {object} UpdaterObject The object passed as a param into the callbackFn
	 * @property {() => void} logObjectKeys Logs the available objects that were loaded
	 * @property {(spriteName: string) => BrioSprite} getSprite Returns the BrioSprite object with the given name
	 * @property {(audioName: string) => BrioAudio} getAudio Returns the BrioAudio object with the given name
	 * @property {(gameObjectName: string) => BrioObject} getObject Returns the BrioObject with the given name
	 * @property {(mapName: string) => BrioObject} getMap Returns the GameMap with the given name
	 * @property {(cameraName: string) => BrioObject} getCamera Returns the GameCamera with the given name
	 * @property {(gameObjectName: string) => void} animateFromName Animates a given named game object and its properties
	 * @property {(gameObject: BrioObject) => void} animate Animates the given game object
	 * @property {(gameObjects: BrioObject[]) => void} animateMany Animates instances of a given array of game objects
	 * @property {() => void} pause Pauses the update animation loop, essencialy freezing the game
	 * @property {() => void} resume Resumes the update animation loop
	 * @property {boolean} isRunning Returns true if the update loop is running and false if it is paused
	 * @property {(identifier: string, callbackFn: () => any) => void} runOnce Runs only once time the logic inside the block code
	 */
	/**
	 * A method that loops through given logic inside it many times per second, be it for
	 * changing BrioObject coordinates or checking if a key was pressed.
	 * @param {(updater: UpdaterObject, deltaTime: number) => void } callbackFn A callback function that passes, by param, an object for game objects manipulation and the time elapsed since the last frame (delta time)
	 * @param {UpdaterObject} callbackFn.updater An object providing methods to manipulate game objects and work around the update loop
	 * @param {number} callbackFn.deltaTime The time elapsed since the last frame, in seconds, used for frame-rate independent updates
	 *
	 * @example game.update((updater, dt) => {
	 * const obj_player = updater.loaded("obj_player"); // returns the BrioObject for Player
	 *
	 * if(game.keyboard.isDown("ArrowUp")) {
	 * obj_player.pos.y += -300 * dt; // makes the player go up (multiplying it by DeltaTime for FPS consistency)
	 * }});
	 */
	public update(callbackFn: (updater: UpdaterObjectParam, deltaTime: number) => void): this {
		this.#lifecyclePromise = this.#lifecyclePromise.then(() => {
			this.#currentState = GameState.update;
			this.#updateIsRunning = true;

			const updater: UpdaterObjectParam = {
				logObjectKeys: () => {
					let loadedObjects: string = "";
					let loadedCameras: string = "";
					let loadedMaps: string = "";

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

					BrioLogger.out("info", `Currently loaded game objects: \n\n${loadedObjects}`);
					BrioLogger.out("info", `Currently loaded game maps: \n\n${loadedMaps}`);
					BrioLogger.out("info", `Currently loaded game cameras: \n\n${loadedCameras}`);
				},
				getSprite: (spriteName: string) => {
					if (
						!this.#loadedSprites.has(spriteName) &&
						!this.#loggedErros.has(`loadError: ${spriteName}`)
					) {
						BrioLogger.out(
							"error",
							`Named sprite asset '${spriteName}' was not found in the preloaded resources, check if you preloaded it correctly and gave it the right name.`,
						);
						this.#loggedErros.add(`loadError: ${spriteName}`);
					}

					if (this.#loadedSprites.has(spriteName)) {
						const spr = this.#loadedSprites.get(spriteName);
						if (spr !== undefined) {
							return spr;
						}
					}

					return BrioSprite.getEmptyInstance();
				},
				getAudio: (audioName: string) => {
					if (
						!this.#loadedAudios.has(audioName) &&
						!this.#loggedErros.has(`loadError: ${audioName}`)
					) {
						BrioLogger.out(
							"error",
							`Named audio asset '${audioName}' was not found in the preloaded resources, check if you preloaded it correctly and gave it the right name.`,
						);
						this.#loggedErros.add(`loadError: ${audioName}`);
					}

					if (this.#loadedAudios.has(audioName)) {
						const aud = this.#loadedAudios.get(audioName);
						if (aud !== undefined) {
							return aud;
						}
					}

					return BrioAudio.getEmptyInstance();
				},
				getObject: (gameObjectName) => {
					if (
						!this.#loadedGameObjects.has(gameObjectName) &&
						!this.#loggedErros.has(`loadError: ${gameObjectName}`)
					) {
						BrioLogger.out(
							"error",
							`Named game object '${gameObjectName}' was not found in the loaded resources, check if you loaded it correctly and gave it the right name.`,
						);
						this.#loggedErros.add(`loadError: ${gameObjectName}`);
					}

					if (this.#loadedGameObjects.has(gameObjectName)) {
						const obj = this.#loadedGameObjects.get(gameObjectName);
						if (obj !== undefined) {
							return obj;
						}
					}

					return BrioObject.getEmptyInstance();
				},
				getMap: (gameMapName) => {
					if (
						!this.#loadedGameMaps.has(gameMapName) &&
						!this.#loggedErros.has(`loadError: ${gameMapName}`)
					) {
						BrioLogger.out(
							"error",
							`Named game map '${gameMapName}' was not found in the loaded resources, check if you loaded it correctly and gave it the right name.`,
						);
						this.#loggedErros.add(`loadError: ${gameMapName}`);
					}

					if (this.#loadedGameMaps.has(gameMapName)) {
						const map = this.#loadedGameMaps.get(gameMapName);
						if (map !== undefined) {
							return map;
						}
					}

					return BrioMap.getEmptyInstance();
				},
				animateFromName: (gameObjectName) => {
					if (
						!this.#loadedGameObjects.has(gameObjectName) &&
						!this.#loggedErros.has(`loadError: ${gameObjectName}`)
					) {
						BrioLogger.out(
							"error",
							`Named game object '${gameObjectName}' was not found in the loaded resources, check if you loaded it correctly and gave it the right name.`,
						);
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
					if (!targetObject) return;

					let object = null;
					if (targetObject instanceof BrioObject) {
						object = this.#loadedGameObjects.get(targetObject.name);
					}

					if (object) {
						this.#renderGameObject(object);
					}
				},
				animateMany: (gameObjects) => {
					if (!gameObjects) return;

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
						BrioLogger.out("info", `Runned once with the ID: ${identifier}.`);

						this.#updaterRunOnceKeys.add(identifier);
					}
				},
				pause: () => {
					if (this.#updateIsRunning) {
						this.#currentState = GameState.unset;
						this.#updateIsRunning = false;
						BrioLogger.out("info", "Game stopped!");
						cancelAnimationFrame(this.#updateFrameId);
					}
				},
				resume: () => {
					if (!this.#updateIsRunning) {
						this.#currentState = GameState.update;
						this.#updateIsRunning = true;
						BrioLogger.out("info", "Game resumed!");
						if (this.#updateLoopLogic) {
							requestAnimationFrame(this.#updateLoopLogic);
						}
					}
				},
				endgame: () => {},
			};

			BrioLogger.out("info", "Update step started!");

			// runs the update loop for the first time (so it can be paused and resumed after that)
			this.#updateLoopLogic = (currentTime: number) => {
				if (this.#currentState !== GameState.update) {
					return;
				}

				this.#loadedGameCameras.forEach((gameCamera) => {
					if (!this.ctx) {
						return;
					}
					this.ctx.drawImage(
						gameCamera.map.sprite.element,
						gameCamera.pos.x,
						gameCamera.pos.y,
						gameCamera.size.x,
						gameCamera.size.y,
						0,
						0,
						this.#width,
						this.#height,
					);
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
	#renderGameObject<T extends BrioObject>(object: T) {
		if (!this.ctx || !object) {
			return;
		}

		if (this.#renderingType === "smooth") {
			this.ctx.imageSmoothingEnabled = true;
			this.ctx.imageSmoothingQuality = this.#smoothRenderingValue;
		} else if (this.#renderingType === "pixelated") {
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
			this.ctx.transform(
				1, // scaleX
				(object.sprite.skew.x * Math.PI) / 180, // rotateX
				(object.sprite.skew.y * Math.PI) / 180, // rotateY
				1, // scaleY
				0, // translateX
				0, // translateY
			);
			translated = true;
		}

		this.ctx.drawImage(
			object.sprite.element,
			translated ? -object.size.x / 2 : 0,
			translated ? -object.size.y / 2 : 0,
			object.size.x,
			object.size.y,
		);

		this.ctx.restore();
	}

	#clearGameObject<T extends BrioSprite | BrioObject>(gameObject: T) {
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

	public createCheckPoint() {
		this.cachedObjects.set("objects", new Map<string, BrioObject>());
		this.#loadedGameObjects.forEach((object, id) => {
			this.cachedObjects.get("objects")?.set(id, object);
		});

		this.cachedObjects.set("sprites", this.#loadedSprites);
		this.cachedObjects.set("audios", this.#loadedAudios);
		this.cachedObjects.set("cameras", this.#loadedGameCameras);
		this.cachedObjects.set("maps", this.#loadedGameMaps);

		if (!this.#cacheExists) this.#cacheExists = true;
	}

	public gotoCheckPoint() {
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
	public pause() {
		if (this.#updateIsRunning) {
			this.#currentState = GameState.unset;
			this.#updateIsRunning = false;
			cancelAnimationFrame(this.#updateFrameId);
			BrioLogger.out("info", "Game stopped!");
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
			this.#currentState = GameState.update;
			this.#updateIsRunning = true;
			if (this.#updateLoopLogic) {
				requestAnimationFrame(this.#updateLoopLogic);
			}
			BrioLogger.out("info", "Game resumed!");
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
		BrioLogger.logsEnabled = false;

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

		BrioLogger.out("info", "Game ended!");
	}

	public restart() {
		// restart logic
	}

	public removeObject<T extends BrioSprite | BrioObject>(targetObject: T) {
		let objectExists: boolean = false;

		if (targetObject instanceof BrioSprite && this.#loadedSprites.has(targetObject.name)) {
			objectExists = true;
			this.#loadedSprites.delete(targetObject.name);
		} else if (
			targetObject instanceof BrioObject &&
			this.#loadedGameObjects.has(targetObject.name)
		) {
			objectExists = true;
			this.#loadedGameObjects.delete(targetObject.name);
		}
		if (this.ctx && objectExists && targetObject) {
			this.#clearGameObject(targetObject);
		}

		if (objectExists) {
			BrioLogger.out("warn", `${targetObject.name} was removed from the scene!`);
		}
	}

	public outbound(targetObject: BrioObject, screenThreshold: number = 1, callbackFn?: () => void) {
		if (!targetObject) {
			return;
		}

		let auxWidth = screenThreshold !== 1 ? this.#width : 0;
		let auxHeight = screenThreshold !== 1 ? this.#width : 0;
		if (
			targetObject.pos.x > this.#width * screenThreshold ||
			targetObject.pos.x + targetObject.size.x * this.#scale < 0 * auxWidth * screenThreshold ||
			targetObject.pos.y > this.#height * screenThreshold ||
			targetObject.pos.y + targetObject.size.y * this.#scale < 0 * auxHeight * screenThreshold
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

		// cloning object
		const newObject = new BrioObject(
			`${targetObject.name}-${targetObject.clonesInstantiated + 1}`,
			targetObject.sprite,
			targetObject.layer,
		);
		// increasing the amount of clones created
		targetObject.clonesInstantiated = 1;

		// cloning collider
		if (targetObject.collision) {
			newObject.addCollisionMask(
				targetObject.collision.shape,
				targetObject.collision.colliderType,
				targetObject.collision.pos.x,
				targetObject.collision.pos.y,
				targetObject.collision.size.x,
				targetObject.collision.size.y,
			);
		}

		// setting an id
		newObject.instanceId = targetObject.clonesInstantiated;

		// add instantiated object to map
		if (!this.#loadedGameObjects.has(newObject.name)) {
			this.#loadedGameObjects.set(newObject.name, newObject);
		}

		BrioObject.instanceOfObject = false;

		return newObject;
	}

	public instantiateMany(targetObject: BrioObject, quantity: number = 1): BrioObject[] {
		const instances: BrioObject[] = [];
		BrioObject.instanceOfObject = true;

		for (let i = 0; i < quantity; i++) {
			// cloning object
			const newObject = new BrioObject(
				`${targetObject.name}-${targetObject.clonesInstantiated + 1}`,
				targetObject.sprite,
				targetObject.layer,
			);
			// increasing the amount of clones created
			targetObject.clonesInstantiated = 1;

			// cloning collider
			if (targetObject.collision) {
				newObject.addCollisionMask(
					targetObject.collision.shape,
					targetObject.collision.colliderType,
					targetObject.collision.pos.x,
					targetObject.collision.pos.y,
					targetObject.collision.size.x,
					targetObject.collision.size.y,
				);
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

		BrioObject.instanceOfObject = false;

		return instances;
	}

	public destroy(targetObject: BrioObject) {
		if (this.#loadedGameObjects.has(targetObject.name)) {
			this.#loadedGameObjects.delete(targetObject.name);
		}
		if (this.#loadedSprites.has(targetObject.sprite.name)) {
			this.#clearGameObject(targetObject);
			this.#loadedSprites.delete(targetObject.name);
		}
	}

	public isColliding(obj1: BrioObject, obj2: BrioObject): boolean {
		let result: boolean = false;

		if (!obj1.collision || !obj2.collision) {
			console.info("not");
			return false;
		}

		if (
			obj1.pos.x <= obj2.pos.x + obj2.collision.size.x &&
			obj1.pos.x + obj1.collision.size.x >= obj2.pos.x &&
			obj1.pos.y <= obj2.pos.y + obj2.collision.size.y &&
			obj1.pos.y + obj1.collision.size.y >= obj2.pos.y
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

	/**
	 * GAME UTILITIES -------------------------------------------------------------------
	 */

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

	/**
	 * @typedef {object} LogsParamObject
	 * @property {boolean} showStackCaller If true, enables stack traces for archives that are calling logs
	 * @property {boolean} showStackInGameClasses If true, enables stack traces in the BrioClasses
	 */
	/** Allows utility logs into the console, such as assets and objects being loaded
	 * @param {LogsParamObject} logsObjectParam
	 */
	public useLogs(logsObjectParam: UseLogsParam) {
		BrioLogger.setErrorsStore(this.#loggedErrors);
		BrioLogger.setExceptionsStore(this.#loggedExceptions);
		BrioLogger.logsEnabled = true;
		if (logsObjectParam.showStackCaller === true) BrioLogger.logsCallerEnabled = true;
		if (logsObjectParam.showStackInGameClasses === true) BrioLogger.logsCallerClassesEnabled = true;

		BrioLogger.out("info", "Utility logs are now enabled.");
	}

	public useShowCollisions() {
		this.#loadedGameObjects.forEach((gameObject, key) => {
			if (this.ctx && gameObject.collision) {
				this.ctx.save();

				this.ctx.scale(this.#scale, this.#scale);
				this.ctx.beginPath();
				this.ctx.rect(
					gameObject.pos.x + gameObject.collision.pos.x,
					gameObject.pos.y + gameObject.collision.pos.y,
					gameObject.collision.size.x,
					gameObject.collision.size.y,
				);
				this.ctx.lineWidth = 2 / this.#scale;
				this.ctx.strokeStyle = "#F00";
				this.ctx.stroke();
				this.ctx.closePath();

				this.ctx.restore();
			}
		});
	}

	public useShowBorders() {
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

	public useShowCenteredAxis() {
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

	public useKeyboard() {
		this.#keyboardInstance = new BrioKeyboard(this.#keyboardState);
		this.#keyboardEnabled = true;
	}

	public useGamepad() {
		window.addEventListener("gamepadconnected", (event) => {
			BrioLogger.out("log", `gamepadconnected ${event}.`);
		});

		window.addEventListener("gamepaddisconnected", (event) => {
			BrioLogger.out("log", `gamepadisconnnected ${event}.`);
		});
	}

	/**
	 * An object that contains logic related to keyboard input
	 * @returns {BrioKeyboard}
	 */
	public get keyboard(): BrioKeyboard {
		if (this.#keyboardInstance !== undefined) {
			return this.#keyboardInstance;
		}

		throw BrioLogger.fatalError(
			"Keyboard instance doesn't exist. Try using the useKeyboard() method in the game object.",
		);
	}
}
