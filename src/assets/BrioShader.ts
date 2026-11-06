/**
 * Source options of a `BrioShader`: inline GLSL hooks, or a `.glsl` file loaded by `preload()`.
 */
export interface BrioShaderOptions {
    /**
     * GLSL ES 3.00 code defining `void surface(inout BrioSurface s)`, plus any `uniform` it reads. Runs per pixel
     * after the base color and texture and before lighting.
     */
    fragment?: string;
    /**
     * GLSL ES 3.00 code defining `void vertex(inout vec3 position, inout vec3 normal)` in object space, plus any
     * `uniform` it reads. Runs per vertex before the world transform.
     */
    vertex?: string;
    /**
     * URL of a `.glsl` file loaded by `preload()`. The file holds the fragment hook; a vertex hook can follow a line
     * containing only `// @vertex`.
     */
    url?: string;
    /** Source limit in characters, against oversized or hostile files (defaults to `65536`). */
    maxLength?: number;
}

/** Marker line separating the fragment hook from the vertex hook in a `.glsl` file. */
const VERTEX_MARKER = /^\s*\/\/\s*@vertex\s*$/m;
/** Prefix reserved for engine identifiers: user hooks may not declare names starting with it. */
const RESERVED_PREFIX = /\bbrio_\w*/;

let nextShaderId = 1;

/**
 * Custom GLSL for a `BrioMaterial` (`BrioShader`): small hooks that change what the built-in pipeline computes,
 * while lighting, shadows, fog and tone mapping keep working. Use it for water, holograms, dissolves, wind and other
 * animated surfaces. Loaded like any asset (`preload()`), shared by name or by reference, and recompiled when its
 * source changes (`shader.fragment = ...`).
 *
 * The fragment hook edits a `BrioSurface`:
 *
 * ```glsl
 * struct BrioSurface {
 *     vec3 baseColor;      // linear color after `material.color` and `material.texture`
 *     float opacity;
 *     vec3 normal;         // world-space unit normal
 *     vec3 emissive;       // linear light added after lighting
 *     float roughness;     // "standard" shading
 *     float metalness;
 *     vec3 worldPosition;
 *     vec2 uv;
 * };
 * ```
 *
 * Built-ins available to both hooks: `TIME` (`game.time` in seconds) and `CAMERA_POSITION`. Every
 * `material.parameters` entry is uploaded to the uniform of the same name: numbers to `float`, `[x, y]` /
 * `[x, y, z]` / `[x, y, z, w]` arrays to vectors, and CSS color strings to linear `vec3`. Names starting with
 * `brio_` are reserved. A shader that fails to compile is logged once (with the driver message and line numbers of
 * the generated source) and the material falls back to the built-in shader. WebGL2 only: the Canvas2D fallback draws
 * the plain material, and the shadow pass ignores the vertex hook.
 *
 * @example
 * ```ts
 * const water = new BrioShader("shd_water", {
 *     vertex: `
 *         uniform float uWaveHeight;
 *         void vertex(inout vec3 position, inout vec3 normal) {
 *             position.y += sin(position.x * 2.0 + TIME * 1.5) * uWaveHeight;
 *         }`,
 *     fragment: `
 *         uniform vec3 uDeepColor;
 *         void surface(inout BrioSurface s) {
 *             float crest = 0.5 + 0.5 * sin(s.worldPosition.x * 2.0 + TIME * 1.5);
 *             s.baseColor = mix(uDeepColor, s.baseColor, crest);
 *             s.roughness = 0.1;
 *         }`,
 * });
 * game.preload(() => [
 *     water,
 *     new BrioMaterial("mat_water", {
 *         shading: "standard",
 *         color: "#5fb3d9",
 *         shader: "shd_water",
 *         parameters: { uWaveHeight: 0.15, uDeepColor: "#0b3c5d" },
 *     }),
 * ]);
 * ```
 */
export class BrioShader {
    readonly #name: string;
    readonly #id: number = nextShaderId++;
    readonly #url?: string;
    readonly #maxLength: number;
    #fragment?: string;
    #vertex?: string;
    #version: number = 0;
    #loaded: boolean;

    /**
     * Creates a new `BrioShader`.
     *
     * @param name Unique asset name (materials reference it through `shader`)
     * @param options Inline hooks or a `url`
     * @throws {Error} When an inline hook exceeds `maxLength` or uses a reserved `brio_` name
     */
    constructor(name: string, options: BrioShaderOptions = {}) {
        this.#name = name;
        this.#url = options.url;
        this.#maxLength = Math.max(1, options.maxLength ?? 65536);
        this.#fragment = options.fragment !== undefined ? this.#check(options.fragment) : undefined;
        this.#vertex = options.vertex !== undefined ? this.#check(options.vertex) : undefined;
        this.#loaded = options.url === undefined;
    }

    /** Unique asset name. */
    public get name(): string {
        return this.#name;
    }

    /** Process-unique numeric id (part of the program cache key). */
    public get id(): number {
        return this.#id;
    }

    /** Incremented on every source change; backends recompile when it differs from what they built. */
    public get version(): number {
        return this.#version;
    }

    /** Whether the source is available (inline, or `load()` finished). */
    public get isLoaded(): boolean {
        return this.#loaded;
    }

    /** URL of the `.glsl` file, if the shader is loaded from one. */
    public get url(): string | undefined {
        return this.#url;
    }

    /**
     * Fragment hook source (`surface()`); assigning it recompiles the shader on the next draw (hot reload).
     *
     * @throws {Error} When the source exceeds `maxLength` or uses a reserved `brio_` name
     */
    public get fragment(): string | undefined {
        return this.#fragment;
    }
    public set fragment(source: string | undefined) {
        this.#fragment = source !== undefined ? this.#check(source) : undefined;
        this.#version++;
    }

    /**
     * Vertex hook source (`vertex()`); assigning it recompiles the shader on the next draw.
     *
     * @throws {Error} When the source exceeds `maxLength` or uses a reserved `brio_` name
     */
    public get vertex(): string | undefined {
        return this.#vertex;
    }
    public set vertex(source: string | undefined) {
        this.#vertex = source !== undefined ? this.#check(source) : undefined;
        this.#version++;
    }

    /**
     * Fetches the `.glsl` file given as `url` (called by `preload()`); resolves at once for inline shaders.
     *
     * @returns This shader
     * @throws {Error} When the file cannot be fetched or breaks the source rules
     */
    public async load(): Promise<this> {
        if (this.#url === undefined || this.#loaded) return this;
        const response = await fetch(this.#url);
        if (!response.ok) {
            throw new Error(`Failed to load the shader '${this.#name}': HTTP ${response.status}.`);
        }
        const text = await response.text();
        const split = text.split(VERTEX_MARKER);
        this.#fragment = this.#check(split[0]);
        this.#vertex = split.length > 1 ? this.#check(split.slice(1).join("\n")) : undefined;
        this.#loaded = true;
        this.#version++;
        return this;
    }

    #check(source: string): string {
        if (source.length > this.#maxLength) {
            throw new Error(
                `Shader '${this.#name}' is ${source.length} characters long (limit ${this.#maxLength}).`,
            );
        }
        const reserved = RESERVED_PREFIX.exec(source);
        if (reserved) {
            throw new Error(`Shader '${this.#name}' uses the reserved name '${reserved[0]}'.`);
        }
        return source;
    }
}
