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
 * Pixel rectangle of the source image that a `BrioSprite` shows (a spritesheet cell or an atlas region).
 */
export interface SpriteSourceRect {
    /** Left edge in source image pixels. */
    x: number;
    /** Top edge in source image pixels. */
    y: number;
    /** Width in source image pixels (greater than `0`). */
    width: number;
    /** Height in source image pixels (greater than `0`). */
    height: number;
}

/**
 * Represents a 2D image asset that can be preloaded by `BrioGame` and attached to `BrioObject2D` instances.
 * A sprite shows its whole image, or only the `sourceRect` region of it (set by `BrioSpriteSheet` and
 * `BrioAtlas`).
 *
 * Each sprite owns its own `HTMLImageElement`: the browser HTTP cache avoids refetching a shared `src`, but
 * each sprite decodes its own copy. Sprites do not share `TextureRegistry` elements because preload assigns
 * `element.onload` per sprite, which a shared element would overwrite.
 *
 * @example
 * ```ts
 * game.preload(() => {
 *     const sprPlayer = new BrioSprite("spr_player", "./assets/sprites/soldier.png");
 *     const sprIcon = new BrioSprite("spr_icon", "./assets/sprites/ui.png", {
 *         x: 0,
 *         y: 0,
 *         width: 16,
 *         height: 16,
 *     });
 *     return [sprPlayer, sprIcon];
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
    /** Region of the image this sprite shows, or `undefined` for the whole image. */
    #sourceRect?: SpriteSourceRect;
    /** Cached `{ x: width, y: height }` of `#sourceRect`, returned by `size` without allocating. */
    #sourceSize?: Vec2;

    static #emptyInstance?: BrioSprite;

    /**
     * Creates a new `BrioSprite` asset instance.
     *
     * @param name Unique identifier used to reference the sprite in `BrioObject2D` and `assets.getSprite(name)`
     * @param src Relative or absolute URL to the image resource
     * @param sourceRect Optional region of the image to show (defaults to the whole image)
     * @example
     * ```ts
     * game.preload(() => {
     *     const sprPlayer = new BrioSprite("spr_player", "./assets/sprites/player.png");
     *     return [sprPlayer];
     * });
     * ```
     */
    constructor(name: string, src: string, sourceRect?: SpriteSourceRect) {
        this.#name = name;
        this.#src = src;
        if (sourceRect) this.sourceRect = sourceRect;

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
     * Region of the source image this sprite shows, or `undefined` to show the whole image.
     * Renderers draw only this rectangle, scaled to the object's render size. Setting it copies the value;
     * a rectangle with a non-positive `width` or `height` clears it.
     *
     * @default undefined
     * @example
     * ```ts
     * const spr = new BrioSprite("spr_coin", "./assets/sprites/items.png");
     * spr.sourceRect = { x: 32, y: 0, width: 16, height: 16 };
     * ```
     */
    public get sourceRect(): Readonly<SpriteSourceRect> | undefined {
        return this.#sourceRect;
    }

    public set sourceRect(rect: SpriteSourceRect | undefined) {
        if (!rect || !(rect.width > 0) || !(rect.height > 0)) {
            this.#sourceRect = undefined;
            this.#sourceSize = undefined;
            return;
        }
        this.#sourceRect = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        this.#sourceSize = create(rect.width, rect.height);
    }

    /**
     * Dimensions (`{ x, y }`) of the sprite in pixels.
     * Automatically populated during `game.preload()` once the image loads. When `sourceRect` is set, the
     * rectangle's `width` and `height` are reported instead, so a spritesheet cell keeps its cell size after
     * preload measures the whole image.
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
        if (this.#sourceSize) return this.#sourceSize;
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
     * Creates a shallow clone of a `BrioSprite` (same `src`, `size` and `sourceRect`) marked with
     * `isClone = true`.
     *
     * @param targetGameSprite Source `BrioSprite` to clone
     * @returns Cloned `BrioSprite` instance
     * @example
     * ```ts
     * const clonedSprite = BrioSprite.clone(sprPlayer);
     * ```
     */
    public static clone(targetGameSprite: BrioSprite): BrioSprite {
        const sprite = new BrioSprite(
            targetGameSprite.#name,
            targetGameSprite.#src,
            targetGameSprite.#sourceRect,
        );
        if (targetGameSprite.#size) {
            sprite.#size = create(targetGameSprite.#size.x, targetGameSprite.#size.y);
        }
        sprite.#isClone = true;

        return sprite;
    }
}
