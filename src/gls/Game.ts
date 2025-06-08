import { Sprite } from "./Sprite";
import { GameObject } from "./GameObject";

enum GameState {
	unset = 0,
	preload = 1,
	load = 2,
	update = 3,
	error = 4,
}

// Used in the "load" step method, in the param of the callbackFn
type AssetsParamType = {
	logSprites: () => void;
	preloaded: (assetName: string) => Sprite | undefined;
};

// Used in the "update" step method, in the param of the callbackFn
type UpdaterParamType = {
	loaded: (gameObjectName: string) => GameObject | undefined;
	logGameObjects: () => void;
	animate: (gameObjectName: string) => void;
	animateInstance: (gameObjectInstances: GameObject[]) => void;
	stop: () => void;
};

// Literal types for image rendering in the canvas context
type ImageRendering = "smooth" | "pixelated";
type ImageSmoothingQuality = "low" | "medium" | "high";

export class Game {
	/** @type {HTMLCanvasElement} Canvas element that serves as the game sandbox */
	#canvas: HTMLCanvasElement;
	/** @type {CanvasRenderingContext2D} Context of the Canvas element */
	#context: CanvasRenderingContext2D | null = null;
	/** @type {CanvasRenderingContext2DSettings} Settings of the Context from the Canvas element */
	#contextSettings: CanvasRenderingContext2DSettings = {};
	/** @type {number} Width of the Canvas element */
	#width: number;
	/** @type {number} Height of the Canvas element */
	#height: number;
	/** @type {Map<string, Sprite>} A map that contains loaded sprites (returned in the preload state) */
	#loadedSprites: Map<string, Sprite> = new Map<string, Sprite>();
	/** @type {Map<string, GameObject>} A map that contains loaded gameobjects (returned in the load state) */
	#loadedGameObjects: Map<string, GameObject> = new Map<string, GameObject>();
	/** @type {number} Global scale multiplier for all sprites in-game */
	#scale: number = 1;
	/** @type {0 | 1 | 2 | 3 | 4} States in which the game will run throught the development process (unset->preload->load->update) */
	#currentState: GameState = GameState.unset;
	/** @type {boolean} A boolean for knowing when to use utility logs */
	#logsEnabled: boolean = false;
	/** @type {"smooth" | "pixelated"} The type of rendering that the canvas will use */
	#renderingType: ImageRendering = "smooth";
	/** @type {"low" | "medium" | "high"} The quality of smoothing that will be used if using the "smooth" type */
	#smoothRenderingValue: ImageSmoothingQuality = "low";

	/**
	 * @param {number} width The game screen width size
	 * @param {number} height The game screen height size
	 * @param {HTMLElement} appendTo The elements whom the game will be appended
	 * @param {CanvasRenderingContext2DSettings} [canvasContextSettings={}] An object for canvas context configurations
	 */
	constructor(
		width: number,
		height: number,
		appendTo: HTMLElement,
		canvasContextSettings: CanvasRenderingContext2DSettings = {},
	) {
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
	public get loadedSprites() {
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

	/** Sets the background of the game screen using common CSS logic */
	public set background(backgroundValue: string) {
		this.#canvas.style.background = backgroundValue;
	}

	/** The global scale of the canvas object. All objects are scaled according to this property
	 * @type {number}
	 * @example const game = new Game(600, 400, document.body);
	 * game.scale = 2; // 128px sprites are now 256px
	 */
	public get scale() {
		return this.#scale;
	}
	public set scale(scaleValue: number) {
		this.#scale = Math.abs(scaleValue);
	}

	/** The rendering type used in the game
	 * @example const game = new Game(600, 400, document.body);
	 * game.renderingType = "pixelated"; // makes the sprites crispy looking
	 * @default "smooth"
	 */
	public get renderingType() {
		return this.#renderingType;
	}
	/** @param {"smooth" | "pixelated"} renderingType */
	public set renderingType(renderingType: ImageRendering) {
		this.#renderingType = renderingType;
	}

	/** The quality of the smoothness of game sprites. Only works when renderingType is set to "smooth"
	 * @example const game = new Game(600, 400, document.body);
	 * game.renderingType = "smooth";
	 * game.smoothingQuality = "high"; // makes the sprites more smooth
	 * @default "low"
	 */
	public get smoothingQuality() {
		return this.#smoothRenderingValue;
	}
	/** @param {"low" | "medium" | "high"} smoothingQuality */
	public set smoothingQuality(smoothingQuality: ImageSmoothingQuality) {
		if (this.#renderingType !== "smooth") {
			throw new Error(
				`The current rendering type is set to '${this.renderingType}', set it to 'smooth' to use this attribute`,
			);
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
	public preload(callbackFn: () => Array<any> | any) {
		const assets: Array<any> = callbackFn();

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
	public load(callbackFn: (assets: AssetsParamType) => Array<GameObject>) {
		setTimeout(() => {
			const assets: AssetsParamType = {
				logSprites: () => {
					console.log("currently loaded sprites: ", this.loadedSprites);
				},
				preloaded: (assetName: string) => {
					if (this.#logsEnabled && !this.#loadedSprites.has(assetName)) {
						console.error(
							`Named asset '${assetName}' was not found in the preloaded resources, check if you preloaded it correctly and gave it the right name`,
						);
					}

					if (this.#loadedSprites.has(assetName)) return this.#loadedSprites.get(assetName);
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
	public update(callbackFn: (updater: UpdaterParamType) => void) {
		setTimeout(() => {
			const updater: UpdaterParamType = {
				logGameObjects: () => {
					console.log("Currently loaded game objects: ", this.#loadedGameObjects);
				},
				loaded: (gameObjectName) => {
					if (this.#logsEnabled && !this.#loadedGameObjects.has(gameObjectName)) {
						console.error(
							`Named game object '${gameObjectName}' was not found in the loaded resources, check if you loaded it correctly and gave it the right name`,
						);
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
	#drawSprite(gameObject: GameObject) {
		if (this.#context) {
			if (this.#renderingType === "smooth") {
				this.#context.imageSmoothingEnabled = true;
				this.#context.imageSmoothingQuality = this.#smoothRenderingValue;
			} else if (this.#renderingType === "pixelated") {
				this.#context.imageSmoothingEnabled = false;
			}

			this.#context.drawImage(
				gameObject.sprite.element,
				gameObject.pos.x,
				gameObject.pos.y,
				gameObject.size.w * this.#scale,
				gameObject.size.h * this.#scale,
			);
		}
	}

	/**
	 * GAME UTILITIES -------------------------------------------------------------------
	 */

	/** Automatically resizes the game screen into Fullscreen Mode using an EventListener */
	public useFullScreen() {
		window.addEventListener("resize", () => {
			this.#canvas.width = window.innerWidth;
			this.#canvas.height = window.innerHeight;
		});
	}

	/** Clears the entire canvas context. Beware of things that you don't want to clear! */
	public useClearScreen() {
		if (this.#context) {
			this.#context.reset();
		}
	}

	/** Allows utility logs into the console, such as assets and objects being loaded */
	public useUtilityLogs() {
		if (!this.#logsEnabled) {
			console.warn(
				"Utility logs are now enabled, be carefull of what you're going to show into your console!",
			);
			this.#logsEnabled = true;
		}
	}
}
