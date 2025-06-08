export class GameScreen {
	/** @type {number} width */
	#width;
	/** @type {number} height */
	#height;
	/** @type {HTMLCanvasElement} element */
	#element = document.createElement("canvas");
	/** @type {CanvasRenderingContext2DSettings} contextSettings */
	#contextSettings;
	/** @type {CanvasRenderingContext2D | null} context */
	#context;
	/** @type {string} title */
	#title;
	/** @type {Function=} callback */
	#callback;
	/** @type {Map<string, GameObject>} */
	#gameObjects = new Map();

	/**
	 * @param {number} width
	 * @param {number} height
	 * @param {string} screenTitle
	 * @param {CanvasRenderingContext2DSettings} contextSettings
	 */
	constructor(width, height, screenTitle, contextSettings = {}) {
		this.#width = width;
		this.#height = height;
		this.#title = screenTitle;
		this.#contextSettings = contextSettings;
		this.#context = this.#element.getContext("2d", this.#contextSettings);

		this.#element.width = this.#width;
		this.#element.height = this.#height;
		this.#element.style.background = "#eee";
		this.#element.setAttribute("screen-title", this.#title);
	}

	/**
	 * ----------------------------------------------------------------------------------
	 * Getters and Setters
	 * ----------------------------------------------------------------------------------
	 **/

	/** Gets and Sets the GameScreen width
	 * @example const GS = new GameScreen(1920, 1080, "main-screen");
	 * console.log(GS.width);
	 * output: 1920;
	 *
	 * GS.width = 640; // changing screen width
	 *
	 * console.log(GS.width);
	 * output: 640
	 */
	get width() {
		return this.#width;
	}
	set width(width) {
		this.#width = width;
		this.#element.width = this.#width;
	}

	/** Gets and Sets the GameScreen height
	 * @example const GS = new GameScreen(1920, 1080, "main-screen");
	 * console.log(GS.height);
	 * output: 1080;
	 *
	 * GS.width = 480; // changing screen height
	 *
	 * console.log(GS.height);
	 * output: 480
	 */
	set height(height) {
		this.#height = height;
		this.#element.height = this.#height;
	}
	get height() {
		return this.#height;
	}

	get gameObjects() {
		return this.#gameObjects;
	}

	/**
	 * ----------------------------------------------------------------------------------
	 * Methods
	 * ----------------------------------------------------------------------------------
	 **/

	/**
	 * Append the GameScreen object to an HTMLElement
	 * @param {HTMLElement} parentElement
	 * @example const GS = new GameScreen(640, 480, "main-screen");
	 * GS.appendTo(document.body);
	 */
	appendTo(parentElement) {
		parentElement.appendChild(this.#element);
	}

	/** Set a style attribute to an GameScreen Canvas Element
	 *
	 * NOTE: This can break or improve you game!
	 * @param {keyof CSSStyleDeclaration} styleAttribute Attribute that will be change (ex: background, border-radius)
	 * @param {string} value A string with the value you want (color, size, positioning...)
	 * @throws {Error} Returns an error if you try to change certain Style rules (lenght, parentRule...)
	 * @example GS.setStyle("background", "#fff")
	 */
	setStyle(styleAttribute, value) {
		/** @type {string[]} disallowedProperties */
		const disallowedProperties = ["length", "parentRule"];

		if (disallowedProperties.includes(String(styleAttribute))) {
			throw new Error("Attribute can't be used");
		}
		this.#element.style[styleAttribute] = value;
	}

	/** Insantiate a GameObject into your GameScreen
	 * @param {Function} callback
	 * @example const GS = new GameScreen(640, 480, "main-screen");
	 * GS.appendTo(document.body);
	 *
	 * const player = new GameObject(0, 0, "./player_spr.png", 64, 64);
	 * GS.instantiate(player);
	 * */
	load(callback) {
		/** @type {Array<GameObject> | GameObject} result */
		const result = callback();

		const objects = Array.isArray(result) ? result : [result];

		for (const gameObject of objects) {
			const draw = () => {
				if (this.#context) {
					console.log(gameObject);
					this.#context.drawImage(
						gameObject.element,
						gameObject.posX,
						gameObject.posY,
						gameObject.width,
						gameObject.height,
					);
				}
			};

			if (gameObject.element.complete) {
				draw();
			} else {
				gameObject.element.onload = draw;
			}

			this.#gameObjects.set(gameObject.objectName, gameObject);
			console.info(`"${gameObject.objectName}" has been added to gameObjects Map`);
		}
	}

	/**
	 * @param {GameObject} gameObject
	 */
	#clear(gameObject) {
		if (this.#context) {
			this.#context.clearRect(
				gameObject.posX,
				gameObject.posY,
				gameObject.width,
				gameObject.height,
			);
		}
	}

	/** @param {GameObject} gameObject */
	destroy(gameObject) {
		if (this.#gameObjects.has(gameObject.objectName)) {
			console.info(`"${gameObject.objectName}" has been removed of gameObjects Map`);
			gameObject.element.onload = () => {
				this.#clear(gameObject);
			};
			this.#gameObjects.delete(gameObject.objectName);
		}
	}

	/**
	 * @callback UpdateCallback
	 * @param {Map<string, GameObject>} gameObjects - Mapa com os objetos do jogo
	 */

	/**
	 * @param {UpdateCallback} callback Function that returns GameObjects loaded and updates what you do inside it every frame
	 * @example GS.update((gameObjects) => {
	 * const player = gameObjects.get("player")
	 *
	 * player.posX += 5
	 * })
	 */
	update(callback) {
		const objects = this.#gameObjects;
		const canvasWidth = this.#element.width;
		const canvasHeight = this.#element.height;

		const loop = () => {
			this.#context?.clearRect(0, 0, canvasWidth, canvasHeight);
			callback(this.#gameObjects);

			for (const gameObject of objects) {
				const draw = () => {
					if (this.#context) {
						this.#context.drawImage(
							gameObject[1].element,
							gameObject[1].posX,
							gameObject[1].posY,
							gameObject[1].width,
							gameObject[1].height,
						);
					}
				};

				if (gameObject[1].element.complete) {
					draw();
				} else {
					gameObject[1].element.onload = draw;
				}
			}

			requestAnimationFrame(loop);
		};
		requestAnimationFrame(loop);
	}
}

export class GameObject {
	/** @type {string} objectName */
	#objectName;
	/** @type {number} posX */
	#posX;
	/** @type {number} posY */
	#posY;
	/** @type {number} width */
	#width;
	/** @type {number} height */
	#height;
	/** @type {string} spr */
	#spr;
	/** @type {HTMLImageElement} element */
	/** @type {any} */
	#scale = 1;
	#element;
	/** @type {object} registeredActions */
	registeredActions = {};

	/**
	 * @param {string} objectIdentifier
	 * @param {number} posX
	 * @param {number} posY
	 * @param {string} spriteURI
	 * @param {number} width
	 * @param {number} height
	 */
	constructor(objectIdentifier, posX = 0, posY = 0, spriteURI = "", width = 64, height = 64) {
		this.#objectName = objectIdentifier;
		this.#posX = posX;
		this.#posY = posY;
		this.#spr = spriteURI;
		this.#width = width;
		this.#height = height;
		this.#element = new Image();
		this.#scale = 1;

		this.#loadImage();

		this.el = this.#element;
	}

	/**
	 * ----------------------------------------------------------------------------------
	 * Getters and Setters
	 * ----------------------------------------------------------------------------------
	 **/

	/** Gets and Sets the GameObject sprite using a local URI
	 * @example const player = new GameObject();
	 * player.sprite = "./player_spr.png";
	 *
	 * console.log(player.sprite);
	 * output: "./player_spr.png"
	 */
	get sprite() {
		return this.#spr;
	}
	set sprite(spr) {
		this.#spr = spr;
		this.#element.src = this.#spr;
	}

	/** Gets and Sets the GameObject position in the X axis
	 * @example const player = new GameObject();
	 * player.posX = 100;
	 *
	 * console.log(player.posX);
	 * output: 100
	 */
	get posX() {
		return this.#posX;
	}
	set posX(valuePX) {
		this.#posX = valuePX;
	}

	/** Gets and Sets the GameObject position in the Y axis
	 * @example const player = new GameObject();
	 * player.posY = 50;
	 *
	 * console.log(player.posY);
	 * output: 50
	 */
	get posY() {
		return this.#posY;
	}
	set posY(valuePY) {
		this.#posY = valuePY;
	}

	/** Gets and Sets the GameObject width size in the GameScreen.
	 *
	 * NOTE: It doesn't change the image actual size, only the way it appears in game.
	 * @example const player = new GameObject();
	 * player.width = 64;
	 *
	 * console.log(player.posY);
	 * output: 64
	 */
	get width() {
		return this.#width ?? this.#element.naturalWidth;
	}
	set width(value) {
		this.#width = value;
	}

	/** Gets and Sets the GameObject height size in the GameScreen.
	 *
	 * NOTE: It doesn't change the image actual size, only the way it appears in game.
	 * @example const player = new GameObject();
	 * player.height = 64;
	 *
	 * console.log(player.posY);
	 * output: 64
	 */
	get height() {
		return this.#height ?? this.#element.naturalHeight;
	}
	set height(value) {
		this.#height = value;
	}

	/** Returns the GameObject image element
	 * @example const player = new GameObject();
	 * player.sprite = "./player_spr.png";
	 *
	 * console.log(player.element);
	 * output: <img src="./player_spr.png">
	 */
	get element() {
		return this.#element;
	}

	get objectName() {
		return this.#objectName;
	}

	get scale() {
		return this.#scale;
	}
	set scale(value) {
		if (value < 0) {
			console.log("-");
			this.#element.style.rotate = "y 180deg";

			value = value * -1;
		}
		this.#width *= value;
		this.#height *= value;
	}

	/**
	 * ----------------------------------------------------------------------------------
	 * Methods
	 * ----------------------------------------------------------------------------------
	 **/

	/** Returns a Promise that resolves after the image is loaded
	 * @returns {Promise<void>}
	 */
	#loadImage() {
		return new Promise((resolve, reject) => {
			this.#element.onload = () => resolve();
			this.#element.onerror = reject;
			this.#element.src = this.#spr;
		});
	}

	/**
	 * @typedef {object} ArrowKeys
	 * @property {() => void} [ArrowUp]
	 * @property {() => void} [ArrowDown]
	 * @property {() => void} [ArrowLeft]
	 * @property {() => void} [ArrowRight]
	 *
	 * @typedef {object} WASDKeys
	 * @property {() => void} [w]
	 * @property {() => void} [s]
	 * @property {() => void} [a]
	 * @property {() => void} [d]
	 *
	 * @typedef {object} KeyEventTypes
	 * @property {ArrowKeys | WASDKeys} [onKeyDown]
	 * @property {WASDKeys} [onKeyUp]
	 * @property {WASDKeys} [onKeyPress]
	 *
	 * @param {KeyEventTypes} keyBindingsObject
	 **/
	setActions(keyBindingsObject) {
		this.registeredActions = Object.assign({}, this.registeredActions, keyBindingsObject);

		if (!this._actionsInitialized) {
			this._actionsInitialized = true;

			window.addEventListener("keydown", (e) => {
				const action = this.registeredActions.onKeyDown?.[e.key];
				if (typeof action === "function") {
					action();
				}
			});

			window.addEventListener("keyup", (e) => {
				const action = this.registeredActions.onKeyUp?.[e.key];
				if (typeof action === "function") {
					action();
				}
			});

			window.addEventListener("keypress", (e) => {
				const action = this.registeredActions.onKeyPress?.[e.key];
				if (typeof action === "function") {
					action();
				}
			});
		}
	}
}
