import { BrioSprite } from "../assets/BrioSprite";
import { BrioGame } from "./BrioGame";
import { BrioObject } from "../objects/BrioObject";
import { Vec2 } from "../math/index";
import { BrioAssetManager } from "./BrioAssetManager";

/**
 * Screen anchor positions for the debug FPS counter overlay.
 *
 * @example
 * ```ts
 * game.debugging.render.fpsOverlay.position = "right-top";
 * ```
 */
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

/**
 * 2D Canvas renderer responsible for drawing `BrioObject` sprites, transforms, and visual debug overlays
 * (`grid`, `axisRulers`, `renderBounds`, `collisionBounds`, and `fpsOverlay`).
 */
export class BrioSpriteRenderer {
    #game: BrioGame;
    #ctx: CanvasRenderingContext2D;
    #assets: BrioAssetManager;
    #appliedMode?: "smooth" | "pixelated";
    #appliedSmoothness?: ImageSmoothingQuality;
    /** Most recent measured frames-per-second value displayed by `renderFPSOverlay`. */
    public gameLastFPS: number;

    /**
     * Creates a new `BrioSpriteRenderer` instance.
     *
     * @param game Owning `BrioGame` instance
     * @param assets Central `BrioAssetManager` registry
     * @param canvasContext 2D rendering context of the game canvas
     * @param gameScale Initial global scale factor
     * @param width Initial canvas width in pixels
     * @param height Initial canvas height in pixels
     * @param gameLastFPS Initial FPS counter value
     */
    constructor(
        game: BrioGame,
        assets: BrioAssetManager,
        canvasContext: CanvasRenderingContext2D,
        gameScale: number,
        width: number,
        height: number,
        gameLastFPS: number,
    ) {
        this.#game = game;
        this.#assets = assets;
        this.#ctx = canvasContext;
        void gameScale;
        void width;
        void height;
        this.gameLastFPS = gameLastFPS;
    }

    /**
     * Synchronizes `imageSmoothingEnabled` and `imageSmoothingQuality` on the 2D canvas context
     * only when `game.rendering.mode` or `game.rendering.smoothness` has changed.
     */
    public syncSmoothingState(): void {
        if (!this.#ctx) return;

        const mode = this.#game.rendering.mode;
        const smoothness = this.#game.rendering.smoothness;

        if (this.#appliedMode === mode && this.#appliedSmoothness === smoothness) {
            return;
        }

        if (mode === "smooth") {
            this.#ctx.imageSmoothingEnabled = true;
            this.#ctx.imageSmoothingQuality = smoothness;
        } else if (mode === "pixelated") {
            this.#ctx.imageSmoothingEnabled = false;
        }

        this.#appliedMode = mode;
        this.#appliedSmoothness = smoothness;
    }

    /**
     * Clears the entire 2D canvas viewport in a single operation.
     * Prevents ghosting artifacts left behind by rotated, skewed, or destroyed objects.
     */
    public clearScreen(): void {
        if (!this.#ctx) return;
        this.#ctx.clearRect(0, 0, this.#game.width, this.#game.height);
    }

    /**
     * Draws a single `BrioObject` onto the canvas, applying `game.scale`, `transform.position`,
     * `transform.renderSize`, `transform.flip`, `transform.rotation`, `transform.skew`, `transform.pivot`, and `transform.opacity`.
     * When `game.rendering.mode === "pixelated"`, translation coordinates are rounded to integer pixels to prevent Chromium sub-pixel shimmering.
     *
     * @param object The `BrioObject` instance to render
     */
    public renderObject<T extends BrioObject>(object: T): void {
        if (!this.#ctx || !object || !object.transform.visibility || object.transform.opacity === 0) {
            return;
        }

        this.syncSmoothingState();

        const gameScale = this.#game.scale;
        const renderWidth = object.transform.renderSize.x || object.transform.size.x;
        const renderHeight = object.transform.renderSize.y || object.transform.size.y;
        const isPixelated = this.#game.rendering.mode === "pixelated";

        this.#ctx.save();

        // Scale or flipped scale for sprites
        const scaleX = (object.transform.flip.x ? -1 : 1) * gameScale;
        const scaleY = (object.transform.flip.y ? -1 : 1) * gameScale;
        // Offset for flipped sprites
        const offsetX = object.transform.flip.x ? renderWidth * gameScale : 0;
        const offsetY = object.transform.flip.y ? renderHeight * gameScale : 0;

        const rawTx = object.transform.position.x * gameScale + offsetX;
        const rawTy = object.transform.position.y * gameScale + offsetY;

        this.#ctx.translate(
            isPixelated ? Math.round(rawTx) : rawTx,
            isPixelated ? Math.round(rawTy) : rawTy,
        );

        this.#ctx.scale(scaleX, scaleY);

        let translated = false;

        if (object.transform.rotation !== 0) {
            this.#ctx.translate(
                renderWidth * object.transform.pivot.x,
                renderHeight * object.transform.pivot.y,
            );
            this.#ctx.rotate(object.transform.rotation);
            translated = true;
        }

        if (object.transform.skew.x !== 0 || object.transform.skew.y !== 0) {
            if (!translated) {
                this.#ctx.translate(
                    renderWidth * object.transform.pivot.x,
                    renderHeight * object.transform.pivot.y,
                );
            }
            this.#ctx.transform(
                1,
                Math.tan(object.transform.skew.x),
                Math.tan(object.transform.skew.y),
                1,
                0,
                0,
            );
            translated = true;
        }

        // Sprite opacity
        this.#ctx.globalAlpha = object.transform.opacity;
        const sprite = this.#assets.sprites.get(object.sprite) ?? BrioSprite.getEmptyInstance();

        // Sprite rendering
        this.#ctx.drawImage(
            sprite.element,
            translated ? -renderWidth * object.transform.pivot.x : 0,
            translated ? -renderHeight * object.transform.pivot.y : 0,
            renderWidth,
            renderHeight,
        );

        this.#ctx.restore();
    }

    /**
     * Clears the canvas region occupied by a specific `BrioObject`, accounting for its scale, rotation, and skew.
     *
     * @param gameObject The `BrioObject` whose rendered area should be cleared
     */
    public clearObject<T extends BrioObject>(gameObject: T): void {
        if (!this.#ctx || !gameObject) {
            return;
        }

        const gameScale = this.#game.scale;
        const renderWidth = gameObject.transform.renderSize.x || gameObject.transform.size.x;
        const renderHeight = gameObject.transform.renderSize.y || gameObject.transform.size.y;

        this.#ctx.save();

        if (
            gameObject.transform.rotation !== 0 ||
            gameObject.transform.skew.x !== 0 ||
            gameObject.transform.skew.y !== 0
        ) {
            const scaleX = (gameObject.transform.flip.x ? -1 : 1) * gameScale;
            const scaleY = (gameObject.transform.flip.y ? -1 : 1) * gameScale;
            const offsetX = gameObject.transform.flip.x ? renderWidth * gameScale : 0;
            const offsetY = gameObject.transform.flip.y ? renderHeight * gameScale : 0;

            this.#ctx.translate(
                gameObject.transform.position.x * gameScale + offsetX,
                gameObject.transform.position.y * gameScale + offsetY,
            );
            this.#ctx.scale(scaleX, scaleY);
            this.#ctx.translate(
                renderWidth * gameObject.transform.pivot.x,
                renderHeight * gameObject.transform.pivot.y,
            );
            if (gameObject.transform.rotation !== 0) {
                this.#ctx.rotate(gameObject.transform.rotation);
            }
            if (gameObject.transform.skew.x !== 0 || gameObject.transform.skew.y !== 0) {
                this.#ctx.transform(
                    1,
                    Math.tan(gameObject.transform.skew.x),
                    Math.tan(gameObject.transform.skew.y),
                    1,
                    0,
                    0,
                );
            }
            this.#ctx.clearRect(
                -renderWidth * gameObject.transform.pivot.x - 1,
                -renderHeight * gameObject.transform.pivot.y - 1,
                renderWidth + 2,
                renderHeight + 2,
            );
        } else {
            this.#ctx.scale(gameScale, gameScale);
            this.#ctx.clearRect(
                gameObject.transform.position.x - 1,
                gameObject.transform.position.y - 1,
                renderWidth + 2,
                renderHeight + 2,
            );
        }

        this.#ctx.restore();
    }

    /**
     * Renders red wireframe outlines for all objects with active collision masks when `game.debugging.render.showCollisionBounds` is `true`.
     */
    public renderCollisions(): void {
        const gameScale = this.#game.scale;
        this.#assets.objects.forEach((gameObject) => {
            if (
                this.#ctx &&
                gameObject.collision &&
                gameObject.collision.enabled &&
                gameObject.collision.colliderType
            ) {
                this.#ctx.save();
                this.#ctx.scale(gameScale, gameScale);
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

                this.#ctx.lineWidth = 2 / gameScale;
                this.#ctx.strokeStyle = "#F00";
                this.#ctx.stroke();
                this.#ctx.closePath();

                this.#ctx.restore();
            }
        });
    }

    /**
     * Renders green bounding-box outlines around every object's `renderSize` when `game.debugging.render.showRenderBounds` is `true`.
     */
    public renderBounds(): void {
        const gameScale = this.#game.scale;
        this.#assets.objects.forEach((gameObject) => {
            if (this.#ctx) {
                const renderWidth =
                    gameObject.transform.renderSize.x || gameObject.transform.size.x;
                const renderHeight =
                    gameObject.transform.renderSize.y || gameObject.transform.size.y;

                this.#ctx.save();

                this.#ctx.scale(gameScale, gameScale);
                this.#ctx.beginPath();
                this.#ctx.rect(
                    gameObject.transform.position.x,
                    gameObject.transform.position.y,
                    renderWidth,
                    renderHeight,
                );
                this.#ctx.lineWidth = 2 / gameScale;
                this.#ctx.strokeStyle = "#0F0";
                this.#ctx.stroke();
                this.#ctx.closePath();

                this.#ctx.restore();
            }
        });
    }

    /**
     * Renders a coordinate alignment grid across the canvas with cell dimensions `(gridX, gridY)`.
     *
     * @param gridX Cell width in pixels
     * @param gridY Cell height in pixels
     */
    public renderGrid(gridX: number, gridY: number): void {
        const maxWidth = this.#game.width;
        const maxHeight = this.#game.height;

        const cellWidth = Math.max(1, gridX);
        const cellHeight = Math.max(1, gridY);

        const maxAxis = Math.max(maxWidth, maxHeight);
        const maxRowsOrCols = maxAxis / Math.min(cellWidth, cellHeight);

        for (let i = 1; i <= maxRowsOrCols; i++) {
            const currentHeight = cellHeight * i;
            const currentWidth = cellWidth * i;

            // Draws the X axis grid line
            this.#ctx.beginPath();
            this.#ctx.moveTo(0, currentHeight);
            this.#ctx.lineTo(maxWidth, currentHeight);
            this.#ctx.lineWidth = 1;
            this.#ctx.strokeStyle = "#DDD";
            this.#ctx.stroke();
            this.#ctx.closePath();

            // Draws the Y axis grid line
            this.#ctx.beginPath();
            this.#ctx.moveTo(currentWidth, 0);
            this.#ctx.lineTo(currentWidth, maxHeight);
            this.#ctx.lineWidth = 1;
            this.#ctx.strokeStyle = "#DDD";
            this.#ctx.stroke();
            this.#ctx.closePath();
        }
    }

    /**
     * Renders horizontal and vertical center axis rulers across the middle of the canvas.
     */
    public renderAxisRulers(): void {
        const gameWidth = this.#game.width;
        const gameHeight = this.#game.height;
        const midWidth = gameWidth / 2;
        const midHeight = gameHeight / 2;

        // Draws the mid X line
        this.#ctx.beginPath();
        this.#ctx.lineWidth = 2;
        this.#ctx.moveTo(0, midHeight);
        this.#ctx.lineTo(gameWidth, midHeight);
        this.#ctx.strokeStyle = "#DDD";
        this.#ctx.stroke();
        this.#ctx.closePath();

        // Draws the mid Y line
        this.#ctx.beginPath();
        this.#ctx.lineWidth = 3;
        this.#ctx.moveTo(midWidth, 0);
        this.#ctx.lineTo(midWidth, gameHeight);
        this.#ctx.strokeStyle = "#DDD";
        this.#ctx.stroke();
        this.#ctx.closePath();
    }

    /**
     * Renders the real-time FPS counter overlay at the specified screen anchor.
     *
     * @param position Screen anchor position
     * @param offset Margin offset in pixels from the canvas edge
     * @param size Font and box base size in pixels
     * @param backgroundColor Box fill CSS color
     * @param textColor Text fill CSS color
     */
    public renderFPSOverlay(
        position: CanvasFPSPosition,
        offset: number,
        size: number,
        backgroundColor: string,
        textColor: string,
    ): void {
        if (!this.#ctx) return;

        const gameWidth = this.#game.width;
        const gameHeight = this.#game.height;
        let pos: Vec2 = { x: 0, y: 0 };
        const off = offset;

        const containerHeight = size * 1.5;
        const containerWidth = containerHeight * 2.25;

        const centerX = gameWidth / 2 - containerHeight;
        const centerY = gameHeight / 2 - containerHeight;
        const bottomY = gameHeight - (containerHeight + off);
        const rightX = gameWidth - (containerWidth + off);

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

        // Draws the background box
        this.#ctx.fillStyle = backgroundColor;
        this.#ctx.fillRect(pos.x, pos.y, containerWidth, containerHeight);

        // Draws the FPS text
        this.#ctx.textRendering = "optimizeLegibility";
        this.#ctx.font = `${size}px monospace`;
        this.#ctx.fillStyle = textColor;
        this.#ctx.fillText(this.gameLastFPS.toFixed(1), pos.x + size / 2, pos.y + size * 1.1);
    }
}

