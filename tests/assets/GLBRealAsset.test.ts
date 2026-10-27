import { describe, it, expect, vi, beforeEach } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { GLBLoader } from "../../src/assets/loaders/GLBLoader";
import { BrioModel } from "../../src/assets/BrioModel";
import { BrioGame } from "../../src/game/BrioGame";
import { BrioCamera3D } from "../../src/cameras/BrioCamera3D";
import { createRecordingContext } from "../helpers/recordingContext";

// `/assets/` is gitignored, so this suite only runs where the local asset exists
const GLB_PATH = resolve(
    __dirname,
    "../../assets/3d/glb/harry_potter_-_malfoy_draconia_3d_model__dl.glb",
);
const hasAsset = existsSync(GLB_PATH);

function readAsset(): ArrayBuffer {
    const bytes = readFileSync(GLB_PATH);
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

describe.skipIf(!hasAsset)("GLBLoader with a real Sketchfab asset (Malfoy Draconia)", () => {
    beforeEach(() => {
        const { ctx } = createRecordingContext();
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as any);
    });

    it("decodes the 3 skinned primitives with Uint32 indices and in-range vertex references", () => {
        const { meshes, materials } = GLBLoader.parse(readAsset(), "mod_malfoy");

        expect(meshes.map((m) => m.name)).toEqual([
            "Clothes_Clothes_0",
            "Face_Face_0",
            "Hair_Hair_0",
        ]);
        expect(materials.map((m) => m.name)).toEqual(["Clothes", "Face", "Hair"]);

        let triangles = 0;
        for (const mesh of meshes) {
            const vertexCount = mesh.positions.length / 3;
            expect(mesh.indices).toBeInstanceOf(Uint32Array);
            expect(mesh.normals.length).toBe(mesh.positions.length);
            expect(mesh.uvs.length).toBe(vertexCount * 2);

            let maxIndex = 0;
            for (let i = 0; i < mesh.indices.length; i++) {
                if (mesh.indices[i] > maxIndex) maxIndex = mesh.indices[i];
            }
            expect(maxIndex).toBeLessThan(vertexCount);
            expect(mesh.positions.every(Number.isFinite)).toBe(true);
            triangles += mesh.triangleCount;
        }
        expect(triangles).toBe(105122);
    });

    it("builds a Y-up bounding box about 1.6 units tall, matching the accessor min/max", () => {
        const model = BrioModel.fromData("mod_malfoy", GLBLoader.parse(readAsset()).meshes);
        const box = model.boundingBox;

        expect(box.min.y).toBeCloseTo(0.0045, 3);
        expect(box.max.y).toBeCloseTo(1.6037, 3);
        expect(box.size.x).toBeCloseTo(1.3393, 3);
        expect(box.size.y).toBeGreaterThan(box.size.x);
    });

    it("preloads through BrioGame, instantiates one child per part and renders them in a 3D pass", async () => {
        const fetchSpy = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValue(new Response(readAsset(), { status: 200 }));
        const container = document.createElement("div");
        const game = new BrioGame({ width: 320, height: 240, container, dimension: "3d" });

        let rootName = "";
        game.preload(() => [new BrioModel("mod_malfoy", "malfoy.glb")]).load((assets) => {
            const root = assets.instantiateModel("mod_malfoy", "obj_malfoy");
            rootName = root.name;
            const cam = new BrioCamera3D("cam_main", {
                position: { x: 0, y: 1, z: 3 },
                target: { x: 0, y: 0.8, z: 0 },
            });
            return [cam, root];
        });
        await game.ready();
        fetchSpy.mockRestore();

        expect(game.loadedMeshes.size).toBe(3);
        expect(game.loadedMaterials.size).toBe(3);

        const root = game.gameObjects3D.get(rootName)!;
        expect(root.children.map((c) => c.mesh)).toEqual([
            "Clothes_Clothes_0",
            "Face_Face_0",
            "Hair_Hair_0",
        ]);
        expect(root.children.map((c) => c.material)).toEqual(["Clothes", "Face", "Hair"]);

        game.renderFrame();
        expect(game.renderStats.passes3D).toBe(1);
    });
});
