import { PlatformAdapter } from "../tools/PlatformAdapter";
import { RenderBackend, RenderBackendType } from "./contracts/RenderBackend";

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
    /**
     * Factories of the backends implemented by BrioJS, keyed by `RenderBackendType`. The built-in backends are
     * imported on demand, so a `"2d"` game that never initializes a 3D backend does not bundle them eagerly.
     */
    static readonly #factories = new Map<RenderBackendType, RenderBackendFactory>([
        ["webgl2", loadWebGL2Backend],
        ["canvas2d", loadCanvas2DBackend],
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
     * The factory may be asynchronous, e.g. to `import()` the backend module on demand.
     *
     * @param type Backend identifier
     * @param factory Function creating (or resolving) an uninitialized backend, or `undefined` to unregister
     * @example
     * ```ts
     * BrioRenderer.registerBackend("webgpu", () => new MyWebGPUBackend());
     * ```
     */
    public static registerBackend(
        type: RenderBackendType,
        factory: RenderBackendFactory | undefined,
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
     * Instantiates the backend chosen by `selectBestBackendType(preferred)`, loading its module on demand.
     *
     * @param preferred Preferred backend or `"auto"`
     * @returns Promise resolving to an uninitialized `RenderBackend` (call `init(surface)` before rendering)
     * @example
     * ```ts
     * const backend = await BrioRenderer.createBackend();
     * await backend.init(canvas);
     * ```
     */
    public static async createBackend(
        preferred: RenderBackendType | "auto" = "auto",
    ): Promise<RenderBackend> {
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
            let backend: RenderBackend | undefined;
            let ready = false;
            let error: unknown;
            try {
                // A factory that cannot load its module (offline chunk, CSP) counts as a failed backend
                backend = await factory();
                ready = await backend.init(surface);
            } catch (err) {
                error = err;
            }
            if (ready && backend) return backend;
            backend?.dispose();
            onFailure?.(candidates[i], error);
        }
        return undefined;
    }
}

/** Creates (or resolves) an uninitialized `RenderBackend`; registered through `BrioRenderer.registerBackend()`. */
export type RenderBackendFactory = () => RenderBackend | Promise<RenderBackend>;

/** Loads the WebGL2 backend module on demand (code-split by bundlers). */
async function loadWebGL2Backend(): Promise<RenderBackend> {
    const { WebGL2Backend } = await import("./WebGL2Backend");
    return new WebGL2Backend();
}

/** Loads the Canvas2D software backend module on demand (code-split by bundlers). */
async function loadCanvas2DBackend(): Promise<RenderBackend> {
    const { Canvas2DBackend } = await import("./Canvas2DBackend");
    return new Canvas2DBackend();
}

/** Cascade priority order of all backend identifiers (ADR-0001). */
const BACKEND_CASCADE: RenderBackendType[] = ["webgpu", "webgl2", "webgl1", "canvas2d"];
