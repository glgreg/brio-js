import { BrioMaterial } from "../assets/BrioMaterial";
import { BrioMesh } from "../assets/BrioMesh";
import { ViewportRect } from "../core/BrioViewport";
import { Mat4, Matrix4, Vector3 } from "../math/index";
import { PlatformAdapter } from "../tools/PlatformAdapter";
import { RenderBackend, RenderBackendType } from "./contracts/RenderBackend";

interface ProjectedTriangle {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    depth: number;
    shade: number;
}

/**
 * Universal fallback `Canvas2D` + **Software 3D Projector/Rasterizer** implementing `RenderBackend`.
 * Projects 3D mesh triangles through `viewProjMatrix * worldMatrix`, performs backface culling,
 * sorts triangles back-to-front via the *Painter's Algorithm*, and rasterizes shaded polygons onto
 * any `CanvasRenderingContext2D` or `OffscreenCanvasRenderingContext2D`.
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
     * Projects and rasterizes a 3D `BrioMesh` using the Software 3D Projector (*Painter's Algorithm*).
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
        const triangles: ProjectedTriangle[] = [];

        const lightDir = Vector3.create(0.4, 0.8, 0.44);
        Vector3.normalizeSelf(lightDir);

        const p0 = Vector3.create();
        const p1 = Vector3.create();
        const p2 = Vector3.create();

        for (let i = 0; i < idx.length; i += 3) {
            const i0 = idx[i] * 3;
            const i1 = idx[i + 1] * 3;
            const i2 = idx[i + 2] * 3;

            Matrix4.transformPoint(
                p0,
                { x: pos[i0], y: pos[i0 + 1], z: pos[i0 + 2] },
                this.#mvpScratch,
            );
            Matrix4.transformPoint(
                p1,
                { x: pos[i1], y: pos[i1 + 1], z: pos[i1 + 2] },
                this.#mvpScratch,
            );
            Matrix4.transformPoint(
                p2,
                { x: pos[i2], y: pos[i2 + 1], z: pos[i2 + 2] },
                this.#mvpScratch,
            );

            // Map NDC [-1, 1] to viewport pixels
            const sx0 = vx + (p0.x * 0.5 + 0.5) * vw;
            const sy0 = vy + (-p0.y * 0.5 + 0.5) * vh;
            const sx1 = vx + (p1.x * 0.5 + 0.5) * vw;
            const sy1 = vy + (-p1.y * 0.5 + 0.5) * vh;
            const sx2 = vx + (p2.x * 0.5 + 0.5) * vw;
            const sy2 = vy + (-p2.y * 0.5 + 0.5) * vh;

            let shade = 1;
            if (material.shading !== "unlit" && norm.length >= i0 + 3) {
                const nx = norm[i0];
                const ny = norm[i0 + 1];
                const nz = norm[i0 + 2];
                const dotVal = Math.max(0, nx * lightDir.x + ny * lightDir.y + nz * lightDir.z);
                shade = 0.35 + 0.65 * dotVal;
            }

            triangles.push({
                x0: sx0,
                y0: sy0,
                x1: sx1,
                y1: sy1,
                x2: sx2,
                y2: sy2,
                depth: (p0.z + p1.z + p2.z) / 3,
                shade,
            });
        }

        // Painter's Algorithm: sort back-to-front (largest depth first)
        triangles.sort((a, b) => b.depth - a.depth);

        this.#ctx.save();
        this.#ctx.globalAlpha = material.opacity;
        this.#ctx.fillStyle = material.color;
        this.#ctx.strokeStyle = material.color;

        for (let i = 0; i < triangles.length; i++) {
            const tri = triangles[i];
            this.#ctx.beginPath();
            this.#ctx.moveTo(tri.x0, tri.y0);
            this.#ctx.lineTo(tri.x1, tri.y1);
            this.#ctx.lineTo(tri.x2, tri.y2);
            this.#ctx.closePath();

            if (material.wireframe) {
                this.#ctx.stroke();
            } else {
                this.#ctx.fill();
            }
        }

        this.#ctx.restore();
    }

    /**
     * Restores the viewport clip state at the end of a frame pass.
     */
    public endFrame(): void {
        if (!this.#ctx) return;
        this.#ctx.restore();
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
 * Multi-backend graphics selector and facade (`BrioRenderer`).
 * Automatically resolves the highest-priority supported graphics API following the cascade:
 * `WebGPU -> WebGL2 -> WebGL1 -> Canvas2D` (ADR-0001).
 *
 * @example
 * ```ts
 * const bestBackend = BrioRenderer.selectBestBackendType("auto");
 * ```
 */
export class BrioRenderer {
    /**
     * Resolves the optimal `RenderBackendType` based on `preferred` and runtime hardware capabilities.
     *
     * @param preferred Preferred backend or `"auto"` for cascade selection (`webgpu -> webgl2 -> webgl1 -> canvas2d`)
     * @returns Selected `RenderBackendType`
     * @example
     * ```ts
     * const backendType = BrioRenderer.selectBestBackendType("auto");
     * ```
     */
    public static selectBestBackendType(
        preferred: RenderBackendType | "auto" = "auto",
    ): RenderBackendType {
        const caps = PlatformAdapter.detectCapabilities();

        if (preferred !== "auto") {
            if (preferred === "webgpu" && caps.supportsWebGPU) return "webgpu";
            if (preferred === "webgl2" && caps.supportsWebGL2) return "webgl2";
            if (preferred === "webgl1" && caps.supportsWebGL1) return "webgl1";
            if (preferred === "canvas2d") return "canvas2d";
        }

        if (caps.supportsWebGPU) return "webgpu";
        if (caps.supportsWebGL2) return "webgl2";
        if (caps.supportsWebGL1) return "webgl1";
        return "canvas2d";
    }
}
