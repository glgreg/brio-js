import { BrioConsole } from "../debugging/BrioConsole";

export interface Vector2<T> {
	x: T;
	y: T;
}

export class BrioVector2 implements Vector2<number> {
	public x: number;
	public y: number;

	/**
	 * @param x
	 * @param y
	 */
	constructor(x: number, y: number) {
		this.x = x;
		this.y = y;
	}

	/**
	 * Returns a normalized version of this vector
	 * @example const vec2 = new BrioVector2(10, 10);
	 */
	public normalize(): Vector2<number> {
		const magnitude = Math.sqrt(this.x * this.x + this.y * this.y);

		if (magnitude === 0) {
			this.x = 0;
			this.y = 0;
		} else {
			this.x = this.x / magnitude;
			this.y = this.y / magnitude;
		}
		return this;
	}

	public clamp(min: Vector2<number>, max: Vector2<number>): Vector2<number> {
		if (min.x > max.x || min.y > max.y) {
			throw new Error(
				`Vector2 Min is greater than Max:\nmin(${min.x}, ${min.y})\nmax(${max.x}, ${max.y})`,
			);
		}

		this.x = Math.max(min.x, Math.min(max.x, this.x));
		this.y = Math.max(min.x, Math.min(max.y, this.y));
		return this;
	}

	public distanceTo(target: Vector2<number>) {
		this.x = Math.abs(target.x - this.x);
		this.y = Math.abs(target.y - this.y);
		return this;
	}
}
