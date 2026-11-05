import { BrioLight } from "../objects/BrioLight";
import { parseCanvasColor, srgbToLinear } from "./color";

/** Maximum directional lights evaluated per pass (extra lights are ignored). */
export const MAX_DIRECTIONAL_LIGHTS = 4;

/** Maximum point and spot lights evaluated per pass (extra lights are ignored); fixed so shaders never recompile. */
export const MAX_PUNCTUAL_LIGHTS = 8;

/** `punctualColors[i * 4 + 3]` value of a point light. */
export const PUNCTUAL_POINT = 1;
/** `punctualColors[i * 4 + 3]` value of a spot light. */
export const PUNCTUAL_SPOT = 2;

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
    /** Number of active point and spot lights (`<= MAX_PUNCTUAL_LIGHTS`). */
    punctualCount: number;
    /** World position and range of each punctual light (`xyz`, range or `0` for no cutoff). */
    readonly punctualPositions: Float32Array;
    /** Intensity times linear color of each punctual light (`rgb`), and its kind (`PUNCTUAL_POINT` / `_SPOT`). */
    readonly punctualColors: Float32Array;
    /** Normalized spot direction (`xyz`, where the spot points) and cosine of the outer cone angle. */
    readonly punctualDirections: Float32Array;
    /** Cosine of the inner cone angle (full intensity inside it) and the distance decay exponent. */
    readonly punctualCones: Float32Array;
    /**
     * Changes whenever the values change (unique across environments), so backends can skip redundant uploads.
     * Replaces the string `key` of BrioJS 0.2, which allocated on every pass.
     */
    version: number;
    /** Lights the values were built from, with their versions (so an unchanged list skips the rebuild). */
    readonly sources: BrioLight[];
    readonly sourceVersions: number[];
}

/** Monotonic counter shared by every environment, so two environments never report the same version. */
let nextEnvironmentVersion = 1;

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
        punctualCount: 0,
        punctualPositions: new Float32Array(MAX_PUNCTUAL_LIGHTS * 4),
        punctualColors: new Float32Array(MAX_PUNCTUAL_LIGHTS * 4),
        punctualDirections: new Float32Array(MAX_PUNCTUAL_LIGHTS * 4),
        punctualCones: new Float32Array(MAX_PUNCTUAL_LIGHTS * 4),
        version: 0,
        sources: [],
        sourceVersions: [],
    };
}

const colorCache = new Map<string, [number, number, number]>();

/** Linear RGB of a CSS hex / `rgb()` color (white when it cannot be parsed). */
function linearRgb(color: string): [number, number, number] {
    let cached = colorCache.get(color);
    if (!cached) {
        const rgba = parseCanvasColor(color.trim()) ?? [255, 255, 255, 1];
        cached = [
            srgbToLinear(rgba[0] / 255),
            srgbToLinear(rgba[1] / 255),
            srgbToLinear(rgba[2] / 255),
        ];
        if (colorCache.size > 256) colorCache.clear();
        colorCache.set(color, cached);
    }
    return cached;
}

function addScaled(
    out: Float32Array,
    offset: number,
    rgb: [number, number, number],
    k: number,
): void {
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
    // Same lights with the same versions: nothing to rebuild (the common case, every frame) (D-04)
    const sources = out.sources;
    const versions = out.sourceVersions;
    if (out.version !== 0 && sources.length === lights.length) {
        let same = true;
        for (let i = 0; i < lights.length; i++) {
            if (sources[i] !== lights[i] || versions[i] !== lights[i].version) {
                same = false;
                break;
            }
        }
        if (same) return out;
    }
    sources.length = lights.length;
    versions.length = lights.length;
    for (let i = 0; i < lights.length; i++) {
        sources[i] = lights[i];
        versions[i] = lights[i].version;
    }

    out.ambient.fill(0);
    out.sky.fill(0);
    out.ground.fill(0);
    out.directions.fill(0);
    out.colors.fill(0);
    out.directionalCount = 0;
    out.punctualPositions.fill(0);
    out.punctualColors.fill(0);
    out.punctualDirections.fill(0);
    out.punctualCones.fill(0);
    out.punctualCount = 0;

    for (let i = 0; i < lights.length; i++) {
        const light = lights[i];
        if (!light.enabled || light.intensity <= 0) continue;
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
            case "point":
            case "spot": {
                if (out.punctualCount >= MAX_PUNCTUAL_LIGHTS) break;
                const o = out.punctualCount * 4;
                const p = light.position;
                out.punctualPositions[o] = p.x;
                out.punctualPositions[o + 1] = p.y;
                out.punctualPositions[o + 2] = p.z;
                out.punctualPositions[o + 3] = light.range;
                addScaled(out.punctualColors, o, linearRgb(light.color), light.intensity);
                out.punctualColors[o + 3] = light.type === "spot" ? PUNCTUAL_SPOT : PUNCTUAL_POINT;
                const d = light.direction;
                const len = Math.hypot(d.x, d.y, d.z) || 1;
                out.punctualDirections[o] = d.x / len;
                out.punctualDirections[o + 1] = d.y / len;
                out.punctualDirections[o + 2] = d.z / len;
                // Points use a cone that covers every direction
                const outer = light.type === "spot" ? light.angle : Math.PI;
                const inner = outer * (1 - light.penumbra);
                out.punctualDirections[o + 3] = Math.cos(outer);
                out.punctualCones[o] = Math.cos(inner);
                out.punctualCones[o + 1] = light.decay;
                out.punctualCount++;
                break;
            }
        }
    }
    out.version = nextEnvironmentVersion++;
    return out;
}

/**
 * Distance and cone attenuation of punctual light `i` at a point `dist` away along the unit vector `(lx, ly, lz)`
 * from the surface toward the light: `1 / dist^decay`, smoothly windowed to zero at `range`
 * (`KHR_lights_punctual`), times the smooth spot cone factor.
 *
 * @param env Lighting environment
 * @param i Punctual light index
 * @param dist Distance from the surface to the light
 * @param lx Unit direction toward the light, X
 * @param ly Unit direction toward the light, Y
 * @param lz Unit direction toward the light, Z
 * @returns Attenuation factor
 */
export function punctualAttenuation(
    env: LightingEnvironment,
    i: number,
    dist: number,
    lx: number,
    ly: number,
    lz: number,
): number {
    const o = i * 4;
    const range = env.punctualPositions[o + 3];
    const decay = env.punctualCones[o + 1];
    let attenuation = 1 / Math.max(Math.pow(dist, decay), 1e-4);
    if (range > 0) {
        const ratio = dist / range;
        const window = Math.min(Math.max(1 - ratio * ratio * ratio * ratio, 0), 1);
        attenuation *= window * window;
    }
    if (env.punctualColors[o + 3] === PUNCTUAL_SPOT) {
        const cosOuter = env.punctualDirections[o + 3];
        const cosInner = env.punctualCones[o];
        // Angle between the spot axis and the ray from the light to the surface
        const cosAngle = -(
            lx * env.punctualDirections[o] +
            ly * env.punctualDirections[o + 1] +
            lz * env.punctualDirections[o + 2]
        );
        const t = Math.min(
            Math.max((cosAngle - cosOuter) / Math.max(cosInner - cosOuter, 1e-4), 0),
            1,
        );
        attenuation *= t * t;
    }
    return attenuation;
}

/**
 * Linear irradiance luminance reaching a surface with unit normal `(nx, ny, nz)` at world point `(px, py, pz)`.
 * Used by the Canvas2D rasterizer, which can only darken a base color by a scalar. Point and spot lights are only
 * evaluated when the position is given.
 *
 * @param env Lighting environment
 * @param nx Normal X
 * @param ny Normal Y
 * @param nz Normal Z
 * @param px World position X (optional)
 * @param py World position Y
 * @param pz World position Z
 * @returns Linear luminance (may exceed `1`)
 */
export function irradianceLuminance(
    env: LightingEnvironment,
    nx: number,
    ny: number,
    nz: number,
    px?: number,
    py: number = 0,
    pz: number = 0,
): number {
    const h = ny * 0.5 + 0.5;
    let r = env.ambient[0] + env.ground[0] + (env.sky[0] - env.ground[0]) * h;
    let g = env.ambient[1] + env.ground[1] + (env.sky[1] - env.ground[1]) * h;
    let b = env.ambient[2] + env.ground[2] + (env.sky[2] - env.ground[2]) * h;
    for (let i = 0; i < env.directionalCount; i++) {
        const o = i * 3;
        const lambert =
            nx * env.directions[o] + ny * env.directions[o + 1] + nz * env.directions[o + 2];
        if (lambert <= 0) continue;
        r += env.colors[o] * lambert;
        g += env.colors[o + 1] * lambert;
        b += env.colors[o + 2] * lambert;
    }
    if (px !== undefined) {
        for (let i = 0; i < env.punctualCount; i++) {
            const o = i * 4;
            let lx = env.punctualPositions[o] - px;
            let ly = env.punctualPositions[o + 1] - py;
            let lz = env.punctualPositions[o + 2] - pz;
            const dist = Math.hypot(lx, ly, lz) || 1e-4;
            lx /= dist;
            ly /= dist;
            lz /= dist;
            const lambert = nx * lx + ny * ly + nz * lz;
            if (lambert <= 0) continue;
            const k = lambert * punctualAttenuation(env, i, dist, lx, ly, lz);
            r += env.punctualColors[o] * k;
            g += env.punctualColors[o + 1] * k;
            b += env.punctualColors[o + 2] * k;
        }
    }
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
