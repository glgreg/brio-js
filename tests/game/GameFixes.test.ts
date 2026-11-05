import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BrioGame } from "../../src/game/BrioGame";
import { BrioObject2D } from "../../src/objects/BrioObject2D";
import { BrioObject3D } from "../../src/objects/BrioObject3D";
import { BrioMesh } from "../../src/assets/BrioMesh";
import { BrioMaterial } from "../../src/assets/BrioMaterial";
import { BrioModel } from "../../src/assets/BrioModel";
import { BrioKeyboard } from "../../src/input/BrioKeyboard";
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
    } as unknown as RenderBackend;
}

describe("BrioGame fixes (game group)", () => {
    let container: HTMLDivElement;

    beforeEach(() => {
        container = document.createElement("div");
        vi.restoreAllMocks();
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
            () => createRecordingContext().ctx as any,
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("interpolates correctly while the number of moving objects grows and shrinks (pooled records)", () => {
        const game = new BrioGame({
            width: 100,
            height: 100,
            container,
            dimension: "hybrid",
            fixedTimestep: 0.1,
            interpolate: true,
            maxDeltaTime: 1,
        });
        const balls = [0, 1, 2].map((i) =>
            game.addObject(new BrioObject2D(`obj_ball_${i}`, "", 1)),
        );
        const cube = game.addObject(new BrioObject3D("obj_cube"));
        let moving = 3;
        game.fixedUpdate(() => {
            for (let i = 0; i < moving; i++) balls[i].transform.position.x += 10;
            cube.transform.position.z -= 1;
        });

        const rendered: number[][] = [];
        vi.spyOn(game, "renderFrame").mockImplementation(() => {
            rendered.push([...balls.map((b) => b.transform.position.x), cube.transform.position.z]);
        });

        game.step(0.1); // every ball 0 -> 10, alpha 0
        game.step(0.05); // alpha 0.5
        expect(rendered[1]).toEqual([5, 5, 5, -0.5]);

        moving = 1; // fewer records than the pool holds
        game.step(0.05); // one step, alpha 0: only ball 0 and the cube moved
        game.step(0.05); // alpha 0.5
        expect(rendered[3]).toEqual([15, 10, 10, -1.5]);

        moving = 3; // pool reused and large enough again
        game.step(0.05); // one step, alpha 0
        game.step(0.025); // alpha 0.25
        expect(rendered[5]).toEqual([22.5, 12.5, 12.5, -2.25]);

        // Simulated positions are restored after every render
        expect(balls.map((b) => b.transform.position.x)).toEqual([30, 20, 20]);
        expect(cube.transform.position.z).toBe(-3);
    });

    it("rolls the global keyboard state over once per frame so BrioKeyboard.globalIsUp fires", () => {
        const game = new BrioGame({ width: 100, height: 100, container });
        game.useKeyboard();
        // Installs the global listener
        expect(BrioKeyboard.globalIsDown("q")).toBe(false);

        window.dispatchEvent(new KeyboardEvent("keydown", { key: "q" }));
        game.step(1 / 60);
        expect(BrioKeyboard.globalIsDown("q")).toBe(true);
        expect(BrioKeyboard.globalIsUp("q")).toBe(false);

        window.dispatchEvent(new KeyboardEvent("keyup", { key: "q" }));
        expect(BrioKeyboard.globalIsUp("q")).toBe(true);
        expect(game.keyboard.isUp("q")).toBe(true);

        game.step(1 / 60);
        expect(BrioKeyboard.globalIsUp("q")).toBe(false);
        expect(game.keyboard.isUp("q")).toBe(false);
        game.end();
    });

    it("keeps keyboard isPressed / isUp edges working across frames without clearing the previous state", () => {
        const game = new BrioGame({ width: 100, height: 100, container });
        game.useKeyboard();
        const pressed: boolean[] = [];
        game.update(() => pressed.push(game.keyboard.isPressed("x")));

        window.dispatchEvent(new KeyboardEvent("keydown", { key: "x" }));
        game.step(1 / 60);
        game.step(1 / 60);
        window.dispatchEvent(new KeyboardEvent("keyup", { key: "x" }));
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "x" }));
        game.step(1 / 60);
        expect(pressed[0]).toBe(true);
        expect(pressed[1]).toBe(false);
        game.end();
    });

    it("end() clears meshes, materials and models and disposes the 3D backend", async () => {
        const backend = fakeBackend();
        vi.spyOn(BrioRenderer, "initBackend").mockResolvedValue(backend);
        const game = new BrioGame({ width: 100, height: 100, container, dimension: "3d" });
        await game.ready();
        expect(game.renderBackend).toBe(backend);

        game.loadedMeshes.set("mesh_box", BrioMesh.createBox("mesh_box"));
        game.loadedMaterials.set("mat_red", new BrioMaterial("mat_red", { color: "#ff0000" }));
        game.loadedModels.set("mdl_ship", new BrioModel("mdl_ship", "./ship.glb"));

        game.end();
        expect(backend.dispose).toHaveBeenCalledTimes(1);
        expect(game.renderBackend).toBeUndefined();
        expect(game.loadedMeshes.size).toBe(0);
        expect(game.loadedMaterials.size).toBe(0);
        expect(game.loadedModels.size).toBe(0);
        // Rendering after end() skips the disposed backend
        game.step(1 / 60);
        expect(backend.beginFrame).not.toHaveBeenCalled();
    });

    it("disposes a 3D backend that finishes initializing after end()", async () => {
        const backend = fakeBackend();
        let resolveBackend!: (value: RenderBackend) => void;
        vi.spyOn(BrioRenderer, "initBackend").mockReturnValue(
            new Promise<RenderBackend | undefined>((resolve) => (resolveBackend = resolve)),
        );
        const game = new BrioGame({ width: 100, height: 100, container, dimension: "3d" });
        await vi.waitFor(() => expect(BrioRenderer.initBackend).toHaveBeenCalled());
        game.end();
        resolveBackend(backend);
        await game.ready();
        expect(backend.dispose).toHaveBeenCalledTimes(1);
        expect(game.renderBackend).toBeUndefined();
    });

    it("skips 3D backend initialization when end() runs before it starts", async () => {
        const init = vi.spyOn(BrioRenderer, "initBackend");
        const game = new BrioGame({ width: 100, height: 100, container, dimension: "3d" });
        game.end();
        await game.ready();
        expect(init).not.toHaveBeenCalled();
        expect(game.renderBackend).toBeUndefined();
    });
});
