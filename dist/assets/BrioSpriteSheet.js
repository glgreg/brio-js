import { BrioSprite } from "./BrioSprite.js";
export class BrioSpriteSheet {
    #sprite;
    #slicing;
    #grid;
    #animations = new Map();
    constructor(sprite, sliceX, sliceY) {
        this.#sprite = sprite;
        this.#slicing = { x: sliceX, y: sliceY };
        this.#grid = {
            x: sprite.size.x / this.#slicing.x,
            y: sprite.size.y / this.#slicing.y,
        };
    }
    log() {
        return this;
    }
    setAnimation(name, gridX, gridY, animationTime) {
        if (gridX > this.#grid.x || gridX < 1 || gridY > this.#grid.y || gridY < 1) {
            return;
        }
        if (!this.#animations.get(name)) {
            this.#animations.set(name, new BrioSprite({
                name: `${this.#sprite.name}_${name}`,
                src: this.#sprite.src,
                pos: this.#sprite.pos,
                size: { x: this.#sprite.size.x / this.#grid.x, y: this.#sprite.size.y },
                type: "img",
            }));
        }
    }
}
