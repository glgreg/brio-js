import { BrioSprite } from "./BrioSprite.js";
export class BrioSpriteSheet {
    #tilesX;
    #tilesY;
    #width;
    #height;
    #sprite;
    #sheetMap;
    constructor(name, src, tilesX, tilesY, sheetW, sheetH) {
        this.#sprite = new BrioSprite(name, src);
        this.#tilesX = tilesX;
        this.#tilesY = tilesY;
        this.#width = sheetW;
        this.#height = sheetH;
    }
    get sprite() {
        return this.#sprite;
    }
    static createSpriteMatrix(sheet) {
        const sheetMap = new Map();
    }
    getSpriteFromName(name) { }
    getSpriteFromPosition(position) { }
    getName(pos) { }
}
