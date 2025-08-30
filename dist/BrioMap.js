import { BrioSprite } from "./asset/BrioSprite.js";
export class BrioMap {
    name;
    size;
    pos;
    sprite;
    static #emptyInstance;
    constructor(mapProps) {
        this.pos = mapProps.pos;
        this.size = mapProps.size;
        this.name = mapProps.name;
        this.sprite = mapProps.sprite;
    }
    static getEmptyInstance() {
        if (this.#emptyInstance === undefined) {
            const instance = new BrioMap({
                name: "",
                sprite: BrioSprite.getEmptyInstance(),
                pos: { x: 0, y: 0 },
                size: { x: 100, y: 100 },
            });
            this.#emptyInstance = instance;
            return this.#emptyInstance;
        }
        else {
            return this.#emptyInstance;
        }
    }
}
