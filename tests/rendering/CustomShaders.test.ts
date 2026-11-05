import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BrioShader } from "../../src/assets/BrioShader";
import { BrioMaterial } from "../../src/assets/BrioMaterial";
import { BrioMesh } from "../../src/assets/BrioMesh";
import { BrioGame } from "../../src/game/BrioGame";
import { WebGL2Backend } from "../../src/rendering/WebGL2Backend";
import { Matrix4 } from "../../src/math/index";
import { createFakeWebGL2 } from "../helpers/fakeWebGL2";
import { createRecordingContext } from "../helpers/recordingContext";

const SURFACE = `uniform float uGlow;
uniform vec3 uTint;
void surface(inout BrioSurface s) {
    s.baseColor *= uTint;
    s.emissive += vec3(uGlow) * (0.5 + 0.5 * sin(TIME));
}`;

describe("BrioShader", () => {
    it("rejects reserved names and oversized sources", () => {
        expect(() => new BrioShader("bad", { fragment: "float brio_x;" })).toThrow(/reserved/);
        expect(() => new BrioShader("big", { fragment: "x".repeat(20), maxLength: 10 })).toThrow(
            /limit/,
        );
        const shader = new BrioShader("ok", { fragment: SURFACE });
        expect(shader.isLoaded).toBe(true);
        const version = shader.version;
        shader.fragment = SURFACE.replace("uGlow", "uShine");
        expect(shader.version).toBe(version + 1);
    });

    it("loads a .glsl file and splits the vertex hook at // @vertex", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                ok: true,
                text: async () =>
                    `${SURFACE}\n// @vertex\nvoid vertex(inout vec3 p, inout vec3 n) {}`,
            })),
        );
        const shader = new BrioShader("file", { url: "./water.glsl" });
        expect(shader.isLoaded).toBe(false);
        await shader.load();
        expect(shader.fragment).toContain("void surface");
        expect(shader.vertex).toContain("void vertex");
        vi.unstubAllGlobals();
    });

    it("is preloaded and resolved by name on materials", async () => {
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
            () => createRecordingContext().ctx as any,
        );
        const game = new BrioGame({
            width: 10,
            height: 10,
            container: document.createElement("div"),
            dimension: "3d",
        });
        const shader = new BrioShader("shd_glow", { fragment: SURFACE });
        const material = new BrioMaterial("mat_glow", {
            shader: "shd_glow",
            parameters: { uGlow: 1 },
        });
        game.preload(() => [shader, material]);
        await game.ready();
        expect(material.shader).toBe(shader);
        expect(game.loadedShaders.get("shd_glow")).toBe(shader);
        expect(material.set("uGlow", 2).parameters.uGlow).toBe(2);
        vi.restoreAllMocks();
    });
});

describe("WebGL2Backend custom shaders", () => {
    let fake: ReturnType<typeof createFakeWebGL2>;

    beforeEach(() => {
        fake = createFakeWebGL2();
        const rec = createRecordingContext();
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(((type: string) =>
            type === "webgl2" ? fake.gl : rec.ctx) as any);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    async function draw(backend: WebGL2Backend, material: BrioMaterial): Promise<void> {
        const vp = Matrix4.perspective(Matrix4.create(), 1, 1, 0.1, 100);
        backend.beginFrame({ x: 0, y: 0, width: 1, height: 1 });
        backend.renderMesh3D(BrioMesh.createBox("box"), material, Matrix4.create(), vp);
        backend.endFrame();
    }

    async function createBackend(): Promise<WebGL2Backend> {
        const surface = document.createElement("canvas");
        surface.width = 64;
        surface.height = 64;
        const backend = new WebGL2Backend();
        expect(await backend.init(surface)).toBe(true);
        fake.clear();
        return backend;
    }

    it("injects the hook, uploads parameters and recompiles after a source change", async () => {
        const backend = await createBackend();
        const shader = new BrioShader("shd", { fragment: SURFACE });
        const material = new BrioMaterial("m", {
            shader,
            parameters: { uGlow: 0.5, uTint: "#ffffff", uOffset: [1, 2] },
        });
        await draw(backend, material);
        const fragment = fake
            .callsOf("shaderSource")
            .map((a) => String(a[1]))
            .find((src) => src.includes("#define USE_SURFACE_HOOK"));
        expect(fragment).toContain("void surface(inout BrioSurface s)");
        expect(fake.callsOf("uniform1f").some((a) => a[1] === 0.5)).toBe(true);
        expect(
            fake
                .callsOf("uniform3f")
                .some((a) => (a[0] as { uniform: string }).uniform === "uTint"),
        ).toBe(true);
        expect(fake.callsOf("uniform2f").some((a) => a[1] === 1 && a[2] === 2)).toBe(true);

        fake.clear();
        await draw(backend, material);
        expect(fake.count("linkProgram")).toBe(0);
        shader.fragment = SURFACE.replace("0.5 + 0.5", "0.25 + 0.75");
        await draw(backend, material);
        expect(fake.count("linkProgram")).toBe(1);
        expect(fake.count("deleteProgram")).toBe(1);
    });

    it("falls back to the built-in shader when the hook fails to compile", async () => {
        const backend = await createBackend();
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
        const sources = new Map<unknown, string>();
        (fake.gl.shaderSource as any).mockImplementation((shader: unknown, source: string) => {
            sources.set(shader, source);
        });
        (fake.gl.getShaderParameter as any).mockImplementation(
            (shader: unknown) => !String(sources.get(shader)).includes("BROKEN"),
        );
        const material = new BrioMaterial("m", {
            shader: new BrioShader("shd_broken", {
                fragment: "void surface(inout BrioSurface s) { BROKEN }",
            }),
        });
        await draw(backend, material);
        expect(consoleError).toHaveBeenCalledTimes(1);
        expect(String(consoleError.mock.calls[0][0])).toContain("shd_broken");
        expect(fake.count("drawElements")).toBe(1);

        await draw(backend, material);
        expect(consoleError).toHaveBeenCalledTimes(1);
    });
});
