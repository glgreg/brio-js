import { describe, it, expect, vi, afterEach } from "vitest";
import { GLBLoader } from "../../src/assets/loaders/GLBLoader";
import { BrioModel } from "../../src/assets/BrioModel";
import { buildGLB, packBuffers } from "../helpers/glb";

/** A PNG signature is enough: decoding is stubbed through `createImageBitmap`. */
const FAKE_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Two single-triangle meshes, each instanced by its own node:
 * - mesh 0 (`mesh_a`) uses material 1 and sits under a parent node translated by (0, 2, 0) and scaled by 2;
 * - mesh 1 (`mesh_b`) uses material 0 and is skinned, so its node transform must be ignored.
 * Materials 0 and 1 share embedded image 0; material 2 is MASK and unused by meshes.
 */
function createDocument() {
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);
    const indices = new Uint16Array([0, 1, 2]);
    const { bin, views } = packBuffers([positions, normals, indices, FAKE_PNG]);

    const accessor = (bufferView: number, type: string, componentType: number, count: number) => ({
        bufferView,
        type,
        componentType,
        count,
    });
    const json = {
        asset: { version: "2.0" },
        buffers: [{ byteLength: bin.byteLength }],
        bufferViews: views,
        accessors: [
            accessor(0, "VEC3", 5126, 3),
            accessor(1, "VEC3", 5126, 3),
            accessor(2, "SCALAR", 5123, 3),
        ],
        images: [{ bufferView: 3, mimeType: "image/png" }],
        samplers: [{}],
        textures: [{ sampler: 0, source: 0 }],
        materials: [
            {
                name: "mat_skin",
                doubleSided: true,
                pbrMetallicRoughness: { baseColorTexture: { index: 0 } },
            },
            {
                name: "mat_cloth",
                alphaMode: "BLEND",
                pbrMetallicRoughness: {
                    baseColorFactor: [1, 1, 1, 0.5],
                    baseColorTexture: { index: 0 },
                },
            },
            { name: "mat_lace", alphaMode: "MASK", alphaCutoff: 0.3 },
        ],
        meshes: [
            {
                name: "mesh_a",
                primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 1 }],
            },
            {
                name: "mesh_b",
                primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }],
            },
        ],
        skins: [{ joints: [3] }],
        nodes: [
            { name: "root", translation: [0, 2, 0], scale: [2, 2, 2], children: [1] },
            { name: "node_a", mesh: 0 },
            { name: "node_b", mesh: 1, skin: 0, translation: [5, 5, 5] },
            { name: "joint" },
        ],
        scenes: [{ nodes: [0, 2, 3] }],
        scene: 0,
    };
    return { json, bin };
}

describe("GLBLoader materials, textures and node transforms", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("maps primitive.material per mesh and reads doubleSided / alpha modes", () => {
        const { json, bin } = createDocument();
        const data = GLBLoader.extractModelData(json, bin.buffer as ArrayBuffer, "mod_doc");

        expect(data.meshMaterials).toEqual(["mat_cloth", "mat_skin"]);
        const [skin, cloth, lace] = data.materials;
        expect(skin.doubleSided).toBe(true);
        expect(skin.alphaCutoff).toBe(0);
        expect(cloth.doubleSided).toBe(false);
        expect(cloth.opacity).toBe(0.5);
        expect(lace.alphaCutoff).toBeCloseTo(0.3);
    });

    it("bakes the node world transform into non-skinned meshes only", () => {
        const { json, bin } = createDocument();
        const [meshA, meshB] = GLBLoader.extractModelData(
            json,
            bin.buffer as ArrayBuffer,
            "m",
        ).meshes;

        // mesh_a: scale 2 then translate (0, 2, 0)
        expect(Array.from(meshA.positions)).toEqual([0, 2, 0, 2, 2, 0, 0, 4, 0]);
        expect(Array.from(meshA.normals)).toEqual([0, 0, 1, 0, 0, 1, 0, 0, 1]);
        // mesh_b is skinned: raw bind-pose positions
        expect(Array.from(meshB.positions)).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    });

    it("lists embedded images once per material, keyed by image so shared images decode once", () => {
        const { json, bin } = createDocument();
        const data = GLBLoader.extractModelData(json, bin.buffer as ArrayBuffer, "m");

        expect(data.pendingTextures!.map((p) => [p.material.name, p.key, p.mimeType])).toEqual([
            ["mat_skin", "image0", "image/png"],
            ["mat_cloth", "image0", "image/png"],
        ]);
        expect(Array.from(data.pendingTextures![0].bytes!)).toEqual(Array.from(FAKE_PNG));
    });

    it("decodes each image once and shares the BrioTexture between materials", async () => {
        const createImageBitmap = vi.fn(async () => ({ width: 2, height: 2, close() {} }));
        vi.stubGlobal("createImageBitmap", createImageBitmap);
        const { json, bin } = createDocument();
        const data = GLBLoader.extractModelData(json, bin.buffer as ArrayBuffer, "m");

        const failures = await GLBLoader.decodeTextures(data);

        expect(failures).toEqual([]);
        expect(createImageBitmap).toHaveBeenCalledTimes(1);
        const [skin, cloth, lace] = data.materials;
        expect(skin.texture).toBeDefined();
        expect(skin.texture).toBe(cloth.texture);
        expect(skin.texture!.isDecoded).toBe(true);
        expect(skin.texture!.width).toBe(2);
        expect(lace.texture).toBeUndefined();
        expect(data.pendingTextures).toEqual([]);
    });

    it("reports decode failures without rejecting and leaves materials untextured", async () => {
        vi.stubGlobal(
            "createImageBitmap",
            vi.fn(async () => Promise.reject(new Error("bad png"))),
        );
        const { json, bin } = createDocument();
        const data = GLBLoader.extractModelData(json, bin.buffer as ArrayBuffer, "m");

        const failures = await GLBLoader.decodeTextures(data);

        expect(failures).toHaveLength(1);
        expect(failures[0]).toContain("bad png");
        expect(data.materials[0].texture).toBeUndefined();
    });

    it("instantiates model parts with the material bound by the primitive, not by index", async () => {
        vi.stubGlobal(
            "createImageBitmap",
            vi.fn(async () => ({ width: 1, height: 1, close() {} })),
        );
        const { json, bin } = createDocument();
        vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(buildGLB(json, bin)));

        const model = await new BrioModel("mod_doc", "doc.glb").load();
        const root = model.instantiate("obj_doc");

        expect(root.children.map((c) => [c.mesh, c.material])).toEqual([
            ["mesh_a", "mat_cloth"],
            ["mesh_b", "mat_skin"],
        ]);
        expect(model.materials.get("mat_skin")!.texture).toBeDefined();
        expect(model.warnings).toEqual([]);
    });
});
