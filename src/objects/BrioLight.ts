import { BrioVec3, Vec3, Vector3 } from "../math/index";
import { CSSColor } from "../tools/base_types";

/**
 * Light source models supported by `BrioLight`.
 * - `"directional"`: parallel rays (sun) travelling along `direction`, with Lambert falloff;
 * - `"ambient"`: uniform light added to every surface;
 * - `"hemisphere"`: sky `color` from above blended into `groundColor` from below by the surface normal.
 */
export type BrioLightType = "directional" | "ambient" | "hemisphere";

/**
 * Configuration options for creating a `BrioLight`.
 */
export interface BrioLightOptions {
    /** Light color (sky color for `"hemisphere"`), defaults to `"#ffffff"`. */
    color?: CSSColor;
    /** Ground color of a `"hemisphere"` light (defaults to `"#444444"`). */
    groundColor?: CSSColor;
    /** Linear intensity multiplier (defaults to `1`). */
    intensity?: number;
    /** Direction the rays of a `"directional"` light travel (defaults to straight down-forward `{ x: -0.4, y: -0.8, z: -0.44 }`). */
    direction?: Vec3;
    /** Whether the light contributes to the scene (defaults to `true`). */
    enabled?: boolean;
}

/**
 * Light source (`BrioLight`) registered in a `BrioGame` or `BrioScene` (`game.addLight()`, `scene.addLight()`,
 * or returned from `load()`), consumed by every 3D pass of that content through `RenderBackend.setLights()`.
 * Content without lights is rendered with the default environment (`BrioLight.createDefaultRig()`).
 *
 * Colors are CSS (sRGB) and converted to linear light; lighting runs in linear space on GPU backends and is
 * approximated per triangle (luminance) by the Canvas2D software rasterizer.
 *
 * @example
 * ```ts
 * const sun = new BrioLight("light_sun", "directional", { direction: { x: -1, y: -2, z: -1 }, intensity: 1.2 });
 * const sky = new BrioLight("light_sky", "hemisphere", { color: "#bcd7ff", groundColor: "#3b3226", intensity: 0.6 });
 * game.addLight(sun).addLight(sky);
 * ```
 */
export class BrioLight {
    readonly #name: string;
    readonly #type: BrioLightType;
    readonly #direction: BrioVec3;
    #color: CSSColor;
    #groundColor: CSSColor;
    #intensity: number;
    #enabled: boolean;
    #version: number = 0;

    /**
     * Creates a new `BrioLight`.
     *
     * @param name Unique light identifier
     * @param type Light model (`"directional"`, `"ambient"`, or `"hemisphere"`)
     * @param options Optional color, intensity, direction, and enabled state
     */
    constructor(name: string, type: BrioLightType, options: BrioLightOptions = {}) {
        this.#name = name;
        this.#type = type;
        this.#color = options.color ?? "#ffffff";
        this.#groundColor = options.groundColor ?? "#444444";
        this.#intensity = Math.max(0, options.intensity ?? 1);
        this.#enabled = options.enabled ?? true;
        const d = options.direction ?? { x: -0.4, y: -0.8, z: -0.44 };
        this.#direction = new BrioVec3(d.x, d.y, d.z, () => {
            this.#version++;
        });
    }

    /** Unique identifier of the light. */
    public get name(): string {
        return this.#name;
    }

    /** Light model. */
    public get type(): BrioLightType {
        return this.#type;
    }

    /** Light color (sky color for `"hemisphere"`). */
    public get color(): CSSColor {
        return this.#color;
    }
    public set color(value: CSSColor) {
        this.#color = value;
        this.#version++;
    }

    /** Ground color of a `"hemisphere"` light. */
    public get groundColor(): CSSColor {
        return this.#groundColor;
    }
    public set groundColor(value: CSSColor) {
        this.#groundColor = value;
        this.#version++;
    }

    /** Linear intensity multiplier (`>= 0`). */
    public get intensity(): number {
        return this.#intensity;
    }
    public set intensity(value: number) {
        this.#intensity = Math.max(0, Number.isFinite(value) ? value : 0);
        this.#version++;
    }

    /** Whether the light contributes to the scene. */
    public get enabled(): boolean {
        return this.#enabled;
    }
    public set enabled(value: boolean) {
        this.#enabled = value;
        this.#version++;
    }

    /** Direction the rays of a `"directional"` light travel (need not be normalized). */
    public get direction(): Vec3 {
        return this.#direction;
    }
    public set direction(value: Vec3) {
        this.#direction.set(value.x, value.y, value.z);
    }

    /**
     * Points a `"directional"` light from `from` toward `to`.
     *
     * @param from Light position
     * @param to Target point
     */
    public pointAt(from: Vec3, to: Vec3): void {
        this.#direction.set(to.x - from.x, to.y - from.y, to.z - from.z);
    }

    /** Counter incremented on every change, so backends can skip re-uploading unchanged lights. */
    public get version(): number {
        return this.#version;
    }

    /**
     * Creates the rig used when content has no lights: a hemisphere ambient plus one warm sun, matching the
     * engine's historic constant lighting.
     *
     * @returns New hemisphere and directional lights
     */
    public static createDefaultRig(): BrioLight[] {
        return [
            new BrioLight("light_brio_default_sky", "hemisphere", {
                color: "#c5c8ce",
                groundColor: "#8b8986",
                intensity: 1,
            }),
            new BrioLight("light_brio_default_sun", "directional", {
                color: "#e5e3de",
                intensity: 1,
                direction: Vector3.create(-0.4, -0.8, -0.44),
            }),
        ];
    }
}
