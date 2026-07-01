export class BrioSprite {
    /** The name of the sprite asset */
    #name;
    /** Element created to receive an image */
    #element;
    /** The source URL used in the sprite */
    #src;
    // #type: SpriteType;
    /** Checks if the sprite is a clone or the original. BrioObject clones sprites when created. */
    #isClone = false;
    #size;
    static #emptyInstance;
    /**
     * @example game.preload(() => {
     * const spr_player = new GameSprite("spr_player", "./sprites/player.png", 0, 0, 32, 32);
     * return [spr_player]; // now the "spr_player" GameSprite can be used in the 'load' step
     * });
     */
    constructor(name, src) {
        this.#name = name;
        this.#src = src;
        // this.#type = type;
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
    // public get type() {
    //     return this.#type;
    // }
    set size(size) {
        if (!this.#size)
            this.#size = size;
    }
    get size() {
        if (!this.#size)
            throw new Error("Sprite size was not initialized");
        return this.#size;
    }
    /**
     * Set the source URL of the GameSprite object
     * @example const player = new BrioSprite("spr_player", "./spr_player.png");
     * player.src = "./spr_player_jump.png";
     */
    set src(value) {
        this.#src = value;
    }
    get isClone() {
        return this.#isClone;
    }
    static getEmptyInstance() {
        if (!this.#emptyInstance) {
            const instance = new BrioSprite("", "");
            this.#emptyInstance = instance;
        }
        return this.#emptyInstance;
    }
    static clone(targetGameSprite) {
        const sprite = new BrioSprite(targetGameSprite.#name, targetGameSprite.#src);
        sprite.#isClone = true;
        return sprite;
    }
}
