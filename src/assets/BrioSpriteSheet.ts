import { Vector2 } from "../math/BrioVector2";
import { BrioSprite, SpriteProperties } from "./BrioSprite";

interface SpriteSheetProps extends SpriteProperties {
	slicing: Vector2<number>;
}
interface KeyframeAnimation {
	name: string;
	grid: Vector2<number>;
}

export class BrioSpriteSheet {
	#sprite: BrioSprite;
	#slicing: Vector2<number>;
	#grid: Vector2<number>;
	#animations: Map<string, BrioSprite> = new Map();

	constructor(sprite: BrioSprite, sliceX: number, sliceY: number) {
		this.#sprite = sprite;
		this.#slicing = { x: sliceX, y: sliceY };
		this.#grid = {
			x: sprite.transform.size.x / this.#slicing.x,
			y: sprite.transform.size.y / this.#slicing.y,
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
				new BrioSprite({
					name: `${this.#sprite.name}_${name}`,
					src: this.#sprite.src,
					position: this.#sprite.transform.position,
					size: {
						x: this.#sprite.transform.size.x / this.#grid.x,
						y: this.#sprite.transform.size.y,
					},
					type: "img",
				}),
			);
		}
	}
}
