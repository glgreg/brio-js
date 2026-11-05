import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebGL2Backend } from "../../src/rendering/WebGL2Backend";
import { BrioMesh } from "../../src/assets/BrioMesh";
import { BrioMaterial } from "../../src/assets/BrioMaterial";
import { BrioLight } from "../../src/objects/BrioLight";
import { BrioObject3D } from "../../src/objects/BrioObject3D";
import { buildLightingEnvironment, createLightingEnvironment } from "../../src/rendering/lighting";
import { SHADOW_CAST, SHADOW_RECEIVE } from "../../src/rendering/contracts/RenderBackend";
import { Matrix4 } from "../../src/math/index";
import { createFakeWebGL2 } from "../helpers/fakeWebGL2";
import { createRecordingContext } from "../helpers/recordingContext";

const FULL = { x: 0, y: 0, width: 1, height: 1 };
const PASS = {
    cameraX: 0,
    cameraY: 5,
    cameraZ: 10,
    targetX: 0,
    targetY: 0,
    targetZ: 0,
    time: 0,
    toneMapping: "none" as const,
    exposure: 1,
    fogMode: 0,
    fogColor: "#000000",
    fogNear: 0,
    fogFar: 1,
    fogDensity: 0,
};

describe("directional shadows", () => {
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

    async function backendWith(lights: BrioLight[]): Promise<WebGL2Backend> {
        const surface = document.createElement("canvas");
        surface.width = 320;
        surface.height = 240;
        const backend = new WebGL2Backend();
        expect(await backend.init(surface)).toBe(true);
        backend.setLights(buildLightingEnvironment(lights, createLightingEnvironment()));
        fake.clear();
        return backend;
    }

    function drawScene(backend: WebGL2Backend, casterFlags = SHADOW_CAST | SHADOW_RECEIVE): void {
        const vp = Matrix4.perspective(Matrix4.create(), 1, 4 / 3, 0.1, 100);
        const world = Matrix4.create();
        backend.beginFrame(FULL, "#000000");
        backend.setPassParameters(PASS);
        backend.renderMesh3D(
            BrioMesh.createBox("crate"),
            new BrioMaterial("m"),
            world,
            vp,
            1,
            casterFlags,
        );
        backend.renderMesh3D(
            BrioMesh.createPlane("ground", 10, 10),
            new BrioMaterial("g"),
            world,
            vp,
            1,
            SHADOW_RECEIVE,
        );
        backend.endFrame();
    }

    it("renders casters into a depth map and samples it in a shadow variant", async () => {
        const sun = new BrioLight("sun", "directional", {
            castShadow: true,
            shadow: { resolution: 1024 },
        });
        const backend = await backendWith([sun]);
        drawScene(backend);

        expect(fake.count("createFramebuffer")).toBe(1);
        expect(fake.callsOf("texStorage2D").some((a) => a[3] === 1024 && a[4] === 1024)).toBe(true);
        // One depth draw for the crate (the ground does not cast), then both meshes in the main pass
        expect(fake.count("drawElements")).toBe(3);
        const fragments = fake.callsOf("shaderSource").map((a) => String(a[1]));
        expect(fragments.some((src) => src.includes("#define USE_SHADOW"))).toBe(true);
        expect(fragments.some((src) => src.includes("uLightViewProj"))).toBe(true);
        // The main pass goes back to the canvas framebuffer and viewport
        const bindings = fake.callsOf("bindFramebuffer");
        expect(bindings[bindings.length - 1][1]).toBeNull();

        // The depth texture and framebuffer are reused by later frames
        fake.clear();
        drawScene(backend);
        expect(fake.count("createFramebuffer")).toBe(0);
        expect(fake.count("drawElements")).toBe(3);
    });

    it("skips the shadow pass without a shadow-casting light or without casters", async () => {
        const plain = await backendWith([new BrioLight("sun", "directional")]);
        drawScene(plain);
        expect(fake.count("createFramebuffer")).toBe(0);
        expect(fake.count("drawElements")).toBe(2);

        const shadowed = await backendWith([
            new BrioLight("sun", "directional", { castShadow: true }),
        ]);
        drawScene(shadowed, SHADOW_RECEIVE);
        expect(fake.count("createFramebuffer")).toBe(0);
        expect(fake.count("drawElements")).toBe(2);
    });

    it("exposes shadow flags on objects and settings on lights", () => {
        const crate = new BrioObject3D("crate", "box");
        expect(crate.castShadow).toBe(true);
        expect(crate.receiveShadow).toBe(true);
        crate.castShadow = false;
        expect(BrioObject3D.clone(crate, "copy").castShadow).toBe(false);

        const sun = new BrioLight("sun", "directional", { castShadow: true });
        const version = sun.version;
        sun.shadow = { size: 8 };
        expect(sun.shadow.size).toBe(8);
        expect(sun.shadow.resolution).toBe(2048);
        expect(sun.version).toBeGreaterThan(version);

        const env = buildLightingEnvironment(
            [new BrioLight("fill", "directional"), sun],
            createLightingEnvironment(),
        );
        expect(env.shadowLight).toBe(1);
        expect(env.shadowSettings[0]).toBe(8);
    });
});
