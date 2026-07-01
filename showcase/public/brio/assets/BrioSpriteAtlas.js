import { BrioSprite } from "./BrioSprite.js";
export class BrioSpriteAtlas {
    #name;
    #tileWidth;
    #tileHeight;
    #gridTileCellsX;
    #gridTileCellsY;
    #sheetWidth;
    #sheetHeight;
    #sprite;
    #gridSize;
    #currentSprite;
    constructor(name, src, tileX, tileY) {
        this.#sprite = new BrioSprite(name, src);
        this.#name = name;
        this.#gridTileCellsX = tileX;
        this.#gridTileCellsY = tileY;
        this.#gridSize = Math.floor(tileX * tileY);
    }
    get name() {
        return this.#name;
    }
    get tileWidth() {
        return this.#tileWidth;
    }
    get tileHeight() {
        return this.#tileHeight;
    }
    get tileX() {
        return this.#gridTileCellsX;
    }
    get tileY() {
        return this.#gridTileCellsY;
    }
    get sheetWidth() {
        if (this.#sheetWidth)
            return this.#sheetWidth;
    }
    get sheetHeight() {
        if (this.#sheetHeight)
            return this.#sheetHeight;
    }
    get sprite() {
        return this.#sprite;
    }
    get gridSize() {
        return this.#gridSize;
    }
    static mountSpriteGrid(sheet) {
        if (!sheet.sprite.element.width ||
            !sheet.sprite.element.height ||
            !sheet.#gridTileCellsX ||
            !sheet.#gridTileCellsY) {
            return;
        }
        sheet.#sheetWidth = sheet.sprite.element.width;
        sheet.#sheetHeight = sheet.sprite.element.height;
        sheet.#tileWidth = Math.floor(sheet.#sheetWidth / sheet.#gridTileCellsX);
        sheet.#tileHeight = Math.floor(sheet.#sheetHeight / sheet.#gridTileCellsY);
        if (!sheet.#currentSprite) {
            sheet.#currentSprite = {
                position: { x: 0, y: 0 },
                size: { x: sheet.#tileWidth, y: sheet.#tileHeight },
            };
        }
    }
    getAnimationByName() { }
    getSpriteFromName(name) { }
    get #isSpriteMounted() {
        if (!this.#currentSprite ||
            !this.#currentSprite.position ||
            !this.#currentSprite.size ||
            !this.#sheetWidth ||
            !this.#sheetHeight ||
            !this.#tileWidth ||
            !this.#tileHeight) {
            return false;
        }
        this.#currentSprite;
        return true;
    }
    setSpriteFromIndexPosition(indexPosition) {
        BrioSpriteAtlas.mountSpriteGrid(this);
        if (indexPosition > this.#gridSize) {
            throw new Error(`Index ${indexPosition} out of range ${this.#gridSize}`);
        }
        if (!this.#currentSprite ||
            !this.#currentSprite.position ||
            !this.#currentSprite.size ||
            !this.#sheetWidth ||
            !this.#sheetHeight ||
            !this.#tileWidth ||
            !this.#tileHeight) {
            throw new Error("CurrentSprite was not mounted");
        }
        const tilePx = this.#sheetWidth - this.#gridTileCellsX * this.#tileWidth;
        const tilePy = 0;
        const tileSx = 0;
        const tileSy = 0;
        this.#currentSprite.position.x = tilePx;
        this.#currentSprite.position.y = tilePy;
        this.#currentSprite.size.x = tileSx;
        this.#currentSprite.size.x = tileSy;
        console.log("BrioAtlas test:\n");
        console.log(tilePx, tilePy, tileSx, tileSy);
    }
    getName(pos) { }
}
