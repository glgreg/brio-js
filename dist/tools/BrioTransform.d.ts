import { Vector2 } from "../BrioVector2.js";
interface Transform {
    get position(): Vector2<number>;
    get rotation(): number;
    get scale(): Vector2<number>;
    get pivot(): Vector2<number>;
    get size(): Vector2<number>;
    get skew(): Vector2<number>;
    get flip(): Vector2<boolean>;
}
export default class BrioTransform implements Transform {
    #private;
    constructor(position: Vector2<number>, size: Vector2<number>);
    get position(): {
        x: number;
        y: number;
    };
    get size(): {
        x: number;
        y: number;
    };
    set rotation(degree: number);
    get rotation(): number;
    get scale(): {
        x: number;
        y: number;
    };
    get flip(): {
        x: boolean;
        y: boolean;
    };
    get skew(): {
        x: number;
        y: number;
    };
    get pivot(): {
        x: number;
        y: number;
    };
}
export {};
//# sourceMappingURL=BrioTransform.d.ts.map
