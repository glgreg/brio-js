import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BrioLight } from "../../src/objects/BrioLight";
import {
    buildLightingEnvironment,
    createLightingEnvironment,
    irradianceLuminance,
    MAX_DIRECTIONAL_LIGHTS,
} from "../../src/rendering/lighting";
import { WebGL2Backend } from "../../src/rendering/WebGL2Backend";
import { Canvas2DBackend } from "../../src/rendering/BrioRenderer";
import { BrioMesh } from "../../src/assets/BrioMesh";
import { BrioMaterial } from "../../src/assets/BrioMaterial";
import { BrioGame } from "../../src/game/BrioGame";
import { BrioScene } from "../../src/core/BrioScene";
import { BrioObject3D } from "../../src/objects/BrioObject3D";
import { BrioCamera3D } from "../../src/cameras/BrioCamera3D";
import { Matrix4 } from "../../src/math/index";
import { createFakeWebGL2, GL } from "../helpers/fakeWebGL2";
import { createRecordingContext } from "../helpers/recordingContext";

describe("Lighting environment", () => {
    it("reduces lights to linear values with directions pointing toward each light", () => {
        const env = buildLightingEnvironment(
            [
                new BrioLight("amb", "ambient", { color: "#ffffff", intensity: 0.5 }),
                new BrioLight("hemi", "hemisphere", { color: "#ff0000", groundColor: "#0000ff" }),
                new BrioLight("sun", "directional", { direction: { x: 0, y: -2, z: 0 }, intensity: 2 }),
                new BrioLight("off", "directional", { enabled: false }),
            ],
            createLightingEnvironment(),
        );
        expect(Array.from(env.ambient)).toEqual([0.5, 0.5, 0.5]);
        expect(env.sky[0]).toBeCloseTo(1);
        expect(env.sky[2]).toBe(0);
        expect(env.ground[2]).toBeCloseTo(1);
        expect(env.directionalCount).toBe(1);
        expect(Array.from(env.directions.subarray(0, 3))).toEqual([-0, 1, -0]);
        expect(env.colors[0]).toBeCloseTo(2);
        expect(env.key).not.toContain("off");
    });

    it("caps directional lights and changes the key when a light changes", () => {
        const lights = Array.from({ length: 6 }, (_, i) => new BrioLight(`d${i}`, "directional"));
        const env = buildLightingEnvironment(lights, createLightingEnvironment());
        expect(env.directionalCount).toBe(MAX_DIRECTIONAL_LIGHTS);
        const key = env.key;
        lights[0].direction.x = 5;
        expect(buildLightingEnvironment(lights, env).key).not.toBe(key);
    });

    it("computes luminance from hemisphere blend and Lambert terms", () => {
        const env = buildLightingEnvironment(
            [
                new BrioLight("hemi", "hemisphere", { color: "#ffffff", groundColor: "#000000" }),
                new BrioLight("sun", "directional", { direction: { x: 0, y: -1, z: 0 } }),
            ],
            createLightingEnvironment(),
        );
        expect(irradianceLuminance(env, 0, 1, 0)).toBeCloseTo(2);
        expect(irradianceLuminance(env, 0, -1, 0)).toBeCloseTo(0);
        expect(irradianceLuminance(env, 1, 0, 0)).toBeCloseTo(0.5);
    });
});

describe("WebGL2Backend lights uniform buffer", () => {
    let fake: ReturnType<typeof createFakeWebGL2>;
    beforeEach(() => {
        fake = createFakeWebGL2();
        const rec = createRecordingContext();
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(((type: string) =>
            type === "webgl2" ? fake.gl : rec.ctx) as any);
    });
    afterEach(() => vi.restoreAllMocks());

    it("creates the UBO at init, binds lit programs to it, and re-uploads only on change", async () => {
        const surface = document.createElement("canvas");
        const backend = new WebGL2Backend();
        await backend.init(surface);
        expect(fake.callsOf("bindBufferBase")).toEqual([[GL.UNIFORM_BUFFER, 0, expect.anything()]]);

        const env = createLightingEnvironment();
        const lights = [new BrioLight("sun", "directional", { direction: { x: 0, y: 0, z: -1 } })];
        buildLightingEnvironment(lights, env);
        backend.setLights(env);
        expect(backend.lightData[12]).toBe(1);
        expect(backend.lightData[18]).toBe(1); // direction toward the light: +Z

        const mvp = Matrix4.perspective(Matrix4.create(), 1, 1, 0.1, 100);
        const world = Matrix4.translate(Matrix4.create(), Matrix4.create(), { x: 0, y: 0, z: -5 });
        const draw = (): void => {
            backend.beginFrame({ x: 0, y: 0, width: 1, height: 1 });
            backend.renderMesh3D(BrioMesh.createBox("b"), new BrioMaterial("m"), world, mvp);
            backend.endFrame();
        };
        draw();
        expect(fake.count("bufferSubData")).toBe(1);
        expect(fake.count("uniformBlockBinding")).toBe(1);
        const fragment = fake
            .callsOf("shaderSource")
            .map((a) => a[1] as string)
            .find((src) => src.includes("BrioLights"));
        expect(fragment).toContain("uDirLightColor[4]");

        backend.setLights(buildLightingEnvironment(lights, env));
        draw();
        expect(fake.count("bufferSubData")).toBe(1);

        lights[0].intensity = 3;
        backend.setLights(buildLightingEnvironment(lights, env));
        draw();
        expect(fake.count("bufferSubData")).toBe(2);
    });
});

describe("Canvas2DBackend lights", () => {
    it("darkens triangles when the lights get dimmer", async () => {
        const rec = createRecordingContext();
        const fills: string[] = [];
        const ctx = rec.ctx as unknown as Record<string, any>;
        const fill = ctx.fill;
        ctx.fill = (...args: unknown[]) => {
            fills.push(ctx.fillStyle);
            fill(...args);
        };
        const backend = new Canvas2DBackend();
        await backend.init({ width: 100, height: 100, getContext: () => rec.ctx } as any);
        const vp = Matrix4.multiply(
            Matrix4.create(),
            Matrix4.perspective(Matrix4.create(), 1, 1, 0.1, 100),
            Matrix4.lookAt(Matrix4.create(), { x: 0, y: 0, z: 3 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }),
        );
        const plane = new BrioMesh(
            "tri",
            new Float32Array([-1, -1, 0, 1, -1, 0, 0, 1, 0]),
            new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
            new Float32Array(6),
            new Uint16Array([0, 1, 2]),
        );
        const render = (): string => {
            fills.length = 0;
            backend.beginFrame({ x: 0, y: 0, width: 1, height: 1 });
            backend.renderMesh3D(plane, new BrioMaterial("white", { color: "#ffffff" }), Matrix4.create(), vp);
            backend.endFrame();
            return fills[fills.length - 1];
        };

        backend.setLights(
            buildLightingEnvironment([new BrioLight("a", "ambient", { intensity: 1 })], createLightingEnvironment()),
        );
        expect(render()).toBe("rgb(255, 255, 255)");
        backend.setLights(
            buildLightingEnvironment([new BrioLight("a", "ambient", { intensity: 0 })], createLightingEnvironment()),
        );
        expect(render()).toBe("rgb(0, 0, 0)");
    });
});

describe("Lights in BrioGame and BrioScene", () => {
    afterEach(() => vi.restoreAllMocks());

    it("hands each source's lights (or the default rig) to the backend before its 3D pass", async () => {
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
            () => createRecordingContext().ctx as any,
        );
        const game = new BrioGame({
            width: 64,
            height: 64,
            container: document.createElement("div"),
            dimension: "3d",
        });
        game.preload(() => [BrioMesh.createBox("box")]);
        await game.ready();
        // The compositor reuses one environment object, so record each key when it is handed over
        const keys: string[] = [];
        const backend = game.renderBackend!;
        const original = backend.setLights!.bind(backend);
        backend.setLights = (env) => {
            keys.push(env.key);
            original(env);
        };

        game.addObject(new BrioObject3D("obj", "box"));
        game.addCamera(new BrioCamera3D("cam", { position: { x: 0, y: 0, z: 5 } }));
        game.renderFrame();
        expect(keys[0]).toContain("light_brio_default_sun");

        game.addLight(new BrioLight("sun", "directional"));
        expect(game.lights.has("sun")).toBe(true);
        game.renderFrame();
        expect(keys[1]).toContain("sun:");
        expect(keys[1]).not.toContain("default");

        const scene = new BrioScene("lit").load(() => [
            new BrioLight("lamp", "ambient"),
            new BrioObject3D("scene_obj", "box"),
            new BrioCamera3D("scene_cam", { position: { x: 0, y: 0, z: 5 } }),
        ]);
        game.addScene(scene);
        await game.ready();
        expect(scene.lights.has("lamp")).toBe(true);
        keys.length = 0;
        game.renderFrame();
        expect(keys).toHaveLength(2);
        expect(keys[0].startsWith("sun:")).toBe(true);
        expect(keys[1].startsWith("lamp:")).toBe(true);
    });
});
