export class Sprite {
	/** @type {HTMLImageElement} Element created to receive an image */
	#element: HTMLImageElement;
	/** @type {string} The name of the sprite */
	#name: string;
	/** @type {string} The source URL used in the sprite */
	#src: string;
	#pos: { x: number; y: number };
	#posX: number;
	#posY: number;
	#initialWidth: number;
	#initialHeight: number;
	#width: number;
	#height: number;
	#size: { w: number; h: number };

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
	constructor(
		name: string,
		src: string,
		px: number = 0,
		py: number = 0,
		sw: number = 128,
		sh: number = 128,
		type: string = "img",
	) {
		this.#name = name;
		this.#src = src;
		this.#posX = px;
		this.#posY = py;
		this.#pos = { x: px, y: py };
		this.#size = { w: sw, h: sh };
		this.#width = sw;
		this.#initialWidth = sw;
		this.#initialHeight = sh;
		this.#height = sh;

		if (type === "img") {
			this.#element = new Image();
			this.#element.src = this.#src;
		} else if (type === "svg") {
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

	public get posX(): number {
		return this.#posX;
	}
	public set posX(value: number) {
		this.#posX = value;
	}

	public get posY(): number {
		return this.#posY;
	}
	public set posY(value: number) {
		this.#posY = value;
	}

	public get size(): { w: number; h: number } {
		const self = this;
		return {
			get w() {
				return self.#size.w;
			},
			set w(value: number) {
				self.#size.w = value;
			},
			get h() {
				return self.#size.h;
			},
			set h(value: number) {
				self.#size.h = value;
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
		return this.#width;
	}
	public set width(value: number) {
		this.#width = value;
	}

	public get height(): number {
		return this.#height;
	}
	public set height(value: number) {
		this.#height = value;
	}

	public get scale() {
		const initialSize = this.#initialWidth * this.#initialHeight;
		const currentSize = this.#width * this.#height;

		return Math.sqrt(currentSize / initialSize);
	}
	public set scale(value: number) {
		this.#width *= value;
		this.#height *= value;
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
		return new Sprite(
			targetSprite.name,
			targetSprite.src,
			targetSprite.posX,
			targetSprite.posY,
			targetSprite.width,
			targetSprite.height,
		);
	}
}
