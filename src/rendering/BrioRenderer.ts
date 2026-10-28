import { BrioMaterial } from "../assets/BrioMaterial";
import { BrioMesh } from "../assets/BrioMesh";
import { ViewportRect } from "../core/BrioViewport";
import { Mat4, Matrix4 } from "../math/index";
import { BrioLight } from "../objects/BrioLight";
import { PlatformAdapter } from "../tools/PlatformAdapter";
import { linearToSrgb, parseCanvasColor } from "./color";
import { RenderBackend, RenderBackendType } from "./contracts/RenderBackend";
import {
    buildLightingEnvironment,
    createLightingEnvironment,
    irradianceLuminance,
    LightingEnvironment,
} from "./lighting";
import { WebGL2Backend } from "./WebGL2Backend";

/** Number of quantized diffuse tones cached per material color (`shade` 0..1 maps to 0..SHADE_LEVELS). */
const SHADE_LEVELS = 64;

/**
 * Maximum triangles per wireframe `stroke()` path. Stroking cost grows superlinearly with path size
 * (105k triangles in one path took ~16 s per frame), while batched fills stay linear and are not capped.
 */
const MAX_WIRE_RUN = 64;

/** Distance (px) each opaque triangle vertex is pushed away from the centroid to hide antialiasing seams. */
const SEAM_DILATION_PX = 0.5;

/** Pushes the three screen-space vertices of `tri` `amount` pixels away from its centroid, in place. */
function dilateTriangle(tri: ProjectedTriangle, amount: number): void {
    const cx = (tri.x0 + tri.x1 + tri.x2) / 3;
    const cy = (tri.y0 + tri.y1 + tri.y2) / 3;
    let dx = tri.x0 - cx;
    let dy = tri.y0 - cy;
    let len = Math.hypot(dx, dy);
    if (len > 0) {
        tri.x0 += (dx / len) * amount;
        tri.y0 += (dy / len) * amount;
    }
    dx = tri.x1 - cx;
    dy = tri.y1 - cy;
    len = Math.hypot(dx, dy);
    if (len > 0) {
        tri.x1 += (dx / len) * amount;
        tri.y1 += (dy / len) * amount;
    }
    dx = tri.x2 - cx;
    dy = tri.y2 - cy;
    len = Math.hypot(dx, dy);
    if (len > 0) {
        tri.x2 += (dx / len) * amount;
        tri.y2 += (dy / len) * amount;
    }
}

/** Back-to-front comparator for the Painter's Algorithm (module-level to avoid per-frame closures). */
function compareTriangleDepth(a: ProjectedTriangle, b: ProjectedTriangle): number {
    return b.depth - a.depth;
}

/** Writes the clip-space position `m * (x, y, z, 1)` into `out[offset .. offset + 3]`. */
function toClip(out: Float64Array, offset: number, m: Mat4, x: number, y: number, z: number): void {
    out[offset] = m[0] * x + m[4] * y + m[8] * z + m[12];
    out[offset + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
    out[offset + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
    out[offset + 3] = m[3] * x + m[7] * y + m[11] * z + m[15];
}

/**
 * Sutherland-Hodgman clipping of a clip-space triangle against the near plane (`z >= -w`).
 * `d0..d2` are the signed vertex distances `z + w`; the clipped convex polygon (3 or 4 vertices) is written to `out`.
 *
 * @returns Number of vertices written (`0` when the whole triangle is behind the plane)
 */
function clipAgainstNearPlane(
    tri: Float64Array,
    d0: number,
    d1: number,
    d2: number,
    out: Float64Array,
): number {
    let count = 0;
    for (let a = 0; a < 3; a++) {
        const b = a === 2 ? 0 : a + 1;
        const da = a === 0 ? d0 : a === 1 ? d1 : d2;
        const db = b === 0 ? d0 : b === 1 ? d1 : d2;
        const oa = a * 4;
        const ob = b * 4;
        if (da >= 0) {
            const o = count * 4;
            out[o] = tri[oa];
            out[o + 1] = tri[oa + 1];
            out[o + 2] = tri[oa + 2];
            out[o + 3] = tri[oa + 3];
            count++;
        }
        if (da >= 0 !== db >= 0) {
            const t = da / (da - db);
            const o = count * 4;
            out[o] = tri[oa] + (tri[ob] - tri[oa]) * t;
            out[o + 1] = tri[oa + 1] + (tri[ob + 1] - tri[oa + 1]) * t;
            out[o + 2] = tri[oa + 2] + (tri[ob + 2] - tri[oa + 2]) * t;
            out[o + 3] = tri[oa + 3] + (tri[ob + 3] - tri[oa + 3]) * t;
            count++;
        }
    }
    return count;
}

interface ProjectedTriangle {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    depth: number;
    /** Pre-shaded fill tone, base fill color (overlay fallback), or wireframe stroke color. */
    style: string;
    /** Material opacity applied through `globalAlpha`. */
    alpha: number;
    /** Darkening overlay alpha for colors without a tone ramp (`0` = none). */
    overlay: number;
    /** Whether the triangle is stroked as wireframe instead of filled. */
    wire: boolean;
}

/**
 * Universal fallback `Canvas2D` + **Software 3D Projector/Rasterizer** implementing `RenderBackend`.
 * Projects 3D mesh triangles through `viewProjMatrix * worldMatrix`, performs backface culling,
 * and queues shaded triangles; `endFrame()` sorts every triangle of the pass back-to-front (*Painter's
 * Algorithm*, across all meshes) and rasterizes them onto any `CanvasRenderingContext2D` or
 * `OffscreenCanvasRenderingContext2D`.
 *
 * @example
 * ```ts
 * const backend = new Canvas2DBackend();
 * await backend.init(canvas);
 * backend.beginFrame({ x: 0, y: 0, width: 1, height: 1 });
 * backend.renderMesh3D(cubeMesh, material, obj.transform.worldMatrix, cam.viewProjectionMatrix);
 * backend.endFrame();
 * ```
 */
export class Canvas2DBackend implements RenderBackend {
    public readonly backendType: RenderBackendType = "canvas2d";
    #surface?: HTMLCanvasElement | OffscreenCanvas;
    #ctx?: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    #activeViewport: ViewportRect = { x: 0, y: 0, width: 1, height: 1 };
    readonly #mvpScratch: Mat4 = Matrix4.create();
    /** Reusable triangle records so rasterizing a mesh does not allocate per frame. */
    readonly #trianglePool: ProjectedTriangle[] = [];
    /** View into `#trianglePool` holding the triangles queued since `beginFrame()`. */
    readonly #triangles: ProjectedTriangle[] = [];
    #trianglesRendered = 0;
    /** Clip-space `x, y, z, w` of the current triangle's 3 vertices. */
    readonly #clipScratch = new Float64Array(12);
    /** Triangle after near-plane clipping: up to 4 clip-space vertices. */
    readonly #polyScratch = new Float64Array(16);
    readonly #screenX = new Float64Array(4);
    readonly #screenY = new Float64Array(4);
    /**
     * Diffuse tone ramps keyed by `material.color`: `SHADE_LEVELS + 1` precomputed CSS colors, or `null`
     * when the color could not be resolved (rasterized with the darkening overlay fallback).
     */
    readonly #shadeRamps = new Map<string, { tones: string[]; opaque: boolean } | null>();
    /** Lights of the current pass (the default rig until `setLights()` is called). */
    readonly #lights: LightingEnvironment = buildLightingEnvironment(
        BrioLight.createDefaultRig(),
        createLightingEnvironment(),
    );

    /**
     * Sets the lights of the following draws. The software rasterizer darkens each triangle's base color by
     * the sRGB-encoded luminance of the light reaching it (colored light is approximated by its luminance).
     *
     * @param environment Lights reduced by `buildLightingEnvironment()`
     */
    public setLights(environment: LightingEnvironment): void {
        const own = this.#lights;
        if (environment.key === own.key) return;
        own.ambient.set(environment.ambient);
        own.sky.set(environment.sky);
        own.ground.set(environment.ground);
        own.directions.set(environment.directions);
        own.colors.set(environment.colors);
        own.directionalCount = environment.directionalCount;
        own.key = environment.key;
    }

    /**
     * Initializes the 2D context on `surface`.
     *
     * @param surface `HTMLCanvasElement` or `OffscreenCanvas`
     * @returns `true` if a 2D context was acquired
     */
    public async init(surface: HTMLCanvasElement | OffscreenCanvas): Promise<boolean> {
        this.#surface = surface;
        this.#ctx = surface.getContext("2d") as
            | CanvasRenderingContext2D
            | OffscreenCanvasRenderingContext2D
            | null;
        return Boolean(this.#ctx);
    }

    /**
     * Begins a frame pass for `viewport` and optionally fills `clearColor`.
     *
     * @param viewport Normalized viewport `[0..1]`
     * @param clearColor Optional CSS color string
     */
    public beginFrame(viewport: ViewportRect, clearColor?: string): void {
        this.#triangles.length = 0;
        if (!this.#ctx || !this.#surface) return;
        this.#activeViewport = viewport;

        const w = this.#surface.width;
        const h = this.#surface.height;
        const vx = Math.round(viewport.x * w);
        const vy = Math.round(viewport.y * h);
        const vw = Math.round(viewport.width * w);
        const vh = Math.round(viewport.height * h);

        this.#ctx.save();
        this.#ctx.beginPath();
        this.#ctx.rect(vx, vy, vw, vh);
        this.#ctx.clip();

        if (clearColor) {
            this.#ctx.fillStyle = clearColor;
            this.#ctx.fillRect(vx, vy, vw, vh);
        } else {
            this.#ctx.clearRect(vx, vy, vw, vh);
        }
    }

    /**
     * Projects a 3D `BrioMesh` with the Software 3D Projector, culls back faces, shades each triangle,
     * and queues it for `endFrame()`, which depth-sorts the whole pass before rasterizing.
     *
     * @param mesh 3D `BrioMesh` geometry
     * @param material `BrioMaterial` appearance
     * @param worldMatrix Object 4x4 world matrix
     * @param viewProjMatrix Camera 4x4 view-projection matrix
     */
    public renderMesh3D(
        mesh: BrioMesh,
        material: BrioMaterial,
        worldMatrix: Mat4,
        viewProjMatrix: Mat4,
    ): void {
        if (!this.#ctx || !this.#surface) return;

        const w = this.#surface.width;
        const h = this.#surface.height;
        const vx = this.#activeViewport.x * w;
        const vy = this.#activeViewport.y * h;
        const vw = this.#activeViewport.width * w;
        const vh = this.#activeViewport.height * h;

        Matrix4.multiply(this.#mvpScratch, viewProjMatrix, worldMatrix);

        const pos = mesh.positions;
        const norm = mesh.normals;
        const idx = mesh.indices;
        const ramp = material.wireframe ? null : this.#shadeRampFor(material.color);
        // Opaque triangles are dilated by half a pixel so antialiased shared edges do not let the
        // background bleed through; translucent ones are not, because the overlap would double the alpha
        const dilation =
            ramp !== null && ramp.opaque && material.opacity >= 1 ? SEAM_DILATION_PX : 0;

        const m = this.#mvpScratch;
        const clip = this.#clipScratch;
        const poly = this.#polyScratch;
        const sx = this.#screenX;
        const sy = this.#screenY;

        for (let i = 0; i < idx.length; i += 3) {
            const i0 = idx[i] * 3;
            const i1 = idx[i + 1] * 3;
            const i2 = idx[i + 2] * 3;

            // Clip-space positions (x, y, z, w) of the 3 vertices
            toClip(clip, 0, m, pos[i0], pos[i0 + 1], pos[i0 + 2]);
            toClip(clip, 4, m, pos[i1], pos[i1 + 1], pos[i1 + 2]);
            toClip(clip, 8, m, pos[i2], pos[i2 + 1], pos[i2 + 2]);

            // Signed distances to the near plane (z = -w); negative means behind it
            const d0 = clip[2] + clip[3];
            const d1 = clip[6] + clip[7];
            const d2 = clip[10] + clip[11];
            if (d0 < 0 && d1 < 0 && d2 < 0) continue;

            let count = 3;
            if (d0 >= 0 && d1 >= 0 && d2 >= 0) {
                for (let k = 0; k < 12; k++) poly[k] = clip[k];
            } else {
                // Without clipping, vertices behind the camera project mirrored (w < 0) across the screen
                count = clipAgainstNearPlane(clip, d0, d1, d2, poly);
                if (count < 3) continue;
            }

            // Perspective divide and NDC [-1, 1] -> viewport pixels
            let depthSum = 0;
            for (let k = 0; k < count; k++) {
                const o = k * 4;
                const w = poly[o + 3] || 1e-6;
                sx[k] = vx + ((poly[o] / w) * 0.5 + 0.5) * vw;
                sy[k] = vy + ((-poly[o + 1] / w) * 0.5 + 0.5) * vh;
                depthSum += poly[o + 2] / w;
            }

            // Backface culling: screen Y points down, so counter-clockwise (front-facing) triangles in
            // world space have a negative screen-space cross product; clipping preserves the winding
            const cross = (sx[1] - sx[0]) * (sy[2] - sy[0]) - (sy[1] - sy[0]) * (sx[2] - sx[0]);
            const backFacing = cross >= 0;
            if (backFacing && !material.wireframe && !material.doubleSided) {
                continue;
            }

            let shade = 1;
            if (material.shading !== "unlit" && norm.length >= i2 + 3) {
                // Average of the 3 vertex normals approximates the smooth surface normal at the centroid;
                // the back side of a double-sided triangle is lit with the flipped normal
                const facing = backFacing ? -1 : 1;
                const nx = norm[i0] + norm[i1] + norm[i2];
                const ny = norm[i0 + 1] + norm[i1 + 1] + norm[i2 + 1];
                const nz = norm[i0 + 2] + norm[i1 + 2] + norm[i2 + 2];
                const k = facing / (Math.hypot(nx, ny, nz) || 1);
                const luminance = irradianceLuminance(this.#lights, nx * k, ny * k, nz * k);
                shade = linearToSrgb(Math.min(1, luminance));
            }

            const depth = depthSum / count;
            // A clipped triangle becomes a convex polygon of up to 4 vertices: emit it as a fan
            for (let k = 1; k + 1 < count; k++) {
                this.#queueTriangle(
                    sx[0],
                    sy[0],
                    sx[k],
                    sy[k],
                    sx[k + 1],
                    sy[k + 1],
                    depth,
                    material,
                    ramp,
                    dilation,
                    shade,
                );
            }
        }
    }

    /** Stores one screen-space triangle in the pass queue (reusing pooled records). */
    #queueTriangle(
        x0: number,
        y0: number,
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        depth: number,
        material: BrioMaterial,
        ramp: { tones: string[]; opaque: boolean } | null,
        dilation: number,
        shade: number,
    ): void {
        const triangles = this.#triangles;
        let tri = this.#trianglePool[triangles.length];
        if (!tri) {
            tri = {
                x0: 0,
                y0: 0,
                x1: 0,
                y1: 0,
                x2: 0,
                y2: 0,
                depth: 0,
                style: "",
                alpha: 1,
                overlay: 0,
                wire: false,
            };
            this.#trianglePool.push(tri);
        }
        tri.x0 = x0;
        tri.y0 = y0;
        tri.x1 = x1;
        tri.y1 = y1;
        tri.x2 = x2;
        tri.y2 = y2;
        tri.depth = depth;
        tri.alpha = material.opacity;
        tri.wire = material.wireframe;
        if (ramp !== null) {
            // Pre-shaded tone: no per-triangle string allocation
            tri.style = ramp.tones[Math.round(shade * SHADE_LEVELS)];
            tri.overlay = 0;
            if (dilation > 0) dilateTriangle(tri, dilation);
        } else {
            tri.style = material.color;
            tri.overlay = material.wireframe ? 0 : 1 - shade;
        }
        triangles.push(tri);
    }

    /**
     * Returns the cached diffuse tone ramp for `color`, resolving any CSS color through the context
     * (`fillStyle` normalizes named, `hsl()`, and hex colors to `"#rrggbb"` / `"rgba(...)"`).
     */
    #shadeRampFor(color: string): { tones: string[]; opaque: boolean } | null {
        const cached = this.#shadeRamps.get(color);
        if (cached !== undefined) return cached;

        const ctx = this.#ctx!;
        const previous = ctx.fillStyle;
        ctx.fillStyle = "#000000";
        ctx.fillStyle = color;
        const rgba = typeof ctx.fillStyle === "string" ? parseCanvasColor(ctx.fillStyle) : undefined;
        ctx.fillStyle = previous;

        let ramp: { tones: string[]; opaque: boolean } | null = null;
        if (rgba) {
            const [r, g, b, a] = rgba;
            const tones: string[] = new Array(SHADE_LEVELS + 1);
            for (let level = 0; level <= SHADE_LEVELS; level++) {
                const k = level / SHADE_LEVELS;
                const rgb = `${Math.round(r * k)}, ${Math.round(g * k)}, ${Math.round(b * k)}`;
                tones[level] = a < 1 ? `rgba(${rgb}, ${a})` : `rgb(${rgb})`;
            }
            ramp = { tones, opaque: a >= 1 };
        }
        this.#shadeRamps.set(color, ramp);
        return ramp;
    }

    /**
     * Rasterizes every triangle queued since `beginFrame()` back-to-front, then restores the viewport clip.
     */
    public endFrame(): void {
        if (!this.#ctx) return;
        this.#flushTriangles(this.#ctx);
        this.#ctx.restore();
    }

    /**
     * Number of triangles rasterized by the last `endFrame()` (after back-face culling).
     */
    public get trianglesRendered(): number {
        return this.#trianglesRendered;
    }

    /**
     * Depth-sorts the queued triangles of the pass and rasterizes them. Consecutive triangles sharing a style,
     * opacity, and mode go into one path with a single `fill()` / `stroke()`, so draw order is unchanged.
     */
    #flushTriangles(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D): void {
        const triangles = this.#triangles;
        this.#trianglesRendered = triangles.length;
        if (triangles.length === 0) return;

        // Painter's Algorithm over the whole pass: sort back-to-front (largest depth first)
        triangles.sort(compareTriangleDepth);

        let open = false;
        let style = "";
        let alpha = -1;
        let wire = false;
        let runLength = 0;
        for (let i = 0; i < triangles.length; i++) {
            const tri = triangles[i];

            if (tri.overlay > 0) {
                // Fallback lighting: darken the base color by `overlay` without parsing CSS colors
                if (open) {
                    if (wire) ctx.stroke();
                    else ctx.fill();
                    open = false;
                }
                ctx.globalAlpha = tri.alpha;
                ctx.beginPath();
                ctx.moveTo(tri.x0, tri.y0);
                ctx.lineTo(tri.x1, tri.y1);
                ctx.lineTo(tri.x2, tri.y2);
                ctx.closePath();
                ctx.fillStyle = tri.style;
                ctx.fill();
                ctx.fillStyle = `rgba(0, 0, 0, ${tri.overlay.toFixed(3)})`;
                ctx.fill();
                continue;
            }

            if (
                !open ||
                tri.style !== style ||
                tri.alpha !== alpha ||
                tri.wire !== wire ||
                (wire && runLength >= MAX_WIRE_RUN)
            ) {
                if (open) {
                    if (wire) ctx.stroke();
                    else ctx.fill();
                }
                style = tri.style;
                alpha = tri.alpha;
                wire = tri.wire;
                ctx.globalAlpha = alpha;
                if (wire) ctx.strokeStyle = style;
                else ctx.fillStyle = style;
                ctx.beginPath();
                open = true;
                runLength = 0;
            }
            runLength++;
            ctx.moveTo(tri.x0, tri.y0);
            ctx.lineTo(tri.x1, tri.y1);
            ctx.lineTo(tri.x2, tri.y2);
            ctx.closePath();
        }
        if (open) {
            if (wire) ctx.stroke();
            else ctx.fill();
        }
        triangles.length = 0;
    }

    /**
     * Releases references to the canvas surface and 2D context.
     */
    public dispose(): void {
        this.#ctx = null;
        this.#surface = undefined;
    }
}

/**
 * Multi-backend graphics selector and factory (`BrioRenderer`).
 * Resolves the highest-priority graphics API that is both **supported by the runtime** and
 * **implemented by BrioJS**, following the cascade `WebGPU -> WebGL2 -> WebGL1 -> Canvas2D` (ADR-0001).
 * Backends that are not implemented yet are never selected, so the result can always be instantiated
 * through `createBackend()`. `initBackend()` walks the same cascade at runtime: when a backend fails to
 * initialize (blocklisted driver, context limit, `requestAdapter()` returning `null`), the **next** one is tried.
 *
 * @example
 * ```ts
 * const backend = await BrioRenderer.initBackend(canvas); // WebGL2Backend when it initializes, else Canvas2DBackend
 * ```
 */
export class BrioRenderer {
    /** Factories of the backends implemented by BrioJS, keyed by `RenderBackendType`. */
    static readonly #factories = new Map<RenderBackendType, () => RenderBackend>([
        ["webgl2", () => new WebGL2Backend()],
        ["canvas2d", () => new Canvas2DBackend()],
    ]);

    /**
     * Backend types implemented by BrioJS, in cascade priority order.
     *
     * @returns Implemented `RenderBackendType` identifiers
     * @example
     * ```ts
     * BrioRenderer.implementedBackends(); // ["webgl2", "canvas2d"]
     * ```
     */
    public static implementedBackends(): RenderBackendType[] {
        return BACKEND_CASCADE.filter((type) => this.#factories.has(type));
    }

    /**
     * Registers (or replaces) the factory of a backend type, making it eligible for the cascade.
     * Passing `undefined` unregisters it; `"canvas2d"` cannot be unregistered because it is the universal fallback.
     *
     * @param type Backend identifier
     * @param factory Function creating an uninitialized backend, or `undefined` to unregister
     * @example
     * ```ts
     * BrioRenderer.registerBackend("webgpu", () => new MyWebGPUBackend());
     * ```
     */
    public static registerBackend(
        type: RenderBackendType,
        factory: (() => RenderBackend) | undefined,
    ): void {
        if (factory) this.#factories.set(type, factory);
        else if (type !== "canvas2d") this.#factories.delete(type);
    }

    /** Whether `type` is implemented and reported as supported by the runtime. */
    static #isUsable(type: RenderBackendType): boolean {
        if (!this.#factories.has(type)) return false;
        const caps = PlatformAdapter.detectCapabilities();
        switch (type) {
            case "webgpu":
                return caps.supportsWebGPU;
            case "webgl2":
                return caps.supportsWebGL2;
            case "webgl1":
                return caps.supportsWebGL1;
            case "canvas2d":
                return true;
        }
    }

    /**
     * Ordered list of backends worth trying: `preferred` first (when usable), then every usable backend of
     * the cascade, always ending with `"canvas2d"`.
     *
     * @param preferred Preferred backend or `"auto"`
     * @returns Distinct `RenderBackendType` candidates in the order `initBackend()` tries them
     * @example
     * ```ts
     * BrioRenderer.backendCandidates("auto"); // ["webgl2", "canvas2d"]
     * ```
     */
    public static backendCandidates(
        preferred: RenderBackendType | "auto" = "auto",
    ): RenderBackendType[] {
        const candidates: RenderBackendType[] = [];
        if (preferred !== "auto" && this.#isUsable(preferred)) candidates.push(preferred);
        for (let i = 0; i < BACKEND_CASCADE.length; i++) {
            const type = BACKEND_CASCADE[i];
            if (!candidates.includes(type) && this.#isUsable(type)) candidates.push(type);
        }
        return candidates;
    }

    /**
     * Resolves the optimal `RenderBackendType` based on `preferred`, runtime capabilities, and implemented backends.
     * A `preferred` backend that is unsupported or not implemented falls back to the cascade.
     *
     * @param preferred Preferred backend or `"auto"` for cascade selection (`webgpu -> webgl2 -> webgl1 -> canvas2d`)
     * @returns Selected `RenderBackendType` (always instantiable via `createBackend`)
     * @example
     * ```ts
     * const backendType = BrioRenderer.selectBestBackendType("auto");
     * ```
     */
    public static selectBestBackendType(
        preferred: RenderBackendType | "auto" = "auto",
    ): RenderBackendType {
        return this.backendCandidates(preferred)[0] ?? "canvas2d";
    }

    /**
     * Instantiates the backend chosen by `selectBestBackendType(preferred)`.
     *
     * @param preferred Preferred backend or `"auto"`
     * @returns Uninitialized `RenderBackend` (call `init(surface)` before rendering)
     * @example
     * ```ts
     * const backend = BrioRenderer.createBackend();
     * await backend.init(canvas);
     * ```
     */
    public static createBackend(preferred: RenderBackendType | "auto" = "auto"): RenderBackend {
        const type = this.selectBestBackendType(preferred);
        return this.#factories.get(type)!();
    }

    /**
     * Creates and initializes the first backend of `backendCandidates(preferred)` whose `init(surface)` succeeds.
     * A backend whose `init()` resolves `false` or throws is disposed and the **next** candidate is tried
     * (`webgpu -> webgl2 -> webgl1 -> canvas2d`), instead of jumping straight to `"canvas2d"`.
     *
     * @param surface Target rendering surface
     * @param preferred Preferred backend or `"auto"`
     * @param onFailure Optional callback invoked for each backend that failed, with the error when `init()` threw
     * @returns The initialized backend, or `undefined` when every candidate (including `"canvas2d"`) failed
     * @example
     * ```ts
     * const backend = await BrioRenderer.initBackend(canvas, "auto", (type) => console.warn(`${type} failed`));
     * ```
     */
    public static async initBackend(
        surface: HTMLCanvasElement | OffscreenCanvas,
        preferred: RenderBackendType | "auto" = "auto",
        onFailure?: (type: RenderBackendType, error?: unknown) => void,
    ): Promise<RenderBackend | undefined> {
        const candidates = this.backendCandidates(preferred);
        for (let i = 0; i < candidates.length; i++) {
            const factory = this.#factories.get(candidates[i]);
            if (!factory) continue;
            const backend = factory();
            let ready = false;
            let error: unknown;
            try {
                ready = await backend.init(surface);
            } catch (err) {
                error = err;
            }
            if (ready) return backend;
            backend.dispose();
            onFailure?.(candidates[i], error);
        }
        return undefined;
    }
}

/** Cascade priority order of all backend identifiers (ADR-0001). */
const BACKEND_CASCADE: RenderBackendType[] = ["webgpu", "webgl2", "webgl1", "canvas2d"];
