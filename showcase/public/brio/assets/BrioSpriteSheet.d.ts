import { BrioSprite } from "./BrioSprite.js";
export declare class BrioSpriteSheet {
    #private;
    constructor(name: string, src: string, tilesX: number, tilesY: number, sheetW?: number, sheetH?: number);
    get sprite(): BrioSprite;
    static createSpriteMatrix(sheet: BrioSpriteSheet): void;
    getSpriteFromName(name: string): void;
    getSpriteFromPosition(position: [
        number,
        number
    ]): void;
    getName(pos: number): void;
}
//# sourceMappingURL=BrioSpriteSheet.d.ts.map
