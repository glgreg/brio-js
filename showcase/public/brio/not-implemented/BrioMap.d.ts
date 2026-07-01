import { BrioSprite } from "../assets/BrioSprite.js";
import { Vec2 } from "../math/index.js";
export interface MapProps {
    name: string;
    pos: Vec2;
    size: Vec2;
    sprite: BrioSprite;
}
export declare class BrioMap {
    #private;
    name: string;
    size: Vec2;
    pos: Vec2;
    sprite: BrioSprite;
    constructor(mapProps: MapProps);
    static getEmptyInstance(): BrioMap;
}
//# sourceMappingURL=BrioMap.d.ts.map
