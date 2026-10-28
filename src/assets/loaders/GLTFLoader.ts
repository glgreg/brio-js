import { GLBLoader } from "./GLBLoader";
import { ParsedModelData } from "./OBJLoader";
import { assertByteLimit, fetchLimited, getModelLoaderLimits } from "./limits";

/** Decodes a base64 `data:` URI payload, rejecting payloads above `maxFileBytes`. */
function decodeDataBuffer(uri: string): ArrayBuffer | undefined {
    const base64Index = uri.indexOf(";base64,");
    if (base64Index === -1) return undefined;
    const base64Data = uri.substring(base64Index + 8);
    assertByteLimit("glTF data: buffer", Math.floor((base64Data.length * 3) / 4), getModelLoaderLimits().maxFileBytes);
    return decodeBase64(base64Data).buffer as ArrayBuffer;
}

/**
 * Decodes a base64-encoded string into a `Uint8Array` in both Browser and Node.js environments.
 */
function decodeBase64(base64: string): Uint8Array {
    if (typeof atob === "function") {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }
    if (typeof Buffer !== "undefined") {
        return new Uint8Array(Buffer.from(base64, "base64"));
    }
    throw new Error("No base64 decoder available in the current runtime environment.");
}

/**
 * Zero-dependency JSON glTF 2.0 (`.gltf`) parser and loader.
 * Supports embedded base64 data URIs and external `.bin` buffers.
 *
 * @example
 * ```ts
 * const { meshes, materials } = GLTFLoader.parse(gltfText, [binBuffer], "mod_ship");
 * const loaded = await GLTFLoader.load("./assets/models/ship.gltf");
 * ```
 */
export class GLTFLoader {
    /**
     * Parses raw glTF JSON text and optional binary buffers into `BrioMesh` and `BrioMaterial` instances.
     *
     * @param gltfText Raw glTF JSON string
     * @param binBuffers Optional array of pre-fetched `ArrayBuffer` instances
     * @param modelName Optional model identifier prefix
     * @returns Decoded `ParsedModelData`
     */
    public static parse(
        gltfText: string,
        binBuffers: ArrayBuffer[] = [],
        modelName: string = "model",
    ): ParsedModelData {
        assertByteLimit("glTF JSON", gltfText.length, getModelLoaderLimits().maxJsonBytes);
        const json = JSON.parse(gltfText);
        let primaryBinBuffer: ArrayBuffer = binBuffers[0] ?? new ArrayBuffer(0);

        if (primaryBinBuffer.byteLength === 0 && Array.isArray(json.buffers) && json.buffers.length > 0) {
            const firstBuf = json.buffers[0];
            if (typeof firstBuf.uri === "string" && firstBuf.uri.startsWith("data:")) {
                primaryBinBuffer = decodeDataBuffer(firstBuf.uri) ?? primaryBinBuffer;
            }
        }

        return GLBLoader.extractModelData(json, primaryBinBuffer, modelName);
    }

    /**
     * Asynchronously loads and decodes a `.gltf` JSON file, its companion `.bin` buffers, and its material
     * textures (decode failures are reported in `warnings` instead of rejecting).
     *
     * @param url URL path to the `.gltf` file
     * @param modelName Optional model identifier prefix
     * @returns Decoded `ParsedModelData`
     */
    public static async load(url: string, modelName?: string): Promise<ParsedModelData> {
        const gltfBytes = await fetchLimited(url, "glTF asset");
        assertByteLimit("glTF JSON", gltfBytes.byteLength, getModelLoaderLimits().maxJsonBytes);
        const gltfText = new TextDecoder("utf-8").decode(gltfBytes);
        const json = JSON.parse(gltfText);

        const binBuffers: ArrayBuffer[] = [];
        if (Array.isArray(json.buffers)) {
            const baseUrl = url.substring(0, url.lastIndexOf("/") + 1);

            for (let i = 0; i < json.buffers.length; i++) {
                const buf = json.buffers[i];
                if (typeof buf.uri === "string") {
                    if (buf.uri.startsWith("data:")) {
                        const decoded = decodeDataBuffer(buf.uri);
                        if (decoded) binBuffers.push(decoded);
                    } else {
                        binBuffers.push(await fetchLimited(`${baseUrl}${buf.uri}`, "glTF buffer"));
                    }
                }
            }
        }

        const resolvedName = modelName ?? url.split("/").pop()?.replace(/\.[^/.]+$/, "") ?? "model";
        const data = GLTFLoader.parse(gltfText, binBuffers, resolvedName);
        const failures = await GLBLoader.decodeTextures(data, url.substring(0, url.lastIndexOf("/") + 1));
        data.warnings = [...(data.warnings ?? []), ...failures];
        return data;
    }
}
