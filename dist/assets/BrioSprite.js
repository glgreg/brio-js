import BrioTransform from "../base/BrioTransform.js";
export class BrioSprite {
    /** The name of the sprite asset */
    #name;
    /** Element created to receive an image */
    #element;
    /** The source URL used in the sprite */
    #src;
    #transform;
    #type;
    /** Checks if the sprite is a clone or the original. BrioObject clones sprites when created. */
    #isClone = false;
    static #emptyInstance;
    /**
     * @example game.preload(() => {
     * const spr_player = new GameSprite("spr_player", "./sprites/player.png", 0, 0, 32, 32);
     * return [spr_player]; // now the "spr_player" GameSprite can be used in the 'load' step
     * });
     */
    constructor(properties) {
        this.#name = properties.name;
        this.#src = properties.src;
        this.#type = properties.type;
        this.#transform = new BrioTransform(properties.position, properties.size);
        this.#element = new Image();
        this.#element.src = this.#src;
        // TODO: Add svg type logic
    }
    /**
     * GETTERS AND SETTERS -------------------------------------------------------------
     */
    /**
     * Returns the element of the GameSprite object
     * @example const player = new GLS.GameSprite("spr_player", "./spr_player.png");
     * console.log(player.element); // <img src="./spr_player.png">
     */
    get element() {
        return this.#element;
    }
    /**
     * Returns the name of the GameSprite object
     * @example const player = new GLS.GameSprite("spr_player", "./spr_player.png");
     * console.log(player.name); // "spr_player"
     */
    get name() {
        return this.#name;
    }
    /**
     * Returns the source URL of the GameSprite object
     * @example const player = new GLS.GameSprite("spr_player", "./spr_player.png");
     * console.log(player.src); // "./spr_player.png"
     */
    get src() {
        return this.#src;
    }
    get type() {
        return this.#type;
    }
    /**
     * Set the source URL of the GameSprite object
     * @example const player = new BrioSprite("spr_player", "./spr_player.png");
     * player.src = "./spr_player_jump.png";
     */
    set src(value) {
        this.#src = value;
    }
    get transform() {
        return this.#transform;
    }
    get isClone() {
        return this.#isClone;
    }
    static getEmptyInstance() {
        if (this.#emptyInstance === undefined) {
            const instance = new BrioSprite({
                name: "",
                src: "",
                position: { x: 0, y: 0 },
                size: { x: 32, y: 32 },
                type: "img",
            });
            this.#emptyInstance = instance;
            return this.#emptyInstance;
        }
        else {
            return this.#emptyInstance;
        }
    }
    static clone(targetGameSprite) {
        const sprite = new BrioSprite({
            name: targetGameSprite.#name,
            src: targetGameSprite.#src,
            position: {
                x: targetGameSprite.#transform.position.x,
                y: targetGameSprite.#transform.position.y,
            },
            size: { x: targetGameSprite.#transform.size.x, y: targetGameSprite.#transform.size.y },
            type: targetGameSprite.type,
        });
        sprite.#isClone = true;
        return sprite;
    }
}
