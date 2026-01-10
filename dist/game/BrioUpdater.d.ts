import { BrioGame, CanvasFPSPosition } from "./BrioGame.js";
import { BrioObject } from "../base/BrioObject.js";
export declare class BrioUpdater {
	#private;
	constructor(
		game: BrioGame,
		gameLoadedObjects: Map<string, BrioObject>,
		canvasContext: CanvasRenderingContext2D,
		gameScale: number,
		width: number,
		height: number,
		gameLastFPS: number,
	);
	useShowCollisions(): void;
	useShowBorders(): void;
	useShowCenteredAxis(): void;
	useShowFPS(
		FPSPosition: CanvasFPSPosition,
		offset: number,
		size: number,
		backgroundColor: string,
		textColor: string,
	): void;
}
//# sourceMappingURL=BrioUpdater.d.ts.map
