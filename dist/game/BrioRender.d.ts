import { BrioSprite } from "../assets/BrioSprite.js";
import { BrioGame } from "./BrioGame.js";
import { BrioObject } from "../objects/BrioObject.js";
export type CanvasFPSPosition = "left-top" | "left-center" | "left-bottom" | "center-top" | "center-center" | "center-bottom" | "right-top" | "right-center" | "right-bottom";
export declare class BrioRender {
    #private;
    gameLastFPS: number;
    constructor(game: BrioGame, gameLoadedObjects: Map<string, BrioObject>, canvasContext: CanvasRenderingContext2D, gameScale: number, width: number, height: number, gameLastFPS: number);
    /** A function that draws an object into the canvas element while considering scale and rendering type */
    renderObject<T extends BrioObject>(object: T): void;
    clearObject<T extends BrioSprite | BrioObject>(gameObject: T): void;
    renderCollisions(): void;
    renderBounds(): void;
    renderGrid(gridX: number, gridY: number): void;
    renderAxisRulers(): void;
    renderFPSOverlay(position: CanvasFPSPosition, offset: number, size: number, backgroundColor: string, textColor: string): void;
}
//# sourceMappingURL=BrioRender.d.ts.map
