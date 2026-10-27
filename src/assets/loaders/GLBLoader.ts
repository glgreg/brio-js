import { BrioMesh } from "../BrioMesh";
import { BrioMaterial } from "../BrioMaterial";
import { BrioTexture } from "../BrioTexture";
import { ParsedModelData, PendingTexture } from "./OBJLoader";
import { CSSColor } from "../../tools/base_types";
import { Mat4, Matrix4 } from "../../math/index";
import { linearToSrgb } from "../../rendering/color";

/**
 * Reads and unpacks a typed array from glTF binary accessors and bufferViews.
 * Handles both tightly-packed and interleaved buffers with arbitrary byte alignment.
 *
 * @param json Decoded glTF JSON root
 * @param binBuffer Contiguous binary buffer (Chunk 1)
 * @param accessorIndex Index of the glTF accessor
 * @returns Decoded `Float32Array`, `Uint16Array`, or `Uint32Array`
 */
export function extractGLTFAccessor(
    json: any,
    binBuffer: ArrayBuffer,
    accessorIndex: number,
): Float32Array | Uint16Array | Uint32Array {
    const accessor = json.accessors?.[accessorIndex];
    if (!accessor) {
        return new Float32Array(0);
    }

    const bufferView = json.bufferViews?.[accessor.bufferView ?? 0];
    const byteOffset = (bufferView?.byteOffset || 0) + (accessor.byteOffset || 0);
    const count = accessor.count || 0;

    let numComponents = 1;
    if (accessor.type === "VEC2") numComponents = 2;
    else if (accessor.type === "VEC3") numComponents = 3;
    else if (accessor.type === "VEC4") numComponents = 4;
    else if (accessor.type === "MAT4") numComponents = 16;

    const totalElements = count * numComponents;
    const componentType = accessor.componentType;

    const componentSize =
        componentType === 5126 || componentType === 5125 ? 4 :
        componentType === 5123 || componentType === 5122 ? 2 : 1;

    const elementSize = numComponents * componentSize;
    const stride = bufferView?.byteStride || elementSize;

    // Fast path: tightly packed and aligned
    if (stride === elementSize && byteOffset % componentSize === 0) {
        const byteLength = totalElements * componentSize;
        if (componentType === 5126) {
            return new Float32Array(binBuffer.slice(byteOffset, byteOffset + byteLength));
        }
        if (componentType === 5123) {
            return new Uint16Array(binBuffer.slice(byteOffset, byteOffset + byteLength));
        }
        if (componentType === 5125) {
            return new Uint32Array(binBuffer.slice(byteOffset, byteOffset + byteLength));
        }
        if (componentType === 5121) {
            const rawBytes = new Uint8Array(binBuffer.slice(byteOffset, byteOffset + byteLength));
            const out = new Uint16Array(totalElements);
            for (let i = 0; i < totalElements; i++) out[i] = rawBytes[i];
            return out;
        }
    }

    // Safe path: unaligned or interleaved buffers via DataView
    const view = new DataView(binBuffer);

    if (componentType === 5126) {
        const out = new Float32Array(totalElements);
        let outIdx = 0;
        for (let i = 0; i < count; i++) {
            const offset = byteOffset + i * stride;
            for (let c = 0; c < numComponents; c++) {
                out[outIdx++] = view.getFloat32(offset + c * 4, true);
            }
        }
        return out;
    }

    if (componentType === 5123) {
        const out = new Uint16Array(totalElements);
        let outIdx = 0;
        for (let i = 0; i < count; i++) {
            const offset = byteOffset + i * stride;
            for (let c = 0; c < numComponents; c++) {
                out[outIdx++] = view.getUint16(offset + c * 2, true);
            }
        }
        return out;
    }

    if (componentType === 5125) {
        const out = new Uint32Array(totalElements);
        let outIdx = 0;
        for (let i = 0; i < count; i++) {
            const offset = byteOffset + i * stride;
            for (let c = 0; c < numComponents; c++) {
                out[outIdx++] = view.getUint32(offset + c * 4, true);
            }
        }
        return out;
    }

    // 5121: UNSIGNED_BYTE -> promoted to Uint16Array
    const out = new Uint16Array(totalElements);
    let outIdx = 0;
    for (let i = 0; i < count; i++) {
        const offset = byteOffset + i * stride;
        for (let c = 0; c < numComponents; c++) {
            out[outIdx++] = view.getUint8(offset + c);
        }
    }
    return out;
}

/**
 * Computes flat normals per triangle for geometries without precomputed normals.
 */
function computeFlatNormals(positions: Float32Array, indices: Uint16Array | Uint32Array): Float32Array {
    const normals = new Float32Array(positions.length);

    for (let i = 0; i < indices.length; i += 3) {
        const i0 = indices[i] * 3;
        const i1 = indices[i + 1] * 3;
        const i2 = indices[i + 2] * 3;

        const ax = positions[i1] - positions[i0];
        const ay = positions[i1 + 1] - positions[i0 + 1];
        const az = positions[i1 + 2] - positions[i0 + 2];

        const bx = positions[i2] - positions[i0];
        const by = positions[i2 + 1] - positions[i0 + 1];
        const bz = positions[i2 + 2] - positions[i0 + 2];

        let nx = ay * bz - az * by;
        let ny = az * bx - ax * bz;
        let nz = ax * by - ay * bx;

        const len = Math.hypot(nx, ny, nz);
        if (len > 0.000001) {
            nx /= len;
            ny /= len;
            nz /= len;
        }

        normals[i0] = nx;
        normals[i0 + 1] = ny;
        normals[i0 + 2] = nz;

        normals[i1] = nx;
        normals[i1 + 1] = ny;
        normals[i1 + 2] = nz;

        normals[i2] = nx;
        normals[i2 + 1] = ny;
        normals[i2 + 2] = nz;
    }

    return normals;
}

/**
 * Converts a linear glTF `baseColorFactor` channel to an sRGB `0..255` byte for CSS colors.
 */
function linearFactorToByte(value: number | undefined): number {
    const linear = Math.min(1, Math.max(0, value ?? 1));
    return Math.round(linearToSrgb(linear) * 255);
}

/**
 * Local matrix of a glTF node: its `matrix`, or the composition of `translation`, `rotation`, `scale`.
 */
function nodeLocalMatrix(node: any): Mat4 {
    const out = Matrix4.create();
    if (Array.isArray(node.matrix) && node.matrix.length === 16) {
        out.set(node.matrix);
        return out;
    }
    const t = node.translation ?? [0, 0, 0];
    const r = node.rotation ?? [0, 0, 0, 1];
    const sc = node.scale ?? [1, 1, 1];
    return Matrix4.fromRotationTranslationScale(
        out,
        { x: r[0], y: r[1], z: r[2], w: r[3] },
        { x: t[0], y: t[1], z: t[2] },
        { x: sc[0], y: sc[1], z: sc[2] },
    );
}

/**
 * World matrix of the first scene node instancing each glTF mesh, keyed by mesh index.
 * Skinned nodes are skipped: per the glTF spec their node transform is ignored, so their raw
 * positions already are the bind pose.
 */
function collectMeshWorldMatrices(json: any): Map<number, Mat4> {
    const result = new Map<number, Mat4>();
    const nodes: any[] = json.nodes ?? [];
    const scene = json.scenes?.[json.scene ?? 0];
    const roots: number[] = scene?.nodes ?? nodes.map((_n, i) => i);

    const visit = (index: number, parent: Mat4, depth: number): void => {
        const node = nodes[index];
        if (!node || depth > nodes.length) return;
        const world = Matrix4.multiply(Matrix4.create(), parent, nodeLocalMatrix(node));
        if (node.mesh !== undefined && node.skin === undefined && !result.has(node.mesh)) {
            result.set(node.mesh, world);
        }
        for (const child of node.children ?? []) visit(child, world, depth + 1);
    };
    const identity = Matrix4.create();
    for (const root of roots) visit(root, identity, 0);
    return result;
}

/** Whether `m` is the identity matrix (within float tolerance). */
function isIdentity(m: Mat4): boolean {
    for (let i = 0; i < 16; i++) {
        if (Math.abs(m[i] - (i % 5 === 0 ? 1 : 0)) > 1e-7) return false;
    }
    return true;
}

/**
 * Bakes `world` into `positions` and `normals` in place (normals use the inverse-transpose 3x3 and are renormalized).
 */
function bakeTransform(positions: Float32Array, normals: Float32Array, world: Mat4): void {
    const m = world;
    for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const y = positions[i + 1];
        const z = positions[i + 2];
        positions[i] = m[0] * x + m[4] * y + m[8] * z + m[12];
        positions[i + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
        positions[i + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
    }
    const normalMatrix = Matrix4.transpose(Matrix4.create(), Matrix4.invert(Matrix4.create(), world));
    const n = normalMatrix;
    for (let i = 0; i < normals.length; i += 3) {
        const x = normals[i];
        const y = normals[i + 1];
        const z = normals[i + 2];
        const nx = n[0] * x + n[4] * y + n[8] * z;
        const ny = n[1] * x + n[5] * y + n[9] * z;
        const nz = n[2] * x + n[6] * y + n[10] * z;
        const len = Math.hypot(nx, ny, nz) || 1;
        normals[i] = nx / len;
        normals[i + 1] = ny / len;
        normals[i + 2] = nz / len;
    }
}

/**
 * Decodes a `data:` URI with base64 payload into bytes (`undefined` for other URIs).
 */
function decodeDataUri(uri: string): Uint8Array | undefined {
    const marker = uri.indexOf(";base64,");
    if (!uri.startsWith("data:") || marker === -1 || typeof atob !== "function") return undefined;
    const binary = atob(uri.substring(marker + 8));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

/**
 * Zero-dependency Binary glTF 2.0 (`.glb`) container parser and loader.
 * Decodes the 12-byte header, JSON chunk (0) and BIN chunk (1), producing typed `BrioMesh` and `BrioMaterial` instances.
 *
 * @example
 * ```ts
 * const { meshes, materials } = GLBLoader.parse(glbArrayBuffer, "mod_player");
 * const loaded = await GLBLoader.load("./assets/models/player.glb");
 * ```
 */
export class GLBLoader {
    /**
     * Parses a raw GLB binary `ArrayBuffer` into `BrioMesh` geometries and `BrioMaterial` surfaces.
     *
     * @param buffer Raw binary GLB `ArrayBuffer`
     * @param modelName Optional model identifier prefix
     * @returns Decoded `ParsedModelData`
     * @throws {Error} When the binary header magic or version is invalid
     */
    public static parse(buffer: ArrayBuffer, modelName: string = "model"): ParsedModelData {
        const view = new DataView(buffer);

        // Header verification (12 bytes)
        const magic = view.getUint32(0, true);
        const version = view.getUint32(4, true);
        const totalLength = view.getUint32(8, true);

        // Magic 0x46546C67 is ASCII "glTF"
        if (magic !== 0x46546c67) {
            throw new Error(`Invalid GLB binary magic: 0x${magic.toString(16)}. Expected 0x46546C67 ('glTF').`);
        }

        if (version !== 2) {
            throw new Error(`Unsupported glTF version: ${version}. BrioJS requires glTF 2.0.`);
        }

        if (totalLength > buffer.byteLength) {
            throw new Error(
                `Truncated GLB container: declared length is ${totalLength} bytes, but buffer has ${buffer.byteLength} bytes.`,
            );
        }

        let byteOffset = 12;
        let json: any = null;
        let binBuffer: ArrayBuffer = new ArrayBuffer(0);

        // Read chunks
        while (byteOffset < totalLength && byteOffset < buffer.byteLength) {
            const chunkLength = view.getUint32(byteOffset, true);
            const chunkType = view.getUint32(byteOffset + 4, true);
            const chunkDataStart = byteOffset + 8;

            if (chunkType === 0x4e4f534a) {
                // Chunk 0: JSON
                const jsonBytes = new Uint8Array(buffer, chunkDataStart, chunkLength);
                const decoder = new TextDecoder("utf-8");
                json = JSON.parse(decoder.decode(jsonBytes));
            } else if (chunkType === 0x004e4942) {
                // Chunk 1: BIN\0
                binBuffer = buffer.slice(chunkDataStart, chunkDataStart + chunkLength);
            }

            byteOffset += 8 + chunkLength;
        }

        if (!json) {
            throw new Error("GLB container does not contain a JSON metadata chunk.");
        }

        return GLBLoader.extractModelData(json, binBuffer, modelName);
    }

    /**
     * Extracts `BrioMesh` and `BrioMaterial` instances from a glTF JSON object and associated binary buffer.
     *
     * @param json Decoded glTF JSON root
     * @param binBuffer Contiguous binary buffer
     * @param modelName Model identifier prefix
     * @returns Decoded `ParsedModelData`
     */
    public static extractModelData(json: any, binBuffer: ArrayBuffer, modelName: string): ParsedModelData {
        const materials: BrioMaterial[] = [];
        const meshes: BrioMesh[] = [];
        const meshMaterials: string[] = [];
        const pendingTextures: PendingTexture[] = [];

        // Parse Materials
        if (Array.isArray(json.materials)) {
            for (let i = 0; i < json.materials.length; i++) {
                const matDef = json.materials[i];
                const pbr = matDef.pbrMetallicRoughness;
                let color: CSSColor = "#ffffff";
                let opacity = 1;

                // baseColorFactor is linear light; CSS colors are sRGB
                if (pbr?.baseColorFactor && Array.isArray(pbr.baseColorFactor)) {
                    const factor = pbr.baseColorFactor;
                    const r = linearFactorToByte(factor[0]);
                    const g = linearFactorToByte(factor[1]);
                    const b = linearFactorToByte(factor[2]);
                    opacity = factor[3] ?? 1;
                    color = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
                }

                // MASK maps to an alpha test; BLEND keeps the factor opacity, and when that is opaque the
                // texture alpha is approximated with a 0.5 alpha test (no per-texel blending yet)
                let alphaCutoff = 0;
                if (matDef.alphaMode === "MASK") {
                    alphaCutoff = matDef.alphaCutoff ?? 0.5;
                } else if (matDef.alphaMode === "BLEND" && opacity >= 1) {
                    alphaCutoff = 0.5;
                }

                const material = new BrioMaterial(matDef.name || `${modelName}_mat_${i}`, {
                    color,
                    opacity,
                    shading: "lambert",
                    doubleSided: matDef.doubleSided === true,
                    alphaCutoff,
                });
                materials.push(material);

                const pending = GLBLoader.#resolveTextureSource(json, binBuffer, pbr?.baseColorTexture?.index);
                if (pending) pendingTextures.push({ ...pending, material });
            }
        }

        const worldMatrices = collectMeshWorldMatrices(json);

        // Parse Meshes
        if (Array.isArray(json.meshes)) {
            for (let mIdx = 0; mIdx < json.meshes.length; mIdx++) {
                const meshDef = json.meshes[mIdx];
                const primitives = meshDef.primitives || [];
                const world = worldMatrices.get(mIdx);
                const bake = world !== undefined && !isIdentity(world);

                for (let pIdx = 0; pIdx < primitives.length; pIdx++) {
                    const prim = primitives[pIdx];
                    const attrs = prim.attributes || {};

                    if (attrs.POSITION === undefined) {
                        continue;
                    }

                    const positions = extractGLTFAccessor(json, binBuffer, attrs.POSITION) as Float32Array;
                    const numVertices = positions.length / 3;

                    // Extract or generate indices
                    let indices: Uint16Array | Uint32Array;
                    if (prim.indices !== undefined) {
                        indices = extractGLTFAccessor(json, binBuffer, prim.indices) as Uint16Array | Uint32Array;
                    } else {
                        // Generate sequential indices
                        indices =
                            numVertices > 65535
                                ? new Uint32Array(numVertices)
                                : new Uint16Array(numVertices);
                        for (let k = 0; k < numVertices; k++) indices[k] = k;
                    }

                    // Extract or generate normals
                    let normals: Float32Array;
                    if (attrs.NORMAL !== undefined) {
                        normals = extractGLTFAccessor(json, binBuffer, attrs.NORMAL) as Float32Array;
                    } else {
                        normals = computeFlatNormals(positions, indices);
                    }

                    // Extract or generate UVs
                    let uvs: Float32Array;
                    if (attrs.TEXCOORD_0 !== undefined) {
                        uvs = extractGLTFAccessor(json, binBuffer, attrs.TEXCOORD_0) as Float32Array;
                    } else {
                        uvs = new Float32Array(numVertices * 2);
                    }

                    // Accessors are decoded into fresh copies, so baking never touches the source buffer
                    if (bake) bakeTransform(positions, normals, world);

                    const meshName =
                        meshDef.name && primitives.length === 1
                            ? meshDef.name
                            : `${modelName}_mesh_${mIdx}_${pIdx}`;

                    meshes.push(new BrioMesh(meshName, positions, normals, uvs, indices));
                    meshMaterials.push(
                        prim.material !== undefined ? (materials[prim.material]?.name ?? "") : "",
                    );
                }
            }
        }

        return { meshes, materials, meshMaterials, pendingTextures };
    }

    /**
     * Locates the encoded image behind glTF texture `textureIndex` (embedded `bufferView`, `data:` URI,
     * or external URI).
     */
    static #resolveTextureSource(
        json: any,
        binBuffer: ArrayBuffer,
        textureIndex: number | undefined,
    ): Omit<PendingTexture, "material"> | undefined {
        if (textureIndex === undefined) return undefined;
        const sourceIndex = json.textures?.[textureIndex]?.source;
        const image = json.images?.[sourceIndex];
        if (!image) return undefined;
        const key = `image${sourceIndex}`;

        if (image.bufferView !== undefined) {
            const view = json.bufferViews?.[image.bufferView];
            if (!view) return undefined;
            const start = view.byteOffset ?? 0;
            const bytes = new Uint8Array(binBuffer, start, view.byteLength);
            return { key, bytes, mimeType: image.mimeType ?? "image/png" };
        }
        if (typeof image.uri === "string") {
            const bytes = decodeDataUri(image.uri);
            if (bytes) {
                const mimeType = image.uri.substring(5, image.uri.indexOf(";")) || "image/png";
                return { key, bytes, mimeType };
            }
            return { key, uri: image.uri, mimeType: image.mimeType ?? "" };
        }
        return undefined;
    }

    /**
     * Decodes every `pendingTextures` image once (off the main thread via `createImageBitmap`) and assigns
     * it to `material.texture`. Runtimes without `createImageBitmap` (Node.js) keep materials untextured.
     *
     * @param data Parsed model data (its `pendingTextures` list is emptied as images are resolved)
     * @param baseUrl Base URL for external image URIs (directory of the model file)
     * @returns Messages describing images that failed to load or decode
     * @example
     * ```ts
     * const data = GLBLoader.parse(buffer, "mod_ship");
     * const failures = await GLBLoader.decodeTextures(data, "./assets/models/");
     * ```
     */
    public static async decodeTextures(data: ParsedModelData, baseUrl: string = ""): Promise<string[]> {
        const pending = data.pendingTextures ?? [];
        if (pending.length === 0 || typeof createImageBitmap !== "function" || typeof Blob === "undefined") {
            return [];
        }

        const failures: string[] = [];
        const decoded = new Map<string, Promise<BrioTexture | undefined>>();
        const decode = async (item: PendingTexture): Promise<BrioTexture | undefined> => {
            try {
                let blob: Blob;
                if (item.bytes) {
                    blob = new Blob([item.bytes as BlobPart], { type: item.mimeType });
                } else {
                    const response = await fetch(`${baseUrl}${item.uri}`);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    blob = await response.blob();
                }
                return await BrioTexture.fromBlob(`${item.material.name}#${item.key}`, blob);
            } catch (err) {
                failures.push(`Texture '${item.key}' of material '${item.material.name}' could not be decoded: ${(err as Error)?.message ?? err}`);
                return undefined;
            }
        };

        await Promise.all(
            pending.map(async (item) => {
                let promise = decoded.get(item.key);
                if (!promise) {
                    promise = decode(item);
                    decoded.set(item.key, promise);
                }
                const texture = await promise;
                if (texture) item.material.texture = texture;
            }),
        );
        data.pendingTextures = [];
        return failures;
    }

    /**
     * Asynchronously loads and decodes a `.glb` binary asset from a URL, including its material textures
     * (decode failures are reported in `warnings` instead of rejecting).
     *
     * @param url URL path to the `.glb` file
     * @param modelName Optional model identifier prefix
     * @returns Decoded `ParsedModelData`
     */
    public static async load(url: string, modelName?: string): Promise<ParsedModelData> {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch GLB asset from '${url}': HTTP ${response.status}`);
        }
        const buffer = await response.arrayBuffer();
        const resolvedName = modelName ?? url.split("/").pop()?.replace(/\.[^/.]+$/, "") ?? "model";
        const data = GLBLoader.parse(buffer, resolvedName);
        data.warnings = await GLBLoader.decodeTextures(data, url.substring(0, url.lastIndexOf("/") + 1));
        return data;
    }
}
