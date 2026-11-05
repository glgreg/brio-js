import { BrioMaterial } from "../../assets/BrioMaterial";
import { BrioMesh } from "../../assets/BrioMesh";
import type { BrioTexture } from "../../assets/BrioTexture";
import { ViewportRect } from "../../core/BrioViewport";
import { Mat4 } from "../../math/mat4";
import { LightingEnvironment } from "../lighting";

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
     * Sets the lights used by the following `renderMesh3D()` calls (called by the compositor before each 3D pass).
     * Backends without lighting support may omit it; until it is called, the default rig is used.
     *
     * @param environment Lights of the pass reduced to linear-light shader values
     */
    setLights?(environment: LightingEnvironment): void;

    /**
     * Renders a 3D `BrioMesh` with `BrioMaterial` transformed by `worldMatrix` and `viewProjMatrix`.
     *
     * @param mesh 3D geometry buffers
     * @param material 3D surface appearance
     * @param worldMatrix Object 4x4 local-to-world matrix
     * @param viewProjMatrix Camera 4x4 view-projection matrix
     * @param opacity Object opacity (`transform.opacity`, defaults to `1`), multiplied with `material.opacity`
     */
    renderMesh3D(
        mesh: BrioMesh,
        material: BrioMaterial,
        worldMatrix: Mat4,
        viewProjMatrix: Mat4,
        opacity?: number,
    ): void;

    /**
     * Finalizes the current frame pass and flushes pending draw calls.
     */
    endFrame(): void;

    /**
     * Optional: frees the GPU copy of `mesh` (called when the mesh is unloaded with `game.unloadAsset()`).
     */
    releaseMesh?(mesh: BrioMesh): void;

    /**
     * Optional: frees the GPU copy of `texture` (called when its last material is unloaded).
     */
    releaseTexture?(texture: BrioTexture): void;

    /**
     * Releases all GPU/context resources associated with this backend.
     */
    dispose(): void;
}
