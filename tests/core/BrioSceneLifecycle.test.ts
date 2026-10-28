import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrioGame } from "../../src/game/BrioGame";
import { BrioScene } from "../../src/core/BrioScene";
import { BrioLayer } from "../../src/core/BrioLayer";
import { BrioObject2D } from "../../src/objects/BrioObject2D";
import { BrioObject3D } from "../../src/objects/BrioObject3D";
import { BrioMesh } from "../../src/assets/BrioMesh";
import { BrioCamera2D } from "../../src/cameras/BrioCamera2D";
import { createRecordingContext } from "../helpers/recordingContext";

describe("BrioScene lifecycle unified with BrioGame", () => {
    let container: HTMLDivElement;

    beforeEach(() => {
        container = document.createElement("div");
        vi.restoreAllMocks();
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
            () => createRecordingContext().ctx as any,
        );
    });

    it("runs scene preload and load on first activation, with assets in the shared game registries", async () => {
        const game = new BrioGame({ width: 320, height: 240, container, dimension: "hybrid" });
        const order: string[] = [];
        const mesh = BrioMesh.createBox("mesh_scene_box");
        const hud = new BrioLayer({ name: "hud", order: 10, policy: "ui" });
        const score = new BrioObject2D("obj_score", "", 1);
        hud.addObject(score);

        const level = new BrioScene("level")
            .preload(() => {
                order.push("preload");
                return [mesh];
            })
            .load((assets, scene) => {
                order.push("load");
                expect(scene.name).toBe("level");
                expect(typeof assets.getSprite).toBe("function");
                return [
                    hud,
                    score,
                    new BrioCamera2D("cam_level"),
                    new BrioObject2D("obj_enemy", "", 1),
                    new BrioObject3D("obj_crate", "mesh_scene_box"),
                ];
            });

        expect(level.isLoaded).toBe(false);
        game.addScene(level);
        expect(game.activeScene).toBeUndefined();

        await game.ready();
        expect(order).toEqual(["preload", "load"]);
        expect(level.isLoaded).toBe(true);
        expect(game.activeScene).toBe(level);
        expect(game.loadedMeshes.get("mesh_scene_box")).toBe(mesh);
        expect(level.layers.get("hud")!.hasObject(score)).toBe(true);
        expect(level.layers.get("default")!.hasObject(level.objects2D.get("obj_enemy")!)).toBe(true);
        expect(level.cameras2D.has("cam_level")).toBe(true);
        expect(level.objects3D.has("obj_crate")).toBe(true);

        // Re-activating a loaded scene does not run its callbacks again
        game.addScene(new BrioScene("menu"));
        game.setScene("menu");
        game.setScene("level");
        await game.ready();
        expect(order).toEqual(["preload", "load"]);
        expect(game.activeScene).toBe(level);
    });

    it("scene.restart() returns to the state right after load(), including spawned and removed objects", async () => {
        const game = new BrioGame(320, 240, container);
        const enemy = new BrioObject2D("obj_enemy", "", 1);
        enemy.transform.position = { x: 10, y: 20 };
        const level = new BrioScene("level").load(() => [enemy]);
        game.addScene(level);
        await game.ready();

        enemy.transform.position = { x: 99, y: 99 };
        const spawned = level.addObject2D(new BrioObject2D("obj_bullet", "", 1));
        level.removeObject(enemy);
        expect(level.objects2D.has("obj_enemy")).toBe(false);

        expect(level.restart()).toBe(true);
        expect(level.objects2D.get("obj_enemy")).toBe(enemy);
        expect(level.objects2D.has("obj_bullet")).toBe(false);
        expect(spawned.entityId).toBe(-1);
        expect(enemy.transform.position.x).toBe(10);
        expect(enemy.transform.position.y).toBe(20);
        expect(level.layers.get("default")!.hasObject(enemy)).toBe(true);
    });

    it("game checkpoints and restart cover the active scene", async () => {
        const game = new BrioGame(320, 240, container);
        const hero = new BrioObject2D("obj_hero", "", 1);
        game.addObject(hero);
        hero.transform.position = { x: 1, y: 1 };

        const enemy = new BrioObject2D("obj_enemy", "", 1);
        enemy.transform.position = { x: 5, y: 5 };
        const level = new BrioScene("level").load(() => [enemy]);
        game.addScene(level);
        await game.ready();

        game.createCheckPoint();
        hero.transform.position = { x: 50, y: 50 };
        enemy.transform.position = { x: 70, y: 70 };
        level.addObject2D(new BrioObject2D("obj_late", "", 1));

        expect(game.restoreCheckPoint()).toBe(true);
        expect(hero.transform.position.x).toBe(1);
        expect(enemy.transform.position.x).toBe(5);
        expect(level.objects2D.has("obj_late")).toBe(false);

        enemy.transform.position = { x: 80, y: 80 };
        game.restart();
        expect(enemy.transform.position.x).toBe(5);
    });

    it("restoring a checkpoint taken in another scene reactivates that scene", async () => {
        const game = new BrioGame(320, 240, container);
        const a = new BrioScene("a");
        const b = new BrioScene("b");
        const marker = a.addObject2D(new BrioObject2D("obj_marker", "", 1));
        marker.transform.position = { x: 3, y: 3 };
        game.addScene(a).addScene(b);

        game.createCheckPoint();
        marker.transform.position = { x: 9, y: 9 };
        game.setScene("b");
        expect(game.activeScene).toBe(b);

        game.restoreCheckPoint();
        expect(game.activeScene).toBe(a);
        expect(a.isPaused).toBe(false);
        expect(b.isPaused).toBe(true);
        expect(marker.transform.position.x).toBe(3);
    });

    it("the latest setScene() wins while a scene is still preloading", async () => {
        const game = new BrioGame(320, 240, container);
        const slow = new BrioScene("slow").preload(() => [BrioMesh.createBox("mesh_slow")]);
        const fast = new BrioScene("fast");
        game.addScene(fast);
        game.addScene(slow);
        game.setScene("slow");
        game.setScene("fast");
        await game.ready();
        expect(game.activeScene).toBe(fast);
        expect(slow.isLoaded).toBe(true);
    });
});
