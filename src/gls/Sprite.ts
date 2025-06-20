import { Vector2 } from "./GameTypes";

export interface SpriteProps {
	name: string;
	src: string;
	pos: Vector2;
	size: Vector2;
	type: string;
}

export class Sprite {
	/** @type {HTMLImageElement} Element created to receive an image */
	#element: HTMLImageElement;
	/** @type {string} The name of the sprite */
	#name: string;
	/** @type {string} The source URL used in the sprite */
	#src: string;
	#pos: Vector2;
	#initialSize: Vector2;
	#size: Vector2;
	#type: string;

	/**
	 * @param {string} name A name for the sprite object
	 * @param {string} src The source URI for the target image
	 * @param {string} [type="img"] The type of the image (img | svg)
	 * @example game.preload(() => {
	 *
	 * const spr_player = new Sprite("spr_player", "./sprites/player.png", 0, 0, 32, 32);
	 * return [spr_player]; // now the "spr_player" Sprite can be used in the 'load' step
	 * });
	 */
	constructor(props: SpriteProps) {
		this.#name = props.name;
		this.#src = props.src;
		this.#pos = props.pos;
		this.#size = props.size;
		this.#initialSize = props.size;
		this.#type = props.type;

		if (this.#type === "img") {
			this.#element = new Image();
			this.#element.src = this.#src;
		} else if (this.#type === "svg") {
			this.#element = new Image();
			this.#element.src = this.#src;
		} else throw new Error("Invalid sprite type: use 'img' or 'svg'");
	}

	/**
	 * GETTERS AND SETTERS -------------------------------------------------------------
	 */

	/**
	 * Returns the element of the Sprite object
	 * @example const player = new GLS.Sprite("spr_player", "./spr_player.png");
	 * console.log(player.element); // <img src="./spr_player.png">
	 */
	public get element(): HTMLImageElement {
		return this.#element;
	}

	/**
	 * Returns the name of the Sprite object
	 * @example const player = new GLS.Sprite("spr_player", "./spr_player.png");
	 * console.log(player.name); // "spr_player"
	 */
	public get name(): string {
		return this.#name;
	}

	/**
	 * Returns the source URL of the Sprite object
	 * @example const player = new GLS.Sprite("spr_player", "./spr_player.png");
	 * console.log(player.src); // "./spr_player.png"
	 */
	public get src(): string {
		return this.#src;
	}

	public get size(): Vector2 {
		const self = this;
		return {
			get x() {
				return self.#size.x;
			},
			set x(value: number) {
				self.#size.x = value;
			},
			get y() {
				return self.#size.y;
			},
			set y(value: number) {
				self.#size.y = value;
			},
		};
	}

	public get pos(): { x: number; y: number } {
		const self = this;
		return {
			get x() {
				return self.#pos.x;
			},
			set x(value: number) {
				self.#pos.x = value;
			},
			get y() {
				return self.#pos.y;
			},
			set y(value: number) {
				self.#pos.y = value;
			},
		};
	}

	public get width(): number {
		return this.#size.x;
	}
	public set width(value: number) {
		this.#size.x = value;
	}

	public get height(): number {
		return this.#size.y;
	}
	public set height(value: number) {
		this.#size.y = value;
	}

	public get scale() {
		const initialSize = this.#initialSize.x * this.#initialSize.y;
		const currentSize = this.#size.x * this.#size.y;

		return Math.sqrt(currentSize / initialSize);
	}
	public set scale(value: number) {
		this.#size.x *= value;
		this.#size.y *= value;
	}

	public get type() {
		return this.#type;
	}

	/**
	 * Set the source URL of the Sprite object
	 * @example const player = new GLS.Sprite("spr_player", "./spr_player.png");
	 * player.src = "./spr_player_jump.png";
	 */
	public set src(value) {
		this.#src = value;
	}

	public static clone(targetSprite: Sprite) {
		const props: SpriteProps = {
			name: targetSprite.#name,
			src: targetSprite.#src,
			pos: { x: targetSprite.#pos.x, y: targetSprite.#pos.y },
			size: { x: targetSprite.#size.x, y: targetSprite.#size.y },
			type: "img",
		};
		return new Sprite(props);
	}
}
