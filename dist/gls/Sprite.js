export class Sprite {
    /** @type {HTMLImageElement} Element created to receive an image */
    #element;
    /** @type {string} The name of the sprite */
    #name;
    /** @type {string} The source URL used in the sprite */
    #src;
    #pos;
    #posX;
    #posY;
    #initialWidth;
    #initialHeight;
    #width;
    #height;
    #size;
    /**
     * @param {string} name A name for the sprite object
     * @param {string} src The source URI for the target image
     * @param {string} [type="img"] The type of the image (img | svg)
     * @example game.preload(() => {
     *
     * const spr_player = new Sprite("spr_player", "./sprites/player.png", 0, 0, 32, 32);
     * return [spr_player]; // now the "spr_player" Sprite can be used in the 'load' step
     * });
     */
    constructor(name, src, px = 0, py = 0, sw = 128, sh = 128, type = "img") {
        this.#name = name;
        this.#src = src;
        this.#posX = px;
        this.#posY = py;
        this.#pos = { x: px, y: py };
        this.#size = { w: sw, h: sh };
        this.#width = sw;
        this.#initialWidth = sw;
        this.#initialHeight = sh;
        this.#height = sh;
        if (type === "img") {
            this.#element = new Image();
            this.#element.src = this.#src;
        }
        else if (type === "svg") {
            this.#element = new Image();
            this.#element.src = this.#src;
        }
        else
            throw new Error("Invalid sprite type: use 'img' or 'svg'");
    }
    /**
     * GETTERS AND SETTERS -------------------------------------------------------------
     */
    /**
     * Returns the element of the Sprite object
     * @example const player = new GLS.Sprite("spr_player", "./spr_player.png");
     * console.log(player.element); // <img src="./spr_player.png">
     */
    get element() {
        return this.#element;
    }
    /**
     * Returns the name of the Sprite object
     * @example const player = new GLS.Sprite("spr_player", "./spr_player.png");
     * console.log(player.name); // "spr_player"
     */
    get name() {
        return this.#name;
    }
    /**
     * Returns the source URL of the Sprite object
     * @example const player = new GLS.Sprite("spr_player", "./spr_player.png");
     * console.log(player.src); // "./spr_player.png"
     */
    get src() {
        return this.#src;
    }
    get posX() {
        return this.#posX;
    }
    set posX(value) {
        this.#posX = value;
    }
    get posY() {
        return this.#posY;
    }
    set posY(value) {
        this.#posY = value;
    }
    get size() {
        const self = this;
        return {
            get w() {
                return self.#size.w;
            },
            set w(value) {
                self.#size.w = value;
            },
            get h() {
                return self.#size.h;
            },
            set h(value) {
                self.#size.h = value;
            },
        };
    }
    get pos() {
        const self = this;
        return {
            get x() {
                return self.#pos.x;
            },
            set x(value) {
                self.#pos.x = value;
            },
            get y() {
                return self.#pos.y;
            },
            set y(value) {
                self.#pos.y = value;
            },
        };
    }
    get width() {
        return this.#width;
    }
    set width(value) {
        this.#width = value;
    }
    get height() {
        return this.#height;
    }
    set height(value) {
        this.#height = value;
    }
    get scale() {
        const initialSize = this.#initialWidth * this.#initialHeight;
        const currentSize = this.#width * this.#height;
        return Math.sqrt(currentSize / initialSize);
    }
    set scale(value) {
        this.#width *= value;
        this.#height *= value;
    }
    /**
     * Set the source URL of the Sprite object
     * @example const player = new GLS.Sprite("spr_player", "./spr_player.png");
     * player.src = "./spr_player_jump.png";
     */
    set src(value) {
        this.#src = value;
    }
    static clone(targetSprite) {
        return new Sprite(targetSprite.name, targetSprite.src, targetSprite.posX, targetSprite.posY, targetSprite.width, targetSprite.height);
    }
}
