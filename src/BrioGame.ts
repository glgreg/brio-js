import { BrioSprite } from "./assets/BrioSprite";
import { BrioObject } from "./BrioObject";
import { BrioKeyboard } from "./input/BrioKeyboard";
import { BrioMap } from "./BrioMap";
import { BrioCamera } from "./BrioCamera";
import { BrioAudio } from "./assets/BrioAudio";
import { BrioLogger } from "./logging/BrioLogger";
import { BrioSpriteSheet } from "./assets/BrioSpriteSheet";
import {
	CSSBackgroundBlendMode,
	CSSBackgroundPosition,
	CSSBackgroundRendering,
	CSSBackgroundRepeat,
	CSSBackgroundSize,
	CSSLength,
} from "./base_types";
import { Vector2 } from "./BrioVector2";

/** Used for managing the game-state step process */
enum GameState {
	UNSET = 0,
	PRELOAD = 1,
	LOAD = 2,
	UPDATE = 3,
	ERROR = 4,
}

// TODO: Check the color and image for types
export interface CanvasBackground {
	color?: string;
	image?: string;
	repeat?: CSSBackgroundRepeat;
	position?: CSSBackgroundPosition;
	size?: CSSBackgroundSize;
	blendMode?: CSSBackgroundBlendMode;
	rendering?: CSSBackgroundRendering;
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

// -> Used in the "update" step method, in the param of the callbackFn

/** An interface for the updater object used as a parameter for callbackFn in the update step */
export interface UpdaterObjectParam {
	// -> object loader
	/** Logs the available objects that were loaded */
	logObjectKeys: () => void;
	/** Returns the BrioSprite object with the given name */
	getSprite: (spriteName: string) => BrioSprite;
	/** Returns the BrioAudio object with the given name */
	getAudio: (audioName: string) => BrioAudio;
	/** Returns the BrioObject with the given name */
	getObject: <T extends BrioObject>(gameObjectName: string) => T;
	/** Returns the GameMap with the given name */
	getMap: (mapName: string) => BrioMap;
	/** Returns the GameCamera with the given name */
	// getCamera: (cameraName: string) => BrioCamera;

	// -> render functions
	/** Animates a given named game object and its properties */
	animateFromName: (gameObjectName: string) => void;
	/** Animates the given game object */
	animate: <T extends BrioObject>(object: T | string) => void;
	/** Animates instances of a given array of game objects */
	animateMany: (gameObjects: BrioObject[]) => void;
	/** Animates clone instances of a object whiout animating the original object */
	animateInstancesOf: <T extends BrioObject>(gameObject: T | string) => void;

	/** Runs only once time the logic inside the block code */
	runOnce: (identifier: string, callbackFn: () => void) => void;

	/** Returns true if the update loop is running and false if it is paused */
	// isRunning: boolean;
	/** Pauses the update animation loop, essencialy freezing the game */
	pause: () => void;
	/** Resumes the update animation loop */
	resume: () => void;
	endgame: () => void;
}

// -> Log related types
type UseLogsParam = {
	/** If true, enables stack traces for archives that are calling logs */
	showStackCaller?: boolean;
	/** If true, enables stack traces in the BrioClasses */
	showStackInGameClasses?: boolean;
};

interface CanvasRendering {
	mode: "smooth" | "pixelated";
	smoothness: ImageSmoothingQuality;
}

export type CanvasFPSPosition =
	| "left-top"
	| "left-center"
	| "left-bottom"
	| "center-top"
	| "center-center"
	| "center-bottom"
	| "right-top"
	| "right-center"
	| "right-bottom";

export class BrioGame {
	// CANVAS
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
	/** An object containing configuration the canvas background using CSS logic */
	#background: CanvasBackground = {};

	// STORED OBJECTS
	/** A map that stores loaded sprites (returned in the preload state) */
	#loadedSprites: Map<string, BrioSprite> = new Map<string, BrioSprite>();
	/** A map that stores loaded gameobjects (returned in the load state) */
	#loadedGameObjects: Map<string, BrioObject> = new Map<string, BrioObject>();
	/** A map that stores loaded game audios (returned in the preload state) */
	#loadedAudios: Map<string, BrioAudio> = new Map();
	/** A map that stores loaded game maps (returned in the preload state) */
	#loadedGameMaps: Map<string, BrioMap> = new Map<string, BrioMap>();
	/** A map that stores loaded game maps (returned in the preload state) */
	#loadedGameCameras: Map<string, BrioCamera> = new Map<string, BrioCamera>();

	// LOGS
	/** A set that holds the logged erros so they don't appear multiple times in the console when using the update loop */
	#loggedErros: Set<string> = new Set<string>();

	#loggedErrors: Set<number> = new Set<number>();
	#loggedExceptions: Set<number> = new Set<number>();

	// GAME STATE LOGIC
	/** States in which the game will run throught the development process (unset->preload->load->update->error) */
	#currentState: GameState = GameState.UNSET;
	/** A promise that resolves the lyfecicle of the game, going to preload -> load -> update */
	#lifecyclePromise: Promise<void> = Promise.resolve();

	// UPDATE LOGIC
	/** Id created in the update step, used for stoping the update loop */
	#updateFrameId: number = 0;
	/** A set that holds keys for events that run only once in the update step */
	#updaterRunOnceKeys: Set<string> = new Set<string>();
	/** A variable that holds the previous time of a animation frame, used to get the deltaTime in the update step */
	#deltaTimePreviousTime: number = 0;
	#updateIsRunning: boolean = false;
	#updateLoopLogic?: (currentTime: number) => void;

	#gameLastFPS: number = 0;

	// KEYBOARD
	#keyboardEnabled: boolean = false;
	#keyboardState: Map<string, boolean> = new Map<string, boolean>();
	#keyboardPrevState: Map<string, boolean> = new Map<string, boolean>();
	#keyboardInstance?: BrioKeyboard;

	// RESTAR LOGIC
	#gameStartingState: BrioGame;

	// CHECKPOINT LOGIC
	cachedObjects: Map<string, Map<string, any>> = new Map();
	#cacheExists: boolean = false;

	// TEMPORARY CACHING LOGIC
	#cachedSprites: Map<string, string> = new Map();
	#cachedAudios: Map<string, string> = new Map();
	#cachedObjects: Map<string, string> = new Map();

	// CONSTRUCTOR
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
		if (width < 0 || height < 0) {
			BrioLogger.out(
				"warn",
				"BrioGame constructor: Negative values converted into positive.",
			);
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
		this.#canvas.style.background = "transparent";

		this.#canvas.width = this.#width;
		this.#canvas.height = this.#height;

		appendToElement.appendChild(this.#canvas);

		this.#lifecyclePromise.catch((err) => {
			this.#currentState = GameState.ERROR;
			BrioLogger.out("error", `An error occurred during the game object creation: ${err}.`);
		});

		this.#gameStartingState = this;
	}

	// GETTERS AND SETTERS
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
	 * @param value
	 */
	public set background(value: CanvasBackground) {
		if (value.image) this.#canvas.style.backgroundImage = `url('${value.image}')`;
		if (value.color) this.#canvas.style.background = value.color;
		if (value.position) {
			this.#canvas.style.backgroundPosition = value.position;
		}
		if (value.repeat) this.#canvas.style.backgroundRepeat = value.repeat;
		if (value.size) this.#canvas.style.backgroundSize = value.size;
		if (value.blendMode) this.#canvas.style.backgroundBlendMode = value.blendMode;
		if (value.rendering) this.#canvas.style.imageRendering = value.rendering;

		this.#background = value;
	}

	/**
	 * Sets the background, as a object, of the game screen using CSS logic
	 */
	public get background() {
		const canvas = this.#canvas;
		const self = this.#background;

		return {
			set color(CSSColorLike: CanvasBackground["color"]) {
				canvas.style.background = CSSColorLike as string;
				self.color = CSSColorLike;
			},
			get color() {
				return self.color;
			},
			set blendMode(blendMode: CanvasBackground["blendMode"]) {
				canvas.style.backgroundBlendMode = blendMode as string;
				self.blendMode = blendMode;
			},
			get blendMode() {
				return self.blendMode;
			},
			set image(imageSrc: CanvasBackground["image"]) {
				const image = `url('${imageSrc}')`;
				const color = self.color || null;
				const result = color ? `${image}, ${color}` : image;

				canvas.style.backgroundImage = result;
				self.image = imageSrc;
			},
			get image() {
				return self.image;
			},
			set position(imagePosition: NonNullable<CanvasBackground["position"]>) {
				canvas.style.backgroundPosition = imagePosition as string;
				self.position = imagePosition;
			},
			get position() {
				return self.position!;
			},
			set repeat(imageRepeat: CanvasBackground["repeat"]) {
				canvas.style.backgroundRepeat = imageRepeat as string;
				self.repeat = imageRepeat;
			},
			get repeat() {
				return self.repeat;
			},
			set size(imageSize: CanvasBackground["size"]) {
				canvas.style.backgroundSize = imageSize as string;
				self.size = imageSize;
			},
			get size() {
				return self.size;
			},
			set rendering(renderingMode: CanvasBackground["rendering"]) {
				canvas.style.imageRendering = renderingMode as string;
				self.rendering = renderingMode;
			},
			get rendering() {
				return self.rendering;
			},
		};
	}

	/** The global scale of the canvas object. All objects are scaled according to this property
	 * @example const game = new BrioGame(600, 400, document.body);
	 * game.scale = 2; // 128px sprites are now 256px
	 */
	public get scale() {
		return this.#scale;
	}
	public set scale(scaleValue: number) {
		this.#scale = Math.abs(scaleValue);
	}

	public get rendering() {
		const self = this.#rendering;

		return {
			set mode(renderingMode) {
				self.mode = renderingMode;
			},
			get mode() {
				return self.mode;
			},
			set smoothness(smoothModeSmoothnessValue) {
				self.smoothness = smoothModeSmoothnessValue;
			},
			get smoothness() {
				return self.smoothness;
			},
		};
	}

	public get gameObjects() {
		return this.#loadedGameObjects;
	}

	public get isRunning(): boolean {
		return this.#updateIsRunning;
	}

	// GAME STATES
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

	/** @param callbackFn A callback function that passes, by param, an object for assets manipulation */
	public load(callbackFn: LoaderCallbackFunction): this {
		this.#lifecyclePromise = this.#lifecyclePromise.then(() => {
			this.#currentState = GameState.LOAD;

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

			this.createSnapshot();
			BrioLogger.out("info", "Load step complete!");
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
	public update(callbackFn: (updater: UpdaterObjectParam, deltaTime: number) => void): this {
		this.#lifecyclePromise = this.#lifecyclePromise.then(() => {
			this.#currentState = GameState.UPDATE;
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
				getObject: <T extends BrioObject>(gameObjectName: string) => {
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
						if (obj) return obj as T;
					}

					return BrioObject.getEmptyInstance() as T;
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
				animate: (gameObject) => {
					if (!gameObject) return;

					const isBrioObjectLike = gameObject instanceof BrioObject;
					const gameObjectName = isBrioObjectLike ? gameObject.name : gameObject;

					const object = this.#loadedGameObjects.get(gameObjectName);
					if (object) this.#renderGameObject(object);
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
				animateInstancesOf: (gameObject) => {
					if (!gameObject) return;

					const isBrioObjectLike = gameObject instanceof BrioObject;
					const gameObjectName = isBrioObjectLike ? gameObject.name : gameObject;

					const object = this.#loadedGameObjects.get(gameObjectName);

					if (object && object.clonesInstantiatedValue > 0) {
						for (let i = 1; i <= object.clonesInstantiatedValue; ++i) {
							updater.animate(`${object.name}-${i}`);
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
						this.#currentState = GameState.UNSET;
						this.#updateIsRunning = false;
						BrioLogger.out("info", "Game stopped!");
						cancelAnimationFrame(this.#updateFrameId);
					}
				},
				resume: () => {
					if (!this.#updateIsRunning) {
						this.#currentState = GameState.UPDATE;
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
				if (this.#currentState !== GameState.UPDATE) {
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

				// -> debug PFS
				this.#gameLastFPS = 1 / deltaTime;

				callbackFn(updater, deltaTime);

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

	/**
	 * INTERNAL METHODS -----------------------------------------------------------------
	 */

	/** A function that draws an object into the canvas element while considering scale and rendering type */
	#renderGameObject<T extends BrioObject>(object: T) {
		if (!this.ctx || !object) {
			return;
		}

		if (this.#rendering.mode === "smooth") {
			this.ctx.imageSmoothingEnabled = true;
			this.ctx.imageSmoothingQuality = this.#rendering.smoothness;
		} else if (this.#rendering.mode === "pixelated") {
			this.ctx.imageSmoothingEnabled = false;
		}

		this.ctx.save();

		// scale or flipped scale for sprites
		const scaleX = (object.sprite.flip.x ? -1 : 1) * this.#scale;
		const scaleY = (object.sprite.flip.y ? -1 : 1) * this.#scale;
		// offset for flipped sprites
		const offsetX = object.sprite.flip.x ? object.size.x * this.#scale : 0;
		const offsetY = object.sprite.flip.y ? object.size.y * this.#scale : 0;

		this.ctx.translate(
			object.pos.x * this.#scale + offsetX,
			object.pos.y * this.#scale + offsetY,
		);
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
		this.ctx.clearRect(
			gameObject.pos.x,
			gameObject.pos.y,
			gameObject.size.x,
			gameObject.size.y,
		);

		this.ctx.restore();
	}

	public createSnapshot() {
		this.#loadedGameObjects.forEach((object, key) => {
			this.#cachedObjects.set(key, JSON.stringify(object));
		});
		this.#loadedSprites.forEach((sprite, key) => {
			this.#cachedSprites.set(key, JSON.stringify(sprite));
		});
	}

	public useSnapshot() {
		for (const [key, object] of this.#cachedObjects) {
			if (!this.#loadedGameObjects.has(key)) {
				//this.#loadedGameObjects.delete(key);
				break;
			}
			this.#loadedGameObjects.set(key, JSON.parse(object));
		}
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
			this.#currentState = GameState.UNSET;
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
			this.#currentState = GameState.UPDATE;
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
			targetObject.pos.x > this.#width * screenThreshold ||
			targetObject.pos.x + targetObject.size.x * this.#scale <
				0 * auxWidth * screenThreshold ||
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
			`${targetObject.name}-${targetObject.clonesInstantiatedValue + 1}`,
			targetObject.sprite,
			targetObject.layer,
		);
		// increasing the amount of clones created
		targetObject.clonesInstantiatedValue = 1;

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
		newObject.instanceId = targetObject.clonesInstantiatedValue;

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
				`${targetObject.name}-${targetObject.clonesInstantiatedValue + 1}`,
				targetObject.sprite,
				targetObject.layer,
			);
			// increasing the amount of clones created
			targetObject.clonesInstantiatedValue = 1;

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
			newObject.instanceId = targetObject.clonesInstantiatedValue;

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

	public useLogs(logsObjectParam: UseLogsParam) {
		BrioLogger.setErrorsStore(this.#loggedErrors);
		BrioLogger.setExceptionsStore(this.#loggedExceptions);
		BrioLogger.logsEnabled = true;
		if (logsObjectParam.showStackCaller === true) BrioLogger.logsCallerEnabled = true;
		if (logsObjectParam.showStackInGameClasses === true)
			BrioLogger.logsCallerClassesEnabled = true;

		BrioLogger.out("info", "Utility logs are now enabled.");
	}

	public useShowCollisions() {
		this.#loadedGameObjects.forEach((gameObject, key) => {
			if (this.ctx && gameObject.collision && gameObject.collision.colliderType) {
				this.ctx.save();
				this.ctx.scale(this.#scale, this.#scale);
				this.ctx.beginPath();

				switch (gameObject.collision.shape) {
					case "square":
					case "rectangle":
						this.ctx.rect(
							gameObject.pos.x + gameObject.collision.pos.x,
							gameObject.pos.y + gameObject.collision.pos.y,
							gameObject.collision.size.x,
							gameObject.collision.size.y,
						);
						break;
					case "circle":
						this.ctx.arc(
							gameObject.pos.x +
								(gameObject.collision.pos.x + gameObject.collision.size.x / 2),
							gameObject.pos.y +
								(gameObject.collision.pos.y + gameObject.collision.size.y / 2),
							gameObject.collision.size.x / 2,
							0,
							2 * Math.PI,
						);
						break;
				}

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
				this.ctx.rect(
					gameObject.pos.x,
					gameObject.pos.y,
					gameObject.size.x,
					gameObject.size.y,
				);
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

	public useShowFPS(
		FPSPosition: CanvasFPSPosition,
		offset: number,
		size: number,
		backgroundColor: string,
		textColor: string,
	) {
		if (!this.ctx) return;

		const off = offset;
		let position: Vector2 = { x: 0, y: 0 };

		const containerHeight = size * 1.5;
		const containerWidth = containerHeight * 2.25;

		const centerX = this.#width / 2 - containerHeight;
		const centerY = this.#height / 2 - containerHeight;
		const bottomY = this.#height - (containerHeight + off);
		const rightX = this.#width - (containerWidth + off);

		// prettier-ignore
		switch (FPSPosition) {
			case "left-top": position = { x: off, y: off }; break;
			case "left-center": position = { x: off, y: centerY }; break;
			case "left-bottom": position = { x: off, y: bottomY }; break;
			
			case "center-top": position = { x: centerX, y: off }; break;
			case "center-center": position = { x: centerX, y: centerY }; break;
			case "center-bottom": position = { x: centerX, y: bottomY }; break;
		
			case "right-top": position = { x: rightX, y: off }; break;
			case "right-center": position = { x: rightX, y: centerY }; break;
			case "right-bottom": position = { x: rightX, y: bottomY }; break;
		}

		// draws the background
		this.ctx.fillStyle = backgroundColor;
		this.ctx.fillRect(position.x, position.y, containerWidth, containerHeight);

		// draws the text
		this.ctx.textRendering = "optimizeLegibility";
		this.ctx.font = `${size}px monospace`;
		this.ctx.fillStyle = textColor;
		this.ctx.fillText(
			this.#gameLastFPS.toFixed(1),
			position.x + size / 2,
			position.y + size * 1.1,
		);
	}

	public useKeyboard() {
		this.#keyboardInstance = new BrioKeyboard(this.#keyboardState, this.#keyboardPrevState);
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
