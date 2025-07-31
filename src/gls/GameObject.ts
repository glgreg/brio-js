import { GameSprite, SpriteManipulation } from "./asset/GameSprite";
import { Vector2 } from "./GameTypes";

export type KeyActions = {
	[key: string]: () => void;
};

type CollisionColliderType = "solid" | "intangible";
type CollisionMaskForm = "square" | "circle";

export class GameObject implements SpriteManipulation {
	/** @type {string} The name of the game object */
	#name: string;
	/** @type {Sprite} The sprite attached to the game object */
	#sprite: GameSprite;
	/** @type {boolean} Used to check if the object is the original object or a instance of itself  */
	public static instanceOfObject: boolean = false;
	/** @type {string} An instance ID used when a game object is a instance of the same game object, defaults to 0 if it's the original object */
	public instanceId: number;
	/** @type {number} The layer level the object is located */
	#layer: number;

	#p: Vector2 = { x: 0, y: 0 };

	static #emptyInstance?: GameObject;

	#collisionEnabled: boolean = false;
	#collisionType?: CollisionColliderType;
	#collisionForm?: CollisionMaskForm;
	#collisionPosX?: number;
	#collisionPosY?: number;
	#collisionWidth?: number;
	#collisionHeight?: number;
	#collisionArea?: number;

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
	constructor(name: string, sprite: GameSprite, layer: number) {
		// Checks if the given name have -[0-9] at the end (so it doesn't conflict with instances of the same game object)
		if (/-[0-9]+$/.test(name) && !GameObject.instanceOfObject) {
			throw new Error(
				"Game objects can't end with '-number', try using underline instead (bot-5 -> bot_5)",
			);
		}

		this.#name = name;
		// Clones the Sprite so that more than one game object can have the same one
		this.#sprite = GameSprite.clone(sprite);
		this.#layer = Math.round(Math.abs(layer));
		this.instanceId = 0;
	}

	/**
	 * GETTER AND SETTERS ---------------------------------------------------------------
	 */

	public get flip() {
		const self = this;
		return {
			set x(value: boolean) {
				self.#sprite.flip.x = value;
			},
			get x() {
				return self.#sprite.flip.x;
			},
			set y(value: boolean) {
				self.#sprite.flip.y = value;
			},
			get y() {
				return self.#sprite.flip.y;
			},
		};
	}

	public get skew() {
		const self = this;
		return {
			set x(value: number) {
				self.#sprite.skew.x = value;
			},
			get x() {
				return self.#sprite.skew.x;
			},
			set y(value: number) {
				self.#sprite.skew.y = value;
			},
			get y() {
				return self.#sprite.skew.y;
			},
		};
	}

	public set scale(value: number) {
		this.#sprite.scale = value;
	}
	public get scale() {
		return this.#sprite.scale;
	}

	public set rotate(value: number) {
		this.#sprite.rotate = value;
	}
	public get rotate() {
		return this.#sprite.rotate;
	}

	public set layer(layerLevel: number) {
		layerLevel = Math.round(Math.abs(layerLevel));

		this.#layer = layerLevel;
	}
	public get layer() {
		return this.#layer;
	}

	public get collision() {
		const self = this;
		return {
			get enabled() {
				return self.#collisionEnabled;
			},
			get form() {
				return self.#collisionForm;
			},
			get type() {
				return self.#collisionType;
			},
			get x() {
				return self.#collisionPosX;
			},
			get y() {
				return self.#collisionPosY;
			},
			get w() {
				return self.#collisionWidth;
			},
			get h() {
				return self.#collisionHeight;
			},
			get area() {
				return self.#collisionArea;
			},
		};
	}

	/** Returns the attached Sprite used in the game object
	 * @returns {GameSprite}
	 */
	public get sprite(): GameSprite {
		return this.#sprite;
	}

	/** Sets and returns the size of the game object Width and Height
	 * @example const player = new GameObject("player", spr_player);
	 * player.size.w = 128;
	 * player.size.h = 128;
	 * console.log(player.size.w, player.size.h); // 128, 128 (attention: it will be multiplied by the game "scale" property)
	 */
	public get size(): Vector2 {
		const self = this;
		return {
			get x() {
				return self.#sprite.size.x;
			},
			set x(value: number) {
				self.#sprite.size.x = value;
			},
			get y() {
				return self.#sprite.size.y;
			},
			set y(value: number) {
				self.#sprite.size.y = value;
			},
		};
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
	public get pos(): Vector2 {
		const self = this;
		return {
			get x() {
				return self.#sprite.pos.x;
			},
			set x(value: number) {
				self.#sprite.pos.x = value;
			},
			get y() {
				return self.#sprite.pos.y;
			},
			set y(value: number) {
				self.#sprite.pos.y = value;
			},
		};
	}

	/**
	 * METHODS --------------------------------------------------------------------------
	 */

	public addCollisionMask(
		maskForm: CollisionMaskForm = "square",
		collisionType: CollisionColliderType,
		px: number,
		py: number,
		sw: number,
		sh: number,
	) {
		if (this.#collisionEnabled) {
			return;
		}

		this.#collisionForm = maskForm;
		this.#collisionType = collisionType;
		this.#collisionPosX = px;
		this.#collisionPosY = py;
		this.#collisionWidth = sw;
		this.#collisionHeight = sh;
		this.#collisionArea = sw * sh;
		this.#collisionEnabled = true;
	}

	static getEmptyInstance(): GameObject {
		if (this.#emptyInstance === undefined) {
			const instance = new GameObject("", GameSprite.getEmptyInstance(), 1);
			this.#emptyInstance = instance;

			return this.#emptyInstance;
		} else {
			return this.#emptyInstance;
		}
	}
}
