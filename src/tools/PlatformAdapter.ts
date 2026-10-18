/**
 * Runtime host platform type detected by `PlatformAdapter`.
 */
export type HostPlatformType = "browser" | "electron" | "capacitor" | "headless";

/**
 * Snapshot of runtime capabilities detected in the current execution environment.
 */
export interface PlatformCapabilities {
    /** Host platform classification. */
    platform: HostPlatformType;
    /** Whether `OffscreenCanvas` and `transferControlToOffscreen` are supported. */
    supportsOffscreenCanvas: boolean;
    /** Whether `SharedArrayBuffer` is available and cross-origin isolated. */
    supportsSharedArrayBuffer: boolean;
    /** Whether the `navigator.gpu` WebGPU API is available. */
    supportsWebGPU: boolean;
    /** Whether `WebGL2RenderingContext` is available. */
    supportsWebGL2: boolean;
    /** Whether `WebGLRenderingContext` (WebGL 1) is available. */
    supportsWebGL1: boolean;
    /** Whether the Web Audio API (`AudioContext`) is available. */
    supportsWebAudio: boolean;
    /** Whether `IndexedDB` is available. */
    supportsIndexedDB: boolean;
}

/**
 * Multi-platform capability detector and lifecycle adapter (`PlatformAdapter`) for Browser,
 * Electron, Capacitor, and Headless test environments.
 *
 * @example
 * ```ts
 * const caps = PlatformAdapter.detectCapabilities();
 * console.log(caps.platform, caps.supportsWebGPU);
 * ```
 */
export class PlatformAdapter {
    /**
     * Detects the host runtime platform (`"browser"`, `"electron"`, `"capacitor"`, or `"headless"`).
     *
     * @returns Detected `HostPlatformType`
     */
    public static detectPlatform(): HostPlatformType {
        if (typeof window === "undefined" || typeof document === "undefined") {
            return "headless";
        }
        const win = window as unknown as Record<string, unknown>;
        if (win.Capacitor !== undefined) {
            return "capacitor";
        }
        const ua = typeof navigator !== "undefined" ? navigator.userAgent.toLowerCase() : "";
        if (ua.includes("electron") || (win.process as Record<string, unknown>)?.type) {
            return "electron";
        }
        if (ua.includes("jsdom") || ua.includes("happy-dom")) {
            return "headless";
        }
        return "browser";
    }

    /**
     * Probes the current runtime for graphics, threading, audio, and storage capabilities.
     *
     * @returns Complete `PlatformCapabilities` report
     * @example
     * ```ts
     * const caps = PlatformAdapter.detectCapabilities();
     * ```
     */
    public static detectCapabilities(): PlatformCapabilities {
        const platform = this.detectPlatform();
        const supportsOffscreenCanvas =
            typeof OffscreenCanvas !== "undefined" &&
            typeof HTMLCanvasElement !== "undefined" &&
            typeof HTMLCanvasElement.prototype.transferControlToOffscreen === "function";

        const supportsSharedArrayBuffer = typeof SharedArrayBuffer !== "undefined";
        const supportsWebGPU =
            typeof navigator !== "undefined" &&
            "gpu" in navigator &&
            (navigator as unknown as { gpu?: unknown }).gpu !== undefined;

        let supportsWebGL2 = false;
        let supportsWebGL1 = false;

        if (typeof document !== "undefined" && platform !== "headless") {
            try {
                const probeCanvas = document.createElement("canvas");
                supportsWebGL2 = Boolean(probeCanvas.getContext("webgl2"));
                supportsWebGL1 =
                    supportsWebGL2 ||
                    Boolean(
                        probeCanvas.getContext("webgl") ||
                            probeCanvas.getContext("experimental-webgl"),
                    );
            } catch {
                supportsWebGL2 = false;
                supportsWebGL1 = false;
            }
        }

        const supportsWebAudio =
            typeof window !== "undefined" &&
            ("AudioContext" in window || "webkitAudioContext" in window);

        const supportsIndexedDB = typeof indexedDB !== "undefined";

        return {
            platform,
            supportsOffscreenCanvas,
            supportsSharedArrayBuffer,
            supportsWebGPU,
            supportsWebGL2,
            supportsWebGL1,
            supportsWebAudio,
            supportsIndexedDB,
        };
    }
}
