import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BrioLight } from "../../src/objects/BrioLight";
import {
    punctualAttenuation,
    buildLightingEnvironment,
    createLightingEnvironment,
    irradianceLuminance,
    MAX_DIRECTIONAL_LIGHTS,
} from "../../src/rendering/lighting";
import { WebGL2Backend } from "../../src/rendering/WebGL2Backend";
import { Canvas2DBackend } from "../../src/rendering/Canvas2DBackend";
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
                new BrioLight("sun", "directional", {
                    direction: { x: 0, y: -2, z: 0 },
                    intensity: 2,
                }),
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
        expect(env.version).toBeGreaterThan(0);
    });

    it("caps directional lights and changes the version only when a light changes", () => {
        const lights = Array.from({ length: 6 }, (_, i) => new BrioLight(`d${i}`, "directional"));
        const env = buildLightingEnvironment(lights, createLightingEnvironment());
        expect(env.directionalCount).toBe(MAX_DIRECTIONAL_LIGHTS);
        const version = env.version;
        expect(buildLightingEnvironment(lights, env).version).toBe(version);
        lights[0].direction.x = 5;
        const changed = buildLightingEnvironment(lights, env).version;
        expect(changed).not.toBe(version);
        expect(buildLightingEnvironment(lights.slice(1), env).version).not.toBe(changed);
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
        // BrioLights at binding 0, BrioPass (camera, fog, tone mapping) at binding 1
        expect(fake.callsOf("bindBufferBase")).toEqual([
            [GL.UNIFORM_BUFFER, 0, expect.anything()],
            [GL.UNIFORM_BUFFER, 1, expect.anything()],
        ]);

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
        expect(fake.count("uniformBlockBinding")).toBe(2);
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

describe("point and spot lights", () => {
    it("are packed with position, range, cone and decay", () => {
        const env = buildLightingEnvironment(
            [
                new BrioLight("lamp", "point", {
                    position: { x: 1, y: 2, z: 3 },
                    range: 8,
                    intensity: 2,
                    color: "#ffffff",
                }),
                new BrioLight("stage", "spot", {
                    position: { x: 0, y: 5, z: 0 },
                    direction: { x: 0, y: -2, z: 0 },
                    angle: Math.PI / 4,
                    penumbra: 0.5,
                }),
            ],
            createLightingEnvironment(),
        );
        expect(env.punctualCount).toBe(2);
        expect(Array.from(env.punctualPositions.subarray(0, 4))).toEqual([1, 2, 3, 8]);
        expect(env.punctualColors[0]).toBeCloseTo(2);
        expect(env.punctualColors[3]).toBe(1);
        expect(env.punctualColors[7]).toBe(2);
        expect(env.punctualDirections[5]).toBeCloseTo(-1);
        expect(env.punctualDirections[7]).toBeCloseTo(Math.cos(Math.PI / 4));
        expect(env.punctualCones[4]).toBeCloseTo(Math.cos(Math.PI / 8));
        expect(env.punctualCones[5]).toBe(2);
    });

    it("fade with distance, vanish past the range and outside the spot cone", () => {
        const env = buildLightingEnvironment(
            [
                new BrioLight("lamp", "point", { position: { x: 0, y: 2, z: 0 }, range: 4 }),
                new BrioLight("spot", "spot", {
                    position: { x: 0, y: 2, z: 0 },
                    direction: { x: 0, y: -1, z: 0 },
                    angle: 0.3,
                    penumbra: 0,
                    enabled: false,
                }),
            ],
            createLightingEnvironment(),
        );
        const near = irradianceLuminance(env, 0, 1, 0, 0, 1, 0);
        const far = irradianceLuminance(env, 0, 1, 0, 0, -1, 0);
        expect(near).toBeGreaterThan(far);
        expect(irradianceLuminance(env, 0, 1, 0, 0, -3, 0)).toBe(0); // 5 units away, beyond the range of 4
        expect(punctualAttenuation(env, 0, 1, 0, 1, 0)).toBeCloseTo(1 * (1 - 1 / 256) ** 2);

        const spotOnly = buildLightingEnvironment(
            [
                new BrioLight("spot", "spot", {
                    position: { x: 0, y: 2, z: 0 },
                    direction: { x: 0, y: -1, z: 0 },
                    angle: 0.3,
                    penumbra: 0,
                }),
            ],
            createLightingEnvironment(),
        );
        expect(irradianceLuminance(spotOnly, 0, 1, 0, 0, 0, 0)).toBeGreaterThan(0); // under the spot
        expect(irradianceLuminance(spotOnly, 0, 1, 0, 3, 0, 0)).toBe(0); // outside the cone
    });

    it("upload tone mapping, exposure, fog and the camera position through BrioPass", async () => {
        const backend = new WebGL2Backend();
        await backend.init(document.createElement("canvas"));
        expect(backend.passData[3]).toBe(1);
        backend.setPassParameters({
            cameraX: 1,
            cameraY: 2,
            cameraZ: 3,
            targetX: 0,
            targetY: 0,
            targetZ: 0,
            toneMapping: "aces",
            exposure: 1.5,
            fogMode: 3,
            fogColor: "#000000",
            fogNear: 1,
            fogFar: 9,
            fogDensity: 0.1,
        });
        expect(Array.from(backend.passData.subarray(0, 4))).toEqual([1, 2, 3, 1.5]);
        expect(backend.passData[7]).toBe(3);
        expect(backend.passData[10]).toBeCloseTo(0.1);
        expect(backend.passData[11]).toBe(2);
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
            Matrix4.lookAt(
                Matrix4.create(),
                { x: 0, y: 0, z: 3 },
                { x: 0, y: 0, z: 0 },
                { x: 0, y: 1, z: 0 },
            ),
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
            backend.renderMesh3D(
                plane,
                new BrioMaterial("white", { color: "#ffffff" }),
                Matrix4.create(),
                vp,
            );
            backend.endFrame();
            return fills[fills.length - 1];
        };

        backend.setLights(
            buildLightingEnvironment(
                [new BrioLight("a", "ambient", { intensity: 1 })],
                createLightingEnvironment(),
            ),
        );
        expect(render()).toBe("rgb(255, 255, 255)");
        backend.setLights(
            buildLightingEnvironment(
                [new BrioLight("a", "ambient", { intensity: 0 })],
                createLightingEnvironment(),
            ),
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
        // The compositor reuses one environment object, so record its source lights when it is handed over
        const keys: string[] = [];
        const backend = game.renderBackend!;
        const original = backend.setLights!.bind(backend);
        backend.setLights = (env) => {
            keys.push(env.sources.map((light) => `${light.name}:`).join(""));
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
