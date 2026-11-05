import { BrioVec3, Vec3, Vector3 } from "../math/index";
import { CSSColor } from "../tools/base_types";

/**
 * Light source models supported by `BrioLight`.
 * - `"directional"`: parallel rays (sun) travelling along `direction`, with Lambert falloff;
 * - `"ambient"`: uniform light added to every surface;
 * - `"hemisphere"`: sky `color` from above blended into `groundColor` from below by the surface normal;
 * - `"point"`: a bulb at `position` lighting every direction, fading with distance (`decay`, `range`);
 * - `"spot"`: a cone of light from `position` along `direction`, `angle` wide, with a soft edge (`penumbra`).
 */
export type BrioLightType = "directional" | "ambient" | "hemisphere" | "point" | "spot";

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
    /**
     * Direction the rays of a `"directional"` light travel, or where a `"spot"` points (defaults to down-forward
     * `{ x: -0.4, y: -0.8, z: -0.44 }`; straight down for spots).
     */
    direction?: Vec3;
    /** World position of a `"point"` or `"spot"` light (defaults to `{ x: 0, y: 3, z: 0 }`). */
    position?: Vec3;
    /**
     * Distance where a `"point"` or `"spot"` light fades out completely (defaults to `0`: no cutoff, the light only
     * decays). Lights with a range also cost nothing for surfaces beyond it.
     */
    range?: number;
    /** Exponent of the distance falloff `1 / distance^decay` (defaults to `2`, physically based). */
    decay?: number;
    /** Half-angle of a `"spot"` cone in radians (defaults to `Math.PI / 6`, clamped to `(0, PI / 2]`). */
    angle?: number;
    /** Soft edge of a `"spot"` cone, from `0` (hard) to `1` (fades from the center), defaults to `0.2`. */
    penumbra?: number;
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
 *
 * // A lantern and a stage spot (up to 8 point and spot lights per pass)
 * const lantern = new BrioLight("light_lantern", "point", { position: { x: 2, y: 1.5, z: 0 }, color: "#ffb35c", intensity: 6, range: 8 });
 * const stage = new BrioLight("light_stage", "spot", { position: { x: 0, y: 5, z: 0 }, angle: 0.4, penumbra: 0.3, intensity: 30 });
 * ```
 */
export class BrioLight {
    readonly #name: string;
    readonly #type: BrioLightType;
    readonly #direction: BrioVec3;
    readonly #position: BrioVec3;
    #range: number;
    #decay: number;
    #angle: number;
    #penumbra: number;
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
        const d =
            options.direction ??
            (type === "spot" ? { x: 0, y: -1, z: 0 } : { x: -0.4, y: -0.8, z: -0.44 });
        this.#direction = new BrioVec3(d.x, d.y, d.z, () => {
            this.#version++;
        });
        const p = options.position ?? { x: 0, y: 3, z: 0 };
        this.#position = new BrioVec3(p.x, p.y, p.z, () => {
            this.#version++;
        });
        this.#range = Math.max(0, options.range ?? 0);
        this.#decay = Math.max(0, options.decay ?? 2);
        this.#angle = Math.min(Math.max(options.angle ?? Math.PI / 6, 1e-3), Math.PI / 2);
        this.#penumbra = Math.min(Math.max(options.penumbra ?? 0.2, 0), 1);
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
    /**
     * World position of a `"point"` or `"spot"` light. Moving it (`light.position.x += 1`) updates the lighting.
     *
     * @example
     * ```ts
     * lamp.position.y = 2 + Math.sin(time) * 0.2; // a flickering lantern
     * ```
     */
    public get position(): Vec3 {
        return this.#position;
    }
    public set position(value: Vec3) {
        this.#position.set(value.x, value.y, value.z);
    }

    /** Distance where a point or spot light fades out completely (`0`: no cutoff). */
    public get range(): number {
        return this.#range;
    }
    public set range(value: number) {
        this.#range = Math.max(0, value);
        this.#version++;
    }

    /** Exponent of the distance falloff (`2` is physically based). */
    public get decay(): number {
        return this.#decay;
    }
    public set decay(value: number) {
        this.#decay = Math.max(0, value);
        this.#version++;
    }

    /** Half-angle of a spot cone in radians. */
    public get angle(): number {
        return this.#angle;
    }
    public set angle(value: number) {
        this.#angle = Math.min(Math.max(value, 1e-3), Math.PI / 2);
        this.#version++;
    }

    /** Soft edge of a spot cone (`0` hard, `1` fades from the center). */
    public get penumbra(): number {
        return this.#penumbra;
    }
    public set penumbra(value: number) {
        this.#penumbra = Math.min(Math.max(value, 0), 1);
        this.#version++;
    }

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
