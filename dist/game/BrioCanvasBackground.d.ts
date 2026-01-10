import { CSSBackgroundBlendMode, CSSBackgroundPosition, CSSBackgroundRendering, CSSBackgroundRepeat, CSSBackgroundSize } from "../tools/base_types.js";
export interface CanvasBackground {
    color?: string;
    image?: string;
    repeat?: CSSBackgroundRepeat;
    position?: CSSBackgroundPosition;
    size?: CSSBackgroundSize;
    blendMode?: CSSBackgroundBlendMode;
    rendering?: CSSBackgroundRendering;
}
export declare class BrioCanvasBackground implements CanvasBackground {
    #private;
    constructor(canvas: HTMLCanvasElement);
    set color(CSSColorLike: CanvasBackground["color"]);
    get color(): CanvasBackground["color"];
    set image(imageSrc: CanvasBackground["image"]);
    get image(): CanvasBackground["image"];
    set blendMode(blendMode: CanvasBackground["blendMode"]);
    get blendMode(): CanvasBackground["blendMode"];
    set position(imagePosition: NonNullable<CanvasBackground["position"]>);
    get position(): NonNullable<CanvasBackground["position"]>;
    set repeat(imageRepeat: CanvasBackground["repeat"]);
    get repeat(): CanvasBackground["repeat"];
    set size(imageSize: CanvasBackground["size"]);
    get size(): CanvasBackground["size"];
    set rendering(renderingMode: CanvasBackground["rendering"]);
    get rendering(): CanvasBackground["rendering"];
}
//# sourceMappingURL=BrioCanvasBackground.d.ts.map
