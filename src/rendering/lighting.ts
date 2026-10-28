import { BrioLight } from "../objects/BrioLight";
import { parseCanvasColor, srgbToLinear } from "./color";

/** Maximum directional lights evaluated per pass (extra lights are ignored). */
export const MAX_DIRECTIONAL_LIGHTS = 4;

/**
 * Lights of one pass reduced to the values shaders consume, in linear light. Built by `BrioCompositor`
 * from the `BrioLight` list of each source and handed to `RenderBackend.setLights()`.
 */
export interface LightingEnvironment {
    /** Sum of `"ambient"` lights, linear RGB. */
    readonly ambient: Float32Array;
    /** Sum of `"hemisphere"` sky colors, linear RGB. */
    readonly sky: Float32Array;
    /** Sum of `"hemisphere"` ground colors, linear RGB. */
    readonly ground: Float32Array;
    /** Number of active directional lights (`<= MAX_DIRECTIONAL_LIGHTS`). */
    directionalCount: number;
    /** Normalized directions **toward** each light (`xyz` per light). */
    readonly directions: Float32Array;
    /** Radiance of each directional light, linear RGB (`rgb` per light). */
    readonly colors: Float32Array;
    /** Changes whenever the values change, so backends can skip redundant uploads. */
    key: string;
}

/**
 * Creates an empty (black) lighting environment.
 *
 * @returns A zeroed `LightingEnvironment`
 */
export function createLightingEnvironment(): LightingEnvironment {
    return {
        ambient: new Float32Array(3),
        sky: new Float32Array(3),
        ground: new Float32Array(3),
        directionalCount: 0,
        directions: new Float32Array(MAX_DIRECTIONAL_LIGHTS * 3),
        colors: new Float32Array(MAX_DIRECTIONAL_LIGHTS * 3),
        key: "",
    };
}

const colorCache = new Map<string, [number, number, number]>();

/** Linear RGB of a CSS hex / `rgb()` color (white when it cannot be parsed). */
function linearRgb(color: string): [number, number, number] {
    let cached = colorCache.get(color);
    if (!cached) {
        const rgba = parseCanvasColor(color.trim()) ?? [255, 255, 255, 1];
        cached = [srgbToLinear(rgba[0] / 255), srgbToLinear(rgba[1] / 255), srgbToLinear(rgba[2] / 255)];
        if (colorCache.size > 256) colorCache.clear();
        colorCache.set(color, cached);
    }
    return cached;
}

function addScaled(out: Float32Array, offset: number, rgb: [number, number, number], k: number): void {
    out[offset] += rgb[0] * k;
    out[offset + 1] += rgb[1] * k;
    out[offset + 2] += rgb[2] * k;
}

/**
 * Reduces `lights` into `out` (enabled lights only; at most `MAX_DIRECTIONAL_LIGHTS` directional lights).
 *
 * @param lights Lights of the pass
 * @param out Environment to overwrite
 * @returns `out`
 */
export function buildLightingEnvironment(
    lights: readonly BrioLight[],
    out: LightingEnvironment,
): LightingEnvironment {
    out.ambient.fill(0);
    out.sky.fill(0);
    out.ground.fill(0);
    out.directions.fill(0);
    out.colors.fill(0);
    out.directionalCount = 0;
    let key = "";

    for (let i = 0; i < lights.length; i++) {
        const light = lights[i];
        if (!light.enabled || light.intensity <= 0) continue;
        key += `${light.name}:${light.version}:${light.type}:${light.color}:${light.groundColor}:${light.intensity}:${light.direction.x},${light.direction.y},${light.direction.z};`;
        switch (light.type) {
            case "ambient":
                addScaled(out.ambient, 0, linearRgb(light.color), light.intensity);
                break;
            case "hemisphere":
                addScaled(out.sky, 0, linearRgb(light.color), light.intensity);
                addScaled(out.ground, 0, linearRgb(light.groundColor), light.intensity);
                break;
            case "directional": {
                if (out.directionalCount >= MAX_DIRECTIONAL_LIGHTS) break;
                const d = light.direction;
                const len = Math.hypot(d.x, d.y, d.z);
                if (len === 0) break;
                const o = out.directionalCount * 3;
                // Shaders use the direction toward the light (opposite to the rays)
                out.directions[o] = -d.x / len;
                out.directions[o + 1] = -d.y / len;
                out.directions[o + 2] = -d.z / len;
                addScaled(out.colors, o, linearRgb(light.color), light.intensity);
                out.directionalCount++;
                break;
            }
        }
    }
    out.key = key;
    return out;
}

/**
 * Linear irradiance luminance reaching a surface with unit normal `(nx, ny, nz)`.
 * Used by the Canvas2D rasterizer, which can only darken a base color by a scalar.
 *
 * @param env Lighting environment
 * @param nx Normal X
 * @param ny Normal Y
 * @param nz Normal Z
 * @returns Linear luminance (may exceed `1`)
 */
export function irradianceLuminance(env: LightingEnvironment, nx: number, ny: number, nz: number): number {
    const h = ny * 0.5 + 0.5;
    let r = env.ambient[0] + env.ground[0] + (env.sky[0] - env.ground[0]) * h;
    let g = env.ambient[1] + env.ground[1] + (env.sky[1] - env.ground[1]) * h;
    let b = env.ambient[2] + env.ground[2] + (env.sky[2] - env.ground[2]) * h;
    for (let i = 0; i < env.directionalCount; i++) {
        const o = i * 3;
        const lambert = nx * env.directions[o] + ny * env.directions[o + 1] + nz * env.directions[o + 2];
        if (lambert <= 0) continue;
        r += env.colors[o] * lambert;
        g += env.colors[o + 1] * lambert;
        b += env.colors[o + 2] * lambert;
    }
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
