import { BrioSprite } from "./assets/BrioSprite.js";
import { Vector2 } from "./BrioVector2.js";
export interface MapProps {
    name: string;
    pos: Vector2;
    size: Vector2;
    sprite: BrioSprite;
}
export declare class BrioMap {
    #private;
    name: string;
    size: Vector2;
    pos: Vector2;
    sprite: BrioSprite;
    constructor(mapProps: MapProps);
    static getEmptyInstance(): BrioMap;
}
//# sourceMappingURL=BrioMap.d.ts.map
