import { Vec2 } from "../math/index";
import { BrioSprite, SpriteProperties } from "./BrioSprite";

interface SpriteSheetProps extends SpriteProperties {
    slicing: Vec2;
}
interface KeyframeAnimation {
    name: string;
    grid: Vec2;
}

export class BrioSpriteSheet {
    #sprite: BrioSprite;
    #slicing: Vec2;
    #grid: Vec2;
    #animations: Map<string, BrioSprite> = new Map();

    constructor(sprite: BrioSprite, sliceX: number, sliceY: number) {
        this.#sprite = sprite;
        this.#slicing = { x: sliceX, y: sliceY };
        this.#grid = {
            x: sprite.transform.size.x / this.#slicing.x,
            y: sprite.transform.size.y / this.#slicing.y,
        };
    }

    public log() {
        return this;
    }

    public setAnimation(name: string, gridX: number, gridY: number, animationTime: number) {
        if (gridX > this.#grid.x || gridX < 1 || gridY > this.#grid.y || gridY < 1) {
            return;
        }

        if (!this.#animations.get(name)) {
            this.#animations.set(
                name,
                new BrioSprite({
                    name: `${this.#sprite.name}_${name}`,
                    src: this.#sprite.src,
                    position: this.#sprite.transform.position,
                    size: {
                        x: this.#sprite.transform.size.x / this.#grid.x,
                        y: this.#sprite.transform.size.y,
                    },
                    type: "img",
                }),
            );
        }
    }
}
