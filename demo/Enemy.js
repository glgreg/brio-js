import { BrioObject, BrioSprite, BrioUtils } from "../dist/index.js";
import { Entity } from "./Entity.js";

/** @typedef {import("../dist/BrioVector2").Vector2} Vec2 */

export class Enemy extends Entity {
	/**
	 * @param {string} name
	 * @param {BrioSprite} sprite
	 * @param {number} health
	 */
	constructor(name, sprite, health) {
		super(name, sprite, health);
	}

	/** @param {Vec2} position */
	moveTo(position) {
		BrioUtils.timedAnimation(() => {
			this.pos.x += position.x;
			this.pos.y += position.y;
		}, 10_000);
	}
}
