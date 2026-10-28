import { describe, it, expect, vi, afterEach } from "vitest";
import { GLBLoader, extractGLTFAccessor } from "../../src/assets/loaders/GLBLoader";
import { GLTFLoader } from "../../src/assets/loaders/GLTFLoader";
import { OBJLoader } from "../../src/assets/loaders/OBJLoader";
import {
    configureModelLoaderLimits,
    ModelLimitError,
    readImageDimensions,
} from "../../src/assets/loaders/limits";
import { buildGLB, packBuffers } from "../helpers/glb";

/** A one-triangle glTF document whose JSON can be tampered with by each test. */
function triangleDoc() {
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const indices = new Uint16Array([0, 1, 2]);
    const { bin, views } = packBuffers([positions, indices]);
    const json: any = {
        asset: { version: "2.0" },
        buffers: [{ byteLength: bin.byteLength }],
        bufferViews: views,
        accessors: [
            { bufferView: 0, type: "VEC3", componentType: 5126, count: 3 },
            { bufferView: 1, type: "SCALAR", componentType: 5123, count: 3 },
        ],
        meshes: [{ name: "tri", primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    };
    return { json, bin };
}

/** Minimal PNG header declaring `width x height`. */
function pngHeader(width: number, height: number): Uint8Array {
    const bytes = new Uint8Array(33);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
    const view = new DataView(bytes.buffer);
    view.setUint32(16, width);
    view.setUint32(20, height);
    return bytes;
}

describe("Model loader resource limits", () => {
    afterEach(() => {
        configureModelLoaderLimits();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("parses a valid document unchanged", () => {
        const { json, bin } = triangleDoc();
        const data = GLBLoader.parse(buildGLB(json, bin), "m");
        expect(data.meshes).toHaveLength(1);
        expect(data.warnings).toEqual([]);
    });

    it("rejects accessors whose count would allocate beyond the limit", () => {
        const { json, bin } = triangleDoc();
        json.accessors[0].count = 2 ** 30;
        expect(() => extractGLTFAccessor(json, bin.buffer as ArrayBuffer, 0)).toThrow(ModelLimitError);
    });

    it("rejects accessors and bufferViews that read outside the binary buffer", () => {
        const { json, bin } = triangleDoc();
        json.accessors[0].count = 10;
        expect(() => extractGLTFAccessor(json, bin.buffer as ArrayBuffer, 0)).toThrow(/past the end/);

        const doc2 = triangleDoc();
        doc2.json.bufferViews[0].byteLength = 1_000_000;
        expect(() => extractGLTFAccessor(doc2.json, doc2.bin.buffer as ArrayBuffer, 0)).toThrow(/outside/);

        const doc3 = triangleDoc();
        doc3.json.bufferViews[0].byteStride = 4; // smaller than a VEC3 float element
        expect(() => extractGLTFAccessor(doc3.json, doc3.bin.buffer as ArrayBuffer, 0)).toThrow(/byteStride/);
    });

    it("rejects unknown component types and invalid counts", () => {
        const { json, bin } = triangleDoc();
        json.accessors[0].componentType = 9999;
        expect(() => extractGLTFAccessor(json, bin.buffer as ArrayBuffer, 0)).toThrow(/unsupported/);
        json.accessors[0].componentType = 5126;
        json.accessors[0].count = -1;
        expect(() => extractGLTFAccessor(json, bin.buffer as ArrayBuffer, 0)).toThrow(/invalid count/);
    });

    it("returns zeros for accessors without bufferView (sparse-only) within the limit", () => {
        const { json, bin } = triangleDoc();
        delete json.accessors[0].bufferView;
        const data = extractGLTFAccessor(json, bin.buffer as ArrayBuffer, 0);
        expect(Array.from(data)).toEqual(new Array(9).fill(0));
    });

    it("skips primitives with out-of-range indices and reports a warning", () => {
        const { json, bin } = triangleDoc();
        const indices = new Uint16Array(bin.buffer, json.bufferViews[1].byteOffset, 3);
        indices[2] = 500;
        const data = GLBLoader.extractModelData(json, bin.buffer as ArrayBuffer, "m");
        expect(data.meshes).toHaveLength(0);
        expect(data.warnings![0]).toMatch(/skipped/);
    });

    it("rejects GLB chunks that declare more bytes than the container holds", () => {
        const { json, bin } = triangleDoc();
        const glb = buildGLB(json, bin);
        new DataView(glb).setUint32(12, 0x7fffffff, true);
        expect(() => GLBLoader.parse(glb, "m")).toThrow(/past the end/);
        expect(() => GLBLoader.parse(new ArrayBuffer(4), "m")).toThrow(/header/);
    });

    it("enforces the file size limit on GLB, glTF JSON and OBJ text", () => {
        const { json, bin } = triangleDoc();
        configureModelLoaderLimits({ maxFileBytes: 64, maxJsonBytes: 16 });
        expect(() => GLBLoader.parse(buildGLB(json, bin), "m")).toThrow(ModelLimitError);
        expect(() => GLTFLoader.parse(JSON.stringify(json), [], "m")).toThrow(/glTF JSON/);
        expect(() => OBJLoader.parse("v 0 0 0\n".repeat(20), undefined, "m")).toThrow(/OBJ text/);
    });

    it("rejects fetched files whose Content-Length exceeds the limit before reading them", async () => {
        configureModelLoaderLimits({ maxFileBytes: 1000 });
        const arrayBuffer = vi.fn();
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({ ok: true, status: 200, headers: new Headers({ "content-length": "5000" }), arrayBuffer })),
        );
        await expect(GLBLoader.load("./huge.glb", "m")).rejects.toThrow(/above the 1000-byte limit/);
        expect(arrayBuffer).not.toHaveBeenCalled();
    });

    it("guards against cyclic or very deep node graphs", () => {
        const { json, bin } = triangleDoc();
        json.nodes = [
            { children: [1], mesh: 0 },
            { children: [0] },
        ];
        json.scenes = [{ nodes: [0] }];
        expect(GLBLoader.extractModelData(json, bin.buffer as ArrayBuffer, "m").meshes).toHaveLength(1);

        configureModelLoaderLimits({ maxNodeDepth: 3 });
        json.nodes = Array.from({ length: 10 }, (_, i) => (i < 9 ? { children: [i + 1] } : { mesh: 0 }));
        expect(() => GLBLoader.extractModelData(json, bin.buffer as ArrayBuffer, "m")).toThrow(/deeper/);
    });

    it("reads image sizes from PNG, GIF, JPEG and WebP headers", () => {
        expect(readImageDimensions(pngHeader(640, 480))).toEqual({ width: 640, height: 480 });
        const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x20, 0x00, 0x10, 0x00]);
        expect(readImageDimensions(gif)).toEqual({ width: 32, height: 16 });
        const jpeg = new Uint8Array([
            0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x00, 0x02, 0x00, 0x03,
        ]);
        expect(readImageDimensions(jpeg)).toEqual({ width: 512, height: 256 });
        const webp = new Uint8Array(30);
        const view = new DataView(webp.buffer);
        view.setUint32(0, 0x52494646);
        view.setUint32(8, 0x57454250);
        view.setUint32(12, 0x56503858); // VP8X
        webp.set([99, 0, 0, 49, 0, 0], 24);
        expect(readImageDimensions(webp)).toEqual({ width: 100, height: 50 });
        expect(readImageDimensions(new Uint8Array([1, 2, 3]))).toBeUndefined();
    });

    it("refuses to decode images that declare a size above maxImageDimension", async () => {
        const createImageBitmap = vi.fn(async () => ({ width: 1, height: 1, close() {} }));
        vi.stubGlobal("createImageBitmap", createImageBitmap);
        const { json, bin } = triangleDoc();
        const data = GLBLoader.extractModelData(json, bin.buffer as ArrayBuffer, "m");
        data.pendingTextures = [
            { material: data.materials[0] ?? ({ name: "mat" } as any), key: "image0", bytes: pngHeader(40000, 40000), mimeType: "image/png" },
        ];
        const failures = await GLBLoader.decodeTextures(data);
        expect(failures[0]).toMatch(/40000x40000/);
        expect(createImageBitmap).not.toHaveBeenCalled();
    });
});
