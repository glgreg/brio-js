import { GLBLoader, fetchGLTFExternalBuffers, resolveGLTFBuffers } from "./GLBLoader";
import { ParsedModelData } from "./OBJLoader";
import { assertByteLimit, fetchLimited, getModelLoaderLimits } from "./limits";

/**
 * Zero-dependency JSON glTF 2.0 (`.gltf`) parser and loader.
 * Supports any number of buffers, each an embedded base64 `data:` URI or an external `.bin` file;
 * every `bufferView` reads from the buffer named by its `buffer` index.
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
     * @param binBuffers Pre-fetched buffers indexed like the glTF `buffers` array; a missing or empty entry
     * whose buffer is a base64 `data:` URI is decoded from the URI
     * @param modelName Optional model identifier prefix
     * @returns Decoded `ParsedModelData`
     */
    public static parse(
        gltfText: string,
        binBuffers: readonly (ArrayBuffer | undefined)[] = [],
        modelName: string = "model",
    ): ParsedModelData {
        assertByteLimit("glTF JSON", gltfText.length, getModelLoaderLimits().maxJsonBytes);
        const json = JSON.parse(gltfText);
        return GLBLoader.extractModelData(json, resolveGLTFBuffers(json, binBuffers), modelName);
    }

    /**
     * Asynchronously loads and decodes a `.gltf` JSON file, its external `.bin` buffers, and its material
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
        const baseUrl = url.substring(0, url.lastIndexOf("/") + 1);

        // Indexed like json.buffers; data: URIs are left undefined and decoded by parse()
        const binBuffers = await fetchGLTFExternalBuffers(JSON.parse(gltfText), baseUrl);

        const resolvedName =
            modelName ??
            url
                .split("/")
                .pop()
                ?.replace(/\.[^/.]+$/, "") ??
            "model";
        const data = GLTFLoader.parse(gltfText, binBuffers, resolvedName);
        const failures = await GLBLoader.decodeTextures(data, baseUrl);
        data.warnings = [...(data.warnings ?? []), ...failures];
        return data;
    }
}
