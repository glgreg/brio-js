import { clamp } from "../math/BrioMath";
import { CSSColor } from "../tools/base_types";
import { BrioTexture } from "./BrioTexture";

/**
 * Shading model applied when rendering a `BrioMaterial`:
 * - `"unlit"`: Constant surface color without lighting calculation.
 * - `"flat"`: Per-triangle directional diffuse shading.
 * - `"lambert"`: Smooth per-vertex Lambertian diffuse shading.
 * - `"standard"`: Physically based metallic-roughness shading (GGX specular highlights, Fresnel and reflections of
 *   the hemisphere sky), configured by `roughness` and `metalness` like glTF materials.
 */
export type MaterialShadingMode = "unlit" | "flat" | "lambert" | "standard";

/**
 * Configuration options for creating a `BrioMaterial`.
 */
export interface BrioMaterialOptions {
    /** Base surface color (defaults to `"#ffffff"`). */
    color?: CSSColor;
    /** Shading model (defaults to `"lambert"`). */
    shading?: MaterialShadingMode;
    /** Surface opacity in `[0, 1]` (defaults to `1`). */
    opacity?: number;
    /** Whether to render triangle edges as wireframe (defaults to `false`). */
    wireframe?: boolean;
    /** Optional diffuse `BrioTexture`, multiplied by `color` (sRGB-encoded, like glTF `baseColorTexture`). */
    texture?: BrioTexture;
    /** Renders both faces of every triangle instead of culling back faces (defaults to `false`). */
    doubleSided?: boolean;
    /**
     * Alpha-test threshold in `[0, 1]`: fragments whose alpha falls below it are discarded
     * (glTF `alphaMode: "MASK"`). `0` disables the test (defaults to `0`).
     */
    alphaCutoff?: number;
    /** Microsurface roughness of `"standard"` shading in `[0, 1]`: `0` mirror-like, `1` matte (defaults to `0.5`). */
    roughness?: number;
    /** Metalness of `"standard"` shading in `[0, 1]`: `1` tints reflections with `color` (defaults to `0`). */
    metalness?: number;
    /** Light emitted by the surface, added after lighting (defaults to `"#000000"`, none). */
    emissive?: CSSColor;
    /** Multiplier of `emissive` (defaults to `1`); values above `1` glow brighter with tone mapping. */
    emissiveIntensity?: number;
}

/**
 * Defines the surface appearance (`BrioMaterial`) of a 3D `BrioMesh`, specifying base `color`,
 * `shading` mode (`"unlit"`, `"flat"`, `"lambert"`), `opacity`, `wireframe`, optional `texture`,
 * face culling (`doubleSided`), and alpha testing (`alphaCutoff`).
 *
 * @example
 * ```ts
 * const mat = new BrioMaterial("mat_gold", {
 *     color: "#ffcc00",
 *     shading: "lambert",
 *     opacity: 1,
 * });
 * ```
 */
export class BrioMaterial {
    readonly #name: string;
    public color: CSSColor;
    public shading: MaterialShadingMode;
    public wireframe: boolean;
    public texture?: BrioTexture;
    public doubleSided: boolean;
    #opacity: number;
    #alphaCutoff: number;
    #roughness: number;
    #metalness: number;
    /** Light emitted by the surface (`"#000000"` for none). */
    public emissive: CSSColor;
    /** Multiplier of `emissive`. */
    public emissiveIntensity: number;

    /**
     * Creates a new `BrioMaterial`.
     *
     * @param name Unique material identifier
     * @param options Optional appearance settings
     */
    constructor(name: string, options: BrioMaterialOptions = {}) {
        this.#name = name;
        this.color = options.color ?? "#ffffff";
        this.shading = options.shading ?? "lambert";
        this.wireframe = options.wireframe ?? false;
        this.texture = options.texture;
        this.doubleSided = options.doubleSided ?? false;
        this.#opacity = clamp(options.opacity ?? 1, 0, 1);
        this.#alphaCutoff = clamp(options.alphaCutoff ?? 0, 0, 1);
        this.#roughness = clamp(options.roughness ?? 0.5, 0, 1);
        this.#metalness = clamp(options.metalness ?? 0, 0, 1);
        this.emissive = options.emissive ?? "#000000";
        this.emissiveIntensity = Math.max(0, options.emissiveIntensity ?? 1);
    }

    /**
     * Microsurface roughness of `"standard"` shading in `[0, 1]` (`0` sharp reflections, `1` matte).
     *
     * @example
     * ```ts
     * const chrome = new BrioMaterial("mat_chrome", { shading: "standard", metalness: 1, roughness: 0.15 });
     * ```
     */
    public get roughness(): number {
        return this.#roughness;
    }
    public set roughness(value: number) {
        this.#roughness = clamp(value, 0, 1);
    }

    /** Metalness of `"standard"` shading in `[0, 1]`. */
    public get metalness(): number {
        return this.#metalness;
    }
    public set metalness(value: number) {
        this.#metalness = clamp(value, 0, 1);
    }

    /** Unique identifier of the material. */
    public get name(): string {
        return this.#name;
    }

    /** Surface opacity clamped to `[0, 1]`. */
    public get opacity(): number {
        return this.#opacity;
    }
    public set opacity(value: number) {
        this.#opacity = clamp(value, 0, 1);
    }

    /** Alpha-test threshold clamped to `[0, 1]` (`0` = disabled). */
    public get alphaCutoff(): number {
        return this.#alphaCutoff;
    }
    public set alphaCutoff(value: number) {
        this.#alphaCutoff = clamp(value, 0, 1);
    }
}
