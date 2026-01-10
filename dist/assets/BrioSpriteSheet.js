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
            x: sprite.transform.size.x / this.#slicing.x,
            y: sprite.transform.size.y / this.#slicing.y,
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
                position: this.#sprite.transform.position,
                size: {
                    x: this.#sprite.transform.size.x / this.#grid.x,
                    y: this.#sprite.transform.size.y,
                },
                type: "img",
            }));
        }
    }
}
