import { BrioMaterial } from "../assets/BrioMaterial";
import { BrioMesh } from "../assets/BrioMesh";
import { BrioTexture } from "../assets/BrioTexture";
import { ViewportRect } from "../core/BrioViewport";
import { Mat4, Matrix4 } from "../math/index";
import { BrioLight } from "../objects/BrioLight";
import { parseCanvasColor, srgbToLinear } from "./color";
import {
    RenderBackend,
    RenderBackendType,
    RenderPassParameters,
    SHADOW_CAST,
    SHADOW_RECEIVE,
} from "./contracts/RenderBackend";
import { sortInPlace } from "../tools/sort";
import {
    buildLightingEnvironment,
    createLightingEnvironment,
    LightingEnvironment,
    MAX_DIRECTIONAL_LIGHTS,
    MAX_PUNCTUAL_LIGHTS,
} from "./lighting";

type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Uniform buffer binding point of the `BrioLights` block. */
const LIGHTS_BINDING = 0;
/** Uniform buffer binding point of the `BrioPass` block (camera position, fog, tone mapping, exposure). */
const PASS_BINDING = 1;
/** Offset of the punctual light arrays in `BrioLights` (after ambient, sky, ground, counts and directional lights). */
const PUNCTUAL_OFFSET = 16 + MAX_DIRECTIONAL_LIGHTS * 8;
/**
 * `BrioLights` std140 layout: ambient, sky, ground, counts (vec4 each), directional directions and colors (vec4 per
 * light), then punctual positions, colors, directions and cones (vec4 per light).
 */
const LIGHTS_FLOATS = PUNCTUAL_OFFSET + MAX_PUNCTUAL_LIGHTS * 16;
/** `BrioPass` std140 layout: camera position + exposure, fog color + mode, fog near / far / density + tone mapping. */
const PASS_FLOATS = 12;
/** `uFogParams.w` value of each tone mapping operator. */
const TONE_MAPPING_CODES: Readonly<Record<RenderPassParameters["toneMapping"], number>> = {
    none: 0,
    reinhard: 1,
    aces: 2,
    agx: 3,
    neutral: 4,
};
/** `gl.INVALID_INDEX`: returned by `getUniformBlockIndex` when a program does not use the block. */
const INVALID_INDEX = 0xffffffff;
/** Upper bound of anisotropic filtering samples requested for textures. */
const MAX_ANISOTROPY = 8;

/** Fixed attribute locations, so one VAO per mesh works with every program variant. */
const ATTR_POSITION = 0;
const ATTR_NORMAL = 1;
const ATTR_UV = 2;

/** Program variant feature bits (one compiled program per combination in use). */
const FEATURE_MAP = 1;
const FEATURE_LIT = 2;
const FEATURE_FLAT = 4;
const FEATURE_ALPHA_TEST = 8;
const FEATURE_STANDARD = 16;
const FEATURE_SHADOW = 32;

/**
 * GLSL sources of the program variant with feature bits `features` (`FEATURE_*`), shared by the program cache and
 * the offline shader validation test.
 *
 * @internal
 */
export function buildShaderSources(features: number): { vertex: string; fragment: string } {
    const defines: string[] = [];
    if (features & FEATURE_MAP) defines.push("#define USE_MAP");
    if (features & FEATURE_LIT) defines.push("#define USE_LIGHTING");
    if (features & FEATURE_FLAT) defines.push("#define FLAT_SHADED");
    if (features & FEATURE_ALPHA_TEST) defines.push("#define USE_ALPHA_TEST");
    if (features & FEATURE_STANDARD) defines.push("#define STANDARD_SHADING");
    if (features & FEATURE_SHADOW) defines.push("#define USE_SHADOW");
    return {
        vertex: VERTEX_SHADER,
        fragment: `#version 300 es\n${defines.join("\n")}\n${FRAGMENT_SHADER}`,
    };
}

/** Depth-only program of the shadow pass (positions transformed into the light's clip space). @internal */
export const SHADOW_DEPTH_SHADERS = {
    vertex: `#version 300 es
layout(location = 0) in vec3 aPosition;
uniform mat4 uLightViewProj;
uniform mat4 uWorld;
void main() {
    gl_Position = uLightViewProj * (uWorld * vec4(aPosition, 1.0));
}`,
    fragment: `#version 300 es
precision mediump float;
void main() {}`,
};

/** Every feature combination the backend can request (for validation tests). @internal */
export const SHADER_FEATURE_COMBINATIONS: readonly number[] = (() => {
    const out: number[] = [0];
    for (let f = 1; f < 64; f++) {
        // Flat shading, standard shading and shadows only exist on lit programs
        if (
            (f & (FEATURE_FLAT | FEATURE_STANDARD | FEATURE_SHADOW)) !== 0 &&
            (f & FEATURE_LIT) === 0
        )
            continue;
        out.push(f);
    }
    return out;
})();

const VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUv;
uniform mat4 uViewProj;
uniform mat4 uWorld;
uniform mat3 uNormalMatrix;
out vec3 vNormal;
out vec3 vWorldPosition;
out vec2 vUv;
void main() {
    vec4 worldPosition = uWorld * vec4(aPosition, 1.0);
    vWorldPosition = worldPosition.xyz;
    vNormal = uNormalMatrix * aNormal;
    vUv = aUv;
    gl_Position = uViewProj * worldPosition;
}`;

const FRAGMENT_SHADER = `
precision highp float;
in vec3 vNormal;
in vec3 vWorldPosition;
in vec2 vUv;
uniform vec4 uColor;
uniform sampler2D uMap;
uniform float uAlphaCutoff;
uniform vec3 uEmissive;
uniform vec2 uRoughnessMetalness;
#ifdef USE_SHADOW
uniform highp sampler2DShadow uShadowMap;
uniform mat4 uShadowMatrix;
// x: depth bias, y: normal bias (world units), z: texel size, w: index of the shadow-casting directional light
uniform vec4 uShadowParams;
uniform float uShadowStrength;
#endif
layout(std140) uniform BrioPass {
    vec4 uCameraPosition;
    vec4 uFogColor;
    vec4 uFogParams;
};
#ifdef USE_LIGHTING
layout(std140) uniform BrioLights {
    vec4 uAmbient;
    vec4 uSkyColor;
    vec4 uGroundColor;
    vec4 uLightCount;
    vec4 uDirLightDirection[${MAX_DIRECTIONAL_LIGHTS}];
    vec4 uDirLightColor[${MAX_DIRECTIONAL_LIGHTS}];
    vec4 uPunctualPosition[${MAX_PUNCTUAL_LIGHTS}];
    vec4 uPunctualColor[${MAX_PUNCTUAL_LIGHTS}];
    vec4 uPunctualDirection[${MAX_PUNCTUAL_LIGHTS}];
    vec4 uPunctualCone[${MAX_PUNCTUAL_LIGHTS}];
};
#endif
out vec4 fragColor;

const float PI = 3.141592653589793;

vec3 linearToSrgb(vec3 c) {
    return mix(pow(c, vec3(0.41666)) * 1.055 - vec3(0.055), c * 12.92, vec3(lessThanEqual(c, vec3(0.0031308))));
}

#ifdef USE_LIGHTING
// Distance falloff 1 / d^decay, windowed to zero at the range (KHR_lights_punctual), times the spot cone
float punctualAttenuation(int i, float dist, vec3 toLight) {
    float range = uPunctualPosition[i].w;
    float attenuation = 1.0 / max(pow(dist, uPunctualCone[i].y), 1e-4);
    if (range > 0.0) {
        float ratio = dist / range;
        float window = clamp(1.0 - ratio * ratio * ratio * ratio, 0.0, 1.0);
        attenuation *= window * window;
    }
    if (uPunctualColor[i].w > 1.5) {
        float cosAngle = dot(-toLight, uPunctualDirection[i].xyz);
        float cosOuter = uPunctualDirection[i].w;
        float t = clamp((cosAngle - cosOuter) / max(uPunctualCone[i].x - cosOuter, 1e-4), 0.0, 1.0);
        attenuation *= t * t;
    }
    return attenuation;
}

#ifdef STANDARD_SHADING
float distributionGGX(float NoH, float alpha) {
    float a2 = alpha * alpha;
    float d = NoH * NoH * (a2 - 1.0) + 1.0;
    return a2 / (PI * d * d);
}

float visibilitySmithGGXCorrelated(float NoV, float NoL, float alpha) {
    float a2 = alpha * alpha;
    float gv = NoL * sqrt(NoV * NoV * (1.0 - a2) + a2);
    float gl = NoV * sqrt(NoL * NoL * (1.0 - a2) + a2);
    return 0.5 / max(gv + gl, 1e-5);
}

vec3 fresnelSchlick(vec3 f0, float VoH) {
    return f0 + (1.0 - f0) * pow(1.0 - VoH, 5.0);
}

// Light of one source with radiance \`radiance\` from direction \`L\`: Lambert diffuse plus GGX specular. Light
// intensities keep the Lambert convention of the other shading models (intensity 1 lights a white surface fully),
// so both terms are scaled by PI.
vec3 shadeStandard(vec3 N, vec3 V, vec3 L, vec3 radiance, vec3 diffuseColor, vec3 f0, float alpha) {
    float NoL = max(dot(N, L), 0.0);
    if (NoL <= 0.0) return vec3(0.0);
    vec3 H = normalize(L + V);
    float NoV = max(dot(N, V), 1e-4);
    float NoH = max(dot(N, H), 0.0);
    float VoH = max(dot(V, H), 0.0);
    vec3 F = fresnelSchlick(f0, VoH);
    vec3 specular = F * (distributionGGX(NoH, alpha) * visibilitySmithGGXCorrelated(NoV, NoL, alpha) * PI);
    return radiance * NoL * ((1.0 - F) * diffuseColor + specular);
}

// Split-sum environment BRDF approximation (Karis, "Physically Based Shading on Mobile")
vec3 environmentBRDF(vec3 f0, float roughness, float NoV) {
    const vec4 c0 = vec4(-1.0, -0.0275, -0.572, 0.022);
    const vec4 c1 = vec4(1.0, 0.0425, 1.04, -0.04);
    vec4 r = roughness * c0 + c1;
    float a004 = min(r.x * r.x, exp2(-9.28 * NoV)) * r.x + r.y;
    vec2 ab = vec2(-1.04, 1.04) * a004 + r.zw;
    return f0 * ab.x + ab.y;
}
#endif
#endif

#ifdef USE_SHADOW
// Fraction of light reaching this fragment from the shadow-casting light: 3x3 percentage-closer filtering on top of
// the hardware 2x2 comparison (LINEAR + COMPARE_REF_TO_TEXTURE), so edges stay soft
float shadowFactor(vec3 normal) {
    vec4 coord = uShadowMatrix * vec4(vWorldPosition + normal * uShadowParams.y, 1.0);
    vec3 p = coord.xyz / coord.w * 0.5 + 0.5;
    if (p.x <= 0.0 || p.x >= 1.0 || p.y <= 0.0 || p.y >= 1.0 || p.z >= 1.0) return 1.0;
    float depth = p.z - uShadowParams.x;
    float texel = uShadowParams.z;
    float sum = 0.0;
    for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
            sum += texture(uShadowMap, vec3(p.xy + vec2(float(x), float(y)) * texel, depth));
        }
    }
    return mix(1.0, sum / 9.0, uShadowStrength);
}
#endif

vec3 toneMap(vec3 color, float mode) {
    if (mode < 0.5) return color;
    if (mode < 1.5) return color / (1.0 + color);
    if (mode < 2.5) {
        // ACES filmic fitted curve (Narkowicz)
        color *= 0.6;
        return clamp((color * (2.51 * color + 0.03)) / (color * (2.43 * color + 0.59) + 0.14), 0.0, 1.0);
    }
    if (mode < 3.5) {
        // AgX base contrast approximation (sigmoid fit of the AgX transform)
        const mat3 agxIn = mat3(0.842479, 0.0423304, 0.0423738, 0.0784336, 0.878468, 0.0784336, 0.0792237, 0.0791661, 0.879142);
        const mat3 agxOut = mat3(1.19688, -0.0528969, -0.0529716, -0.0980209, 1.15190, -0.0980435, -0.0990297, -0.0989612, 1.15107);
        vec3 x = agxIn * max(color, vec3(1e-10));
        x = clamp((log2(x) + 12.47393) / 16.5, 0.0, 1.0);
        vec3 x2 = x * x;
        vec3 x4 = x2 * x2;
        x = 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
        return clamp(pow(max(agxOut * x, vec3(0.0)), vec3(2.2)), 0.0, 1.0);
    }
    // Khronos PBR Neutral
    const float startCompression = 0.8 - 0.04;
    const float desaturation = 0.15;
    float x = min(color.r, min(color.g, color.b));
    float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
    color -= offset;
    float peak = max(color.r, max(color.g, color.b));
    if (peak < startCompression) return color;
    float d = 1.0 - startCompression;
    float newPeak = 1.0 - d * d / (peak + d - startCompression);
    color *= newPeak / peak;
    float g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
    return mix(color, vec3(newPeak), g);
}

void main() {
    vec4 base = uColor;
#ifdef USE_MAP
    // SRGB8_ALPHA8 storage: the sampler already returns linear values
    base *= texture(uMap, vUv);
#endif
#ifdef USE_ALPHA_TEST
    if (base.a < uAlphaCutoff) discard;
#endif
    vec3 color = base.rgb;
#ifdef USE_LIGHTING
#ifdef FLAT_SHADED
    vec3 normal = normalize(cross(dFdx(vWorldPosition), dFdy(vWorldPosition)));
#else
    vec3 normal = normalize(vNormal);
    normal = gl_FrontFacing ? normal : -normal;
#endif
    float hemisphere = normal.y * 0.5 + 0.5;
    vec3 ambient = uAmbient.rgb + mix(uGroundColor.rgb, uSkyColor.rgb, hemisphere);
    int directionalCount = int(uLightCount.x);
    int punctualCount = int(uLightCount.y);
#ifdef USE_SHADOW
    float shadow = shadowFactor(normal);
    int shadowLight = int(uShadowParams.w);
#else
    float shadow = 1.0;
    int shadowLight = -1;
#endif
#ifdef STANDARD_SHADING
    vec3 V = normalize(uCameraPosition.xyz - vWorldPosition);
    float roughness = clamp(uRoughnessMetalness.x, 0.03, 1.0);
    float metalness = uRoughnessMetalness.y;
    float alpha = roughness * roughness;
    vec3 diffuseColor = base.rgb * (1.0 - metalness);
    vec3 f0 = mix(vec3(0.04), base.rgb, metalness);
    float NoV = max(dot(normal, V), 1e-4);
    vec3 reflected = reflect(-V, normal);
    vec3 skyReflection = mix(uGroundColor.rgb, uSkyColor.rgb, reflected.y * 0.5 + 0.5) + uAmbient.rgb;
    vec3 lit = ambient * diffuseColor + skyReflection * environmentBRDF(f0, roughness, NoV);
    for (int i = 0; i < ${MAX_DIRECTIONAL_LIGHTS}; i++) {
        if (i >= directionalCount) break;
        float visibility = i == shadowLight ? shadow : 1.0;
        lit += shadeStandard(normal, V, uDirLightDirection[i].xyz, uDirLightColor[i].rgb * visibility, diffuseColor, f0, alpha);
    }
    for (int i = 0; i < ${MAX_PUNCTUAL_LIGHTS}; i++) {
        if (i >= punctualCount) break;
        vec3 toLight = uPunctualPosition[i].xyz - vWorldPosition;
        float dist = max(length(toLight), 1e-4);
        toLight /= dist;
        vec3 radiance = uPunctualColor[i].rgb * punctualAttenuation(i, dist, toLight);
        lit += shadeStandard(normal, V, toLight, radiance, diffuseColor, f0, alpha);
    }
    color = lit;
#else
    vec3 irradiance = ambient;
    for (int i = 0; i < ${MAX_DIRECTIONAL_LIGHTS}; i++) {
        if (i >= directionalCount) break;
        float visibility = i == shadowLight ? shadow : 1.0;
        irradiance += uDirLightColor[i].rgb * (max(dot(normal, uDirLightDirection[i].xyz), 0.0) * visibility);
    }
    for (int i = 0; i < ${MAX_PUNCTUAL_LIGHTS}; i++) {
        if (i >= punctualCount) break;
        vec3 toLight = uPunctualPosition[i].xyz - vWorldPosition;
        float dist = max(length(toLight), 1e-4);
        toLight /= dist;
        float lambert = max(dot(normal, toLight), 0.0);
        irradiance += uPunctualColor[i].rgb * (lambert * punctualAttenuation(i, dist, toLight));
    }
    color *= irradiance;
#endif
#endif
    color += uEmissive;
    // Fog blends toward its color with the distance to the camera (mode in uFogColor.w)
    float fogMode = uFogColor.w;
    if (fogMode > 0.5) {
        float dist = length(uCameraPosition.xyz - vWorldPosition);
        float fog;
        if (fogMode < 1.5) fog = clamp((dist - uFogParams.x) / max(uFogParams.y - uFogParams.x, 1e-4), 0.0, 1.0);
        else if (fogMode < 2.5) fog = 1.0 - exp(-uFogParams.z * dist);
        else fog = 1.0 - exp(-(uFogParams.z * dist) * (uFogParams.z * dist));
        color = mix(color, uFogColor.rgb, fog);
    }
    color = toneMap(color * uCameraPosition.w, uFogParams.w);
    // Premultiplied output, matching the canvas compositor and the ONE / ONE_MINUS_SRC_ALPHA blend
    fragColor = vec4(linearToSrgb(color) * base.a, base.a);
}`;

/** GPU-resident buffers of one `BrioMesh`, uploaded once and reused every frame. */
/** Removes `item` from `list` (swap with the last element; order is irrelevant for owned-resource lists). */
function removeItem<T>(list: T[], item: T): void {
    const index = list.indexOf(item);
    if (index < 0) return;
    list[index] = list[list.length - 1];
    list.pop();
}

interface GpuGeometry {
    vao: WebGLVertexArrayObject;
    buffers: WebGLBuffer[];
    indexType: number;
    indexCount: number;
    /** Line-list edge buffer, built on the first wireframe draw. */
    wireVao?: WebGLVertexArrayObject;
    wireBuffer?: WebGLBuffer;
    wireCount: number;
}

interface ProgramInfo {
    program: WebGLProgram;
    uViewProj: WebGLUniformLocation | null;
    uWorld: WebGLUniformLocation | null;
    uNormalMatrix: WebGLUniformLocation | null;
    uColor: WebGLUniformLocation | null;
    uMap: WebGLUniformLocation | null;
    uAlphaCutoff: WebGLUniformLocation | null;
    uEmissive: WebGLUniformLocation | null;
    uRoughnessMetalness: WebGLUniformLocation | null;
    uShadowMap: WebGLUniformLocation | null;
    uShadowMatrix: WebGLUniformLocation | null;
    uShadowParams: WebGLUniformLocation | null;
    uShadowStrength: WebGLUniformLocation | null;
}

/** Depth-only program of the shadow pass. */
interface DepthProgramInfo {
    program: WebGLProgram;
    uLightViewProj: WebGLUniformLocation | null;
    uWorld: WebGLUniformLocation | null;
}

/** One queued `renderMesh3D()` call, sorted and drawn by `endFrame()`. */
interface DrawItem {
    mesh: BrioMesh;
    material: BrioMaterial;
    world: Float32Array;
    viewProj: Float32Array;
    features: number;
    materialId: number;
    /** Clip-space `w` of the object origin (view depth), used for sorting. */
    depth: number;
    /** Object opacity (`transform.opacity`), multiplied with `material.opacity`. */
    opacity: number;
    /** Whether the item is drawn into the shadow map. */
    castsShadow: boolean;
}

/** Opaque items: group by program and material (fewer state changes), then front-to-back (early-z). */
function compareOpaque(a: DrawItem, b: DrawItem): number {
    if (a.features !== b.features) return a.features - b.features;
    if (a.materialId !== b.materialId) return a.materialId - b.materialId;
    return a.depth - b.depth;
}

/** Transparent items: back-to-front so blending composes correctly. */
function compareTransparent(a: DrawItem, b: DrawItem): number {
    return b.depth - a.depth;
}

/**
 * Hardware-accelerated `WebGL2` implementation of `RenderBackend`.
 *
 * Mesh buffers are uploaded to the GPU once (cached per `BrioMesh`, one VAO each) and every frame only
 * issues one draw call per mesh, so per-frame cost no longer grows with triangle count on the CPU. Inside a
 * pass, `renderMesh3D()` only queues draw items; `endFrame()` sorts opaque items by program, material, and
 * depth (front-to-back) and transparent items back-to-front, draws them with redundant GL state changes
 * skipped, and copies the viewport onto the 2D canvas so 2D layers and UI keep compositing on top.
 *
 * Shading: ambient, hemisphere, and up to `MAX_DIRECTIONAL_LIGHTS` directional lights (Lambert) from
 * `setLights()`, uploaded once per change into the `BrioLights` uniform buffer; per-pixel normals (`"lambert"`),
 * derivative normals (`"flat"`), or none (`"unlit"`). `BrioMaterial.texture` is sampled as sRGB data with
 * mipmaps and anisotropic filtering, lighting runs in linear space, and output is sRGB-encoded.
 * Mesh geometry is treated as immutable after the first draw.
 *
 * @example
 * ```ts
 * const backend = new WebGL2Backend();
 * if (await backend.init(canvas)) {
 *     backend.beginFrame({ x: 0, y: 0, width: 1, height: 1 }, "#0b1220");
 *     backend.renderMesh3D(mesh, material, obj.transform.worldMatrix, cam.viewProjectionMatrix);
 *     backend.endFrame();
 * }
 * ```
 */
export class WebGL2Backend implements RenderBackend {
    public readonly backendType: RenderBackendType = "webgl2";
    #surface?: HTMLCanvasElement | OffscreenCanvas;
    #ctx2d: Context2D | null = null;
    #glCanvas?: HTMLCanvasElement | OffscreenCanvas;
    #gl: WebGL2RenderingContext | null = null;
    #contextLost = false;
    #anisotropy: { ext: any; max: number } | null = null;

    #geometries = new WeakMap<BrioMesh, GpuGeometry>();
    #textures = new WeakMap<BrioTexture, WebGLTexture>();
    /** Every GL resource created, so `dispose()` can free them (WeakMaps are not iterable). */
    #ownedBuffers: WebGLBuffer[] = [];
    #ownedVaos: WebGLVertexArrayObject[] = [];
    #ownedTextures: WebGLTexture[] = [];
    #programs = new Map<number, ProgramInfo>();
    #linearColors = new Map<string, Float32Array>();
    #materialIds = new WeakMap<BrioMaterial, number>();
    #nextMaterialId = 1;

    readonly #itemPool: DrawItem[] = [];
    readonly #opaque: DrawItem[] = [];
    readonly #transparent: DrawItem[] = [];
    readonly #sortScratch: DrawItem[] = [];
    #itemCount = 0;

    // Pixel rect of the current pass (top-left origin, as on the 2D canvas)
    #px = 0;
    #py = 0;
    #pw = 0;
    #ph = 0;
    #clearOn2D = false;

    // Cached GL state (mirrors three.js WebGLState: skip calls that would not change anything)
    #currentProgram: WebGLProgram | null = null;
    #currentVao: WebGLVertexArrayObject | null = null;
    #cullEnabled: boolean | null = null;
    #blendEnabled: boolean | null = null;
    #depthMask: boolean | null = null;
    #frontFaceCW: boolean | null = null;

    /** `BrioLights` uniform buffer and its CPU copy (std140). */
    #lightsUbo: WebGLBuffer | null = null;
    readonly #lightData = new Float32Array(LIGHTS_FLOATS);
    /** `BrioPass` uniform buffer and its CPU copy (std140), rewritten by `setPassParameters()`. */
    #passUbo: WebGLBuffer | null = null;
    readonly #passData = new Float32Array(PASS_FLOATS);
    #passDirty = true;
    /** Programs that failed to compile or link: logged once, then their draws are skipped (D-07). */
    readonly #failedPrograms = new Set<number>();
    readonly #emissiveScratch = new Float32Array(3);

    // Directional shadow (one map per pass, from the first shadow-casting directional light)
    #shadowLight = -1;
    readonly #shadowDirection = new Float32Array(3);
    /** size, distance, resolution, bias, normal bias, strength */
    readonly #shadowSettings = new Float32Array(6);
    #shadowTexture: WebGLTexture | null = null;
    #shadowFramebuffer: WebGLFramebuffer | null = null;
    #shadowResolution = 0;
    #depthProgram: DepthProgramInfo | null = null;
    /** Set once the depth program or framebuffer failed: shadows stay off instead of failing every frame. */
    #shadowsUnsupported = false;
    /** Whether the shadow map of the current pass was rendered (shadow variants sample it). */
    #shadowReady = false;
    readonly #shadowView = Matrix4.create();
    readonly #shadowProjection = Matrix4.create();
    readonly #shadowMatrix = Matrix4.create();
    readonly #shadowEye = { x: 0, y: 0, z: 0 };
    readonly #shadowCenter = { x: 0, y: 0, z: 0 };
    readonly #shadowUp = { x: 0, y: 1, z: 0 };
    /** GL (bottom-left) Y of the current pass viewport. */
    #glY = 0;
    #lightsVersion = -1;
    #lightsDirty = true;

    readonly #normalMatrix = new Float32Array(9);
    readonly #colorScratch = new Float32Array(4);
    #drawCalls = 0;
    #trianglesRendered = 0;

    constructor() {
        // Exposure 1 until a pass sets its parameters
        this.#passData[3] = 1;
        this.setLights(
            buildLightingEnvironment(BrioLight.createDefaultRig(), createLightingEnvironment()),
        );
    }

    /**
     * Sets the lights of the following draws; the uniform buffer is only re-uploaded when they changed.
     *
     * @param environment Lights reduced by `buildLightingEnvironment()`
     */
    public setLights(environment: LightingEnvironment): void {
        if (environment.version === this.#lightsVersion) return;
        this.#lightsVersion = environment.version;
        const data = this.#lightData;
        data.fill(0);
        data.set(environment.ambient, 0);
        data.set(environment.sky, 4);
        data.set(environment.ground, 8);
        data[12] = environment.directionalCount;
        data[13] = environment.punctualCount;
        for (let i = 0; i < environment.directionalCount; i++) {
            data.set(environment.directions.subarray(i * 3, i * 3 + 3), 16 + i * 4);
            data.set(
                environment.colors.subarray(i * 3, i * 3 + 3),
                16 + MAX_DIRECTIONAL_LIGHTS * 4 + i * 4,
            );
        }
        const count = environment.punctualCount * 4;
        const stride = MAX_PUNCTUAL_LIGHTS * 4;
        data.set(environment.punctualPositions.subarray(0, count), PUNCTUAL_OFFSET);
        data.set(environment.punctualColors.subarray(0, count), PUNCTUAL_OFFSET + stride);
        data.set(environment.punctualDirections.subarray(0, count), PUNCTUAL_OFFSET + stride * 2);
        data.set(environment.punctualCones.subarray(0, count), PUNCTUAL_OFFSET + stride * 3);
        this.#shadowLight = environment.shadowLight;
        this.#shadowDirection.set(environment.shadowDirection);
        this.#shadowSettings.set(environment.shadowSettings);
        this.#lightsDirty = true;
    }

    /**
     * Sets the camera position, fog, tone mapping and exposure of the current pass (`BrioPass` block).
     *
     * @param parameters Values of the pass
     */
    public setPassParameters(parameters: Readonly<RenderPassParameters>): void {
        const data = this.#passData;
        data[0] = parameters.cameraX;
        data[1] = parameters.cameraY;
        data[2] = parameters.cameraZ;
        data[3] = parameters.exposure;
        if (parameters.fogMode > 0) {
            const fog = this.#linearColor(parameters.fogColor);
            data[4] = fog[0];
            data[5] = fog[1];
            data[6] = fog[2];
        }
        data[7] = parameters.fogMode;
        data[8] = parameters.fogNear;
        data[9] = parameters.fogFar;
        data[10] = parameters.fogDensity;
        data[11] = TONE_MAPPING_CODES[parameters.toneMapping] ?? 0;
        this.#passDirty = true;
        this.#shadowCenter.x = parameters.targetX;
        this.#shadowCenter.y = parameters.targetY;
        this.#shadowCenter.z = parameters.targetZ;
    }

    /** Values currently uploaded (or pending upload) to the `BrioPass` block (std140 layout). */
    public get passData(): Readonly<Float32Array> {
        return this.#passData;
    }

    /** Light values currently uploaded (or pending upload) to the `BrioLights` block (std140 layout). */
    public get lightData(): Readonly<Float32Array> {
        return this.#lightData;
    }

    /**
     * Creates an internal WebGL2 canvas matching `surface`; each pass is composited onto `surface`'s 2D context.
     *
     * @param surface Target canvas (its 2D context receives the rendered viewports)
     * @returns `true` if a WebGL2 context and a 2D target context were acquired
     */
    public async init(surface: HTMLCanvasElement | OffscreenCanvas): Promise<boolean> {
        this.#surface = surface;
        this.#ctx2d = surface.getContext("2d") as Context2D | null;
        if (!this.#ctx2d) return false;

        let glCanvas: HTMLCanvasElement | OffscreenCanvas;
        if (typeof document !== "undefined") {
            glCanvas = document.createElement("canvas");
        } else if (typeof OffscreenCanvas !== "undefined") {
            glCanvas = new OffscreenCanvas(1, 1);
        } else {
            return false;
        }
        glCanvas.width = Math.max(1, surface.width);
        glCanvas.height = Math.max(1, surface.height);

        const gl = glCanvas.getContext("webgl2", {
            alpha: true,
            antialias: true,
            depth: true,
            premultipliedAlpha: true,
            preserveDrawingBuffer: false,
            powerPreference: "high-performance",
        }) as WebGL2RenderingContext | null;
        // Duck-typed check: test doubles and non-WebGL2 contexts lack VAO support
        if (
            !gl ||
            typeof (gl as Partial<WebGL2RenderingContext>).createVertexArray !== "function"
        ) {
            return false;
        }

        this.#glCanvas = glCanvas;
        this.#gl = gl;
        (glCanvas as HTMLCanvasElement).addEventListener?.("webglcontextlost", (event: Event) => {
            event.preventDefault();
            this.#contextLost = true;
        });
        (glCanvas as HTMLCanvasElement).addEventListener?.("webglcontextrestored", () => {
            this.#resetResources();
            this.#setupContext();
            this.#contextLost = false;
        });

        this.#setupContext();
        return true;
    }

    /** Number of draw calls issued by the last `endFrame()`. */
    public get drawCalls(): number {
        return this.#drawCalls;
    }

    /** Number of triangles submitted by the last `endFrame()` (back faces are culled later on the GPU). */
    public get trianglesRendered(): number {
        return this.#trianglesRendered;
    }

    /**
     * Begins a pass: restricts drawing to `viewport` and clears its color (or transparency) and depth.
     *
     * @param viewport Normalized viewport `[0..1]`
     * @param clearColor Optional CSS clear color; without it the viewport stays transparent
     */
    public beginFrame(viewport: ViewportRect, clearColor?: string): void {
        this.#opaque.length = 0;
        this.#transparent.length = 0;
        this.#itemCount = 0;
        const gl = this.#gl;
        if (!gl || !this.#surface || !this.#glCanvas || this.#contextLost) return;

        const w = this.#surface.width;
        const h = this.#surface.height;
        if (this.#glCanvas.width !== w || this.#glCanvas.height !== h) {
            this.#glCanvas.width = Math.max(1, w);
            this.#glCanvas.height = Math.max(1, h);
        }

        this.#px = Math.round(viewport.x * w);
        this.#py = Math.round(viewport.y * h);
        this.#pw = Math.round(viewport.width * w);
        this.#ph = Math.round(viewport.height * h);
        // GL window coordinates start at the bottom-left corner
        const glY = h - this.#py - this.#ph;
        this.#glY = glY;
        this.#shadowReady = false;
        gl.viewport(this.#px, glY, this.#pw, this.#ph);
        gl.scissor(this.#px, glY, this.#pw, this.#ph);

        const rgba = clearColor ? this.#resolveColor(clearColor) : undefined;
        if (rgba) {
            // Clear values are written as-is to the sRGB canvas, premultiplied like the shader output
            gl.clearColor(
                (rgba[0] / 255) * rgba[3],
                (rgba[1] / 255) * rgba[3],
                (rgba[2] / 255) * rgba[3],
                rgba[3],
            );
        } else {
            gl.clearColor(0, 0, 0, 0);
        }
        this.#setDepthMask(true);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        // Without an opaque clear color the 2D content under the viewport is erased, like Canvas2DBackend
        this.#clearOn2D = !rgba || rgba[3] < 1;
    }

    /**
     * Queues `mesh` for this pass; `endFrame()` sorts and draws the queue.
     *
     * @param mesh 3D `BrioMesh` geometry
     * @param material `BrioMaterial` appearance
     * @param worldMatrix Object 4x4 world matrix
     * @param viewProjMatrix Camera 4x4 view-projection matrix
     * @param opacity Object opacity (`transform.opacity`), multiplied with `material.opacity`
     */
    public renderMesh3D(
        mesh: BrioMesh,
        material: BrioMaterial,
        worldMatrix: Mat4,
        viewProjMatrix: Mat4,
        opacity: number = 1,
        shadowFlags: number = SHADOW_CAST | SHADOW_RECEIVE,
    ): void {
        if (!this.#gl || this.#contextLost || mesh.indices.length === 0 || opacity <= 0) return;

        let item = this.#itemPool[this.#itemCount];
        if (!item) {
            item = {
                mesh,
                material,
                world: new Float32Array(16),
                viewProj: new Float32Array(16),
                features: 0,
                materialId: 0,
                depth: 0,
                opacity: 1,
                castsShadow: false,
            };
            this.#itemPool.push(item);
        }
        this.#itemCount++;
        item.mesh = mesh;
        item.material = material;
        item.world.set(worldMatrix);
        item.viewProj.set(viewProjMatrix);
        item.features = this.#featuresOf(material);
        item.materialId = this.#materialId(material);
        const vp = viewProjMatrix;
        const x = worldMatrix[12];
        const y = worldMatrix[13];
        const z = worldMatrix[14];
        item.depth = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
        item.opacity = opacity;
        item.castsShadow = (shadowFlags & SHADOW_CAST) !== 0;
        if (
            this.#shadowLight >= 0 &&
            (shadowFlags & SHADOW_RECEIVE) !== 0 &&
            (item.features & FEATURE_LIT) !== 0
        ) {
            item.features |= FEATURE_SHADOW;
        }

        if (material.opacity * opacity < 1) this.#transparent.push(item);
        else this.#opaque.push(item);
    }

    /**
     * Draws the queued items (opaque first, then transparent) and composites the viewport onto the 2D canvas.
     */
    public endFrame(): void {
        const gl = this.#gl;
        if (!gl || this.#contextLost) return;

        this.#drawCalls = 0;
        this.#trianglesRendered = 0;
        if (this.#lightsDirty && this.#lightsUbo) {
            gl.bindBuffer(gl.UNIFORM_BUFFER, this.#lightsUbo);
            gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this.#lightData);
            this.#lightsDirty = false;
        }
        if (this.#passDirty && this.#passUbo) {
            gl.bindBuffer(gl.UNIFORM_BUFFER, this.#passUbo);
            gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this.#passData);
            this.#passDirty = false;
        }
        // Unlike Array.prototype.sort, allocates no work buffer per frame
        sortInPlace(this.#opaque, this.#opaque.length, compareOpaque, this.#sortScratch);
        sortInPlace(
            this.#transparent,
            this.#transparent.length,
            compareTransparent,
            this.#sortScratch,
        );

        if (this.#shadowLight >= 0) this.#renderShadowMap(gl);

        this.#setBlend(false);
        this.#setDepthMask(true);
        for (let i = 0; i < this.#opaque.length; i++) this.#draw(gl, this.#opaque[i]);

        if (this.#transparent.length > 0) {
            this.#setBlend(true);
            this.#setDepthMask(false);
            for (let i = 0; i < this.#transparent.length; i++) this.#draw(gl, this.#transparent[i]);
            this.#setDepthMask(true);
        }

        this.#opaque.length = 0;
        this.#transparent.length = 0;
        this.#composite();
    }

    /**
     * Frees the GPU buffers uploaded for `mesh` (they are uploaded again if the mesh is drawn later).
     *
     * @param mesh Mesh whose geometry is released
     */
    public releaseMesh(mesh: BrioMesh): void {
        const geometry = this.#geometries.get(mesh);
        if (!geometry) return;
        this.#geometries.delete(mesh);
        const gl = this.#gl;
        const buffers = geometry.wireBuffer
            ? [...geometry.buffers, geometry.wireBuffer]
            : geometry.buffers;
        const vaos = geometry.wireVao ? [geometry.vao, geometry.wireVao] : [geometry.vao];
        for (const buffer of buffers) {
            removeItem(this.#ownedBuffers, buffer);
            if (gl && !this.#contextLost) gl.deleteBuffer(buffer);
        }
        for (const vao of vaos) {
            removeItem(this.#ownedVaos, vao);
            if (gl && !this.#contextLost) gl.deleteVertexArray(vao);
        }
    }

    /**
     * Frees the GPU texture uploaded for `texture`.
     *
     * @param texture Texture whose GPU copy is released
     */
    public releaseTexture(texture: BrioTexture): void {
        const handle = this.#textures.get(texture);
        if (!handle) return;
        this.#textures.delete(texture);
        removeItem(this.#ownedTextures, handle);
        if (this.#gl && !this.#contextLost) this.#gl.deleteTexture(handle);
    }

    /**
     * Frees every GPU resource, the program cache, and the internal WebGL2 canvas.
     */
    public dispose(): void {
        const gl = this.#gl;
        if (gl && !this.#contextLost) {
            for (const buffer of this.#ownedBuffers) gl.deleteBuffer(buffer);
            for (const vao of this.#ownedVaos) gl.deleteVertexArray(vao);
            for (const texture of this.#ownedTextures) gl.deleteTexture(texture);
            for (const info of this.#programs.values()) gl.deleteProgram(info.program);
            if (this.#lightsUbo) gl.deleteBuffer(this.#lightsUbo);
            if (this.#passUbo) gl.deleteBuffer(this.#passUbo);
            if (this.#shadowTexture) gl.deleteTexture(this.#shadowTexture);
            if (this.#shadowFramebuffer) gl.deleteFramebuffer(this.#shadowFramebuffer);
            if (this.#depthProgram) gl.deleteProgram(this.#depthProgram.program);
        }
        this.#resetResources();
        this.#gl = null;
        this.#glCanvas = undefined;
        this.#ctx2d = null;
        this.#surface = undefined;
    }

    #setupContext(): void {
        const gl = this.#gl!;
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.enable(gl.SCISSOR_TEST);
        gl.cullFace(gl.BACK);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        // Constant values used when a mesh has no normals / UVs (that attribute array stays disabled)
        gl.vertexAttrib3f(ATTR_NORMAL, 0, 1, 0);
        gl.vertexAttrib2f(ATTR_UV, 0, 0);
        this.#lightsUbo = gl.createBuffer();
        gl.bindBuffer(gl.UNIFORM_BUFFER, this.#lightsUbo);
        gl.bufferData(gl.UNIFORM_BUFFER, this.#lightData, gl.DYNAMIC_DRAW);
        gl.bindBufferBase(gl.UNIFORM_BUFFER, LIGHTS_BINDING, this.#lightsUbo);
        this.#lightsDirty = false;
        this.#passUbo = gl.createBuffer();
        gl.bindBuffer(gl.UNIFORM_BUFFER, this.#passUbo);
        gl.bufferData(gl.UNIFORM_BUFFER, this.#passData, gl.DYNAMIC_DRAW);
        gl.bindBufferBase(gl.UNIFORM_BUFFER, PASS_BINDING, this.#passUbo);
        this.#passDirty = false;
        const ext =
            gl.getExtension("EXT_texture_filter_anisotropic") ??
            gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic");
        this.#anisotropy = ext
            ? {
                  ext,
                  max: Math.min(
                      MAX_ANISOTROPY,
                      gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number,
                  ),
              }
            : null;
    }

    #resetResources(): void {
        this.#geometries = new WeakMap();
        this.#textures = new WeakMap();
        this.#ownedBuffers = [];
        this.#ownedVaos = [];
        this.#ownedTextures = [];
        this.#programs.clear();
        this.#lightsUbo = null;
        this.#lightsDirty = true;
        this.#passUbo = null;
        this.#passDirty = true;
        this.#failedPrograms.clear();
        this.#shadowTexture = null;
        this.#shadowFramebuffer = null;
        this.#shadowResolution = 0;
        this.#depthProgram = null;
        this.#shadowReady = false;
        this.#shadowsUnsupported = false;
        this.#currentProgram = null;
        this.#currentVao = null;
        this.#cullEnabled = null;
        this.#blendEnabled = null;
        this.#depthMask = null;
        this.#frontFaceCW = null;
    }

    #featuresOf(material: BrioMaterial): number {
        if (material.wireframe) return 0;
        let features = 0;
        if (material.texture && this.#textureFor(material.texture)) features |= FEATURE_MAP;
        if (material.shading !== "unlit") features |= FEATURE_LIT;
        if (material.shading === "flat") features |= FEATURE_FLAT;
        if (material.shading === "standard") features |= FEATURE_STANDARD;
        if (material.alphaCutoff > 0) features |= FEATURE_ALPHA_TEST;
        return features;
    }

    #materialId(material: BrioMaterial): number {
        let id = this.#materialIds.get(material);
        if (id === undefined) {
            id = this.#nextMaterialId++;
            this.#materialIds.set(material, id);
        }
        return id;
    }

    #draw(gl: WebGL2RenderingContext, item: DrawItem): void {
        const material = item.material;
        const geometry = this.#geometryFor(gl, item.mesh);
        // Without a shadow map this pass (no depth texture support, nothing cast), draw the unshadowed variant
        const features =
            (item.features & FEATURE_SHADOW) !== 0 && !this.#shadowReady
                ? item.features & ~FEATURE_SHADOW
                : item.features;
        const info = this.#programFor(gl, features);
        if (!info) return;

        if (this.#currentProgram !== info.program) {
            gl.useProgram(info.program);
            this.#currentProgram = info.program;
        }

        gl.uniformMatrix4fv(info.uViewProj, false, item.viewProj);
        gl.uniformMatrix4fv(info.uWorld, false, item.world);
        const det = this.#computeNormalMatrix(item.world);
        gl.uniformMatrix3fv(info.uNormalMatrix, false, this.#normalMatrix);

        const color = this.#linearColor(material.color);
        const rgba = this.#colorScratch;
        rgba[0] = color[0];
        rgba[1] = color[1];
        rgba[2] = color[2];
        rgba[3] = color[3] * material.opacity * item.opacity;
        gl.uniform4fv(info.uColor, rgba);

        if ((item.features & FEATURE_MAP) !== 0) {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.#textureFor(material.texture!)!);
            gl.uniform1i(info.uMap, 0);
        }
        if ((item.features & FEATURE_ALPHA_TEST) !== 0) {
            gl.uniform1f(info.uAlphaCutoff, material.alphaCutoff);
        }
        const emissive = this.#emissiveScratch;
        if (material.emissive !== "#000000" && material.emissiveIntensity > 0) {
            const e = this.#linearColor(material.emissive);
            const k = material.emissiveIntensity * e[3];
            emissive[0] = e[0] * k;
            emissive[1] = e[1] * k;
            emissive[2] = e[2] * k;
        } else {
            emissive[0] = 0;
            emissive[1] = 0;
            emissive[2] = 0;
        }
        gl.uniform3fv(info.uEmissive, emissive);
        if ((features & FEATURE_STANDARD) !== 0) {
            gl.uniform2f(info.uRoughnessMetalness, material.roughness, material.metalness);
        }
        if ((features & FEATURE_SHADOW) !== 0) {
            const settings = this.#shadowSettings;
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, this.#shadowTexture);
            gl.activeTexture(gl.TEXTURE0);
            gl.uniform1i(info.uShadowMap, 1);
            gl.uniformMatrix4fv(info.uShadowMatrix, false, this.#shadowMatrix);
            gl.uniform4f(
                info.uShadowParams,
                settings[3],
                settings[4],
                1 / this.#shadowResolution,
                this.#shadowLight,
            );
            gl.uniform1f(info.uShadowStrength, settings[5]);
        }

        this.#setCull(!material.doubleSided && !material.wireframe);
        // A mirroring transform flips the winding, so front faces become clockwise (as in three.js)
        this.#setFrontFaceCW(det < 0);

        if (material.wireframe) {
            const vao = this.#wireVaoFor(gl, item.mesh, geometry);
            this.#bindVao(gl, vao);
            gl.drawElements(gl.LINES, geometry.wireCount, geometry.indexType, 0);
        } else {
            this.#bindVao(gl, geometry.vao);
            gl.drawElements(gl.TRIANGLES, geometry.indexCount, geometry.indexType, 0);
        }
        this.#drawCalls++;
        this.#trianglesRendered += item.mesh.triangleCount;
    }

    /**
     * Writes the inverse-transpose of the upper 3x3 of `m` to `#normalMatrix` and returns its determinant.
     */
    #computeNormalMatrix(m: Float32Array): number {
        const a00 = m[0],
            a01 = m[1],
            a02 = m[2];
        const a10 = m[4],
            a11 = m[5],
            a12 = m[6];
        const a20 = m[8],
            a21 = m[9],
            a22 = m[10];
        const c00 = a11 * a22 - a12 * a21;
        const c01 = a12 * a20 - a10 * a22;
        const c02 = a10 * a21 - a11 * a20;
        const det = a00 * c00 + a01 * c01 + a02 * c02;
        const inv = det !== 0 ? 1 / det : 0;
        // Cofactor matrix / det = (M^-1)^T, laid out column-major like `m`
        const n = this.#normalMatrix;
        n[0] = c00 * inv;
        n[1] = c01 * inv;
        n[2] = c02 * inv;
        n[3] = (a02 * a21 - a01 * a22) * inv;
        n[4] = (a00 * a22 - a02 * a20) * inv;
        n[5] = (a01 * a20 - a00 * a21) * inv;
        n[6] = (a01 * a12 - a02 * a11) * inv;
        n[7] = (a02 * a10 - a00 * a12) * inv;
        n[8] = (a00 * a11 - a01 * a10) * inv;
        return det;
    }

    #geometryFor(gl: WebGL2RenderingContext, mesh: BrioMesh): GpuGeometry {
        let geometry = this.#geometries.get(mesh);
        if (geometry) return geometry;

        const vao = gl.createVertexArray()!;
        this.#ownedVaos.push(vao);
        this.#bindVao(gl, vao);
        const buffers: WebGLBuffer[] = [];
        const vertexCount = mesh.vertexCount;
        const upload = (location: number, data: Float32Array, size: number): void => {
            if (data.length < vertexCount * size) return;
            const buffer = gl.createBuffer()!;
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
            gl.enableVertexAttribArray(location);
            gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
            buffers.push(buffer);
        };
        upload(ATTR_POSITION, mesh.positions, 3);
        upload(ATTR_NORMAL, mesh.normals, 3);
        upload(ATTR_UV, mesh.uvs, 2);

        const indexBuffer = gl.createBuffer()!;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
        buffers.push(indexBuffer);
        this.#ownedBuffers.push(...buffers);

        geometry = {
            vao,
            buffers,
            indexType: mesh.indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT,
            indexCount: mesh.indices.length,
            wireCount: 0,
        };
        this.#geometries.set(mesh, geometry);
        return geometry;
    }

    /** Builds (once) a VAO sharing the mesh vertex buffers with a line-list index buffer of triangle edges. */
    #wireVaoFor(
        gl: WebGL2RenderingContext,
        mesh: BrioMesh,
        geometry: GpuGeometry,
    ): WebGLVertexArrayObject {
        if (geometry.wireVao) return geometry.wireVao;
        const tri = mesh.indices;
        const lines =
            tri instanceof Uint32Array
                ? new Uint32Array(tri.length * 2)
                : new Uint16Array(tri.length * 2);
        for (let i = 0, o = 0; i + 2 < tri.length; i += 3) {
            lines[o++] = tri[i];
            lines[o++] = tri[i + 1];
            lines[o++] = tri[i + 1];
            lines[o++] = tri[i + 2];
            lines[o++] = tri[i + 2];
            lines[o++] = tri[i];
        }

        const vao = gl.createVertexArray()!;
        this.#ownedVaos.push(vao);
        this.#bindVao(gl, vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, geometry.buffers[0]);
        gl.enableVertexAttribArray(ATTR_POSITION);
        gl.vertexAttribPointer(ATTR_POSITION, 3, gl.FLOAT, false, 0, 0);
        const lineBuffer = gl.createBuffer()!;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lineBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, lines, gl.STATIC_DRAW);
        this.#ownedBuffers.push(lineBuffer);

        geometry.wireVao = vao;
        geometry.wireBuffer = lineBuffer;
        geometry.wireCount = lines.length;
        return vao;
    }

    /** Uploads (once) a decoded `BrioTexture` as sRGB with mipmaps; `undefined` while it is still decoding. */
    #textureFor(texture: BrioTexture): WebGLTexture | undefined {
        const cached = this.#textures.get(texture);
        if (cached) return cached;
        const gl = this.#gl!;
        const source: TexImageSource | undefined =
            texture.bitmap ??
            (texture.isDecoded || (texture.element.complete && texture.element.naturalWidth > 0)
                ? texture.element
                : undefined);
        if (!source || texture.width === 0 || texture.height === 0) return undefined;

        const handle = gl.createTexture()!;
        this.#ownedTextures.push(handle);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, handle);
        // glTF UVs put the image origin at the top-left, which is how WebGL reads unflipped rows
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
        const levels = Math.floor(Math.log2(Math.max(texture.width, texture.height))) + 1;
        gl.texStorage2D(gl.TEXTURE_2D, levels, gl.SRGB8_ALPHA8, texture.width, texture.height);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        if (this.#anisotropy) {
            gl.texParameterf(
                gl.TEXTURE_2D,
                this.#anisotropy.ext.TEXTURE_MAX_ANISOTROPY_EXT,
                this.#anisotropy.max,
            );
        }
        this.#textures.set(texture, handle);
        return handle;
    }

    #programFor(gl: WebGL2RenderingContext, features: number): ProgramInfo | undefined {
        const cached = this.#programs.get(features);
        if (cached) return cached;
        if (this.#failedPrograms.has(features)) return undefined;

        // A shader error must never throw from a draw (D-07): log it once with the driver's message and skip the
        // draws of that variant, so the rest of the frame still renders
        let program: WebGLProgram | undefined;
        try {
            program = this.#linkProgram(gl, features);
        } catch (err) {
            this.#failedPrograms.add(features);
            console.error(
                `BrioJS WebGL2Backend: shader program (features ${features}) failed; its meshes are not drawn.`,
                err,
            );
            return undefined;
        }

        const info: ProgramInfo = {
            program,
            uViewProj: gl.getUniformLocation(program, "uViewProj"),
            uWorld: gl.getUniformLocation(program, "uWorld"),
            uNormalMatrix: gl.getUniformLocation(program, "uNormalMatrix"),
            uColor: gl.getUniformLocation(program, "uColor"),
            uMap: gl.getUniformLocation(program, "uMap"),
            uAlphaCutoff: gl.getUniformLocation(program, "uAlphaCutoff"),
            uEmissive: gl.getUniformLocation(program, "uEmissive"),
            uRoughnessMetalness: gl.getUniformLocation(program, "uRoughnessMetalness"),
            uShadowMap: gl.getUniformLocation(program, "uShadowMap"),
            uShadowMatrix: gl.getUniformLocation(program, "uShadowMatrix"),
            uShadowParams: gl.getUniformLocation(program, "uShadowParams"),
            uShadowStrength: gl.getUniformLocation(program, "uShadowStrength"),
        };
        // Programs read the shared BrioLights (lit variants) and BrioPass uniform buffers
        const lightsIndex = gl.getUniformBlockIndex(program, "BrioLights");
        if (typeof lightsIndex === "number" && lightsIndex !== INVALID_INDEX) {
            gl.uniformBlockBinding(program, lightsIndex, LIGHTS_BINDING);
        }
        const passIndex = gl.getUniformBlockIndex(program, "BrioPass");
        if (typeof passIndex === "number" && passIndex !== INVALID_INDEX) {
            gl.uniformBlockBinding(program, passIndex, PASS_BINDING);
        }
        this.#programs.set(features, info);
        return info;
    }

    /**
     * Renders the depth of every shadow-casting opaque item of the pass, seen from the shadow-casting light, into
     * the shadow map. The light's orthographic box (`size` half-width, `distance` deep) is centered on the camera
     * target and snapped to whole texels in light space, so shadow edges do not shimmer when the camera moves.
     */
    #renderShadowMap(gl: WebGL2RenderingContext): void {
        let casters = 0;
        for (let i = 0; i < this.#opaque.length; i++) if (this.#opaque[i].castsShadow) casters++;
        if (casters === 0 || this.#shadowsUnsupported || !this.#ensureShadowResources(gl)) return;

        const settings = this.#shadowSettings;
        const size = settings[0];
        const distance = settings[1];
        const resolution = this.#shadowResolution;
        const d = this.#shadowDirection;
        const center = this.#shadowCenter;
        const eye = this.#shadowEye;
        eye.x = center.x - d[0] * distance * 0.5;
        eye.y = center.y - d[1] * distance * 0.5;
        eye.z = center.z - d[2] * distance * 0.5;
        const up = this.#shadowUp;
        const vertical = Math.abs(d[1]) > 0.99;
        up.x = 0;
        up.y = vertical ? 0 : 1;
        up.z = vertical ? 1 : 0;
        const view = this.#shadowView;
        Matrix4.lookAt(view, eye, center, up);
        const texel = (size * 2) / resolution;
        const vx = view[0] * center.x + view[4] * center.y + view[8] * center.z + view[12];
        const vy = view[1] * center.x + view[5] * center.y + view[9] * center.z + view[13];
        view[12] -= vx - Math.round(vx / texel) * texel;
        view[13] -= vy - Math.round(vy / texel) * texel;
        Matrix4.orthographic(this.#shadowProjection, -size, size, -size, size, 0, distance);
        Matrix4.multiply(this.#shadowMatrix, this.#shadowProjection, view);

        const depth = this.#depthProgram!;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.#shadowFramebuffer);
        gl.viewport(0, 0, resolution, resolution);
        gl.scissor(0, 0, resolution, resolution);
        this.#setDepthMask(true);
        this.#setBlend(false);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        gl.useProgram(depth.program);
        this.#currentProgram = depth.program;
        gl.uniformMatrix4fv(depth.uLightViewProj, false, this.#shadowMatrix);
        // Slope-scaled depth offset against shadow acne
        gl.enable(gl.POLYGON_OFFSET_FILL);
        gl.polygonOffset(1.5, 2);
        for (let i = 0; i < this.#opaque.length; i++) {
            const item = this.#opaque[i];
            if (!item.castsShadow || item.material.wireframe) continue;
            const geometry = this.#geometryFor(gl, item.mesh);
            const det = this.#computeNormalMatrix(item.world);
            this.#setCull(!item.material.doubleSided);
            this.#setFrontFaceCW(det < 0);
            gl.uniformMatrix4fv(depth.uWorld, false, item.world);
            this.#bindVao(gl, geometry.vao);
            gl.drawElements(gl.TRIANGLES, geometry.indexCount, geometry.indexType, 0);
            this.#drawCalls++;
        }
        gl.disable(gl.POLYGON_OFFSET_FILL);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(this.#px, this.#glY, this.#pw, this.#ph);
        gl.scissor(this.#px, this.#glY, this.#pw, this.#ph);
        this.#shadowReady = true;
    }

    /** Creates (or resizes) the depth texture, framebuffer and depth program; `false` when unsupported. */
    #ensureShadowResources(gl: WebGL2RenderingContext): boolean {
        const resolution = this.#shadowSettings[2];
        if (!this.#depthProgram) {
            try {
                const vs = this.#compile(gl, gl.VERTEX_SHADER, SHADOW_DEPTH_SHADERS.vertex);
                const fs = this.#compile(gl, gl.FRAGMENT_SHADER, SHADOW_DEPTH_SHADERS.fragment);
                const program = gl.createProgram()!;
                gl.attachShader(program, vs);
                gl.attachShader(program, fs);
                gl.linkProgram(program);
                gl.deleteShader(vs);
                gl.deleteShader(fs);
                if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                    throw new Error(gl.getProgramInfoLog(program) ?? "link failed");
                }
                this.#depthProgram = {
                    program,
                    uLightViewProj: gl.getUniformLocation(program, "uLightViewProj"),
                    uWorld: gl.getUniformLocation(program, "uWorld"),
                };
            } catch (err) {
                console.error(
                    "BrioJS WebGL2Backend: shadow depth program failed; shadows are off.",
                    err,
                );
                this.#shadowLight = -1;
                return false;
            }
        }
        if (this.#shadowTexture && this.#shadowResolution === resolution) return true;

        if (this.#shadowTexture) gl.deleteTexture(this.#shadowTexture);
        if (this.#shadowFramebuffer) gl.deleteFramebuffer(this.#shadowFramebuffer);
        const texture = gl.createTexture()!;
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, resolution, resolution);
        // LINEAR + comparison mode: the hardware returns a 2x2 filtered visibility (percentage-closer filtering)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
        gl.activeTexture(gl.TEXTURE0);
        const framebuffer = gl.createFramebuffer()!;
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, texture, 0);
        gl.drawBuffers([gl.NONE]);
        gl.readBuffer(gl.NONE);
        const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.#shadowTexture = texture;
        this.#shadowFramebuffer = framebuffer;
        this.#shadowResolution = resolution;
        if (!complete) {
            console.error(
                "BrioJS WebGL2Backend: the shadow framebuffer is incomplete; shadows are off.",
            );
            this.#shadowLight = -1;
            return false;
        }
        return true;
    }

    /** Compiles and links the program of `features`; throws with the info log when it fails. */
    #linkProgram(gl: WebGL2RenderingContext, features: number): WebGLProgram {
        const sources = buildShaderSources(features);
        const vs = this.#compile(gl, gl.VERTEX_SHADER, sources.vertex);
        let fs: WebGLShader;
        try {
            fs = this.#compile(gl, gl.FRAGMENT_SHADER, sources.fragment);
        } catch (err) {
            gl.deleteShader(vs);
            throw err;
        }
        const program = gl.createProgram()!;
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const log = gl.getProgramInfoLog(program);
            gl.deleteProgram(program);
            throw new Error(`WebGL2Backend: program link failed (features ${features}): ${log}`);
        }
        return program;
    }

    #compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
        const shader = gl.createShader(type)!;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const log = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error(`WebGL2Backend: shader compilation failed: ${log}`);
        }
        return shader;
    }

    /** Resolves any CSS color to `[r, g, b, a]` through the 2D context (`r, g, b` in `0..255`). */
    #resolveColor(color: string): [number, number, number, number] | undefined {
        const ctx = this.#ctx2d;
        if (!ctx) return parseCanvasColor(color);
        const previous = ctx.fillStyle;
        ctx.fillStyle = "#000000";
        ctx.fillStyle = color;
        const normalized = ctx.fillStyle;
        ctx.fillStyle = previous;
        return typeof normalized === "string" ? parseCanvasColor(normalized) : undefined;
    }

    /** Cached linear-light `[r, g, b, a]` of a CSS color (white when it cannot be resolved). */
    #linearColor(color: string): Float32Array {
        let linear = this.#linearColors.get(color);
        if (!linear) {
            const rgba = this.#resolveColor(color) ?? [255, 255, 255, 1];
            linear = new Float32Array([
                srgbToLinear(rgba[0] / 255),
                srgbToLinear(rgba[1] / 255),
                srgbToLinear(rgba[2] / 255),
                rgba[3],
            ]);
            this.#linearColors.set(color, linear);
        }
        return linear;
    }

    /** Copies the pass viewport from the WebGL2 canvas onto the 2D canvas. */
    #composite(): void {
        const ctx = this.#ctx2d;
        if (!ctx || !this.#glCanvas || this.#pw <= 0 || this.#ph <= 0) return;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
        ctx.imageSmoothingEnabled = false;
        if (this.#clearOn2D) ctx.clearRect(this.#px, this.#py, this.#pw, this.#ph);
        ctx.drawImage(
            this.#glCanvas as CanvasImageSource,
            this.#px,
            this.#py,
            this.#pw,
            this.#ph,
            this.#px,
            this.#py,
            this.#pw,
            this.#ph,
        );
        ctx.restore();
    }

    #bindVao(gl: WebGL2RenderingContext, vao: WebGLVertexArrayObject): void {
        if (this.#currentVao !== vao) {
            gl.bindVertexArray(vao);
            this.#currentVao = vao;
        }
    }

    #setCull(enabled: boolean): void {
        if (this.#cullEnabled === enabled) return;
        const gl = this.#gl!;
        if (enabled) gl.enable(gl.CULL_FACE);
        else gl.disable(gl.CULL_FACE);
        this.#cullEnabled = enabled;
    }

    #setBlend(enabled: boolean): void {
        if (this.#blendEnabled === enabled) return;
        const gl = this.#gl!;
        if (enabled) gl.enable(gl.BLEND);
        else gl.disable(gl.BLEND);
        this.#blendEnabled = enabled;
    }

    #setDepthMask(enabled: boolean): void {
        if (this.#depthMask === enabled) return;
        this.#gl!.depthMask(enabled);
        this.#depthMask = enabled;
    }

    #setFrontFaceCW(cw: boolean): void {
        if (this.#frontFaceCW === cw) return;
        const gl = this.#gl!;
        gl.frontFace(cw ? gl.CW : gl.CCW);
        this.#frontFaceCW = cw;
    }
}
