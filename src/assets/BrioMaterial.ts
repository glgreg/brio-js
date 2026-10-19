import { clamp } from "../math/BrioMath";
import { CSSColor } from "../tools/base_types";
import { BrioTexture } from "./BrioTexture";

/**
 * Shading model applied when rendering a `BrioMaterial`:
 * - `"unlit"`: Constant surface color without lighting calculation.
 * - `"flat"`: Per-triangle directional diffuse shading.
 * - `"lambert"`: Smooth per-vertex Lambertian diffuse shading.
 */
export type MaterialShadingMode = "unlit" | "flat" | "lambert";

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
    /** Optional diffuse `BrioTexture`. */
    texture?: BrioTexture;
}

/**
 * Defines the surface appearance (`BrioMaterial`) of a 3D `BrioMesh`, specifying base `color`,
 * `shading` mode (`"unlit"`, `"flat"`, `"lambert"`), `opacity`, `wireframe`, and optional `texture`.
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
    #opacity: number;

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
        this.#opacity = clamp(options.opacity ?? 1, 0, 1);
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
}
