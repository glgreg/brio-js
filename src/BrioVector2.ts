import { Vector2 } from "./BrioTypes";

export class BrioVector2 implements Vector2 {
	public x: number;
	public y: number;

	/**
	 * @property {number} x
	 * @property {number} y
	 */
	constructor(x: number, y: number) {
		this.x = x;
		this.y = y;
	}

	/**
	 * Returns a normalized version of this vector
	 * @example const vec2 = new BrioVector2(10, 10);
	 *
	 * @returns {Vector2}
	 */
	public get normalized(): Vector2 {
		const magnitude = Math.sqrt(this.x * this.x + this.y * this.y);

		if (magnitude === 0) return { x: 0, y: 0 };

		return { x: this.x / magnitude, y: this.y / magnitude };
	}
}
