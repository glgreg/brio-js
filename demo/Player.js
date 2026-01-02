import { BrioGame, BrioSprite, BrioUtils } from "../dist/index.js";
import { Entity } from "./Entity.js";
import { Projectile } from "./Projectile.js";

export class Player extends Entity {
	movSpeed = 500;
	/** @type {BrioGame} */
	#game;

	/**
	 * @param {string} name
	 * @param {BrioSprite} sprite
	 * @param {BrioGame} game
	 */
	constructor(name, sprite, game) {
		super(name, sprite, 5);
		this.#game = game;
		this.pos.x = game.width / 2 - this.size.x / 2;
		this.pos.y = game.height - (this.size.y + 16);
	}

	/** @param {number} speed */
	moveLeft(speed) {
		this.flip.x = false;
		this.pos.x -= speed;
	}

	/** @param {number} speed */
	moveRight(speed) {
		this.flip.x = true;
		this.pos.x += speed;
	}

	/**
	 *
	 * @param {Projectile} object
	 * @param {number} speed
	 */
	shoot(object, speed) {
		const projectile = this.#game.instantiate(object);
		projectile.pos.x = this.pos.x + this.size.x / 2 - projectile.size.x / 2;
		projectile.pos.y = this.pos.y;

		object.audio.play();

		BrioUtils.timedAnimation(() => {
			projectile.pos.y -= speed;
			this.#game.outbound(projectile, 1, () => {
				if (projectile) this.#game.destroy(projectile);
			});
		}, 5_000);
	}
}
