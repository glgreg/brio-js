import { BrioSprite } from "./BrioSprite.js";
export class BrioSpriteRegistry {
    #sprites = new Map();
    set(sprite) {
        this.#sprites.set(sprite.name, sprite);
    }
    get(key) {
        const sprite = this.#sprites.get(key);
        if (sprite)
            return sprite;
        return BrioSprite.getEmptyInstance();
    }
    has(key) {
        return this.#sprites.has(key);
    }
    delete(key) {
        return this.#sprites.delete(key);
    }
}
