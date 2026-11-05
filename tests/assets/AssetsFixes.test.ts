import { describe, it, expect, vi, afterEach } from "vitest";
import {
    GLBLoader,
    extractGLTFAccessor,
    resolveGLTFBuffers,
} from "../../src/assets/loaders/GLBLoader";
import { GLTFLoader } from "../../src/assets/loaders/GLTFLoader";
import { OBJLoader } from "../../src/assets/loaders/OBJLoader";
import { configureModelLoaderLimits, ModelLimitError } from "../../src/assets/loaders/limits";
import { BrioMesh } from "../../src/assets/BrioMesh";
import { BrioSprite } from "../../src/assets/BrioSprite";
import { BrioSpriteSheet } from "../../src/assets/BrioSpriteSheet";
import { BrioAtlas } from "../../src/assets/BrioAtlas";
import { TextureRegistry } from "../../src/assets/BrioTexture";
import { BrioSpriteRenderer } from "../../src/game/BrioSpriteRenderer";
import { BrioObject2D } from "../../src/objects/BrioObject2D";
import { buildGLB } from "../helpers/glb";
import { createRecordingContext } from "../helpers/recordingContext";

const POSITIONS = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
const INDICES = new Uint16Array([0, 1, 2, 0]); // padded to 8 bytes

/** Base64 of the bytes of `view`. */
function toBase64(view: ArrayBufferView): string {
    return Buffer.from(view.buffer, view.byteOffset, view.byteLength).toString("base64");
}

/** A triangle whose positions live in buffer 0 and indices in buffer 1. */
function twoBufferJson(buffer0: object, buffer1: object): any {
    return {
        asset: { version: "2.0" },
        buffers: [buffer0, buffer1],
        bufferViews: [
            { buffer: 0, byteOffset: 0, byteLength: POSITIONS.byteLength },
            { buffer: 1, byteOffset: 0, byteLength: 6 },
        ],
        accessors: [
            { bufferView: 0, type: "VEC3", componentType: 5126, count: 3 },
            { bufferView: 1, type: "SCALAR", componentType: 5123, count: 3 },
        ],
        meshes: [{ name: "tri", primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    };
}

describe("glTF multi-buffer support", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        configureModelLoaderLimits();
    });

    it("reads each bufferView from the buffer named by bufferView.buffer (provided buffers)", () => {
        const json = twoBufferJson(
            { byteLength: POSITIONS.byteLength, uri: "a.bin" },
            { byteLength: INDICES.byteLength, uri: "b.bin" },
        );
        const data = GLTFLoader.parse(
            JSON.stringify(json),
            [POSITIONS.buffer as ArrayBuffer, INDICES.buffer as ArrayBuffer],
            "m",
        );
        expect(data.meshes).toHaveLength(1);
        expect(Array.from(data.meshes[0].positions)).toEqual(Array.from(POSITIONS));
        expect(Array.from(data.meshes[0].indices)).toEqual([0, 1, 2]);
    });

    it("decodes every data: URI buffer, not only the first", () => {
        const json = twoBufferJson(
            {
                byteLength: POSITIONS.byteLength,
                uri: `data:application/octet-stream;base64,${toBase64(POSITIONS)}`,
            },
            {
                byteLength: INDICES.byteLength,
                uri: `data:application/octet-stream;base64,${toBase64(INDICES)}`,
            },
        );
        const data = GLTFLoader.parse(JSON.stringify(json), [], "m");
        expect(Array.from(data.meshes[0].indices)).toEqual([0, 1, 2]);
    });

    it("combines the GLB BIN chunk (buffer 0) with a data: URI buffer", () => {
        const json = twoBufferJson(
            { byteLength: POSITIONS.byteLength },
            {
                byteLength: INDICES.byteLength,
                uri: `data:application/octet-stream;base64,${toBase64(INDICES)}`,
            },
        );
        const data = GLBLoader.parse(buildGLB(json, new Uint8Array(POSITIONS.buffer)), "m");
        expect(data.meshes).toHaveLength(1);
        expect(data.meshes[0].positions[3]).toBe(1);
    });

    it("fetches every external buffer in GLTFLoader.load and GLBLoader.load", async () => {
        const json = twoBufferJson(
            { byteLength: POSITIONS.byteLength, uri: "pos.bin" },
            { byteLength: INDICES.byteLength, uri: "idx.bin" },
        );
        const files: Record<string, ArrayBuffer> = {
            "./models/tri.gltf": new TextEncoder().encode(JSON.stringify(json))
                .buffer as ArrayBuffer,
            "./models/pos.bin": POSITIONS.buffer.slice(0) as ArrayBuffer,
            "./models/idx.bin": INDICES.buffer.slice(0) as ArrayBuffer,
        };
        vi.spyOn(globalThis, "fetch").mockImplementation(
            async (url) => new Response(files[String(url)]),
        );
        const data = await GLTFLoader.load("./models/tri.gltf");
        expect(Array.from(data.meshes[0].indices)).toEqual([0, 1, 2]);

        // GLB: buffer 0 is the BIN chunk, buffer 1 an external file
        const glbJson = twoBufferJson(
            { byteLength: POSITIONS.byteLength },
            { byteLength: INDICES.byteLength, uri: "idx.bin" },
        );
        files["./models/tri.glb"] = buildGLB(glbJson, new Uint8Array(POSITIONS.buffer));
        const glb = await GLBLoader.load("./models/tri.glb");
        expect(Array.from(glb.meshes[0].indices)).toEqual([0, 1, 2]);
    });

    it("reports a bufferView that references a buffer that is not available", () => {
        const json = twoBufferJson({ byteLength: 36 }, { byteLength: 8 });
        expect(() => extractGLTFAccessor(json, POSITIONS.buffer as ArrayBuffer, 1)).toThrow(
            ModelLimitError,
        );
        expect(() => extractGLTFAccessor(json, [POSITIONS.buffer as ArrayBuffer], 1)).toThrow(
            /buffer 1/,
        );
    });

    it("applies maxFileBytes to every data: URI buffer", () => {
        configureModelLoaderLimits({ maxFileBytes: 8 });
        const json = { buffers: [{}, { uri: `data:;base64,${toBase64(POSITIONS)}` }] };
        expect(() => resolveGLTFBuffers(json, [new ArrayBuffer(4)])).toThrow(ModelLimitError);
    });
});

describe("OBJ usemtl and the shared OBJ parser", () => {
    afterEach(() => configureModelLoaderLimits());

    const MTL = ["newmtl Red", "Kd 1 0 0", "newmtl Blue", "Kd 0 0 1"].join("\n");

    it("binds meshes to their usemtl material instead of pairing by index", () => {
        const obj = [
            "v 0 0 0",
            "v 1 0 0",
            "v 0 1 0",
            "v 1 1 0",
            "o Body",
            "usemtl Blue",
            "f 1 2 3",
            "usemtl Red",
            "f 2 4 3",
            "o Head",
            "usemtl Blue",
            "f 1 2 4",
        ].join("\n");
        const data = OBJLoader.parse(obj, MTL, "mod");
        expect(data.meshes.map((m) => m.name)).toEqual(["mod/Body", "mod/Body_Red", "mod/Head"]);
        expect(data.meshMaterials).toEqual(["mod/Blue", "mod/Red", "mod/Blue"]);
        expect(data.warnings).toEqual([]);
    });

    it("warns about usemtl materials missing from the MTL and leaves them unbound", () => {
        const obj = ["v 0 0 0", "v 1 0 0", "v 0 1 0", "usemtl Gold", "f 1 2 3"].join("\n");
        const data = OBJLoader.parse(obj, MTL, "mod");
        expect(data.meshMaterials).toEqual([""]);
        expect(data.warnings?.[0]).toMatch(/Gold/);
    });

    it("keeps files without usemtl unbound so materials still pair by index", () => {
        const obj = ["v 0 0 0", "v 1 0 0", "v 0 1 0", "g a", "f 1 2 3", "g b", "f 1 3 2"].join(
            "\n",
        );
        const data = OBJLoader.parse(obj, MTL, "mod");
        expect(data.meshes.map((m) => m.name)).toEqual(["mod/a", "mod/b"]);
        expect(data.meshMaterials).toEqual(["", ""]);
    });

    it("supports negative (relative) face indices", () => {
        const obj = ["v 0 0 0", "v 2 0 0", "v 0 3 0", "f -3 -2 -1"].join("\n");
        const mesh = BrioMesh.fromOBJ("rel", obj);
        expect(Array.from(mesh.positions)).toEqual([0, 0, 0, 2, 0, 0, 0, 3, 0]);
    });

    it("BrioMesh.fromOBJ enforces ModelLoaderLimits", () => {
        configureModelLoaderLimits({ maxFileBytes: 10 });
        expect(() => BrioMesh.fromOBJ("big", "v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3")).toThrow(
            ModelLimitError,
        );
        configureModelLoaderLimits({ maxAccessorComponents: 6 });
        expect(() => BrioMesh.fromOBJ("big", "v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3")).toThrow(
            ModelLimitError,
        );
    });

    it("BrioMesh.fromOBJ merges groups, computes flat normals and uses Uint32 indices above 65535 vertices", () => {
        const tri = BrioMesh.fromOBJ(
            "tri",
            "v 0 0 0\nv 1 0 0\nv 0 1 0\nv 5 5 5\nv 6 5 5\nv 5 6 5\ng x\nf 1 2 3\ng y\nf 4 5 6",
        );
        expect(tri.indices.length).toBe(6);
        expect(Array.from(tri.normals.slice(0, 3))).toEqual([0, 0, 1]);

        const lines: string[] = [];
        const triangles = 21846; // 65538 vertices
        for (let i = 0; i < triangles * 3; i++) lines.push(`v ${i} 0 0`);
        for (let t = 0; t < triangles; t++) lines.push(`f ${t * 3 + 1} ${t * 3 + 2} ${t * 3 + 3}`);
        const big = BrioMesh.fromOBJ("big", lines.join("\n"));
        expect(big.indices).toBeInstanceOf(Uint32Array);
        expect(big.indices[big.indices.length - 1]).toBe(triangles * 3 - 1);
    });
});

describe("Sprite source rectangles", () => {
    afterEach(() => TextureRegistry.clear());

    it("BrioSprite stores a copied sourceRect, reports its size and clones it", () => {
        const rect = { x: 16, y: 32, width: 8, height: 12 };
        const sprite = new BrioSprite("spr_a", "./sheet.png", rect);
        rect.x = 99;
        expect(sprite.sourceRect).toEqual({ x: 16, y: 32, width: 8, height: 12 });
        // preload measures the whole image; the rectangle size still wins
        sprite.size = { x: 256, y: 256 };
        expect(sprite.size).toEqual({ x: 8, y: 12 });
        expect(BrioSprite.clone(sprite).sourceRect).toEqual(sprite.sourceRect);

        sprite.sourceRect = undefined;
        expect(sprite.size).toEqual({ x: 256, y: 256 });
        sprite.sourceRect = { x: 0, y: 0, width: 0, height: 4 };
        expect(sprite.sourceRect).toBeUndefined();
    });

    it("BrioSpriteSheet.createSprite shows one cell and createCellSprites matches createAnimation frames", () => {
        const sheet = new BrioSpriteSheet("sht", "./sheet.png", 32, 16, 4, 2);
        const cell5 = sheet.createSprite("spr_5", 5);
        expect(cell5.sourceRect).toEqual({ x: 32, y: 16, width: 32, height: 16 });
        expect(sheet.createSprite("spr_0").sourceRect).toEqual({
            x: 0,
            y: 0,
            width: 32,
            height: 16,
        });

        const sprites = sheet.createCellSprites(2, 4);
        const anim = sheet.createAnimation("anim", 2, 4);
        expect(sprites.map((s) => s.name)).toEqual(anim.frames);
        expect(sheet.createCellSprites()).toHaveLength(8);
    });

    it("BrioAtlas holds named regions, creates region sprites and shares its image via TextureRegistry", () => {
        const atlas = new BrioAtlas("atl", 128, 128, "./atlas.png", {
            coin: { x: 0, y: 0, width: 16, height: 16 },
        });
        atlas.defineRegion("gem", 16, 0, 16, 24);
        expect(atlas.regionNames).toEqual(["coin", "gem"]);
        expect(atlas.hasRegion("gem")).toBe(true);
        expect(atlas.getRegion("gem")).toEqual({ x: 16, y: 0, width: 16, height: 24 });

        const gem = atlas.createSprite("gem");
        expect(gem.name).toBe("atl_gem");
        expect(gem.size).toEqual({ x: 16, y: 24 });
        expect(gem.sourceRect).toEqual({ x: 16, y: 0, width: 16, height: 24 });
        expect(() => atlas.createSprite("missing")).toThrow(/missing/);

        const other = new BrioAtlas("atl2", 128, 128, "./atlas.png");
        expect(other.texture).toBe(atlas.texture);
        expect(other.element).toBe(TextureRegistry.acquire("./atlas.png").element);
    });

    it("BrioSpriteRenderer draws only the source rectangle of a sprite", () => {
        const { ctx, calls } = createRecordingContext();
        const sheet = new BrioSpriteSheet("sht", "./sheet.png", 32, 16, 4, 2);
        const cell = sheet.createSprite("spr_cell", 6);
        const whole = new BrioSprite("spr_whole", "./whole.png");
        const sprites = new Map<string, BrioSprite>([
            [cell.name, cell],
            [whole.name, whole],
        ]);
        const game = { scale: 1, rendering: { mode: "smooth", smoothness: "high" } };
        const renderer = new BrioSpriteRenderer(
            game as any,
            { sprites } as any,
            ctx,
            1,
            640,
            480,
            60,
        );

        const obj = new BrioObject2D("obj", "spr_cell");
        obj.transform.size.x = 64;
        obj.transform.size.y = 32;
        renderer.renderObject(obj);
        const draw = calls.find((c) => c.name === "drawImage")!;
        expect(draw.args.slice(1)).toEqual([64, 16, 32, 16, 0, 0, 64, 32]);

        calls.length = 0;
        const plain = new BrioObject2D("obj2", "spr_whole");
        plain.transform.size.x = 10;
        plain.transform.size.y = 10;
        renderer.renderObject(plain);
        expect(calls.find((c) => c.name === "drawImage")!.args.slice(1)).toEqual([0, 0, 10, 10]);
    });
});
