import { BrioMap } from "./BrioMap.js";
import { Vector2 } from "./BrioVector2.js";
export declare class BrioCamera {
    #private;
    constructor(id: string, pos: Vector2, size: Vector2, map: BrioMap);
    get name(): string;
    get map(): BrioMap;
    get pos(): Vector2;
    get size(): Vector2;
}
//# sourceMappingURL=BrioCamera.d.ts.map
