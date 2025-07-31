import { GameMap } from "./GameMap";
import { GameObject } from "./GameObject";
import { Vector2 } from "./GameTypes";

export class GameCamera {
	#name: string;
	#pos: Vector2;
	#size: Vector2;
	#map: GameMap;
	#target?: GameObject;

	constructor(id: string, pos: Vector2, size: Vector2, map: GameMap) {
		this.#name = id;
		this.#pos = pos;
		this.#size = size;
		this.#map = map;
	}

	public get name() {
		return this.#name;
	}
	public get map() {
		return this.#map;
	}

	public get pos(): Vector2 {
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
}
