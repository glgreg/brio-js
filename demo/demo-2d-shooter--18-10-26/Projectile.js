import { BrioAudio, BrioObject2D, BrioSprite } from "../../dist/index.js";

export class Projectile extends BrioObject2D {
    audio;

    /**
     *
     * @param {string} name
     * @param {string} sprite
     * @param {BrioAudio} audio
     */
    constructor(name, sprite, audio) {
        super(name, sprite, 1);
        this.audio = audio;
    }
}
