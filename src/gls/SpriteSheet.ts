import { Vector2 } from "./GameTypes";
import { Sprite, SpriteProps } from "./Sprite";

interface SpriteSheetProps extends SpriteProps {
	slicing: Vector2;
}
interface KeyframeAnimation {
	name: string;
	grid: Vector2;
}

export class SpriteSheet {
	#sprite: Sprite;
	#slicing: Vector2;
	#grid: Vector2;
	#animations: Map<string, Sprite> = new Map();

	constructor(sprite: Sprite, sliceX: number, sliceY: number) {
		this.#sprite = sprite;
		this.#slicing = { x: sliceX, y: sliceY };
		this.#grid = {
			x: sprite.size.x / this.#slicing.x,
			y: sprite.size.y / this.#slicing.y,
		};
	}

	public log() {
		return this;
	}

	public setAnimation(name: string, gridX: number, gridY: number, animationTime: number) {
		if (gridX > this.#grid.x || gridX < 1 || gridY > this.#grid.y || gridY < 1) {
			return;
		}

		if (!this.#animations.get(name)) {
			this.#animations.set(
				name,
				new Sprite({
					name: `${this.#sprite.name}_${name}`,
					src: this.#sprite.src,
					pos: this.#sprite.pos,
					size: { x: this.#sprite.size.x / this.#grid.x, y: this.#sprite.size.y },
					type: "img",
				}),
			);
		}
	}
}
