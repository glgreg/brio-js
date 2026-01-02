import { BrioObject, BrioSprite } from "./../dist/index.js";

export class Entity extends BrioObject {
	/** @type {number} */
	#health;

	/**
	 * @param {string} name
	 * @param {BrioSprite} sprite
	 * @param {number} health
	 */
	constructor(name, sprite, health) {
		super(name, sprite, 1);
		this.#health = health;
	}
}
