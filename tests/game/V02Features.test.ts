import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BrioGame, LoadProgress } from "../../src/game/BrioGame";
import { BrioObject2D } from "../../src/objects/BrioObject2D";
import { BrioObject3D } from "../../src/objects/BrioObject3D";
import { BrioText } from "../../src/objects/BrioText";
import { BrioMesh } from "../../src/assets/BrioMesh";
import { BrioMaterial } from "../../src/assets/BrioMaterial";
import { BrioTileMap } from "../../src/assets/BrioTileMap";
import { BrioScene } from "../../src/core/BrioScene";
import { BrioCamera3D } from "../../src/cameras/BrioCamera3D";
import { BrioCollision } from "../../src/math/BrioCollision";
import { BrioRenderer } from "../../src/rendering/BrioRenderer";
import { RenderBackend } from "../../src/rendering/contracts/RenderBackend";
import { createRecordingContext } from "../helpers/recordingContext";

function fakeBackend(): RenderBackend {
    return {
        backendType: "canvas2d",
        init: vi.fn(async () => true),
        beginFrame: vi.fn(),
        renderMesh3D: vi.fn(),
        endFrame: vi.fn(),
        dispose: vi.fn(),
        releaseMesh: vi.fn(),
        releaseTexture: vi.fn(),
    } as unknown as RenderBackend;
}

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
});

function container(): HTMLDivElement {
    return document.createElement("div");
}

describe("lifecycle errors and empty preloads", () => {
    it("accepts a preload that returns no assets", async () => {
        const game = new BrioGame({ width: 10, height: 10, container: container() });
        const load = vi.fn(() => []);
        game.preload(() => []).load(load);
        await game.ready();
        expect(load).toHaveBeenCalled();
    });

    it("rejects ready() with an Error naming the asset that failed", async () => {
        const game = new BrioGame({ width: 10, height: 10, container: container() });
        game.preload(() => {
            throw new TypeError("boom");
        });
        await expect(game.ready()).rejects.toThrow("boom");
        expect(game.lifecycleError).toBeInstanceOf(TypeError);
    });
});

describe("BrioText", () => {
    it("measures its box, wraps at maxWidth and keeps the type when instantiated", () => {
        const text = new BrioText("txt", "one two three four", { size: 10, maxWidth: 60 });
        expect(text.lines.length).toBeGreaterThan(1);
        expect(text.transform.size.x).toBe(60);
        expect(text.transform.size.y).toBe(Math.ceil(text.lines.length * 10 * 1.25));
        text.text = "a\nb";
        expect(text.lines).toEqual(["a", "b"]);

        const game = new BrioGame({ width: 100, height: 100, container: container() });
        game.addObject(text);
        const copy = game.instantiate(text);
        expect(copy).toBeInstanceOf(BrioText);
        expect(copy.text).toBe("a\nb");
        expect(copy.maxWidth).toBe(60);
    });

    it("is drawn with fillText (and strokeText for outlines) instead of a sprite", () => {
        const game = new BrioGame({ width: 100, height: 100, container: container() });
        game.addObject(new BrioText("txt", "Score", { strokeWidth: 2 }));
        calls.length = 0;
        game.renderFrame();
        const names = calls.map((c) => c.name);
        expect(names).toContain("strokeText");
        expect(names).toContain("fillText");
        expect(names).not.toContain("drawImage");
    });
});

describe("checkpoints keep the state outside the ECS", () => {
    it("restores sprite, flip, tag, collider, parent and text", () => {
        const game = new BrioGame({ width: 100, height: 100, container: container() });
        const parent = game.addObject(new BrioObject2D("obj_parent"));
        const hero = game.addObject(new BrioObject2D("obj_hero", "spr_idle"));
        const label = game.addObject(new BrioText("txt_label", "Ready"));
        BrioCollision.addRectangle({
            object: hero,
            colliderType: "solid",
            pos: { x: 0, y: 0 },
            size: { x: 4, y: 4 },
        });
        hero.tag = "player";
        game.createCheckPoint();

        hero.sprite = "spr_run";
        hero.transform.flip = { x: true, y: false };
        hero.transform.parent = parent.transform;
        hero.tag = "ghost";
        hero.collision!.size.x = 99;
        label.text = "Go!";
        game.restoreCheckPoint();

        expect(hero.sprite).toBe("spr_idle");
        expect(hero.transform.flip.x).toBe(false);
        expect(hero.transform.parent).toBeUndefined();
        expect(hero.tag).toBe("player");
        expect(hero.collision!.size.x).toBe(4);
        expect(label.text).toBe("Ready");
    });

    it("restores 3D mesh, material and detached parts", () => {
        const game = new BrioGame({
            width: 100,
            height: 100,
            container: container(),
            dimension: "3d",
        });
        const ship = new BrioObject3D("ship", "mesh_a", "mat_a");
        const wing = new BrioObject3D("ship/wing", "mesh_w");
        ship.addChild(wing);
        game.addObject(ship);
        game.createCheckPoint();
        ship.mesh = "mesh_b";
        ship.material = "mat_b";
        ship.removeChild(wing);
        game.restoreCheckPoint();
        expect(ship.mesh).toBe("mesh_a");
        expect(ship.material).toBe("mat_a");
        expect(wing.parent).toBe(ship);
        expect(wing.entityId).toBeGreaterThanOrEqual(0);
    });

    it("restores tile map tiles on restart()", async () => {
        const game = new BrioGame({ width: 100, height: 100, container: container() });
        const map = new BrioTileMap("map", 16, 16, [
            [1, 1],
            [0, 0],
        ]);
        game.load(() => [map]);
        await game.ready();
        expect(game.getLayer("default")!.hasTileMap(map)).toBe(true);
        map.setTile(0, 0, 0);
        game.restart();
        expect(map.getTile(0, 0)).toBe(1);
    });
});

describe("pixel ratio and window fitting", () => {
    it("sizes the backing store by the pixel ratio and keeps logical coordinates", () => {
        const game = new BrioGame({
            width: 320,
            height: 180,
            container: container(),
            pixelRatio: 2,
        });
        const canvas = game.canvas;
        expect(canvas.width).toBe(640);
        expect(canvas.height).toBe(360);
        expect(canvas.style.width).toBe("320px");
        expect(game.width).toBe(320);
        calls.length = 0;
        game.renderFrame();
        expect(calls.find((c) => c.name === "setTransform")?.args).toEqual([2, 0, 0, 2, 0, 0]);

        game.pixelRatio = 1;
        expect(canvas.width).toBe(320);
        game.resize(100, 50);
        expect(canvas.width).toBe(100);
        expect(game.height).toBe(50);
    });

    it("auto ratio follows devicePixelRatio capped at maxPixelRatio", () => {
        vi.spyOn(window, "devicePixelRatio", "get").mockReturnValue(3);
        const game = new BrioGame({ width: 100, height: 100, container: container() });
        expect(game.pixelRatio).toBe(2);
        const sharp = new BrioGame({
            width: 100,
            height: 100,
            container: container(),
            maxPixelRatio: 4,
        });
        expect(sharp.pixelRatio).toBe(3);
    });

    it("fit mode scales the canvas to the window and end() removes the listener", () => {
        vi.spyOn(window, "innerWidth", "get").mockReturnValue(1280);
        vi.spyOn(window, "innerHeight", "get").mockReturnValue(1000);
        const add = vi.spyOn(window, "addEventListener");
        const remove = vi.spyOn(window, "removeEventListener");
        const game = new BrioGame({
            width: 320,
            height: 180,
            container: container(),
            pixelRatio: 1,
        });
        game.useFullScreen("fit");
        expect(game.width).toBe(320);
        expect(game.canvas.style.width).toBe("1280px");
        expect(game.canvas.style.height).toBe("720px");
        expect(game.canvas.width).toBe(1280);

        game.useFullScreen("resize");
        expect(game.width).toBe(1280);
        expect(game.height).toBe(1000);
        const resizeAdds = add.mock.calls.filter((c) => c[0] === "resize").length;
        expect(remove.mock.calls.filter((c) => c[0] === "resize").length).toBe(resizeAdds - 1);

        game.end();
        expect(remove.mock.calls.filter((c) => c[0] === "resize").length).toBe(resizeAdds);
    });
});

describe("asset lifetime", () => {
    it("reports load progress for every asset", async () => {
        const game = new BrioGame({
            width: 10,
            height: 10,
            container: container(),
            dimension: "3d",
        });
        const events: LoadProgress[] = [];
        game.onLoadProgress((p) => events.push(p));
        game.preload(() => [BrioMesh.createBox("mesh_box"), new BrioMaterial("mat_red")]);
        await game.ready();
        expect(events.map((e) => [e.loaded, e.total, e.asset])).toEqual([
            [1, 2, "mesh_box"],
            [2, 2, "mat_red"],
        ]);
        expect(events[1].ratio).toBe(1);
        expect(events[1].scene).toBeUndefined();
    });

    it("unloads assets and releases GPU copies", async () => {
        const backend = fakeBackend();
        vi.spyOn(BrioRenderer, "initBackend").mockResolvedValue(backend);
        const game = new BrioGame({
            width: 10,
            height: 10,
            container: container(),
            dimension: "3d",
        });
        const box = BrioMesh.createBox("mesh_box");
        game.preload(() => [box]);
        await game.ready();
        expect(game.unloadAsset("mesh_box")).toBe(true);
        expect(game.loadedMeshes.has("mesh_box")).toBe(false);
        expect(backend.releaseMesh).toHaveBeenCalledWith(box);
        expect(game.unloadAsset("mesh_box")).toBe(false);
    });

    it("removeScene() unloads only the assets no other owner requested", async () => {
        const game = new BrioGame({
            width: 10,
            height: 10,
            container: container(),
            dimension: "3d",
        });
        const shared = BrioMesh.createBox("mesh_shared");
        const own = BrioMesh.createBox("mesh_own");
        game.preload(() => [shared]);
        const level = new BrioScene("level").preload(() => [shared, own]);
        const menu = new BrioScene("menu");
        game.addScene(level);
        game.addScene(menu);
        await game.ready();
        expect(game.activeScene).toBe(level);
        expect(() => game.removeScene("level")).toThrow();
        game.setScene("menu");
        await game.ready();
        expect(game.removeScene("level")).toBe(true);
        expect(game.scenes.has("level")).toBe(false);
        expect(game.loadedMeshes.has("mesh_own")).toBe(false);
        expect(game.loadedMeshes.has("mesh_shared")).toBe(true);
    });
});

describe("3D frustum culling", () => {
    it("skips objects outside the camera frustum", async () => {
        const backend = fakeBackend();
        vi.spyOn(BrioRenderer, "initBackend").mockResolvedValue(backend);
        const game = new BrioGame({
            width: 100,
            height: 100,
            container: container(),
            dimension: "3d",
        });
        game.preload(() => [BrioMesh.createBox("mesh_box")]).load(() => {
            const near = new BrioObject3D("near", "mesh_box");
            const behind = new BrioObject3D("behind", "mesh_box");
            behind.transform.position.z = 50;
            const camera = new BrioCamera3D("cam", { position: { x: 0, y: 0, z: 10 } });
            return [camera, near, behind];
        });
        await game.ready();
        game.renderFrame();
        expect(game.renderStats.objects3DDrawn).toBe(1);
        expect(game.renderStats.objects3DCulled).toBe(1);
        expect(backend.renderMesh3D).toHaveBeenCalledTimes(1);
    });
});

describe("composition order", () => {
    it("draws game-level ui layers above the active scene", async () => {
        const { BrioLayer } = await import("../../src/core/BrioLayer");
        const game = new BrioGame({ width: 100, height: 100, container: container() });
        const hud = new BrioText("txt_hud", "HUD");
        const ui = new BrioLayer({ name: "ui", order: 100, policy: "ui" });
        ui.addObject(hud);
        game.load(() => [ui, hud]);
        const scene = new BrioScene("level").load(() => [new BrioText("txt_world", "WORLD")]);
        game.addScene(scene);
        await game.ready();
        calls.length = 0;
        game.renderFrame();
        const texts = calls.filter((c) => c.name === "fillText").map((c) => c.args[0]);
        expect(texts).toEqual(["WORLD", "HUD"]);
    });
});

describe("scene cameras", () => {
    it("receive game.random when the scene activates", async () => {
        const { BrioCamera2D } = await import("../../src/cameras/BrioCamera2D");
        const game = new BrioGame({ width: 10, height: 10, container: container(), seed: 1 });
        const camera = new BrioCamera2D("cam");
        game.addScene(new BrioScene("level").load(() => [camera]));
        await game.ready();
        expect(camera.random).toBe(game.random);
    });
});
