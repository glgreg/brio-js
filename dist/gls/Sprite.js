export class Sprite {
    /** @type {string} The name of the sprite asset */
    #name;
    /** @type {HTMLImageElement} Element created to receive an image */
    #element;
    /** @type {string} The source URL used in the sprite */
    #pos;
    #src;
    #initialSize;
    #size;
    #type;
    /**
     * @param {string} name A name for the sprite object
     * @param {string} src The source URI for the targeted image
     * @param {string} [type="img"] The type of the image (img | svg)
     * @example game.preload(() => {
     *
     * const spr_player = new Sprite("spr_player", "./sprites/player.png", 0, 0, 32, 32);
     * return [spr_player]; // now the "spr_player" Sprite can be used in the 'load' step
     * });
     */
    constructor(props) {
        this.#name = props.name;
        this.#src = props.src;
        this.#pos = props.pos;
        this.#size = props.size;
        this.#initialSize = props.size;
        this.#type = props.type;
        if (this.#type === "img") {
            this.#element = new Image();
            this.#element.src = this.#src;
        }
        else if (this.#type === "svg") {
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
    get size() {
        const self = this;
        return {
            get x() {
                return self.#size.x;
            },
            set x(value) {
                self.#size.x = value;
            },
            get y() {
                return self.#size.y;
            },
            set y(value) {
                self.#size.y = value;
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
        return this.#size.x;
    }
    set width(value) {
        this.#size.x = value;
    }
    get height() {
        return this.#size.y;
    }
    set height(value) {
        this.#size.y = value;
    }
    get scale() {
        const initialSize = this.#initialSize.x * this.#initialSize.y;
        const currentSize = this.#size.x * this.#size.y;
        return Math.sqrt(currentSize / initialSize);
    }
    set scale(value) {
        this.#size.x *= value;
        this.#size.y *= value;
    }
    get type() {
        return this.#type;
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
        const props = {
            name: targetSprite.#name,
            src: targetSprite.#src,
            pos: { x: targetSprite.#pos.x, y: targetSprite.#pos.y },
            size: { x: targetSprite.#size.x, y: targetSprite.#size.y },
            type: "img",
        };
        return new Sprite(props);
    }
}
