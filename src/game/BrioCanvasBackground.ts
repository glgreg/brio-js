import {
    CSSBackgroundBlendMode,
    CSSBackgroundPosition,
    CSSBackgroundRendering,
    CSSBackgroundRepeat,
    CSSBackgroundSize,
} from "../tools/base_types";

export interface CanvasBackground {
    color?: string;
    image?: string;
    repeat?: CSSBackgroundRepeat;
    position?: CSSBackgroundPosition;
    size?: CSSBackgroundSize;
    blendMode?: CSSBackgroundBlendMode;
    rendering?: CSSBackgroundRendering;
}

export class BrioCanvasBackground implements CanvasBackground {
    #canvas: HTMLCanvasElement;

    #color?: CanvasBackground["color"];
    #image?: CanvasBackground["image"];
    #repeat?: CanvasBackground["repeat"];
    #position?: CanvasBackground["position"];
    #size?: CanvasBackground["size"];
    #blendMode?: CanvasBackground["blendMode"];
    #rendering?: CanvasBackground["rendering"];

    constructor(canvas: HTMLCanvasElement) {
        this.#canvas = canvas;
    }

    set color(CSSColorLike: CanvasBackground["color"]) {
        this.#canvas.style.background = CSSColorLike as string;
        this.#color = CSSColorLike;
    }
    get color() {
        return this.#color;
    }

    set image(imageSrc: CanvasBackground["image"]) {
        const image = `url('${imageSrc}')`;
        const color = this.#color || null;
        const result = color ? `${image}, ${color}` : image;

        this.#canvas.style.background = result;
        this.#image = imageSrc;
    }
    get image() {
        return this.#image;
    }

    set blendMode(blendMode: CanvasBackground["blendMode"]) {
        this.#canvas.style.backgroundBlendMode = blendMode as string;
        this.#blendMode = blendMode;
    }
    get blendMode() {
        return this.#blendMode;
    }

    set position(imagePosition: NonNullable<CanvasBackground["position"]>) {
        this.#canvas.style.backgroundPosition = imagePosition as string;
        this.#position = imagePosition;
    }
    get position() {
        return this.#position!;
    }

    set repeat(imageRepeat: CanvasBackground["repeat"]) {
        this.#canvas.style.backgroundRepeat = imageRepeat as string;
        this.#repeat = imageRepeat;
    }
    get repeat() {
        return this.#repeat;
    }

    set size(imageSize: CanvasBackground["size"]) {
        this.#canvas.style.backgroundSize = imageSize as string;
        this.#size = imageSize;
    }
    get size() {
        return this.#size;
    }

    set rendering(renderingMode: CanvasBackground["rendering"]) {
        this.#canvas.style.imageRendering = renderingMode as string;
        this.#rendering = renderingMode;
    }
    get rendering() {
        return this.#rendering;
    }
}
