import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BrioGame } from "../../src/game/BrioGame";
import { BrioObject2D } from "../../src/objects/BrioObject2D";
import { BrioObject3D } from "../../src/objects/BrioObject3D";
import { BrioLayer } from "../../src/core/BrioLayer";
import { BrioScene } from "../../src/core/BrioScene";
import { BrioCamera2D } from "../../src/cameras/BrioCamera2D";
import { BrioCamera3D } from "../../src/cameras/BrioCamera3D";
import { BrioMesh } from "../../src/assets/BrioMesh";
import { BrioCollision } from "../../src/math/BrioCollision";
import { BrioRenderer } from "../../src/rendering/BrioRenderer";
import { RenderBackend } from "../../src/rendering/contracts/RenderBackend";
import { createRecordingContext } from "../helpers/recordingContext";

let calls: ReturnType<typeof createRecordingContext>["calls"];

beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => {
        const recording = createRecordingContext();
        calls = recording.calls;
        return recording.ctx as any;
    });
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

function container(): HTMLDivElement {
    return document.createElement("div");
}

function fakeBackend(): RenderBackend {
    return {
        backendType: "canvas2d",
        init: vi.fn(async () => true),
        beginFrame: vi.fn(),
        renderMesh3D: vi.fn(),
        endFrame: vi.fn(),
        dispose: vi.fn(),
    } as unknown as RenderBackend;
}

function box(name: string, x: number, y: number, size = 10): BrioObject2D {
    const object = new BrioObject2D(name, "", 1);
    object.transform.size = { x: size, y: size };
    object.transform.position = { x, y };
    return object;
}

describe("D-01: 2D hierarchy", () => {
    it("computes world positions through the parent's position, scale and pivot rotation", () => {
        const parent = box("parent", 100, 50, 20);
        const child = box("child", 10, 0);
        child.transform.parent = parent.transform;
        expect(child.transform.getWorldPosition({ x: 0, y: 0 })).toEqual({ x: 110, y: 50 });

        parent.transform.scale = { x: 2, y: 2 };
        expect(child.transform.worldPosition).toEqual({ x: 120, y: 50 });

        // Quarter turn around the parent's center: pivot 0.5 of its 40x40 render size is (20, 20). The scaled
        // child offset (20, 0) is (0, -20) from the pivot, (20, 0) after rotating, (40, 20) back from the pivot
        parent.transform.rotation = Math.PI / 2;
        const p = child.transform.worldPosition;
        expect(p.x).toBeCloseTo(140);
        expect(p.y).toBeCloseTo(70);
    });

    it("draws a child inside its parent's frame", () => {
        const game = new BrioGame({ width: 200, height: 200, container: container() });
        const parent = game.addObject(box("parent", 100, 50));
        const child = game.addObject(box("child", 10, 5));
        child.transform.parent = parent.transform;
        calls.length = 0;
        game.renderFrame();
        const translates = calls.filter((c) => c.name === "translate").map((c) => c.args);
        const parentFrame = translates.findIndex((a) => a[0] === 100 && a[1] === 50);
        expect(parentFrame).toBeGreaterThanOrEqual(0);
        expect(translates.slice(parentFrame + 1).some((a) => a[0] === 10 && a[1] === 5)).toBe(true);
    });

    it("makes the camera follow and the colliders use world positions", () => {
        const parent = box("parent", 300, 300);
        const hand = box("hand", 10, 0);
        hand.transform.parent = parent.transform;
        const camera = new BrioCamera2D("cam", { x: 0, y: 0 }, { x: 100, y: 100 });
        camera.follow(hand);
        camera.update(1);
        expect(camera.pos.x).toBeCloseTo(310 + 5 - 50);

        const target = box("target", 312, 302);
        for (const object of [hand, target]) {
            BrioCollision.addRectangle({
                object,
                colliderType: "trigger",
                pos: { x: 0, y: 0 },
                size: { x: 10, y: 10 },
            });
        }
        expect(BrioCollision.isColliding(hand, target)).toBe(true);
        parent.transform.position.x = 0;
        expect(BrioCollision.isColliding(hand, target)).toBe(false);
    });
});

describe("D-12: 2D culling", () => {
    it("culls off-screen objects with game.scale != 1 and keeps visible ones with a rotated camera", () => {
        const game = new BrioGame({ width: 100, height: 100, container: container() });
        game.scale = 2;
        game.addObject(box("near", 10, 10));
        game.addObject(box("far", 80, 80)); // drawn at 160px: off screen
        game.renderFrame();
        expect(game.renderStats.objectsCulled).toBe(1);

        const camera = new BrioCamera2D("cam", { x: 0, y: 0 }, { x: 100, y: 100 });
        camera.rotation = 0.5;
        game.addCamera(camera);
        game.scale = 1;
        game.renderFrame();
        expect(game.renderStats.objectsDrawn).toBe(2);
    });
});

describe("D-14: unchanged sprites", () => {
    it("assigning the same sprite does not redraw a static layer", () => {
        const game = new BrioGame({ width: 100, height: 100, container: container() });
        const layer = new BrioLayer({ name: "bg", order: 0, policy: "static" });
        game.addLayer(layer);
        const tile = game.addObject(new BrioObject2D("tile", "spr_a"), "bg");
        game.renderFrame();
        const before = game.renderStats.staticRedrawsTotal;
        tile.sprite = "spr_a";
        game.renderFrame();
        expect(game.renderStats.staticRedrawsTotal).toBe(before);
        tile.sprite = "spr_b";
        game.renderFrame();
        expect(game.renderStats.staticRedrawsTotal).toBe(before + 1);
    });
});

describe("3D passes", () => {
    it("pass object opacity down the hierarchy (D-06) and clear cameras without objects", async () => {
        const backend = fakeBackend();
        vi.spyOn(BrioRenderer, "initBackend").mockResolvedValue(backend);
        const game = new BrioGame({
            width: 100,
            height: 100,
            container: container(),
            dimension: "3d",
        });
        game.preload(() => [BrioMesh.createBox("box")]).load(() => [
            new BrioCamera3D("cam", { position: { x: 0, y: 0, z: 10 } }),
        ]);
        await game.ready();
        game.renderFrame();
        expect(backend.beginFrame).toHaveBeenCalledTimes(1);

        const parent = new BrioObject3D("parent", "box");
        const child = new BrioObject3D("child", "box");
        parent.addChild(child);
        parent.transform.opacity = 0.5;
        child.transform.opacity = 0.5;
        game.addObject(parent);
        game.renderFrame();
        const opacities = (backend.renderMesh3D as any).mock.calls.map((c: unknown[]) => c[4]);
        expect(opacities).toEqual([0.5, 0.25]);
    });
});

describe("D-18 and D-19: fixed steps", () => {
    it("runs scene fixed updates at the default rate", async () => {
        const game = new BrioGame({ width: 10, height: 10, container: container() });
        const fixed = vi.fn();
        game.addScene(new BrioScene("level").onFixedUpdate(fixed));
        await game.ready();
        game.step(0.05);
        expect(fixed).toHaveBeenCalledTimes(3);
        expect(fixed.mock.calls[0][1]).toBeCloseTo(1 / 60);
    });

    it("interpolates 2D rotation and scale and restores the simulated values", () => {
        const game = new BrioGame({
            width: 100,
            height: 100,
            container: container(),
            fixedTimestep: 0.1,
            interpolate: true,
            maxDeltaTime: 1,
        });
        const spinner = game.addObject(box("spinner", 0, 0));
        game.fixedUpdate(() => {
            spinner.transform.rotation += 1;
            spinner.transform.scale.x += 1;
        });
        const seen: number[][] = [];
        vi.spyOn(game, "renderFrame").mockImplementation(() => {
            seen.push([spinner.transform.rotation, spinner.transform.scale.x]);
        });
        game.step(0.15); // one fixed step, alpha 0.5
        expect(seen[0][0]).toBeCloseTo(0.5);
        expect(seen[0][1]).toBeCloseTo(1.5);
        expect(spinner.transform.rotation).toBeCloseTo(1);
        expect(spinner.transform.scale.x).toBeCloseTo(2);
    });

    it("interpolates 3D rotations along the shortest arc", () => {
        const game = new BrioGame({
            width: 100,
            height: 100,
            container: container(),
            dimension: "3d",
            fixedTimestep: 0.1,
            interpolate: true,
            maxDeltaTime: 1,
        });
        const cube = game.addObject(new BrioObject3D("cube"));
        game.fixedUpdate(() => {
            cube.transform.rotation.y += Math.PI / 2;
        });
        let renderedY = 0;
        vi.spyOn(game, "renderFrame").mockImplementation(() => {
            renderedY = cube.transform.rotation.y;
        });
        game.step(0.15);
        expect(renderedY).toBeCloseTo(Math.PI / 4, 3);
        expect(cube.transform.rotation.y).toBeCloseTo(Math.PI / 2, 5);
    });
});

describe("runtime robustness", () => {
    it("stops the loop, reports and paints the error when a frame callback throws", async () => {
        const frames: FrameRequestCallback[] = [];
        vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => frames.push(cb));
        vi.stubGlobal("cancelAnimationFrame", vi.fn());
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
        const game = new BrioGame({ width: 100, height: 100, container: container() });
        const onError = vi.fn();
        game.onError(onError);
        game.update(() => {
            throw new TypeError("player is undefined");
        });
        await game.ready();
        calls.length = 0;
        frames.shift()!(16);
        frames.shift()?.(32);

        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError.mock.calls[0][0].message).toBe("player is undefined");
        expect(game.lifecycleError?.message).toBe("player is undefined");
        expect(game.isRunning).toBe(false);
        expect(frames).toHaveLength(0);
        expect(consoleError).toHaveBeenCalled();
        expect(
            calls.some(
                (c) => c.name === "fillText" && String(c.args[0]).includes("player is undefined"),
            ),
        ).toBe(true);
    });

    it("pauses while the page is hidden and resumes when it is visible", async () => {
        vi.stubGlobal(
            "requestAnimationFrame",
            vi.fn(() => 1),
        );
        vi.stubGlobal("cancelAnimationFrame", vi.fn());
        const game = new BrioGame({ width: 10, height: 10, container: container() });
        game.update(() => {});
        await game.ready();
        expect(game.isRunning).toBe(true);
        const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
        document.dispatchEvent(new Event("visibilitychange"));
        expect(game.isRunning).toBe(false);
        hidden.mockReturnValue(false);
        document.dispatchEvent(new Event("visibilitychange"));
        expect(game.isRunning).toBe(true);

        game.pauseWhenHidden = false;
        hidden.mockReturnValue(true);
        document.dispatchEvent(new Event("visibilitychange"));
        expect(game.isRunning).toBe(true);
        game.end();
    });

    it("claims touch gestures on the canvas", () => {
        const game = new BrioGame({ width: 10, height: 10, container: container() });
        expect(game.canvas.style.touchAction).toBe("none");
    });
});
