import { BrioMaterial } from "../../assets/BrioMaterial";
import { BrioMesh } from "../../assets/BrioMesh";
import { ViewportRect } from "../../core/BrioViewport";
import { Mat4 } from "../../math/mat4";

/**
 * Supported rendering backend identifiers in priority order (`webgpu -> webgl2 -> webgl1 -> canvas2d`).
 */
export type RenderBackendType = "webgpu" | "webgl2" | "webgl1" | "canvas2d";

/**
 * Deterministic rendering contract (`RenderBackend`) implemented by all BrioJS graphics backends
 * (ADR-0001). Guarantees visual parity across WebGPU, WebGL2, WebGL1, and Canvas2D.
 */
export interface RenderBackend {
    /** Identifier of the active graphics API. */
    readonly backendType: RenderBackendType;

    /**
     * Initializes the backend on the provided `<canvas>` or `OffscreenCanvas`.
     *
     * @param surface Target rendering surface
     * @returns Promise resolving to `true` if initialization succeeded
     */
    init(surface: HTMLCanvasElement | OffscreenCanvas): Promise<boolean>;

    /**
     * Begins a frame pass within the specified normalized `viewport`.
     *
     * @param viewport Normalized `[0..1]` viewport region
     * @param clearColor Optional CSS background clear color
     */
    beginFrame(viewport: ViewportRect, clearColor?: string): void;

    /**
     * Renders a 3D `BrioMesh` with `BrioMaterial` transformed by `worldMatrix` and `viewProjMatrix`.
     *
     * @param mesh 3D geometry buffers
     * @param material 3D surface appearance
     * @param worldMatrix Object 4x4 local-to-world matrix
     * @param viewProjMatrix Camera 4x4 view-projection matrix
     */
    renderMesh3D(
        mesh: BrioMesh,
        material: BrioMaterial,
        worldMatrix: Mat4,
        viewProjMatrix: Mat4,
    ): void;

    /**
     * Finalizes the current frame pass and flushes pending draw calls.
     */
    endFrame(): void;

    /**
     * Releases all GPU/context resources associated with this backend.
     */
    dispose(): void;
}
