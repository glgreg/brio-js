import { Vector2 } from "../math/BrioVector2";
import BrioTransform from "../base/BrioTransform";

export type SpriteType = "img" | "svg";

export interface SpriteProperties {
    /** A name for the sprite object */
    name: string;
    /** The source URI for the targeted image */
    src: string;
    /** A Vec2 of a Sprite position */
    position: Vector2<number>;
    /** A Vec2 of a Sprite size */
    size: Vector2<number>;
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
    #transform: BrioTransform;
    #type: SpriteType;
    /** Checks if the sprite is a clone or the original. BrioObject clones sprites when created. */
    #isClone: boolean = false;

    static #emptyInstance?: BrioSprite;

    /**
     * @example game.preload(() => {
     * const spr_player = new GameSprite("spr_player", "./sprites/player.png", 0, 0, 32, 32);
     * return [spr_player]; // now the "spr_player" GameSprite can be used in the 'load' step
     * });
     */
    constructor(properties: SpriteProperties) {
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

    /**
     * Set the source URL of the GameSprite object
     * @example const player = new BrioSprite("spr_player", "./spr_player.png");
     * player.src = "./spr_player_jump.png";
     */
    public set src(value) {
        this.#src = value;
    }

    public get transform() {
        return this.#transform;
    }

    public get isClone() {
        return this.#isClone;
    }

    public static getEmptyInstance(): BrioSprite {
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
        } else {
            return this.#emptyInstance;
        }
    }

    public static clone(targetGameSprite: BrioSprite): BrioSprite {
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
