import { BrioSprite, SpriteSourceRect } from "./BrioSprite";
import { BrioTexture, TextureRegistry } from "./BrioTexture";

/**
 * Represents a decoded texture atlas containing an `ImageBitmap` and sub-region coordinates.
 */
export interface Atlas {
    /** Hardware-accelerated `ImageBitmap` decoded from the source image. */
    bitmap: ImageBitmap;
    /** Flat array or list of region coordinates within the atlas. */
    regions: number[];
}

/**
 * Texture atlas: named, arbitrary rectangular regions over one image, acting as a factory for `BrioSprite`
 * instances that show a single region. The image is shared through `TextureRegistry`, so atlases (and
 * spritesheets) over the same `src` decode it once; `mount()` decodes it into a GPU-friendly `ImageBitmap`.
 *
 * @example
 * ```ts
 * const atlas = new BrioAtlas("world_atlas", 512, 512, "./assets/sprites/world.png");
 * atlas.defineRegion("tree", 0, 0, 64, 96);
 * const sprTree = atlas.createSprite("tree", "spr_tree");
 * const bitmap = await atlas.mount();
 * ```
 */
export class BrioAtlas {
    #name: string;
    #width: number;
    #height: number;
    #src: string;
    #texture: BrioTexture;
    readonly #regions = new Map<string, SpriteSourceRect>();

    /**
     * Creates a new `BrioAtlas` instance.
     *
     * @param name Unique identifier for the texture atlas
     * @param sx Atlas width in pixels
     * @param sy Atlas height in pixels
     * @param src Relative or absolute URL to the atlas image file
     * @param regions Optional named regions, as by `defineRegion`
     * @example
     * ```ts
     * const atlas = new BrioAtlas("ui_atlas", 256, 256, "./assets/sprites/ui_sheet.png", {
     *     button: { x: 0, y: 0, width: 96, height: 32 },
     * });
     * ```
     */
    public constructor(
        name: string,
        sx: number,
        sy: number,
        src: string = "./assets/sprites/background.png",
        regions?: Record<string, SpriteSourceRect>,
    ) {
        this.#name = name;
        this.#width = Math.abs(sx);
        this.#height = Math.abs(sy);
        this.#src = src;
        this.#texture = TextureRegistry.acquire(src);
        if (regions) {
            for (const key of Object.keys(regions)) {
                const r = regions[key];
                this.defineRegion(key, r.x, r.y, r.width, r.height);
            }
        }
    }

    /**
     * Unique identifier of the `BrioAtlas`.
     *
     * @example
     * ```ts
     * console.log(atlas.name); // "ui_atlas"
     * ```
     */
    public get name(): string {
        return this.#name;
    }

    /**
     * Source URI of the atlas image.
     */
    public get src(): string {
        return this.#src;
    }

    /**
     * Configured width of the atlas in pixels.
     */
    public get width(): number {
        return this.#width;
    }

    /**
     * Configured height of the atlas in pixels.
     */
    public get height(): number {
        return this.#height;
    }

    /**
     * Shared `BrioTexture` holding the atlas image (from `TextureRegistry`).
     */
    public get texture(): BrioTexture {
        return this.#texture;
    }

    /**
     * Underlying `HTMLImageElement` used to fetch the atlas texture (shared with every user of the same `src`).
     */
    public get element(): HTMLImageElement {
        return this.#texture.element;
    }

    /**
     * Cached `ImageBitmap` once `mount()` has resolved, or `undefined` if not yet mounted.
     */
    public get bitmap(): ImageBitmap | undefined {
        return this.#texture.bitmap;
    }

    /**
     * Names of every defined region, in definition order.
     */
    public get regionNames(): string[] {
        return Array.from(this.#regions.keys());
    }

    /**
     * Defines (or replaces) the named region `regionName`. Width and height are clamped to at least 1 pixel.
     *
     * @param regionName Region identifier, unique within this atlas
     * @param x Left edge in pixels
     * @param y Top edge in pixels
     * @param width Region width in pixels
     * @param height Region height in pixels
     * @returns This `BrioAtlas` for chaining
     * @example
     * ```ts
     * atlas.defineRegion("coin", 0, 0, 16, 16).defineRegion("gem", 16, 0, 16, 16);
     * ```
     */
    public defineRegion(
        regionName: string,
        x: number,
        y: number,
        width: number,
        height: number,
    ): this {
        this.#regions.set(regionName, {
            x,
            y,
            width: Math.max(1, width),
            height: Math.max(1, height),
        });
        return this;
    }

    /**
     * Returns the rectangle of region `regionName`, or `undefined` when it is not defined.
     *
     * @param regionName Region identifier
     * @returns Region rectangle (read-only)
     */
    public getRegion(regionName: string): Readonly<SpriteSourceRect> | undefined {
        return this.#regions.get(regionName);
    }

    /**
     * Whether region `regionName` is defined.
     *
     * @param regionName Region identifier
     * @returns `true` when defined
     */
    public hasRegion(regionName: string): boolean {
        return this.#regions.has(regionName);
    }

    /**
     * Creates a `BrioSprite` that shows region `regionName` (its `sourceRect` and `size`).
     * Return the sprite from `preload()` like any other sprite.
     *
     * @param regionName Region identifier
     * @param spriteName Sprite name (defaults to `"<atlas>_<region>"`)
     * @returns Configured `BrioSprite`
     * @throws {Error} When the region is not defined
     * @example
     * ```ts
     * const sprCoin = atlas.createSprite("coin", "spr_coin");
     * ```
     */
    public createSprite(regionName: string, spriteName?: string): BrioSprite {
        const region = this.#regions.get(regionName);
        if (!region) {
            throw new Error(`BrioAtlas '${this.#name}' has no region named '${regionName}'.`);
        }
        const sprite = new BrioSprite(
            spriteName ?? `${this.#name}_${regionName}`,
            this.#src,
            region,
        );
        sprite.size = { x: region.width, y: region.height };
        return sprite;
    }

    /**
     * Decodes the shared image asynchronously into a hardware-accelerated `ImageBitmap` (once per `src`,
     * through `TextureRegistry`).
     *
     * @returns A Promise resolving to the decoded `ImageBitmap`
     * @throws {Error} When the runtime has no `createImageBitmap`
     * @example
     * ```ts
     * const atlas = new BrioAtlas("tiles", 1024, 1024, "./assets/sprites/tileset.png");
     * const bitmap = await atlas.mount();
     * ```
     */
    public async mount(): Promise<ImageBitmap> {
        await this.#texture.decode();
        const bitmap = this.#texture.bitmap;
        if (!bitmap) {
            throw new Error(
                `BrioAtlas '${this.#name}' could not create an ImageBitmap: createImageBitmap is unavailable.`,
            );
        }
        return bitmap;
    }
}
