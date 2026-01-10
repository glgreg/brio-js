import { BrioSprite } from "../assets/BrioSprite.js";
import { Vector2 } from "../BrioVector2.js";
export interface MapProps {
	name: string;
	pos: Vector2<number>;
	size: Vector2<number>;
	sprite: BrioSprite;
}
export declare class BrioMap {
	#private;
	name: string;
	size: Vector2<number>;
	pos: Vector2<number>;
	sprite: BrioSprite;
	constructor(mapProps: MapProps);
	static getEmptyInstance(): BrioMap;
}
//# sourceMappingURL=BrioMap.d.ts.map
