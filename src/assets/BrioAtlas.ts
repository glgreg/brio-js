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
 * Manages a texture atlas image that decodes asynchronously into a GPU-friendly `ImageBitmap`.
 *
 * @example
 * ```ts
 * const atlas = new BrioAtlas("world_atlas", 512, 512, "./assets/sprites/background.png");
 * const bitmap = await atlas.mount();
 * ```
 */
export class BrioAtlas {
    #name: string;
    #width: number;
    #height: number;
    #src: string;
    #element: HTMLImageElement;
    #bitmap?: ImageBitmap;

    /**
     * Creates a new `BrioAtlas` instance.
     *
     * @param name Unique identifier for the texture atlas
     * @param sx Atlas width in pixels
     * @param sy Atlas height in pixels
     * @param src Relative or absolute URL to the atlas image file
     * @example
     * ```ts
     * const atlas = new BrioAtlas("ui_atlas", 256, 256, "./assets/sprites/ui_sheet.png");
     * ```
     */
    public constructor(
        name: string,
        sx: number,
        sy: number,
        src: string = "./assets/sprites/background.png",
    ) {
        this.#name = name;
        this.#width = Math.abs(sx);
        this.#height = Math.abs(sy);
        this.#src = src;
        const img = new Image();
        img.src = src;
        this.#element = img;
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
     * Underlying `HTMLImageElement` used to fetch the atlas texture.
     */
    public get element(): HTMLImageElement {
        return this.#element;
    }

    /**
     * Cached `ImageBitmap` once `mount()` has resolved, or `undefined` if not yet mounted.
     */
    public get bitmap(): ImageBitmap | undefined {
        return this.#bitmap;
    }

    /**
     * Decodes the underlying image asynchronously and creates a hardware-accelerated `ImageBitmap`.
     *
     * @returns A Promise resolving to the decoded `ImageBitmap`
     * @example
     * ```ts
     * const atlas = new BrioAtlas("tiles", 1024, 1024, "./assets/sprites/tileset.png");
     * const bitmap = await atlas.mount();
     * ```
     */
    public async mount(): Promise<ImageBitmap> {
        await this.#element.decode();
        this.#bitmap = await createImageBitmap(this.#element);
        return this.#bitmap;
    }
}