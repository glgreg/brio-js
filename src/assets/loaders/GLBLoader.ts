import { BrioMesh } from "../BrioMesh";
import { BrioMaterial } from "../BrioMaterial";
import { ParsedModelData } from "./OBJLoader";
import { CSSColor } from "../../tools/base_types";

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

        // Parse Materials
        if (Array.isArray(json.materials)) {
            for (let i = 0; i < json.materials.length; i++) {
                const matDef = json.materials[i];
                const pbr = matDef.pbrMetallicRoughness;
                let color: CSSColor = "#ffffff";
                let opacity = 1;

                if (pbr?.baseColorFactor && Array.isArray(pbr.baseColorFactor)) {
                    const factor = pbr.baseColorFactor;
                    const r = Math.min(255, Math.max(0, Math.round((factor[0] ?? 1) * 255)));
                    const g = Math.min(255, Math.max(0, Math.round((factor[1] ?? 1) * 255)));
                    const b = Math.min(255, Math.max(0, Math.round((factor[2] ?? 1) * 255)));
                    opacity = factor[3] ?? 1;
                    color = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
                }

                materials.push(
                    new BrioMaterial(matDef.name || `${modelName}_mat_${i}`, {
                        color,
                        opacity,
                        shading: "lambert",
                    }),
                );
            }
        }

        // Parse Meshes
        if (Array.isArray(json.meshes)) {
            for (let mIdx = 0; mIdx < json.meshes.length; mIdx++) {
                const meshDef = json.meshes[mIdx];
                const primitives = meshDef.primitives || [];

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

                    const meshName =
                        meshDef.name && primitives.length === 1
                            ? meshDef.name
                            : `${modelName}_mesh_${mIdx}_${pIdx}`;

                    meshes.push(new BrioMesh(meshName, positions, normals, uvs, indices));
                }
            }
        }

        return { meshes, materials };
    }

    /**
     * Asynchronously loads and decodes a `.glb` binary asset from a URL.
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
        return GLBLoader.parse(buffer, resolvedName);
    }
}
