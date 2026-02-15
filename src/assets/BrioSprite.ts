import { Vec2 } from "../math/index";
import BrioTransform from "../base/BrioTransform";
import { create } from "../math/vec2";
import { BrioConsole } from "../debugging/BrioConsole";

export type SpriteType = "img" | "svg";

export interface SpriteProperties {
    /** A name for the sprite object */
    name: string;
    /** The source URI for the targeted image */
    src: string;
    /** A Vec2 of a Sprite size */
    size: Vec2;
    /** The type of the image (img | svg */
    type: SpriteType;
}

export class BrioSprite {
    /** The name of the sprite asset */
    #name: string;
    /** Element created to receive an image */
    #element: HTMLImageElement;
    /** The source URL used in the sprite */
    #src: string;
    #type: SpriteType;
    /** Checks if the sprite is a clone or the original. BrioObject clones sprites when created. */
    #isClone: boolean = false;
    #size?: Vec2;

    static #emptyInstance?: BrioSprite;

    /**
     * @example game.preload(() => {
     * const spr_player = new GameSprite("spr_player", "./sprites/player.png", 0, 0, 32, 32);
     * return [spr_player]; // now the "spr_player" GameSprite can be used in the 'load' step
     * });
     */
    constructor(name: string, src: string, type: SpriteType) {
        this.#name = name;
        this.#src = src;
        this.#type = type;

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
    public get element(): HTMLImageElement {
        return this.#element;
    }

    /**
     * Returns the name of the GameSprite object
     * @example const player = new GLS.GameSprite("spr_player", "./spr_player.png");
     * console.log(player.name); // "spr_player"
     */
    public get name(): string {
        return this.#name;
    }

    /**
     * Returns the source URL of the GameSprite object
     * @example const player = new GLS.GameSprite("spr_player", "./spr_player.png");
     * console.log(player.src); // "./spr_player.png"
     */
    public get src(): string {
        return this.#src;
    }

    public get type() {
        return this.#type;
    }

    public set size(size: Vec2) {
        if (!this.#size) this.#size = size;
    }

    public get size(): Vec2 {
        if (!this.#size) throw new Error("Sprite size was not initialized");

        return this.#size;
    }

    /**
     * Set the source URL of the GameSprite object
     * @example const player = new BrioSprite("spr_player", "./spr_player.png");
     * player.src = "./spr_player_jump.png";
     */
    public set src(value) {
        this.#src = value;
    }

    public get isClone() {
        return this.#isClone;
    }

    public static getEmptyInstance(): BrioSprite {
        if (!this.#emptyInstance) {
            const instance = new BrioSprite("", "", "img");

            this.#emptyInstance = instance;
        }

        return this.#emptyInstance;
    }

    public static clone(targetGameSprite: BrioSprite): BrioSprite {
        const sprite = new BrioSprite(
            targetGameSprite.#name,
            targetGameSprite.#src,
            targetGameSprite.#type,
        );

        sprite.#isClone = true;

        return sprite;
    }
}
