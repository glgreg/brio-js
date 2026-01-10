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
        this.transform.position.x = game.width / 2 - this.transform.size.x / 2;
        this.transform.position.y = game.height - (this.transform.size.y + 16);
    }

    /** @param {number} speed */
    moveLeft(speed) {
        this.transform.flip.x = false;
        this.transform.position.x -= speed;
    }

    /** @param {number} speed */
    moveRight(speed) {
        this.transform.flip.x = true;
        this.transform.position.x += speed;
    }

    /**
     *
     * @param {Projectile} object
     * @param {number} speed
     */
    shoot(object, speed) {
        const projectile = this.#game.instantiate(object);
        projectile.transform.position.x =
            this.transform.position.x + this.transform.size.x / 2 - projectile.transform.size.x / 2;
        projectile.transform.position.y = this.transform.position.y;

        object.audio.play();

        BrioUtils.timedAnimation(() => {
            projectile.transform.position.y -= speed;
            this.#game.outbound(projectile, 1, () => {
                if (projectile) this.#game.destroy(projectile);
            });
        }, 5_000);
    }
}
