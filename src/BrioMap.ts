import { BrioSprite } from "./asset/BrioSprite";
import { Vector2 } from "./BrioTypes";

export interface MapProps {
	name: string;
	pos: Vector2;
	size: Vector2;
	sprite: BrioSprite;
}

export class BrioMap {
	name: string;
	size: Vector2;
	pos: Vector2;
	sprite: BrioSprite;
	static #emptyInstance?: BrioMap;

	constructor(mapProps: MapProps) {
		this.pos = mapProps.pos;
		this.size = mapProps.size;
		this.name = mapProps.name;

		this.sprite = mapProps.sprite;
	}

	public static getEmptyInstance(): BrioMap {
		if (this.#emptyInstance === undefined) {
			const instance = new BrioMap({
				name: "",
				sprite: BrioSprite.getEmptyInstance(),
				pos: { x: 0, y: 0 },
				size: { x: 100, y: 100 },
			});
			this.#emptyInstance = instance;

			return this.#emptyInstance;
		} else {
			return this.#emptyInstance;
		}
	}
}
