import { BrioMap } from "../BrioMap.js";
import { Vector2 } from "../BrioVector2.js";
export declare class BrioCamera {
	#private;
	constructor(id: string, pos: Vector2<number>, size: Vector2<number>, map: BrioMap);
	get name(): string;
	get map(): BrioMap;
	get pos(): Vector2<number>;
	get size(): Vector2<number>;
}
//# sourceMappingURL=BrioCamera.d.ts.map
