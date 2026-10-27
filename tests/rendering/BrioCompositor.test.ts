import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BrioGame } from "../../src/game/BrioGame";
import { BrioObject2D } from "../../src/objects/BrioObject2D";
import { BrioObject3D } from "../../src/objects/BrioObject3D";
import { BrioSprite } from "../../src/assets/BrioSprite";
import { BrioLayer } from "../../src/core/BrioLayer";
import { BrioViewport } from "../../src/core/BrioViewport";
import { BrioScene } from "../../src/core/BrioScene";
import { BrioCamera2D } from "../../src/cameras/BrioCamera2D";
import { BrioCamera3D } from "../../src/cameras/BrioCamera3D";
import { BrioMesh } from "../../src/assets/BrioMesh";
import { BrioMaterial } from "../../src/assets/BrioMaterial";
import { createRecordingContext, RecordedCall } from "../helpers/recordingContext";

type Recorder = ReturnType<typeof createRecordingContext>;

describe("BrioCompositor integration in BrioGame", () => {
    let container: HTMLDivElement;
    let contexts: Recorder[];

    beforeEach(() => {
        container = document.createElement("div");
        contexts = [];
        // Every canvas (game canvas, static layer caches) gets its own recording context
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => {
            const rec = createRecordingContext();
            contexts.push(rec);
            return rec.ctx as any;
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    function withSprite(game: BrioGame, name: string): BrioSprite {
        const spr = new BrioSprite(name, `./${name}.png`);
        spr.size = { x: 16, y: 16 };
        game.loadedGameSprites.set(name, spr);
        return spr;
    }

    function drawnImages(calls: RecordedCall[]): unknown[] {
        return calls.filter((c) => c.name === "drawImage").map((c) => c.args[0]);
    }

    it("draws layers by ascending order regardless of registration order", () => {
        const game = new BrioGame(640, 480, container);
        const main = contexts[0];
        const sprBack = withSprite(game, "spr_back");
        const sprFront = withSprite(game, "spr_front");

        game.addLayer(new BrioLayer({ name: "front", order: 10 }));
        game.addLayer(new BrioLayer({ name: "back", order: -10 }));
        game.addObject(new BrioObject2D("obj_front", "spr_front"), "front");
        game.addObject(new BrioObject2D("obj_back", "spr_back"), "back");

        game.renderFrame();
        expect(drawnImages(main.calls)).toEqual([sprBack.element, sprFront.element]);
    });

    it("does not allocate or sort arrays per frame once the order is stable", () => {
        const game = new BrioGame(640, 480, container);
        withSprite(game, "spr");
        for (let i = 0; i < 20; i++) {
            game.addObject(new BrioObject2D(`obj_${i}`, "spr", 20 - i));
        }
        game.renderFrame(); // first frame sorts once

        const fromSpy = vi.spyOn(Array, "from");
        const sortSpy = vi.spyOn(Array.prototype, "sort");
        game.renderFrame();
        game.renderFrame();
        expect(fromSpy).not.toHaveBeenCalled();
        expect(sortSpy).not.toHaveBeenCalled();

        // Changing a depth is detected without any notification and triggers exactly one re-sort
        game.gameObjects.get("obj_0")!.transform.layer = 0;
        game.renderFrame();
        expect(sortSpy).toHaveBeenCalledTimes(1);
    });

    it("renders one clipped pass per BrioCamera2D viewport (split-screen)", () => {
        const game = new BrioGame(640, 480, container);
        const main = contexts[0];
        withSprite(game, "spr");
        game.addObject(new BrioObject2D("obj_hero", "spr"));
        game.addCamera(
            new BrioCamera2D(
                "cam_p1",
                { x: 0, y: 0 },
                undefined,
                BrioViewport.fromPreset("split-horizontal-top"),
            ),
        );
        game.addCamera(
            new BrioCamera2D(
                "cam_p2",
                { x: 0, y: 0 },
                undefined,
                BrioViewport.fromPreset("split-horizontal-bottom"),
            ),
        );

        game.renderFrame();
        const rects = main.calls.filter((c) => c.name === "rect").map((c) => c.args);
        expect(rects).toEqual([
            [0, 0, 640, 240],
            [0, 240, 640, 240],
        ]);
        expect(main.count("clip")).toBe(2);
        expect(main.count("drawImage")).toBe(2);
        expect(game.cameras2D.get("cam_p1")!.size).toEqual({ x: 640, y: 240 });
    });

    it("draws ui layers once, after every viewport, in screen space", () => {
        const game = new BrioGame(640, 480, container);
        const main = contexts[0];
        const sprWorld = withSprite(game, "spr_world");
        const sprHud = withSprite(game, "spr_hud");
        const hud = new BrioLayer({ name: "hud", order: 100, policy: "ui" });
        game.addLayer(hud);
        game.addObject(new BrioObject2D("obj_world", "spr_world"));
        game.addObject(new BrioObject2D("obj_hud", "spr_hud"), "hud");
        game.addCamera(
            new BrioCamera2D(
                "cam_a",
                { x: 500, y: 0 },
                undefined,
                BrioViewport.fromPreset("split-vertical-left"),
            ),
        );
        game.addCamera(
            new BrioCamera2D(
                "cam_b",
                { x: 0, y: 0 },
                undefined,
                BrioViewport.fromPreset("split-vertical-right"),
            ),
        );

        game.renderFrame();
        const images = drawnImages(main.calls);
        expect(images.filter((img) => img === sprHud.element)).toHaveLength(1);
        expect(images[images.length - 1]).toBe(sprHud.element);
        expect(images.filter((img) => img === sprWorld.element).length).toBeLessThanOrEqual(2);
    });

    it("offsets parallax layers by camera position times scrollFactor and culls dynamic objects", () => {
        const game = new BrioGame(640, 480, container);
        const main = contexts[0];
        withSprite(game, "spr");
        game.addLayer(
            new BrioLayer({
                name: "far",
                order: -1,
                policy: "parallax",
                scrollFactor: { x: 0.5, y: 0.25 },
            }),
        );
        game.addObject(new BrioObject2D("obj_mountain", "spr"), "far");
        const offscreen = game.addObject(new BrioObject2D("obj_far_away", "spr"));
        offscreen.transform.position = { x: 5000, y: 5000 };
        game.addCamera(new BrioCamera2D("cam", { x: 100, y: 40 }));

        game.renderFrame();
        const translates = main.calls.filter((c) => c.name === "translate").map((c) => c.args);
        expect(translates).toContainEqual([-50, -10]);
        // Only the parallax object is drawn: the dynamic one is outside the camera frustum
        expect(main.count("drawImage")).toBe(1);
        expect(game.renderStats.objectsCulled).toBe(1);
        expect(game.renderStats.passes2D).toBe(1);
    });

    it("caches static layers and only re-rasterizes when an object or the camera changes", () => {
        const game = new BrioGame(640, 480, container);
        withSprite(game, "spr_tile");
        game.addLayer(new BrioLayer({ name: "terrain", order: -5, policy: "static" }));
        const tile = game.addObject(new BrioObject2D("obj_tile", "spr_tile"), "terrain");
        const cam = new BrioCamera2D("cam");
        game.addCamera(cam);

        game.renderFrame();
        const main = contexts[0];
        const cache = contexts[1];
        expect(cache).toBeDefined();
        expect(cache.count("drawImage")).toBe(1);
        expect(main.count("drawImage")).toBe(1); // the cache surface

        game.renderFrame();
        game.renderFrame();
        expect(cache.count("drawImage")).toBe(1);
        expect(main.count("drawImage")).toBe(3);

        tile.transform.position.x = 32;
        game.renderFrame();
        expect(cache.count("drawImage")).toBe(2);

        cam.pos.x = 10;
        game.renderFrame();
        expect(cache.count("drawImage")).toBe(3);

        game.renderFrame();
        expect(cache.count("drawImage")).toBe(3);
        expect(game.renderStats.staticRedraws).toBe(0);
        expect(game.renderStats.staticRedrawsTotal).toBe(3);
    });

    it("renders 3D objects (and their child parts) through the 3D backend for every BrioCamera3D", async () => {
        const game = new BrioGame(640, 480, container, "hybrid");
        game.preload(() => [
            BrioMesh.createBox("mesh_box", 1, 1, 1),
            new BrioMaterial("mat_red", { color: "#ff0000" }),
        ]);
        await game.ready();
        expect(game.renderBackend?.backendType).toBe("canvas2d");

        const root = new BrioObject3D("obj_root", "mesh_box", "mat_red");
        root.addChild(new BrioObject3D("obj_part", "mesh_box", "mat_red"));
        game.addObject(root);
        game.addCamera(
            new BrioCamera3D("cam_3d", {
                position: { x: 0, y: 0, z: 5 },
                viewport: BrioViewport.fromPreset("minimap-top-right"),
            }),
        );

        const renderMesh = vi.spyOn(game.renderBackend!, "renderMesh3D");
        game.renderFrame();
        expect(renderMesh).toHaveBeenCalledTimes(2);
        expect(renderMesh.mock.calls[0][1].name).toBe("mat_red");
    });

    it("composes the active BrioScene after the game content", () => {
        const game = new BrioGame(640, 480, container);
        const main = contexts[0];
        const sprGame = withSprite(game, "spr_game");
        const sprScene = withSprite(game, "spr_scene");
        game.addObject(new BrioObject2D("obj_game", "spr_game"));

        const scene = new BrioScene("scene_level");
        scene.addObject2D(new BrioObject2D("obj_scene", "spr_scene"));
        game.addScene(scene);

        game.renderFrame();
        expect(drawnImages(main.calls)).toEqual([sprGame.element, sprScene.element]);
    });
});
