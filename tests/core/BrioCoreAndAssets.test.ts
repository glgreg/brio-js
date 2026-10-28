import { describe, expect, it } from "vitest";
import { BrioMaterial } from "../../src/assets/BrioMaterial";
import { BrioMesh } from "../../src/assets/BrioMesh";
import { BrioSpriteSheet } from "../../src/assets/BrioSpriteSheet";
import { BrioTileMap } from "../../src/assets/BrioTileMap";
import { BrioCamera2D } from "../../src/cameras/BrioCamera2D";
import { BrioCamera3D } from "../../src/cameras/BrioCamera3D";
import { BrioScene } from "../../src/core/BrioScene";
import { BrioTimer } from "../../src/core/BrioTimer";
import { BrioGame } from "../../src/game/BrioGame";
import { BrioObject2D } from "../../src/objects/BrioObject2D";
import { BrioObject3D } from "../../src/objects/BrioObject3D";
import { BrioRenderer, Canvas2DBackend } from "../../src/rendering/BrioRenderer";

describe("Core Subsystems, Cameras, Assets, 3D Renderer & Game Checkpoints", () => {
    it("schedules and pauses frame-synchronized tasks in BrioTimer", () => {
        const timer = new BrioTimer();
        let firedOnce = 0;
        let firedRepeating = 0;

        timer.after(1.0, () => {
            firedOnce++;
        });
        timer.every(0.5, () => {
            firedRepeating++;
        });

        timer.update(0.5);
        expect(firedOnce).toBe(0);
        expect(firedRepeating).toBe(1);

        timer.pause();
        timer.update(2.0);
        expect(firedOnce).toBe(0);

        timer.resume();
        timer.update(0.5);
        expect(firedOnce).toBe(1);
        expect(firedRepeating).toBe(2);
    });

    it("merges contiguous solid tiles via 2D greedy meshing in BrioTileMap", () => {
        const map = new BrioTileMap(
            "test_map",
            16,
            16,
            [
                [1, 1, 1, 0],
                [1, 1, 1, 0],
            ],
            [1],
        );

        // A 3x2 block of solid tiles should merge into a single 48x32 rectangle!
        const merged = map.buildMergedColliders();
        expect(merged.length).toBe(1);
        expect(merged[0].width).toBe(48);
        expect(merged[0].height).toBe(32);
    });

    it("drives frame-based sprite animations via BrioSpriteSheet and BrioAnimation", () => {
        const sheet = new BrioSpriteSheet("hero_sheet", "spr_hero", 32, 32, 2, 1);
        expect(sheet.totalCells).toBe(2);
        expect(sheet.getCellRect(1)).toEqual({
            col: 1,
            row: 0,
            x: 32,
            y: 0,
            width: 32,
            height: 32,
        });

        const anim = sheet.createAnimation("run", 0, 1, { fps: 10, loop: true });
        expect(anim.currentFrame).toBe("hero_sheet_cell_0");

        anim.update(0.12); // advances past frame 0 (0.1s per frame at 10 FPS)
        expect(anim.currentFrame).toBe("hero_sheet_cell_1");
    });

    it("projects 3D meshes and cameras on Canvas2DBackend and parses Wavefront OBJ", async () => {
        const objSource = [
            "v 0 0 0",
            "v 1 0 0",
            "v 0 1 0",
            "vn 0 0 1",
            "vt 0 0",
            "vt 1 0",
            "vt 0 1",
            "f 1/1/1 2/2/1 3/3/1",
        ].join("\n");

        const mesh = BrioMesh.fromOBJ("tri", objSource);
        expect(mesh.indices.length).toBe(3);

        const boxMesh = BrioMesh.createBox("cube", 2, 2, 2);
        expect(boxMesh.indices.length).toBe(36);

        const cam3D = new BrioCamera3D("cam3d", {
            fov: Math.PI / 3,
            aspect: 640 / 480,
        });
        cam3D.position = { x: 0, y: 0, z: 5 };
        cam3D.lookAt({ x: 0, y: 0, z: 0 });

        const ndcPt = cam3D.projectToNDC({ x: 0, y: 0, z: 0 });
        expect(ndcPt.x).toBeCloseTo(0, 3);
        expect(ndcPt.y).toBeCloseTo(0, 3);

        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        expect(BrioRenderer.selectBestBackendType("canvas2d")).toBe("canvas2d");

        const backend = new Canvas2DBackend();
        await backend.init(canvas);
        backend.beginFrame({ x: 0, y: 0, width: 1, height: 1 }, "#000000");
        backend.renderMesh3D(
            boxMesh,
            new BrioMaterial({ color: "#4488ff", wireframe: true }),
            new BrioObject3D("cube_obj").transform.worldMatrix,
            cam3D.viewProjectionMatrix,
        );
        backend.endFrame();
    });

    it("manages BrioGame dimension presets, BrioScene transitions, and binary checkpoints", () => {
        const container = document.createElement("div");
        const game = new BrioGame({
            width: 800,
            height: 600,
            container,
            dimension: "3d",
        });

        expect(game.dimension).toBe("3d");
        expect(game.width).toBe(800);
        expect(game.height).toBe(600);

        const scene1 = new BrioScene("scene_1");
        const scene2 = new BrioScene("scene_2");
        const hero = new BrioObject2D("hero", "", 1);
        hero.transform.position = { x: 50, y: 75 };
        scene1.addObject2D(hero);
        scene1.createCheckpoint();

        hero.transform.position = { x: 400, y: 500 };
        scene1.restoreCheckpoint();
        expect(hero.transform.position.x).toBe(50);
        expect(hero.transform.position.y).toBe(75);

        game.addScene(scene1).addScene(scene2);
        expect(game.activeScene).toBe(scene1);
        game.setScene("scene_2");
        expect(game.activeScene).toBe(scene2);
        expect(scene1.isPaused).toBe(true);
        expect(scene2.isPaused).toBe(false);

        const cam2D = new BrioCamera2D("cam2d", { x: 0, y: 0 }, { x: 800, y: 600 });
        cam2D.follow(hero, 1);
        cam2D.update(0.016);
        expect(cam2D.pos.x).toBe(50 - 400);
        expect(cam2D.pos.y).toBe(75 - 300);
    });
});
