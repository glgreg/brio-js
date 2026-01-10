export class BrioUpdater {
    #game;
    #ctx;
    #gameLoadedObjects;
    #gameScale;
    #gameWidth;
    #gameHeight;
    #gameLastFPS;
    constructor(game, gameLoadedObjects, canvasContext, gameScale, width, height, gameLastFPS) {
        this.#game = game;
        this.#gameLoadedObjects = gameLoadedObjects;
        this.#ctx = canvasContext;
        this.#gameScale = gameScale;
        this.#gameWidth = width;
        this.#gameHeight = height;
        this.#gameLastFPS = gameLastFPS;
    }
    useShowCollisions() {
        this.#gameLoadedObjects.forEach((gameObject, key) => {
            if (this.#ctx && gameObject.collision && gameObject.collision.colliderType) {
                this.#ctx.save();
                this.#ctx.scale(this.#gameScale, this.#gameScale);
                this.#ctx.beginPath();
                switch (gameObject.collision.shape) {
                    case "square":
                    case "rectangle":
                        this.#ctx.rect(gameObject.transform.position.x + gameObject.collision.pos.x, gameObject.transform.position.y + gameObject.collision.pos.y, gameObject.collision.size.x, gameObject.collision.size.y);
                        break;
                    case "circle":
                        this.#ctx.arc(gameObject.transform.position.x +
                            (gameObject.collision.pos.x + gameObject.collision.size.x / 2), gameObject.transform.position.y +
                            (gameObject.collision.pos.y + gameObject.collision.size.y / 2), gameObject.collision.size.x / 2, 0, 2 * Math.PI);
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
    useShowBorders() {
        this.#gameLoadedObjects.forEach((gameObject, key) => {
            if (this.#ctx) {
                this.#ctx.save();
                this.#ctx.scale(this.#gameScale, this.#gameScale);
                this.#ctx.beginPath();
                this.#ctx.rect(gameObject.transform.position.x, gameObject.transform.position.y, gameObject.transform.size.x, gameObject.transform.size.y);
                this.#ctx.lineWidth = 2 / this.#gameScale;
                this.#ctx.strokeStyle = "#0F0";
                this.#ctx.stroke();
                this.#ctx.closePath();
                this.#ctx.restore();
            }
        });
    }
    useShowCenteredAxis() {
        if (!this.#ctx) {
            return;
        }
        // Draws the mid Y line
        this.#ctx.beginPath();
        this.#ctx.moveTo(0, this.#gameHeight / 2);
        this.#ctx.lineTo(this.#gameWidth, this.#gameHeight / 2);
        this.#ctx.strokeStyle = "#F00";
        this.#ctx.stroke();
        this.#ctx.closePath();
        // Draws the mid X line
        this.#ctx.beginPath();
        this.#ctx.moveTo(this.#gameWidth / 2, 0);
        this.#ctx.lineTo(this.#gameWidth / 2, this.#gameHeight);
        this.#ctx.strokeStyle = "#F00";
        this.#ctx.stroke();
        this.#ctx.closePath();
    }
    useShowFPS(FPSPosition, offset, size, backgroundColor, textColor) {
        if (!this.#ctx)
            return;
        const off = offset;
        let position = { x: 0, y: 0 };
        const containerHeight = size * 1.5;
        const containerWidth = containerHeight * 2.25;
        const centerX = this.#gameWidth / 2 - containerHeight;
        const centerY = this.#gameHeight / 2 - containerHeight;
        const bottomY = this.#gameHeight - (containerHeight + off);
        const rightX = this.#gameWidth - (containerWidth + off);
        // prettier-ignore
        switch (FPSPosition) {
            case "left-top":
                position = { x: off, y: off };
                break;
            case "left-center":
                position = { x: off, y: centerY };
                break;
            case "left-bottom":
                position = { x: off, y: bottomY };
                break;
            case "center-top":
                position = { x: centerX, y: off };
                break;
            case "center-center":
                position = { x: centerX, y: centerY };
                break;
            case "center-bottom":
                position = { x: centerX, y: bottomY };
                break;
            case "right-top":
                position = { x: rightX, y: off };
                break;
            case "right-center":
                position = { x: rightX, y: centerY };
                break;
            case "right-bottom":
                position = { x: rightX, y: bottomY };
                break;
        }
        // draws the background
        this.#ctx.fillStyle = backgroundColor;
        this.#ctx.fillRect(position.x, position.y, containerWidth, containerHeight);
        // draws the text
        this.#ctx.textRendering = "optimizeLegibility";
        this.#ctx.font = `${size}px monospace`;
        this.#ctx.fillStyle = textColor;
        this.#ctx.fillText(this.#gameLastFPS.toFixed(1), position.x + size / 2, position.y + size * 1.1);
    }
}
