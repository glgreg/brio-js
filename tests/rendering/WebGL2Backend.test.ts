import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebGL2Backend } from "../../src/rendering/WebGL2Backend";
import { BrioMesh } from "../../src/assets/BrioMesh";
import { BrioMaterial } from "../../src/assets/BrioMaterial";
import { BrioTexture } from "../../src/assets/BrioTexture";
import { BrioGame } from "../../src/game/BrioGame";
import { BrioCamera3D } from "../../src/cameras/BrioCamera3D";
import { Matrix4 } from "../../src/math/index";
import { PlatformAdapter } from "../../src/tools/PlatformAdapter";
import { createFakeWebGL2, GL } from "../helpers/fakeWebGL2";
import { createRecordingContext } from "../helpers/recordingContext";

const FULL = { x: 0, y: 0, width: 1, height: 1 };

function translation(x: number, y: number, z: number): Float32Array {
    return Matrix4.translate(Matrix4.create(), Matrix4.create(), { x, y, z });
}

/** View-projection looking down -Z from the origin, so larger -z means farther away. */
function viewProj(): Float32Array {
    const proj = Matrix4.perspective(Matrix4.create(), Math.PI / 3, 4 / 3, 0.1, 100);
    const view = Matrix4.lookAt(
        Matrix4.create(),
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: -1 },
        { x: 0, y: 1, z: 0 },
    );
    return Matrix4.multiply(Matrix4.create(), proj, view);
}

describe("WebGL2Backend", () => {
    let fake: ReturnType<typeof createFakeWebGL2>;
    let rec: ReturnType<typeof createRecordingContext>;

    beforeEach(() => {
        fake = createFakeWebGL2();
        rec = createRecordingContext();
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(((type: string) =>
            type === "webgl2" ? fake.gl : rec.ctx) as any);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    async function createBackend(): Promise<WebGL2Backend> {
        const surface = document.createElement("canvas");
        surface.width = 320;
        surface.height = 240;
        const backend = new WebGL2Backend();
        expect(await backend.init(surface)).toBe(true);
        fake.clear();
        rec.clear();
        return backend;
    }

    it("rejects contexts without WebGL2 VAO support", async () => {
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(rec.ctx as any);
        expect(await new WebGL2Backend().init(document.createElement("canvas"))).toBe(false);
    });

    it("uploads mesh buffers once and only issues one draw call per mesh on later frames", async () => {
        const backend = await createBackend();
        const mesh = BrioMesh.createBox("mesh_box", 1, 1, 1);
        const mat = new BrioMaterial("mat_box");

        for (let frame = 0; frame < 3; frame++) {
            backend.beginFrame(FULL, "#000000");
            backend.renderMesh3D(mesh, mat, translation(0, 0, -5), viewProj());
            backend.endFrame();
        }

        // positions + normals + uvs + indices, uploaded on the first frame only
        expect(fake.count("bufferData")).toBe(4);
        expect(fake.count("createVertexArray")).toBe(1);
        expect(fake.count("linkProgram")).toBe(1);
        expect(fake.callsOf("drawElements")).toEqual([
            [GL.TRIANGLES, 36, GL.UNSIGNED_SHORT, 0],
            [GL.TRIANGLES, 36, GL.UNSIGNED_SHORT, 0],
            [GL.TRIANGLES, 36, GL.UNSIGNED_SHORT, 0],
        ]);
        // The VAO stays bound across frames (redundant binds are skipped)
        expect(fake.count("bindVertexArray")).toBe(1);
        expect(backend.drawCalls).toBe(1);
        expect(backend.trianglesRendered).toBe(12);
    });

    it("draws Uint32-indexed meshes with UNSIGNED_INT", async () => {
        const backend = await createBackend();
        const src = BrioMesh.createBox("m", 1, 1, 1);
        const mesh = new BrioMesh(
            "mesh_u32",
            src.positions,
            src.normals,
            src.uvs,
            Uint32Array.from(src.indices),
        );

        backend.beginFrame(FULL);
        backend.renderMesh3D(mesh, new BrioMaterial("m"), translation(0, 0, -5), viewProj());
        backend.endFrame();

        expect(fake.callsOf("drawElements")[0]).toEqual([GL.TRIANGLES, 36, GL.UNSIGNED_INT, 0]);
    });

    it("draws opaque meshes front-to-back, then transparent ones back-to-front with blending and no depth writes", async () => {
        const backend = await createBackend();
        const near = BrioMesh.createBox("near", 1, 1, 1);
        const far = BrioMesh.createBox("far", 1, 1, 1);
        const glassNear = BrioMesh.createBox("glass_near", 1, 1, 1);
        const glassFar = BrioMesh.createBox("glass_far", 1, 1, 1);
        const solid = new BrioMaterial("solid");
        const glass = new BrioMaterial("glass", { opacity: 0.5 });
        const vp = viewProj();

        backend.beginFrame(FULL, "#000");
        backend.renderMesh3D(glassNear, glass, translation(0, 0, -3), vp);
        backend.renderMesh3D(far, solid, translation(0, 0, -20), vp);
        backend.renderMesh3D(glassFar, glass, translation(0, 0, -15), vp);
        backend.renderMesh3D(near, solid, translation(0, 0, -4), vp);
        fake.clear();
        backend.endFrame();

        // Each mesh gets its own VAO on first draw, so VAO creation order is the draw order
        const vaos = fake
            .callsOf("bindVertexArray")
            .map((args) => (args[0] as { handle: number }).handle);
        const created = fake.callsOf("createVertexArray").length;
        expect(created).toBe(4);
        const order = fake.calls
            .filter(
                (c) =>
                    c.name === "drawElements" ||
                    c.name === "depthMask" ||
                    (c.name === "enable" && c.args[0] === GL.BLEND),
            )
            .map((c) => (c.name === "drawElements" ? "draw" : `${c.name}(${c.args[0]})`));
        expect(order).toEqual([
            "draw",
            "draw",
            `enable(${GL.BLEND})`,
            "depthMask(false)",
            "draw",
            "draw",
            "depthMask(true)",
        ]);
        // near (z=-4) before far (z=-20); glass far (z=-15) before glass near (z=-3)
        expect(vaos).toHaveLength(4);
        const uniformWorlds = fake
            .callsOf("uniformMatrix4fv")
            .filter((args) => (args[0] as { uniform: string }).uniform === "uWorld")
            .map((args) => (args[2] as Float32Array)[14]);
        expect(uniformWorlds).toEqual([-4, -20, -15, -3]);
    });

    it("culls back faces unless the material is double-sided or wireframe", async () => {
        const backend = await createBackend();
        const mesh = BrioMesh.createBox("m", 1, 1, 1);
        const vp = viewProj();

        backend.beginFrame(FULL);
        backend.renderMesh3D(mesh, new BrioMaterial("single"), translation(0, 0, -5), vp);
        backend.endFrame();
        expect(fake.callsOf("enable")).toContainEqual([GL.CULL_FACE]);

        fake.clear();
        backend.beginFrame(FULL);
        backend.renderMesh3D(
            mesh,
            new BrioMaterial("double", { doubleSided: true }),
            translation(0, 0, -5),
            vp,
        );
        backend.endFrame();
        expect(fake.callsOf("disable")).toContainEqual([GL.CULL_FACE]);
    });

    it("flips the front face for mirroring transforms", async () => {
        const backend = await createBackend();
        const mirrored = Matrix4.scale(Matrix4.create(), translation(0, 0, -5), {
            x: -1,
            y: 1,
            z: 1,
        });

        backend.beginFrame(FULL);
        backend.renderMesh3D(
            BrioMesh.createBox("m", 1, 1, 1),
            new BrioMaterial("m"),
            mirrored,
            viewProj(),
        );
        backend.endFrame();

        expect(fake.callsOf("frontFace")).toEqual([[GL.CW]]);
    });

    it("compiles one program per feature set and shares it between materials", async () => {
        const backend = await createBackend();
        const mesh = BrioMesh.createBox("m", 1, 1, 1);
        const vp = viewProj();

        backend.beginFrame(FULL);
        backend.renderMesh3D(
            mesh,
            new BrioMaterial("a", { color: "#ff0000" }),
            translation(0, 0, -5),
            vp,
        );
        backend.renderMesh3D(
            mesh,
            new BrioMaterial("b", { color: "#00ff00" }),
            translation(0, 0, -6),
            vp,
        );
        backend.renderMesh3D(
            mesh,
            new BrioMaterial("c", { shading: "unlit" }),
            translation(0, 0, -7),
            vp,
        );
        backend.renderMesh3D(
            mesh,
            new BrioMaterial("d", { alphaCutoff: 0.5 }),
            translation(0, 0, -8),
            vp,
        );
        backend.endFrame();

        expect(fake.count("linkProgram")).toBe(3);
        const fragments = fake
            .callsOf("shaderSource")
            .map((args) => args[1] as string)
            .filter((src) => src.includes("fragColor"));
        // Opaque items are grouped by program, so variants compile in feature-bit order
        expect(fragments.map((src) => src.match(/#define \w+/g) ?? [])).toEqual([
            [],
            ["#define USE_LIGHTING"],
            ["#define USE_LIGHTING", "#define USE_ALPHA_TEST"],
        ]);
    });

    it("uploads decoded textures once as sRGB with mipmaps and samples them in a USE_MAP program", async () => {
        const backend = await createBackend();
        const bitmap = { width: 64, height: 32, close() {} } as unknown as ImageBitmap;
        const mat = new BrioMaterial("mat_tex", { texture: new BrioTexture("tex#0", bitmap) });
        const mesh = BrioMesh.createBox("m", 1, 1, 1);

        for (let frame = 0; frame < 2; frame++) {
            backend.beginFrame(FULL);
            backend.renderMesh3D(mesh, mat, translation(0, 0, -5), viewProj());
            backend.endFrame();
        }

        expect(fake.callsOf("texStorage2D")).toEqual([[GL.TEXTURE_2D, 7, GL.SRGB8_ALPHA8, 64, 32]]);
        expect(fake.callsOf("texSubImage2D")[0][6]).toBe(bitmap);
        expect(fake.count("generateMipmap")).toBe(1);
        expect(fake.callsOf("pixelStorei")).toContainEqual([GL.UNPACK_FLIP_Y_WEBGL, false]);
        expect(
            fake
                .callsOf("shaderSource")
                .some((args) => (args[1] as string).includes("#define USE_MAP")),
        ).toBe(true);
    });

    it("draws wireframe materials as a cached line list of triangle edges", async () => {
        const backend = await createBackend();
        const mesh = BrioMesh.createBox("m", 1, 1, 1);
        const wire = new BrioMaterial("wire", { wireframe: true });

        for (let frame = 0; frame < 2; frame++) {
            backend.beginFrame(FULL);
            backend.renderMesh3D(mesh, wire, translation(0, 0, -5), viewProj());
            backend.endFrame();
        }

        expect(fake.callsOf("drawElements")).toEqual([
            [GL.LINES, 72, GL.UNSIGNED_SHORT, 0],
            [GL.LINES, 72, GL.UNSIGNED_SHORT, 0],
        ]);
        // vertex buffers (3) + index buffer + line buffer, all from the first frame
        expect(fake.count("bufferData")).toBe(5);
    });

    it("restricts drawing to the viewport and composites that rect onto the 2D canvas", async () => {
        const backend = await createBackend();
        const viewport = { x: 0.5, y: 0, width: 0.5, height: 0.5 };

        backend.beginFrame(viewport);
        backend.renderMesh3D(
            BrioMesh.createBox("m", 1, 1, 1),
            new BrioMaterial("m"),
            translation(0, 0, -5),
            viewProj(),
        );
        backend.endFrame();

        // GL origin is bottom-left: the top-right quarter starts at y = 240 - 0 - 120
        expect(fake.callsOf("viewport")).toEqual([[160, 120, 160, 120]]);
        expect(fake.callsOf("scissor")).toEqual([[160, 120, 160, 120]]);
        // No clear color: the 2D content under the viewport is erased, like Canvas2DBackend
        expect(rec.count("clearRect")).toBe(1);
        const draw = rec.calls.find((c) => c.name === "drawImage")!;
        expect(draw.args.slice(1)).toEqual([160, 0, 160, 120, 160, 0, 160, 120]);
    });

    it("is selected by BrioGame when WebGL2 is available, and BrioGame falls back to canvas2d otherwise", async () => {
        vi.spyOn(PlatformAdapter, "detectCapabilities").mockReturnValue({
            platform: "browser",
            supportsOffscreenCanvas: false,
            supportsSharedArrayBuffer: false,
            supportsWebGPU: false,
            supportsWebGL2: true,
            supportsWebGL1: true,
            supportsWebAudio: false,
            supportsIndexedDB: false,
        });
        const gpuGame = new BrioGame({
            width: 320,
            height: 240,
            container: document.createElement("div"),
            dimension: "3d",
        });
        gpuGame.load(() => [new BrioCamera3D("cam")]);
        await gpuGame.ready();
        expect(gpuGame.renderBackend?.backendType).toBe("webgl2");

        // Same capabilities, but context creation fails (only 2D contexts exist)
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(rec.ctx as any);
        const cpuGame = new BrioGame({
            width: 320,
            height: 240,
            container: document.createElement("div"),
            dimension: "3d",
        });
        cpuGame.load(() => [new BrioCamera3D("cam")]);
        await cpuGame.ready();
        expect(cpuGame.renderBackend?.backendType).toBe("canvas2d");
    });
});
