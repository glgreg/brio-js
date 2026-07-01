import { BrioGame } from "./BrioGame.js";
import { BrioObject } from "../objects/BrioObject.js";
import { BrioAssetManager } from "./BrioAssetManager.js";
export type CanvasFPSPosition = "left-top" | "left-center" | "left-bottom" | "center-top" | "center-center" | "center-bottom" | "right-top" | "right-center" | "right-bottom";
export declare class BrioSpriteRender {
    #private;
    gameLastFPS: number;
    constructor(game: BrioGame, assets: BrioAssetManager, canvasContext: CanvasRenderingContext2D, gameScale: number, width: number, height: number, gameLastFPS: number);
    /** A function that draws an object into the canvas element while considering scale and rendering type */
    renderObject<T extends BrioObject>(object: T): void;
    clearObject<T extends BrioObject>(gameObject: T): void;
    renderCollisions(): void;
    renderBounds(): void;
    renderGrid(gridX: number, gridY: number): void;
    renderAxisRulers(): void;
    renderFPSOverlay(position: CanvasFPSPosition, offset: number, size: number, backgroundColor: string, textColor: string): void;
}
//# sourceMappingURL=BrioSpriteRender.d.ts.map
