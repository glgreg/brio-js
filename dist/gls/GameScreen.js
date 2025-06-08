import { Sprite } from "./Sprite.js";
export class Game {
    /** @type {HTMLCanvasElement} Canvas element that serves as the game sandbox */
    #canvas;
    /** @type {CanvasRenderingContext2D} Context of the Canvas element */
    #context = null;
    /** @type {CanvasRenderingContext2DSettings} Settings of the Context from the Canvas element */
    #contextSettings;
    /** @type {number} Width of the Canvas element */
    #width;
    /** @type {number} Height of the Canvas element */
    #height;
    #loadedSprites = [];
    /**
     * @param {number} width
     * @param {number} height
     * @param {HTMLElement} appendTo
     * @param {CanvasRenderingContext2DSettings} [canvasContextSettings={}]
     */
    constructor(width, height, appendTo, canvasContextSettings = {}) {
        this.#width = width;
        this.#height = height;
        this.#contextSettings = canvasContextSettings;
        this.#canvas = document.createElement("canvas");
        this.#context = this.#canvas.getContext("2d", this.#contextSettings);
        this.#canvas.width = this.#width;
        this.#canvas.height = this.#height;
        this.#canvas.style.background = "#DDD";
        appendTo.appendChild(this.#canvas);
    }
    createScene() { }
    /** @param {() => Array<any> | any} callbackFn */
    preload(callbackFn) {
        const assets = callbackFn();
        if (assets.length === 0) {
            throw new Error("Zero assets returned. You must return at least one asset.");
        }
        const sprites = assets.filter((asset) => asset instanceof Sprite);
        sprites.forEach((sprite) => {
            console.log(sprite);
        });
    }
    get loadedSprites() {
        return this.#loadedSprites;
    }
    useFullScreen() {
        window.addEventListener("resize", () => {
            this.#canvas.width = window.innerWidth;
            this.#canvas.height = window.innerHeight;
        });
    }
}
