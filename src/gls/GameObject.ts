import { Sprite } from "./Sprite";

type KeyActions = {
	[key: string]: () => void;
};

interface KeyEventTypes {
	onKeyDown?: KeyActions;
	onKeyUp?: KeyActions;
	onKeyPress?: KeyActions;
}

export class GameObject {
	/** @type {string} The name of the game object */
	#name: string;
	/** @type {Sprite} The sprite attached to the game object */
	#sprite: Sprite;
	/** @type {"check latter"} An object that receives actions events for the game object, such as keyboard clicking events */
	#registeredActions: KeyEventTypes = {};
	/** @type {boolean} Checks if game actions were initialized */
	#actionsInitialized: boolean = false;
	/** @type {boolean} Used to check if the object is the original object or a instance of itself  */
	static #instanceOfObject: boolean = false;
	/** @type {string} An instance ID used when a game object is a instance of the same game object, defaults to 0 if it's the original object */
	#instanceId: number;

	/**
	 * @param {string} name The name of the game object
	 * @param {Sprite} sprite The Sprite that will be attached to the game object
	 * @example game.load((assets) => {
	 *
	 * const spr_player = assets.preloaded("spr_player");
	 * const player = new GameObject("player", spr_player);
	 * return [player]; // now the "player" GameObject can be used in the 'update' step
	 * });
	 */
	constructor(name: string, sprite: Sprite) {
		// Checks if the given name have -[0-9] at the end (so it doesn't conflict with instances of the game object)
		if (/-[0-9]+$/.test(name) && !GameObject.#instanceOfObject) {
			throw new Error(
				"Game objects can't end with '-number', try using underline instead (bot-5 -> bot_5)",
			);
		}
		this.#name = name;
		// Clones the Sprite so that more than one game object can have the same one
		this.#sprite = Sprite.clone(sprite);

		this.#instanceId = 0;
	}

	/**
	 * GETTER AND SETTERS ---------------------------------------------------------------
	 */

	/** Returns the attached Sprite used in the game object */
	public get sprite() {
		return this.#sprite;
	}

	/** Returns the attached Sprite used in the game object */
	public get size() {
		return { w: this.#sprite.width, h: this.#sprite.height };
	}

	/** Returns the name of the game object */
	public get name() {
		return this.#name;
	}

	/** Sets and returns the position of the game object in the X and Y axis
	 * @example const player = new GameObject("player", spr_player);
	 * player.pos.x = 0;
	 * player.pos.y = 0;
	 * console.log(player.pos.x, player.pos.y); // 0, 0
	 */
	public get pos(): { x: number; y: number } {
		const self = this;
		return {
			get x() {
				return self.#sprite.posX;
			},
			set x(value: number) {
				self.#sprite.posX = value;
			},
			get y() {
				return self.#sprite.posY;
			},
			set y(value: number) {
				self.#sprite.posY = value;
			},
		};
	}

	/**
	 * METHODS --------------------------------------------------------------------------
	 */

	/** Sets actions events for the game object, such as keyboard clicking events
	 * @example const player = new GameObject("player", spr_player);
	 *
	 * player.setActions({
	 * onKeyDown: {
	 * ArrowLeft: () => { player.pos.x -= 5 },
	 * ArrowRight: () => { player.pos.y += 5 },
	 * }})
	 */
	public setActions(keyBindingsObject: KeyEventTypes) {
		this.#registeredActions = Object.assign({}, this.#registeredActions, keyBindingsObject);

		if (!this.#actionsInitialized) {
			this.#actionsInitialized = true;

			window.addEventListener("keydown", (e: KeyboardEvent) => {
				if (this.#registeredActions.onKeyDown) {
					const action = this.#registeredActions.onKeyDown[e.key];

					if (typeof action === "function") {
						action();
					}
				}
			});

			window.addEventListener("keyup", (e: KeyboardEvent) => {
				if (this.#registeredActions.onKeyUp) {
					const action = this.#registeredActions.onKeyUp[e.key];

					if (typeof action === "function") {
						action();
					}
				}
			});

			window.addEventListener("keypress", (e: KeyboardEvent) => {
				if (this.#registeredActions.onKeyPress) {
					const action = this.#registeredActions.onKeyPress[e.key];

					if (typeof action === "function") {
						action();
					}
				}
			});
		}
	}

	/** A factory-type method that creates clones of the game object and returns an array of them
	 * @param {number} [quantity=1] The quantity of clones to create
	 * @returns {GameObject[]} Returns an array of cloned game objects
	 * @example const enemy = new GameObject("enemy", spr_enemy);
	 * const enemies = enemy.instantiate(2);
	 *
	 * console.log(enemies); // [{name: "enemy-1"}, {name: "enemy-2"}]
	 */
	public instantiate(quantity: number = 1): GameObject[] {
		const instances: GameObject[] = [];
		GameObject.#instanceOfObject = true;

		for (let i = 0; i < quantity; i++) {
			const newObject = new GameObject(`${this.name}-${i + 1}`, this.#sprite);
			newObject.#instanceId++;
			newObject.pos.x = 0;
			newObject.pos.y = 0;

			instances.push(newObject);
		}

		GameObject.#instanceOfObject = false;

		return instances;
	}
}
