import { BrioSprite, SpriteManipulation } from "./assets/BrioSprite";
import { BrioCollision } from "./BrioCollision";
import { Vector2 } from "./BrioVector2";
import { BrioLogger } from "./logging/BrioLogger";

export type KeyActions = {
	[key: string]: () => void;
};

export interface CollisionType {
	enabled: boolean;
	colliderType: CollisionColliderType;
	shape: CollisionShapeType;
	pos: Vector2;
	size: Vector2;
}
export type CollisionColliderType = "solid" | "intangible";
export type CollisionShapeType = "square" | "circle" | "rectangle";

export class BrioObject implements SpriteManipulation {
	// Basic properites
	/** The name of the game object */
	#name: string;
	/** The sprite attached to the game object */
	#sprite: BrioSprite;
	/** The layer level the object is located */
	#layer: number;

	// Cloning and identification logic
	/** Used to check if the object is the original object or a instance of itself  */
	public static instanceOfObject: boolean = false;
	/** An instance ID used when a game object is a instance of the same game object, defaults to 0 if it's the original object */
	public instanceId: number;
	/** The number of instantiated clones of this object (clones can also be cloned) */
	#clonesInstantiatedValue: number = 0;
	/** An empty instance for singleton logic */ // todo: remove this
	static #emptyInstance?: BrioObject;

	// COLLISION LOGIC
	/** An object that contains collision properties of the game object, such as shape, position and size */
	public collision?: CollisionType;

	/**
	 * @param name The name of the game object
	 * @param sprite The Sprite that will be attached to the game object
	 * @example game.load((assets) => {
	 *
	 * const spr_player = assets.preloaded("spr_player");
	 * const player = new BrioObject("player", spr_player);
	 * return [player]; // now the "player" BrioObject can be used in the 'update' step
	 * });
	 */
	constructor(name: string, sprite: BrioSprite, layer: number) {
		// Checks if the given name have -[0-9] at the end (so it doesn't conflict with instances of the same game object)
		if (/-[0-9]+$/.test(name) && !BrioObject.instanceOfObject) {
			throw new Error(
				"Game objects can't end with '-number', try using underline instead (bot-5 -> bot_5)",
			);
		}

		this.#name = name;
		// clones the Sprite so that more than one game object can have the same one
		this.#sprite = BrioSprite.clone(sprite);
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

	/** Returns the attached Sprite used in the game object
	 */
	public get sprite(): BrioSprite {
		return this.#sprite;
	}
	/** Returns the attached Sprite used in the game object
	 */
	public set sprite(newSprite) {
		this.#sprite = newSprite;
	}

	/** Sets and returns the size of the game object Width and Height
	 * @example const player = new BrioObject("player", spr_player);
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
	 * @example const player = new BrioObject("player", spr_player);
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

	public set clonesInstantiatedValue(value: number) {
		if (!BrioObject.instanceOfObject) {
			throw BrioLogger.fatalError(
				"The number of clones can't be hard coded, their amount increases automatically when new instances are created.",
			);
		}

		this.#clonesInstantiatedValue += value;
	}
	public get clonesInstantiatedValue() {
		return this.#clonesInstantiatedValue;
	}

	/**
	 * METHODS --------------------------------------------------------------------------
	 */

	public addCollisionMask(
		shape: CollisionShapeType = "square",
		collisionType: CollisionColliderType = "solid",
		px: number,
		py: number,
		sw: number,
		sh: number,
	) {
		if (this.collision) {
			return;
		}

		this.collision = {
			enabled: true,
			shape: shape,
			colliderType: collisionType,
			pos: { x: px, y: py },
			size: { x: sw, y: sh },
		};
	}

	static getEmptyInstance(): BrioObject {
		if (this.#emptyInstance === undefined) {
			const instance = new BrioObject("", BrioSprite.getEmptyInstance(), 1);
			this.#emptyInstance = instance;

			return this.#emptyInstance;
		} else {
			return this.#emptyInstance;
		}
	}

	public static clone(gameObject: BrioObject) {
		const object = new BrioObject(gameObject.#name, gameObject.#sprite, gameObject.#layer);

		if (object.collision) {
			switch (object.collision.shape) {
				case "square":
					BrioCollision.addSquare({
						object: object,
						colliderType: "solid",
						pos: object.collision.pos,
						size: object.collision.size.x,
					});
					break;
				case "rectangle":
					BrioCollision.addRectangle({
						object: object,
						colliderType: "solid",
						pos: object.collision.pos,
						size: object.collision.size,
					});
					break;
				case "circle":
					BrioCollision.addCircle({
						object: object,
						colliderType: "solid",
						pos: object.collision.pos,
						size: object.collision.size.x,
					});
					break;
			}
		}

		return object;
	}
}
