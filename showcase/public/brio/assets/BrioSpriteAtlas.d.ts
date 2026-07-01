import { BrioSprite } from "./BrioSprite.js";
export declare class BrioSpriteAtlas {
    #private;
    constructor(name: string, src: string, tileX: number, tileY: number);
    get name(): string;
    get tileWidth(): number | undefined;
    get tileHeight(): number | undefined;
    get tileX(): number;
    get tileY(): number;
    get sheetWidth(): number | undefined;
    get sheetHeight(): number | undefined;
    get sprite(): BrioSprite;
    get gridSize(): number;
    static mountSpriteGrid(sheet: BrioSpriteAtlas): void;
    getAnimationByName(): void;
    getSpriteFromName(name: string): void;
    setSpriteFromIndexPosition(indexPosition: number): void;
    getName(pos: number): void;
}
//# sourceMappingURL=BrioSpriteAtlas.d.ts.map
