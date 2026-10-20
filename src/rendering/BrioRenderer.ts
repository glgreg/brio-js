import { BrioMaterial } from "../assets/BrioMaterial";
import { BrioMesh } from "../assets/BrioMesh";
import { ViewportRect } from "../core/BrioViewport";
import { Mat4, Matrix4, Vec3, Vector3 } from "../math/index";
import { PlatformAdapter } from "../tools/PlatformAdapter";
import { parseCanvasColor } from "./color";
import { RenderBackend, RenderBackendType } from "./contracts/RenderBackend";
import { WebGL2Backend } from "./WebGL2Backend";

/** Normalized directional light used by the Software 3D Projector. */
const LIGHT_DIRECTION: Vec3 = Vector3.normalizeSelf(Vector3.create(0.4, 0.8, 0.44));

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
    readonly #srcScratch: Vec3 = { x: 0, y: 0, z: 0 };
    readonly #p0: Vec3 = { x: 0, y: 0, z: 0 };
    readonly #p1: Vec3 = { x: 0, y: 0, z: 0 };
    readonly #p2: Vec3 = { x: 0, y: 0, z: 0 };
    /**
     * Diffuse tone ramps keyed by `material.color`: `SHADE_LEVELS + 1` precomputed CSS colors, or `null`
     * when the color could not be resolved (rasterized with the darkening overlay fallback).
     */
    readonly #shadeRamps = new Map<string, { tones: string[]; opaque: boolean } | null>();

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
        const triangles = this.#triangles;
        const ramp = material.wireframe ? null : this.#shadeRampFor(material.color);
        // Opaque triangles are dilated by half a pixel so antialiased shared edges do not let the
        // background bleed through; translucent ones are not, because the overlap would double the alpha
        const dilation =
            ramp !== null && ramp.opaque && material.opacity >= 1 ? SEAM_DILATION_PX : 0;

        const src = this.#srcScratch;
        const p0 = this.#p0;
        const p1 = this.#p1;
        const p2 = this.#p2;

        for (let i = 0; i < idx.length; i += 3) {
            const i0 = idx[i] * 3;
            const i1 = idx[i + 1] * 3;
            const i2 = idx[i + 2] * 3;

            src.x = pos[i0];
            src.y = pos[i0 + 1];
            src.z = pos[i0 + 2];
            Matrix4.transformPoint(p0, src, this.#mvpScratch);
            src.x = pos[i1];
            src.y = pos[i1 + 1];
            src.z = pos[i1 + 2];
            Matrix4.transformPoint(p1, src, this.#mvpScratch);
            src.x = pos[i2];
            src.y = pos[i2 + 1];
            src.z = pos[i2 + 2];
            Matrix4.transformPoint(p2, src, this.#mvpScratch);

            // Map NDC [-1, 1] to viewport pixels
            const sx0 = vx + (p0.x * 0.5 + 0.5) * vw;
            const sy0 = vy + (-p0.y * 0.5 + 0.5) * vh;
            const sx1 = vx + (p1.x * 0.5 + 0.5) * vw;
            const sy1 = vy + (-p1.y * 0.5 + 0.5) * vh;
            const sx2 = vx + (p2.x * 0.5 + 0.5) * vw;
            const sy2 = vy + (-p2.y * 0.5 + 0.5) * vh;

            // Backface culling: screen Y points down, so counter-clockwise (front-facing) triangles in
            // world space have a negative screen-space cross product; skip the rest
            const cross = (sx1 - sx0) * (sy2 - sy0) - (sy1 - sy0) * (sx2 - sx0);
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
                const len = Math.hypot(nx, ny, nz) || 1;
                const dotVal = Math.max(
                    0,
                    (facing * (nx * LIGHT_DIRECTION.x + ny * LIGHT_DIRECTION.y + nz * LIGHT_DIRECTION.z)) /
                        len,
                );
                shade = 0.35 + 0.65 * dotVal;
            }

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
            tri.x0 = sx0;
            tri.y0 = sy0;
            tri.x1 = sx1;
            tri.y1 = sy1;
            tri.x2 = sx2;
            tri.y2 = sy2;
            tri.depth = (p0.z + p1.z + p2.z) / 3;
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
 * through `createBackend()`.
 *
 * @example
 * ```ts
 * const backend = BrioRenderer.createBackend("auto"); // WebGL2Backend when available, else Canvas2DBackend
 * await backend.init(canvas);
 * ```
 */
export class BrioRenderer {
    /** Factories of the backends implemented by BrioJS, keyed by `RenderBackendType`. */
    static readonly #factories: Partial<Record<RenderBackendType, () => RenderBackend>> = {
        webgl2: () => new WebGL2Backend(),
        canvas2d: () => new Canvas2DBackend(),
    };

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
        return BACKEND_CASCADE.filter((type) => this.#factories[type] !== undefined);
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
        const caps = PlatformAdapter.detectCapabilities();
        const usable = (type: RenderBackendType): boolean => {
            if (this.#factories[type] === undefined) return false;
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
        };

        if (preferred !== "auto" && usable(preferred)) {
            return preferred;
        }
        for (let i = 0; i < BACKEND_CASCADE.length; i++) {
            if (usable(BACKEND_CASCADE[i])) return BACKEND_CASCADE[i];
        }
        return "canvas2d";
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
        return this.#factories[type]!();
    }
}

/** Cascade priority order of all backend identifiers (ADR-0001). */
const BACKEND_CASCADE: RenderBackendType[] = ["webgpu", "webgl2", "webgl1", "canvas2d"];
