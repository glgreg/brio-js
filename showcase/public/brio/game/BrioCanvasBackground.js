export class BrioCanvasBackground {
    #canvas;
    #color;
    #image;
    #repeat;
    #position;
    #size;
    #blendMode;
    #rendering;
    constructor(canvas) {
        this.#canvas = canvas;
    }
    set color(CSSColorLike) {
        this.#canvas.style.background = CSSColorLike;
        this.#color = CSSColorLike;
    }
    get color() {
        return this.#color;
    }
    set image(imageSrc) {
        const image = `url('${imageSrc}')`;
        const color = this.#color || null;
        const result = color ? `${image}, ${color}` : image;
        this.#canvas.style.background = result;
        this.#image = imageSrc;
    }
    get image() {
        return this.#image;
    }
    set blendMode(blendMode) {
        this.#canvas.style.backgroundBlendMode = blendMode;
        this.#blendMode = blendMode;
    }
    get blendMode() {
        return this.#blendMode;
    }
    set position(imagePosition) {
        this.#canvas.style.backgroundPosition = imagePosition;
        this.#position = imagePosition;
    }
    get position() {
        return this.#position;
    }
    set repeat(imageRepeat) {
        this.#canvas.style.backgroundRepeat = imageRepeat;
        this.#repeat = imageRepeat;
    }
    get repeat() {
        return this.#repeat;
    }
    set size(imageSize) {
        this.#canvas.style.backgroundSize = imageSize;
        this.#size = imageSize;
    }
    get size() {
        return this.#size;
    }
    set rendering(renderingMode) {
        this.#canvas.style.imageRendering = renderingMode;
        this.#rendering = renderingMode;
    }
    get rendering() {
        return this.#rendering;
    }
}
