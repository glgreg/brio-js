import { describe, it, expect, vi, afterEach } from "vitest";
import { BrioRenderer, Canvas2DBackend } from "../../src/rendering/BrioRenderer";
import { WebGL2Backend } from "../../src/rendering/WebGL2Backend";
import { RenderBackend, RenderBackendType } from "../../src/rendering/contracts/RenderBackend";
import { PlatformAdapter, PlatformCapabilities } from "../../src/tools/PlatformAdapter";
import { createRecordingContext } from "../helpers/recordingContext";

const GPU_CAPS: PlatformCapabilities = {
    platform: "browser",
    supportsOffscreenCanvas: true,
    supportsSharedArrayBuffer: false,
    supportsWebGPU: true,
    supportsWebGL2: true,
    supportsWebGL1: true,
    supportsWebAudio: true,
    supportsIndexedDB: true,
};

/** Backend double whose `init()` resolves `result` (or throws when `result` is an `Error`). */
function fakeBackend(type: RenderBackendType, result: boolean | Error, log: string[]): RenderBackend {
    return {
        backendType: type,
        init: async () => {
            log.push(`init:${type}`);
            if (result instanceof Error) throw result;
            return result;
        },
        beginFrame: () => {},
        renderMesh3D: () => {},
        endFrame: () => {},
        dispose: () => {
            log.push(`dispose:${type}`);
        },
    };
}

function surface2D(): HTMLCanvasElement {
    const rec = createRecordingContext();
    return { width: 64, height: 64, getContext: () => rec.ctx } as unknown as HTMLCanvasElement;
}

describe("BrioRenderer cascade fallback", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        BrioRenderer.registerBackend("webgpu", undefined);
        BrioRenderer.registerBackend("webgl1", undefined);
        BrioRenderer.registerBackend("webgl2", () => new WebGL2Backend());
        BrioRenderer.registerBackend("canvas2d", () => new Canvas2DBackend());
    });

    it("lists usable candidates with the preferred backend first and canvas2d last", () => {
        vi.spyOn(PlatformAdapter, "detectCapabilities").mockReturnValue(GPU_CAPS);
        expect(BrioRenderer.backendCandidates("auto")).toEqual(["webgl2", "canvas2d"]);
        expect(BrioRenderer.backendCandidates("canvas2d")).toEqual(["canvas2d", "webgl2"]);
        expect(BrioRenderer.backendCandidates("webgpu")).toEqual(["webgl2", "canvas2d"]);
    });

    it("tries the next backend of the cascade instead of jumping straight to canvas2d", async () => {
        vi.spyOn(PlatformAdapter, "detectCapabilities").mockReturnValue(GPU_CAPS);
        const log: string[] = [];
        BrioRenderer.registerBackend("webgpu", () => fakeBackend("webgpu", false, log));
        BrioRenderer.registerBackend("webgl2", () => fakeBackend("webgl2", true, log));
        BrioRenderer.registerBackend("webgl1", () => fakeBackend("webgl1", true, log));

        const failed: RenderBackendType[] = [];
        const backend = await BrioRenderer.initBackend(surface2D(), "auto", (type) => failed.push(type));

        expect(backend?.backendType).toBe("webgl2");
        expect(failed).toEqual(["webgpu"]);
        expect(log).toEqual(["init:webgpu", "dispose:webgpu", "init:webgl2"]);
    });

    it("treats a throwing init() as a failure and reports the error", async () => {
        vi.spyOn(PlatformAdapter, "detectCapabilities").mockReturnValue(GPU_CAPS);
        const log: string[] = [];
        const boom = new Error("adapter lost");
        BrioRenderer.registerBackend("webgpu", () => fakeBackend("webgpu", boom, log));
        BrioRenderer.registerBackend("webgl2", () => fakeBackend("webgl2", false, log));
        BrioRenderer.registerBackend("webgl1", () => fakeBackend("webgl1", true, log));

        const errors: unknown[] = [];
        const backend = await BrioRenderer.initBackend(surface2D(), "auto", (_t, e) => errors.push(e));

        expect(backend?.backendType).toBe("webgl1");
        expect(errors).toEqual([boom, undefined]);
    });

    it("ends on the real Canvas2DBackend when every GPU backend fails", async () => {
        vi.spyOn(PlatformAdapter, "detectCapabilities").mockReturnValue(GPU_CAPS);
        const log: string[] = [];
        BrioRenderer.registerBackend("webgl2", () => fakeBackend("webgl2", false, log));
        const backend = await BrioRenderer.initBackend(surface2D());
        expect(backend).toBeInstanceOf(Canvas2DBackend);
    });

    it("returns undefined when even canvas2d cannot get a context", async () => {
        vi.spyOn(PlatformAdapter, "detectCapabilities").mockReturnValue({
            ...GPU_CAPS,
            supportsWebGL2: false,
            supportsWebGPU: false,
        });
        const dead = { width: 1, height: 1, getContext: () => null } as unknown as HTMLCanvasElement;
        expect(await BrioRenderer.initBackend(dead)).toBeUndefined();
    });

    it("never unregisters the canvas2d fallback", () => {
        BrioRenderer.registerBackend("canvas2d", undefined);
        expect(BrioRenderer.implementedBackends()).toContain("canvas2d");
    });
});
