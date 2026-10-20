/**
 * Represents a decoded visual image resource (`BrioTexture`) loaded from a single source URI
 * and shared across any number of 2D sprites, atlases, or 3D materials without memory duplication.
 *
 * @example
 * ```ts
 * const tex = TextureRegistry.acquire("./assets/sprites/tileset.png");
 * await tex.decode();
 * ```
 */
export class BrioTexture {
    readonly #src: string;
    readonly #element: HTMLImageElement;
    #bitmap?: ImageBitmap;
    #decoded: boolean = false;

    /**
     * Creates a new `BrioTexture` for `src`.
     * Prefer `TextureRegistry.acquire(src)` to share instances by URI automatically.
     *
     * @param src Image source URI, or a descriptive label when `bitmap` is given
     * @param bitmap Already decoded image (e.g. an embedded glTF image); `src` is then not fetched
     */
    constructor(src: string, bitmap?: ImageBitmap) {
        this.#src = src;
        this.#element = new Image();
        if (bitmap) {
            this.#bitmap = bitmap;
            this.#decoded = true;
        } else if (src) {
            this.#element.src = src;
        }
    }

    /**
     * Decodes encoded image bytes (PNG, JPEG, WebP) off the main thread into a ready `BrioTexture`.
     * Pixels are kept unpremultiplied and without color-space conversion, so GPU backends can sample
     * them as sRGB data.
     *
     * @param label Descriptive identifier stored as `src` (not fetched)
     * @param blob Encoded image data
     * @returns Promise resolving to a decoded `BrioTexture`
     * @example
     * ```ts
     * const tex = await BrioTexture.fromBlob("mod_ship#image0", new Blob([bytes], { type: "image/png" }));
     * ```
     */
    public static async fromBlob(label: string, blob: Blob): Promise<BrioTexture> {
        const bitmap = await createImageBitmap(blob, {
            premultiplyAlpha: "none",
            colorSpaceConversion: "none",
        });
        return new BrioTexture(label, bitmap);
    }

    /** Source URI of the texture. */
    public get src(): string {
        return this.#src;
    }

    /** Underlying `HTMLImageElement`. */
    public get element(): HTMLImageElement {
        return this.#element;
    }

    /** Decoded `ImageBitmap` if available in the current environment. */
    public get bitmap(): ImageBitmap | undefined {
        return this.#bitmap;
    }

    /** Indicates whether the texture has finished decoding. */
    public get isDecoded(): boolean {
        return this.#decoded;
    }

    /** Natural pixel width of the texture (`0` before decoding). */
    public get width(): number {
        return this.#bitmap?.width ?? this.#element.naturalWidth ?? this.#element.width ?? 0;
    }

    /** Natural pixel height of the texture (`0` before decoding). */
    public get height(): number {
        return this.#bitmap?.height ?? this.#element.naturalHeight ?? this.#element.height ?? 0;
    }

    /**
     * Asynchronously decodes the image and creates an `ImageBitmap` when supported by the runtime.
     *
     * @returns Promise resolving to this `BrioTexture`
     * @example
     * ```ts
     * await texture.decode();
     * ```
     */
    public async decode(): Promise<this> {
        if (this.#decoded) return this;
        if (typeof this.#element.decode === "function") {
            await this.#element.decode();
        }
        if (typeof createImageBitmap === "function") {
            this.#bitmap = await createImageBitmap(this.#element);
        }
        this.#decoded = true;
        return this;
    }

    /**
     * Releases GPU/memory resources held by the decoded `ImageBitmap`.
     */
    public dispose(): void {
        if (this.#bitmap && typeof this.#bitmap.close === "function") {
            this.#bitmap.close();
        }
        this.#bitmap = undefined;
        this.#decoded = false;
    }
}

/**
 * Flyweight registry (`TextureRegistry`) ensuring each unique image URI is loaded and decoded at most once in memory.
 *
 * @example
 * ```ts
 * const texA = TextureRegistry.acquire("./hero.png");
 * const texB = TextureRegistry.acquire("./hero.png");
 * console.log(texA === texB); // true
 * ```
 */
export class TextureRegistry {
    static readonly #cache = new Map<string, BrioTexture>();

    /**
     * Returns the shared `BrioTexture` instance for `src`, creating and caching it if not yet registered.
     *
     * @param src Image source URI
     * @returns Shared `BrioTexture` instance
     */
    public static acquire(src: string): BrioTexture {
        let tex = this.#cache.get(src);
        if (!tex) {
            tex = new BrioTexture(src);
            this.#cache.set(src, tex);
        }
        return tex;
    }

    /**
     * Checks whether a texture with `src` is already cached in the registry.
     *
     * @param src Image source URI
     * @returns `true` if cached
     */
    public static has(src: string): boolean {
        return this.#cache.has(src);
    }

    /**
     * Disposes and removes all cached textures from the registry.
     */
    public static clear(): void {
        for (const tex of this.#cache.values()) {
            tex.dispose();
        }
        this.#cache.clear();
    }
}
