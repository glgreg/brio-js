import { Vector2 } from "../GameTypes";
import { BrioLogger } from "../logging/BrioLogger";

type Vector2Bool = {
	x: boolean;
	y: boolean;
};
export interface SpriteManipulation {
	size: Vector2;
	pos: Vector2;
	rotate: number;
	scale: number;
	skew: Vector2;
	flip: Vector2Bool;
}

export type GameSpriteProps = {
	name: string;
	src: string;
	pos: Vector2;
	size: Vector2;
	type: string;
};

export class BrioSprite implements SpriteManipulation {
	/** @type {string} The name of the sprite asset */
	#name: string;
	/** @type {HTMLImageElement} Element created to receive an image */
	#element: HTMLImageElement;
	/** @type {string} The source URL used in the sprite */
	#pos: Vector2;
	#src: string;
	#initialSize: Vector2;
	#size: Vector2;
	#type: string;
	#rotation: number = 0;
	#skew: Vector2 = { x: 0, y: 0 };
	#scale: number = 1;
	#flip: { x: boolean; y: boolean } = { x: false, y: false };

	static #emptyInstance?: BrioSprite;

	/**
	 * @param {string} name A name for the sprite object
	 * @param {string} src The source URI for the targeted image
	 * @param {string} [type="img"] The type of the image (img | svg)
	 * @example game.preload(() => {
	 *
	 * const spr_player = new GameSprite("spr_player", "./sprites/player.png", 0, 0, 32, 32);
	 * return [spr_player]; // now the "spr_player" GameSprite can be used in the 'load' step
	 * });
	 */
	constructor(props: GameSpriteProps) {
		this.#name = props.name;
		this.#src = props.src;
		this.#pos = props.pos;
		this.#size = props.size;
		this.#initialSize = props.size;
		this.#type = props.type;

		if (this.#type === "img") {
			this.#element = new Image();
			this.#element.src = this.#src;
		} else if (this.#type === "vec") {
			this.#element = new Image();
			this.#element.src = this.#src;
		} else throw BrioLogger.fatalError("Invalid sprite type: use 'img' or 'vec'");
	}

	/**
	 * GETTERS AND SETTERS -------------------------------------------------------------
	 */

	/**
	 * Returns the element of the GameSprite object
	 * @example const player = new GLS.GameSprite("spr_player", "./spr_player.png");
	 * console.log(player.element); // <img src="./spr_player.png">
	 */
	public get element(): HTMLImageElement {
		return this.#element;
	}

	/**
	 * Returns the name of the GameSprite object
	 * @example const player = new GLS.GameSprite("spr_player", "./spr_player.png");
	 * console.log(player.name); // "spr_player"
	 */
	public get name(): string {
		return this.#name;
	}

	/**
	 * Returns the source URL of the GameSprite object
	 * @example const player = new GLS.GameSprite("spr_player", "./spr_player.png");
	 * console.log(player.src); // "./spr_player.png"
	 */
	public get src(): string {
		return this.#src;
	}

	public get size() {
		const self = this;
		return {
			get x() {
				return self.#size.x;
			},
			set x(value: number) {
				self.#flipSprite("x", value);
				self.#size.x = Math.abs(value);
			},
			get y() {
				return self.#size.y;
			},
			set y(value: number) {
				self.#flipSprite("y", value);
				self.#size.y = Math.abs(value);
			},
		};
	}

	public get pos() {
		const self = this;
		return {
			get x() {
				return self.#pos.x;
			},
			set x(value: number) {
				self.#pos.x = Number(value.toFixed(2));
			},
			get y() {
				return self.#pos.y;
			},
			set y(value: number) {
				self.#pos.y = Number(value.toFixed(2));
			},
		};
	}

	public get scale() {
		return this.#scale;
	}
	public set scale(value: number) {
		this.#scale = value;

		this.#flipSprite("x", value);
		this.#size.x *= Math.abs(this.#scale);
		this.#size.y *= Math.abs(this.#scale);
	}

	public get type() {
		return this.#type;
	}

	public set rotate(value: number) {
		this.#rotation = value;
		this.#element.style.transform = `rotate(${this.#rotation}deg)`;
	}
	public get rotate() {
		return this.#rotation;
	}

	public get skew() {
		const self = this;

		return {
			get x() {
				return self.#skew.x;
			},
			set x(value: number) {
				self.#skew.x = value;
				self.#element.style.transform = `skewX(${self.#skew.x}deg)`;
			},
			get y() {
				return self.#skew.y;
			},
			set y(value: number) {
				self.#skew.y = value;
				self.#element.style.transform = `skewX(${self.#skew.y}deg)`;
			},
		};
	}

	public get flip() {
		const self = this;
		return {
			set x(value: boolean) {
				self.#flip.x = value;
			},
			get x() {
				return self.#flip.x;
			},
			set y(value: boolean) {
				self.#flip.y = value;
			},
			get y() {
				return self.#flip.y;
			},
		};
	}

	/**
	 * Set the source URL of the GameSprite object
	 * @example const player = new GLS.GameSprite("spr_player", "./spr_player.png");
	 * player.src = "./spr_player_jump.png";
	 */
	public set src(value) {
		this.#src = value;
	}

	#flipSprite(axis: "x" | "y", value: number) {
		switch (axis) {
			case "x":
				if (value < 0 && this.#flip.x === false) this.#flip.x = true;
				else this.#flip.x = false;
				break;
			case "y":
				if (value < 0 && this.#flip.y === false) this.#flip.y = true;
				else this.#flip.y = false;
				break;
			default:
				throw new Error("Only x and y can be used to flip a sprite");
		}
	}

	public static getEmptyInstance(): BrioSprite {
		if (this.#emptyInstance === undefined) {
			const instance = new BrioSprite({
				name: "",
				src: "",
				pos: { x: 0, y: 0 },
				size: { x: 32, y: 32 },
				type: "img",
			});
			this.#emptyInstance = instance;

			return this.#emptyInstance;
		} else {
			return this.#emptyInstance;
		}
	}

	public static clone(targetGameSprite: BrioSprite): BrioSprite {
		return new BrioSprite({
			name: targetGameSprite.#name,
			src: targetGameSprite.#src,
			pos: { x: targetGameSprite.#pos.x, y: targetGameSprite.#pos.y },
			size: { x: targetGameSprite.#size.x, y: targetGameSprite.#size.y },
			type: targetGameSprite.type,
		});
	}
}
