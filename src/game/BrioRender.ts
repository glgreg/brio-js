import { BrioSprite } from "../assets/BrioSprite";
import { BrioGame } from "./BrioGame";
import { BrioObject } from "../objects/BrioObject";
import { Vec2 } from "../math/index";

export type CanvasFPSPosition =
    | "left-top"
    | "left-center"
    | "left-bottom"
    | "center-top"
    | "center-center"
    | "center-bottom"
    | "right-top"
    | "right-center"
    | "right-bottom";

export class BrioRender {
    #game: BrioGame;
    #ctx: CanvasRenderingContext2D;
    #gameLoadedObjects: Map<string, BrioObject>;
    #gameScale: number;
    #gameWidth: number;
    #gameHeight: number;
    gameLastFPS: number;

    constructor(
        game: BrioGame,
        gameLoadedObjects: Map<string, BrioObject>,
        canvasContext: CanvasRenderingContext2D,
        gameScale: number,
        width: number,
        height: number,
        gameLastFPS: number,
    ) {
        this.#game = game;
        this.#gameLoadedObjects = gameLoadedObjects;
        this.#ctx = canvasContext;
        this.#gameScale = gameScale;
        this.#gameWidth = width;
        this.#gameHeight = height;
        this.gameLastFPS = gameLastFPS;
    }

    /** A function that draws an object into the canvas element while considering scale and rendering type */
    public renderObject<T extends BrioObject>(object: T) {
        if (!object || !object.transform.visibility || object.transform.opacity === 0) return;

        if (this.#game.rendering.mode === "smooth") {
            this.#ctx.imageSmoothingEnabled = true;
            this.#ctx.imageSmoothingQuality = this.#game.rendering.smoothness;
        } else if (this.#game.rendering.mode === "pixelated") {
            this.#ctx.imageSmoothingEnabled = false;
        }

        this.#ctx.save();

        // scale or flipped scale for sprites
        const scaleX = (object.transform.flip.x ? -1 : 1) * this.#gameScale;
        const scaleY = (object.transform.flip.y ? -1 : 1) * this.#gameScale;
        // offset for flipped sprites
        const offsetX = object.transform.flip.x ? object.transform.size.x * this.#gameScale : 0;
        const offsetY = object.transform.flip.y ? object.transform.size.y * this.#gameScale : 0;

        this.#ctx.translate(
            object.transform.position.x * this.#gameScale + offsetX,
            object.transform.position.y * this.#gameScale + offsetY,
        );

        this.#ctx.scale(scaleX, scaleY);

        let translated = false;

        if (object.transform.rotation !== 0) {
            // this.#ctx.translate(object.transform.size.x / 2, object.transform.size.y / 2);
            this.#ctx.translate(
                object.transform.size.x * object.transform.pivot.x,
                object.transform.size.y * object.transform.pivot.y,
            );
            this.#ctx.rotate(object.transform.rotation);
            translated = true;
        }

        if (object.transform.skew.x !== 0 || object.transform.skew.y !== 0) {
            if (!translated) {
                this.#ctx.translate(object.transform.size.x / 2, object.transform.size.y / 2);
            }
            this.#ctx.transform(
                1, // scaleX
                (object.transform.skew.x * Math.PI) / 180, // rotateX
                (object.transform.skew.y * Math.PI) / 180, // rotateY
                1, // scaleY
                0, // translateX
                0, // translateY
            );
            translated = true;
        }

        // sprite opacity
        this.#ctx.globalAlpha = object.transform.opacity;

        this.#ctx.drawImage(
            object.sprite.element,
            translated ? -object.transform.size.x * object.transform.pivot.x : 0,
            translated ? -object.transform.size.y * object.transform.pivot.y : 0,
            object.transform.size.x,
            object.transform.size.y,
        );

        this.#ctx.restore();
    }

    public clearObject<T extends BrioSprite | BrioObject>(gameObject: T) {
        if (!this.#ctx || !gameObject) {
            return;
        }

        this.#ctx.save();

        this.#ctx.scale(this.#gameScale, this.#gameScale);
        this.#ctx.clearRect(
            gameObject.transform.position.x,
            gameObject.transform.position.y,
            gameObject.transform.size.x,
            gameObject.transform.size.y,
        );

        this.#ctx.restore();
    }

    public renderCollisions() {
        this.#gameLoadedObjects.forEach((gameObject, key) => {
            if (this.#ctx && gameObject.collision && gameObject.collision.colliderType) {
                this.#ctx.save();
                this.#ctx.scale(this.#gameScale, this.#gameScale);
                this.#ctx.beginPath();

                switch (gameObject.collision.shape) {
                    case "square":
                    case "rectangle":
                        this.#ctx.rect(
                            gameObject.transform.position.x + gameObject.collision.pos.x,
                            gameObject.transform.position.y + gameObject.collision.pos.y,
                            gameObject.collision.size.x,
                            gameObject.collision.size.y,
                        );
                        break;
                    case "circle":
                        this.#ctx.arc(
                            gameObject.transform.position.x +
                                (gameObject.collision.pos.x + gameObject.collision.size.x / 2),
                            gameObject.transform.position.y +
                                (gameObject.collision.pos.y + gameObject.collision.size.y / 2),
                            gameObject.collision.size.x / 2,
                            0,
                            2 * Math.PI,
                        );
                        break;
                }

                this.#ctx.lineWidth = 2 / this.#gameScale;
                this.#ctx.strokeStyle = "#F00";
                this.#ctx.stroke();
                this.#ctx.closePath();

                this.#ctx.restore();
            }
        });
    }

    public renderBounds() {
        this.#gameLoadedObjects.forEach((gameObject, key) => {
            if (this.#ctx) {
                this.#ctx.save();

                this.#ctx.scale(this.#gameScale, this.#gameScale);
                this.#ctx.beginPath();
                this.#ctx.rect(
                    gameObject.transform.position.x,
                    gameObject.transform.position.y,
                    gameObject.transform.size.x,
                    gameObject.transform.size.y,
                );
                this.#ctx.lineWidth = 2 / this.#gameScale;
                this.#ctx.strokeStyle = "#0F0";
                this.#ctx.stroke();
                this.#ctx.closePath();

                this.#ctx.restore();
            }
        });
    }

    public renderGrid(gridX: number, gridY: number): void {
        const maxWidth = this.#gameWidth;
        const maxHeight = this.#gameHeight;

        const cellWidth = gridX;
        const cellHeight = gridY;

        const maxAxis = Math.max(maxWidth, maxHeight);
        const maxRowsOrCols = maxAxis / Math.min(cellWidth, cellHeight);

        for (let i = 1; i <= maxRowsOrCols; i++) {
            const currentHeight = cellHeight * i;
            const currentWidth = cellWidth * i;

            // Draws the X axis grid
            this.#ctx.beginPath();
            this.#ctx.moveTo(0, currentHeight);
            this.#ctx.lineTo(maxWidth, currentHeight);
            this.#ctx.lineWidth = 1;
            this.#ctx.strokeStyle = "#DDD";
            this.#ctx.stroke();
            this.#ctx.closePath();

            // Draws the Y axis grid
            this.#ctx.beginPath();
            this.#ctx.moveTo(currentWidth, 0);
            this.#ctx.lineTo(currentWidth, maxHeight);
            this.#ctx.lineWidth = 1;
            this.#ctx.strokeStyle = "#DDD";
            this.#ctx.stroke();
            this.#ctx.closePath();
        }
    }

    public renderAxisRulers() {
        const midWidth = this.#gameWidth / 2;
        const midHeight = this.#gameHeight / 2;

        // Draws the mid X line
        this.#ctx.beginPath();
        this.#ctx.lineWidth = 2;
        this.#ctx.lineWidth;
        this.#ctx.moveTo(0, midHeight);
        this.#ctx.lineTo(this.#gameWidth, midHeight);
        this.#ctx.strokeStyle = "#DDD";
        this.#ctx.stroke();
        this.#ctx.closePath();

        // Draws the mid Y line
        this.#ctx.beginPath();
        this.#ctx.lineWidth = 3;
        this.#ctx.moveTo(midWidth, 0);
        this.#ctx.lineTo(midWidth, this.#gameHeight);
        this.#ctx.strokeStyle = "#DDD";
        this.#ctx.stroke();
        this.#ctx.closePath();
    }

    public renderFPSOverlay(
        position: CanvasFPSPosition,
        offset: number,
        size: number,
        backgroundColor: string,
        textColor: string,
    ) {
        if (!this.#ctx) return;

        let pos: Vec2 = { x: 0, y: 0 };
        const off = offset;

        const containerHeight = size * 1.5;
        const containerWidth = containerHeight * 2.25;

        const centerX = this.#gameWidth / 2 - containerHeight;
        const centerY = this.#gameHeight / 2 - containerHeight;
        const bottomY = this.#gameHeight - (containerHeight + off);
        const rightX = this.#gameWidth - (containerWidth + off);

        // prettier-ignore
        switch (position) {
			case "left-top": pos = { x: off, y: off }; break;
			case "left-center": pos = { x: off, y: centerY }; break;
			case "left-bottom": pos = { x: off, y: bottomY }; break;
			
			case "center-top": pos = { x: centerX, y: off }; break;
			case "center-center": pos = { x: centerX, y: centerY }; break;
			case "center-bottom": pos = { x: centerX, y: bottomY }; break;
		
			case "right-top": pos = { x: rightX, y: off }; break;
			case "right-center": pos = { x: rightX, y: centerY }; break;
			case "right-bottom": pos = { x: rightX, y: bottomY }; break;
		}

        // draws the background
        this.#ctx.fillStyle = backgroundColor;
        this.#ctx.fillRect(pos.x, pos.y, containerWidth, containerHeight);

        // draws the text
        this.#ctx.textRendering = "optimizeLegibility";
        this.#ctx.font = `${size}px monospace`;
        this.#ctx.fillStyle = textColor;
        this.#ctx.fillText(this.gameLastFPS.toFixed(1), pos.x + size / 2, pos.y + size * 1.1);
    }
}
