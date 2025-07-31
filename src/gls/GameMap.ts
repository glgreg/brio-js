import { GameSprite } from "./asset/GameSprite";
import { Vector2 } from "./GameTypes";

export interface MapProps {
	name: string;
	pos: Vector2;
	size: Vector2;
	sprite: GameSprite;
}

export class GameMap {
	name: string;
	size: Vector2;
	pos: Vector2;
	sprite: GameSprite;
	static #emptyInstance?: GameMap;

	constructor(mapProps: MapProps) {
		this.pos = mapProps.pos;
		this.size = mapProps.size;
		this.name = mapProps.name;

		this.sprite = mapProps.sprite;
	}

	public static getEmptyInstance(): GameMap {
		if (this.#emptyInstance === undefined) {
			const instance = new GameMap({
				name: "",
				sprite: GameSprite.getEmptyInstance(),
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
