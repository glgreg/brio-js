import { BrioAudio, BrioObject, BrioSprite } from "../dist/index.js";

export class Projectile extends BrioObject {
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
