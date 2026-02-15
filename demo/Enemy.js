import { BrioSprite, BrioUtils } from "../dist/index.js";
import { Entity } from "./Entity.js";

/** @typedef {import("../src/math/index.ts").Vec2} Vec2 */

export class Enemy extends Entity {
    /**
     * @param {string} name
     * @param {string} sprite
     * @param {number} health
     */
    constructor(name, sprite, health) {
        super(name, sprite, health);
    }

    /** @param {Vec2} position */
    moveTo(position) {
        BrioUtils.timedAnimation(() => {
            this.transform.position.x += position.x;
            this.transform.position.y += position.y;
        }, 10_000);
    }
}
