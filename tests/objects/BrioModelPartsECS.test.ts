import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrioGame } from "../../src/game/BrioGame";
import { BrioScene } from "../../src/core/BrioScene";
import { BrioModel } from "../../src/assets/BrioModel";
import { BrioMesh } from "../../src/assets/BrioMesh";
import { BrioObject3D } from "../../src/objects/BrioObject3D";
import { createRecordingContext } from "../helpers/recordingContext";

function twoPartModel(): BrioModel {
    return BrioModel.fromData("mod_robot", [BrioMesh.createBox("mesh_body"), BrioMesh.createSphere("mesh_head")]);
}

describe("BrioModel parts are registered in the ECS", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
            () => createRecordingContext().ctx as any,
        );
    });

    it("binds every part to its own slot and restores part transforms from game checkpoints", () => {
        const game = new BrioGame({ width: 64, height: 64, container: document.createElement("div"), dimension: "3d" });
        const robot = game.addObject(twoPartModel().instantiate("obj_robot"));
        const [body, head] = robot.children;
        expect(body.entityId).toBeGreaterThanOrEqual(0);
        expect(head.entityId).toBeGreaterThanOrEqual(0);
        expect(new Set([robot.entityId, body.entityId, head.entityId]).size).toBe(3);
        expect(head.transform.isBoundToECS).toBe(true);

        head.transform.position = { x: 0, y: 1.5, z: 0 };
        game.createCheckPoint();
        head.transform.position = { x: 9, y: 9, z: 9 };
        game.restoreCheckPoint();
        expect(head.transform.position.y).toBe(1.5);
        expect(head.transform.position.x).toBe(0);
        // Parts stay out of the root registry: the compositor renders them through their root
        expect(game.gameObjects3D.has(head.name)).toBe(false);
    });

    it("releases part slots when the root is destroyed", () => {
        const game = new BrioGame({ width: 64, height: 64, container: document.createElement("div"), dimension: "3d" });
        const robot = game.addObject(twoPartModel().instantiate("obj_robot"));
        const head = robot.children[1];
        const alive = game.ecsWorld.activeCount;
        game.destroy(robot);
        expect(head.entityId).toBe(-1);
        expect(head.transform.isBoundToECS).toBe(false);
        expect(game.ecsWorld.activeCount).toBe(alive - 3);
    });

    it("covers parts in scene checkpoints and restart()", async () => {
        const game = new BrioGame({ width: 64, height: 64, container: document.createElement("div"), dimension: "3d" });
        const root = new BrioObject3D("obj_root");
        const arm = new BrioObject3D("obj_arm");
        root.addChild(arm);
        arm.transform.position = { x: 1, y: 0, z: 0 };
        const scene = new BrioScene("s").load(() => [root]);
        game.addScene(scene);
        await game.ready();
        expect(arm.entityId).toBeGreaterThanOrEqual(0);

        arm.transform.position = { x: 5, y: 5, z: 5 };
        scene.restart();
        expect(arm.transform.position.x).toBe(1);

        scene.removeObject(root);
        expect(arm.entityId).toBe(-1);
    });
});
