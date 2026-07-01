import { BrioMap } from "./BrioMap.js";
import { Vec2 } from "../math/index.js";
export declare class BrioCamera {
    #private;
    constructor(id: string, pos: Vec2, size: Vec2, map: BrioMap);
    get name(): string;
    get map(): BrioMap;
    get pos(): Vec2;
    get size(): Vec2;
}
//# sourceMappingURL=BrioCamera.d.ts.map
