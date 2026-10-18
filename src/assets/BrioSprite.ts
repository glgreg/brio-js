import { Vec2 } from "../math/index";
import { create } from "../math/vec2";

/**
 * Supported image asset formats for `BrioSprite`.
 */
export type SpriteType = "img" | "svg";

/**
 * Configuration properties describing a `BrioSprite` asset.
 */
export interface SpriteProperties {
    /** Unique identifier of the sprite asset. */
    name: string;
    /** Source URI pointing to the image file. */
    src: string;
    /** Dimensions `{ x, y }` of the sprite in pixels. */
    size: Vec2;
    /** Image format type (`"img"` or `"svg"`). */
    type: SpriteType;
}

/**
 * Represents a 2D image asset that can be preloaded by `BrioGame` and attached to `BrioObject` instances.
 *
 * @example
 * ```ts
 * game.preload(() => {
 *     const sprPlayer = new BrioSprite("spr_player", "./assets/sprites/soldier.png");
 *     return [sprPlayer];
 * });
 * ```
 */
export class BrioSprite {
    /** Unique identifier of the sprite asset. */
    #name: string;
    /** Underlying `HTMLImageElement` holding the decoded image data. */
    #element: HTMLImageElement;
    /** Source URI of the sprite image. */
    #src: string;
    /** Indicates whether this instance was cloned from another `BrioSprite`. */
    #isClone: boolean = false;
    /** Dimensions `{ x, y }` of the loaded image in pixels. */
    #size?: Vec2;

    static #emptyInstance?: BrioSprite;

    /**
     * Creates a new `BrioSprite` asset instance.
     *
     * @param name Unique identifier used to reference the sprite in `BrioObject` and `assets.getSprite(name)`
     * @param src Relative or absolute URL to the image resource
     * @example
     * ```ts
     * game.preload(() => {
     *     const sprPlayer = new BrioSprite("spr_player", "./assets/sprites/player.png");
     *     return [sprPlayer];
     * });
     * ```
     */
    constructor(name: string, src: string) {
        this.#name = name;
        this.#src = src;

        this.#element = new Image();
        this.#element.src = this.#src;
    }

    /**
     * GETTERS AND SETTERS -------------------------------------------------------------
     */

    /**
     * Returns the underlying `HTMLImageElement` of this `BrioSprite`.
     *
     * @example
     * ```ts
     * const sprPlayer = new BrioSprite("spr_player", "./assets/sprites/player.png");
     * console.log(sprPlayer.element); // <img src="./assets/sprites/player.png">
     * ```
     */
    public get element(): HTMLImageElement {
        return this.#element;
    }

    /**
     * Returns the unique identifier name of this `BrioSprite`.
     *
     * @example
     * ```ts
     * const sprPlayer = new BrioSprite("spr_player", "./assets/sprites/player.png");
     * console.log(sprPlayer.name); // "spr_player"
     * ```
     */
    public get name(): string {
        return this.#name;
    }

    /**
     * Source URI of this `BrioSprite`.
     * Updating `src` also updates the underlying `HTMLImageElement.src`.
     *
     * @example
     * ```ts
     * const sprPlayer = new BrioSprite("spr_player", "./assets/sprites/player.png");
     * sprPlayer.src = "./assets/sprites/player_jump.png";
     * ```
     */
    public get src(): string {
        return this.#src;
    }

    public set src(value: string) {
        this.#src = value;
        this.#element.src = value;
    }

    /**
     * Dimensions (`{ x, y }`) of the sprite in pixels.
     * Automatically populated during `game.preload()` once the image loads.
     *
     * @throws {Error} When accessed before the sprite size has been initialized
     * @example
     * ```ts
     * const spr = assets.getSprite("spr_player");
     * console.log(spr.size); // { x: 64, y: 64 }
     * ```
     */
    public set size(size: Vec2) {
        this.#size = create(size.x, size.y);
    }

    public get size(): Vec2 {
        if (!this.#size) throw new Error("Sprite size was not initialized");

        return this.#size;
    }

    /**
     * Indicates whether this `BrioSprite` was created via `BrioSprite.clone()`.
     *
     * @example
     * ```ts
     * const copy = BrioSprite.clone(sprPlayer);
     * console.log(copy.isClone); // true
     * ```
     */
    public get isClone(): boolean {
        return this.#isClone;
    }

    /**
     * Returns a shared singleton fallback `BrioSprite` with zero dimensions `(0, 0)`.
     *
     * @returns Fallback empty `BrioSprite` instance
     */
    public static getEmptyInstance(): BrioSprite {
        if (!this.#emptyInstance) {
            const instance = new BrioSprite("", "");
            instance.size = create(0, 0);
            this.#emptyInstance = instance;
        }

        return this.#emptyInstance;
    }

    /**
     * Creates a shallow clone of a `BrioSprite` marked with `isClone = true`.
     *
     * @param targetGameSprite Source `BrioSprite` to clone
     * @returns Cloned `BrioSprite` instance
     * @example
     * ```ts
     * const clonedSprite = BrioSprite.clone(sprPlayer);
     * ```
     */
    public static clone(targetGameSprite: BrioSprite): BrioSprite {
        const sprite = new BrioSprite(targetGameSprite.#name, targetGameSprite.#src);
        if (targetGameSprite.#size) {
            sprite.#size = create(targetGameSprite.#size.x, targetGameSprite.#size.y);
        }
        sprite.#isClone = true;

        return sprite;
    }
}

