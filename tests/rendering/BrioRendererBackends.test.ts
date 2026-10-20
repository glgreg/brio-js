import { describe, it, expect, vi, afterEach } from "vitest";
import { BrioRenderer, Canvas2DBackend } from "../../src/rendering/BrioRenderer";
import { WebGL2Backend } from "../../src/rendering/WebGL2Backend";
import { PlatformAdapter, PlatformCapabilities } from "../../src/tools/PlatformAdapter";
import { BrioMesh } from "../../src/assets/BrioMesh";
import { BrioMaterial } from "../../src/assets/BrioMaterial";
import { Matrix4 } from "../../src/math/index";
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

describe("BrioRenderer backend selection", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("never selects a backend that BrioJS does not implement, even when the GPU supports it", () => {
        vi.spyOn(PlatformAdapter, "detectCapabilities").mockReturnValue(GPU_CAPS);

        expect(BrioRenderer.implementedBackends()).toEqual(["webgl2", "canvas2d"]);
        expect(BrioRenderer.selectBestBackendType("auto")).toBe("webgl2");
        expect(BrioRenderer.selectBestBackendType("webgpu")).toBe("webgl2");
        expect(BrioRenderer.selectBestBackendType("webgl1")).toBe("webgl2");
        expect(BrioRenderer.selectBestBackendType("canvas2d")).toBe("canvas2d");
        expect(BrioRenderer.createBackend("auto")).toBeInstanceOf(WebGL2Backend);
    });

    it("falls back to canvas2d when the runtime has no WebGL2", () => {
        vi.spyOn(PlatformAdapter, "detectCapabilities").mockReturnValue({
            ...GPU_CAPS,
            supportsWebGPU: false,
            supportsWebGL2: false,
        });

        expect(BrioRenderer.selectBestBackendType("auto")).toBe("canvas2d");
        expect(BrioRenderer.createBackend("webgl2")).toBeInstanceOf(Canvas2DBackend);
    });
});

describe("Canvas2DBackend software shading", () => {
    /** Renders a lit box and records the `fillStyle` / `strokeStyle` active at every fill / stroke call. */
    async function renderBox(color: string, opacity = 1) {
        const rec = createRecordingContext();
        const fillStyles: string[] = [];
        const strokeStyles: string[] = [];
        const ctx = rec.ctx as unknown as Record<string, any>;
        const fill = ctx.fill;
        const stroke = ctx.stroke;
        ctx.fill = (...args: unknown[]) => {
            fillStyles.push(ctx.fillStyle);
            fill(...args);
        };
        ctx.stroke = (...args: unknown[]) => {
            strokeStyles.push(ctx.strokeStyle);
            stroke(...args);
        };
        const surface = {
            width: 200,
            height: 200,
            getContext: () => rec.ctx,
        } as unknown as HTMLCanvasElement;
        const backend = new Canvas2DBackend();
        await backend.init(surface);

        const viewProj = Matrix4.create();
        Matrix4.perspective(viewProj, Math.PI / 3, 1, 0.1, 100);
        const view = Matrix4.create();
        Matrix4.lookAt(view, { x: 2, y: 2, z: 4 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
        Matrix4.multiply(viewProj, viewProj, view);

        backend.beginFrame({ x: 0, y: 0, width: 1, height: 1 });
        backend.renderMesh3D(
            BrioMesh.createBox("box", 1, 1, 1),
            new BrioMaterial("mat", { color, shading: "lambert", opacity }),
            Matrix4.create(),
            viewProj,
        );
        backend.endFrame();

        const paths = rec.count("beginPath") - 1; // first beginPath belongs to the viewport clip
        const moveTos = rec.calls.filter((c) => c.name === "moveTo").map((c) => c.args as number[]);
        return { paths, fillStyles, strokeStyles, moveTos };
    }

    it("fills runs of equally shaded triangles with one pre-shaded tone of the material color", async () => {
        const { paths, fillStyles, strokeStyles, moveTos } = await renderBox("#3366ff");

        // The camera at (2, 2, 4) sees the +X, +Y, and +Z faces (6 triangles), each lit differently
        expect(moveTos).toHaveLength(6);
        expect(new Set(fillStyles).size).toBe(3);
        // One path and one fill per run of equal tones, never more than one per triangle
        expect(fillStyles).toHaveLength(paths);
        expect(paths).toBeLessThanOrEqual(6);
        expect(strokeStyles).toHaveLength(0);
        for (const style of fillStyles) {
            const [r, g, b] = style.match(/\d+/g)!.map(Number);
            // Every tone keeps the hue of #3366ff (51, 102, 255), only scaled by the shade
            expect(g / b).toBeCloseTo(102 / 255, 1);
            expect(r / b).toBeCloseTo(51 / 255, 1);
        }
    });

    it("culls back faces: only camera-facing faces are drawn, and none of them sits at the ambient floor", async () => {
        const { fillStyles } = await renderBox("#ffffff");
        // shade = 0.35 + 0.65 * max(0, N.L); a face turned away from the light would get the 0.35 floor (rgb 89)
        const intensities = fillStyles.map((s) => Number(s.match(/\d+/)![0]));
        expect(Math.min(...intensities)).toBeGreaterThan(89);
        // The top face (+Y) faces the light the most and is the brightest
        expect(Math.max(...intensities)).toBeGreaterThan(200);
    });

    it("dilates opaque triangles by half a pixel to hide seams, but not translucent ones", async () => {
        const opaque = await renderBox("#3366ff");
        const translucent = await renderBox("#3366ff", 0.5);

        expect(opaque.moveTos).toHaveLength(translucent.moveTos.length);
        for (let i = 0; i < opaque.moveTos.length; i++) {
            const [ox, oy] = opaque.moveTos[i];
            const [tx, ty] = translucent.moveTos[i];
            expect(Math.hypot(ox - tx, oy - ty)).toBeCloseTo(0.5, 5);
        }
    });

    it("falls back to the darkening overlay when the color cannot be resolved", async () => {
        const { paths, fillStyles } = await renderBox("color-mix(in srgb, red, blue)");
        expect(fillStyles.filter((s) => s === "color-mix(in srgb, red, blue)")).toHaveLength(paths);
        expect(fillStyles.some((s) => s.startsWith("rgba(0, 0, 0,"))).toBe(true);
    });

    it("depth-sorts across meshes: a far mesh submitted last is still painted behind a near one", async () => {
        const rec = createRecordingContext();
        const fillStyles: string[] = [];
        const ctx = rec.ctx as unknown as Record<string, any>;
        const fill = ctx.fill;
        ctx.fill = (...args: unknown[]) => {
            fillStyles.push(ctx.fillStyle);
            fill(...args);
        };
        const surface = { width: 200, height: 200, getContext: () => rec.ctx } as unknown as HTMLCanvasElement;
        const backend = new Canvas2DBackend();
        await backend.init(surface);

        const vp = Matrix4.create();
        Matrix4.perspective(vp, Math.PI / 3, 1, 0.1, 100);
        const near = Matrix4.create();
        Matrix4.translate(near, near, { x: 0, y: 0, z: -3 });
        const far = Matrix4.create();
        Matrix4.translate(far, far, { x: 0.3, y: 0.3, z: -8 });
        const box = BrioMesh.createBox("box", 1, 1, 1);

        backend.beginFrame({ x: 0, y: 0, width: 1, height: 1 });
        // Submission order is near first, far last (e.g. face mesh before hair mesh of one model)
        backend.renderMesh3D(box, new BrioMaterial("near", { color: "#ff0000", shading: "unlit" }), near, vp);
        backend.renderMesh3D(box, new BrioMaterial("far", { color: "#0000ff", shading: "unlit" }), far, vp);
        backend.endFrame();

        expect(fillStyles).toEqual(["rgb(0, 0, 255)", "rgb(255, 0, 0)"]);
        expect(backend.trianglesRendered).toBeGreaterThan(0);
    });

    it("splits wireframe strokes into bounded paths instead of one path for the whole pass", async () => {
        const rec = createRecordingContext();
        const surface = { width: 200, height: 200, getContext: () => rec.ctx } as unknown as HTMLCanvasElement;
        const backend = new Canvas2DBackend();
        await backend.init(surface);
        const vp = Matrix4.create();
        Matrix4.perspective(vp, Math.PI / 3, 1, 0.1, 100);
        const world = Matrix4.create();
        Matrix4.translate(world, world, { x: 0, y: 0, z: -4 });
        const sphere = BrioMesh.createSphere("sphere", 1, 16, 16);

        backend.beginFrame({ x: 0, y: 0, width: 1, height: 1 });
        backend.renderMesh3D(sphere, new BrioMaterial("wire", { wireframe: true }), world, vp);
        backend.endFrame();

        // Wireframe draws every triangle (no culling); a single huge stroke path costs seconds on real models
        const drawn = backend.trianglesRendered;
        expect(drawn).toBe(sphere.triangleCount);
        expect(rec.count("stroke")).toBe(Math.ceil(drawn / 64));
    });

    it("sorts triangles with the same module-level comparator every frame (no per-frame closures)", async () => {
        const rec = createRecordingContext();
        const surface = {
            width: 100,
            height: 100,
            getContext: () => rec.ctx,
        } as unknown as HTMLCanvasElement;
        const backend = new Canvas2DBackend();
        await backend.init(surface);
        const mesh = BrioMesh.createSphere("sphere", 1, 8, 8);
        const mat = new BrioMaterial("mat");
        const vp = Matrix4.create();
        Matrix4.perspective(vp, Math.PI / 3, 1, 0.1, 100);
        const world = Matrix4.create();
        Matrix4.translate(world, world, { x: 0, y: 0, z: -4 });

        const sortSpy = vi.spyOn(Array.prototype, "sort");
        for (let frame = 0; frame < 2; frame++) {
            backend.beginFrame({ x: 0, y: 0, width: 1, height: 1 });
            backend.renderMesh3D(mesh, mat, world, vp);
            backend.endFrame();
        }
        const comparators = sortSpy.mock.calls.map((args) => args[0]);
        const sortedArrays = sortSpy.mock.contexts;
        sortSpy.mockRestore();

        expect(comparators).toHaveLength(2);
        expect(comparators[0]).toBe(comparators[1]);
        // The same pooled frame list is reused instead of a new array per frame
        expect(sortedArrays[0]).toBe(sortedArrays[1]);
    });
});

describe("PlatformAdapter capability cache", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("probes once and reuses the report until forceRefresh is requested", () => {
        PlatformAdapter.detectCapabilities(true);
        const createSpy = vi.spyOn(document, "createElement");

        const a = PlatformAdapter.detectCapabilities();
        const b = PlatformAdapter.detectCapabilities();
        expect(a).toBe(b);
        expect(createSpy).not.toHaveBeenCalled();

        PlatformAdapter.detectCapabilities(true);
        // jsdom is classified as "headless", so even a refresh skips the WebGL probe entirely
        expect(createSpy).not.toHaveBeenCalled();
    });

    it("does not report SharedArrayBuffer as usable on a non-isolated page", () => {
        const original = (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated;
        (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated = false;
        const caps = PlatformAdapter.detectCapabilities(true);
        (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated = original;
        expect(caps.supportsSharedArrayBuffer).toBe(false);
    });
});
