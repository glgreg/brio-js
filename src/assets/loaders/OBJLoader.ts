import { BrioMesh } from "../BrioMesh";
import { BrioMaterial } from "../BrioMaterial";
import { CSSColor } from "../../tools/base_types";
import { assertByteLimit, fetchLimited, getModelLoaderLimits } from "./limits";
import { computeOBJFlatNormals, parseOBJGeometry } from "./objGeometry";

/**
 * Options configuring `OBJLoader` operations.
 */
export interface OBJLoaderOptions {
    /** Optional companion `.mtl` material file URL or text content. */
    mtlSource?: string;
    /** Model identifier prefix. */
    modelName?: string;
}

/**
 * Result data produced by parsing Wavefront OBJ and MTL assets.
 */
export interface ParsedModelData {
    /** Array of geometry meshes decoded from the asset. */
    meshes: BrioMesh[];
    /** Array of surface materials decoded from the asset. */
    materials: BrioMaterial[];
    /**
     * Material name assigned to each entry of `meshes` (same order), for formats that bind materials
     * per primitive (glTF `primitive.material`). `""` means no material.
     */
    meshMaterials?: string[];
    /** Encoded images still to be decoded into `BrioMaterial.texture` (see `GLBLoader.decodeTextures`). */
    pendingTextures?: PendingTexture[];
    /** Non-fatal problems found while loading (e.g. textures that failed to decode). */
    warnings?: string[];
}

/**
 * Image referenced by a material that must be decoded asynchronously before rendering.
 */
export interface PendingTexture {
    /** Material that receives the decoded texture. */
    material: BrioMaterial;
    /** Cache key shared by every material referencing the same image (decoded once). */
    key: string;
    /** Encoded bytes for embedded images (GLB `bufferView` or `data:` URI). */
    bytes?: Uint8Array;
    /** External image URI, relative to the model file. */
    uri?: string;
    /** Image MIME type (`"image/png"`, `"image/jpeg"`, ...). */
    mimeType: string;
}

/**
 * Zero-dependency Wavefront `.obj` (geometry) and `.mtl` (material library) parser and loader.
 * Supports multi-group meshes (`o`, `g`), per-face material binding (`usemtl`), smooth UV/normal vertex
 * indexing, negative (relative) indices, polygon fan triangulation, automatic flat normal generation, and
 * companion `.mtl` materials. Geometry is parsed by the same `ModelLoaderLimits`-aware parser as
 * `BrioMesh.fromOBJ`.
 *
 * @example
 * ```ts
 * const { meshes, materials } = OBJLoader.parse(objFileText, mtlFileText, "mod_statue");
 * const loaded = await OBJLoader.load("./assets/models/statue.obj");
 * ```
 */
export class OBJLoader {
    /**
     * Parses Wavefront MTL material library text into `BrioMaterial` instances.
     *
     * @param mtlText Raw `.mtl` file content
     * @param namePrefix Optional prefix added to every material name (`OBJLoader.parse` passes `"<model>/"`)
     * @returns Array of parsed `BrioMaterial` instances
     */
    public static parseMTL(mtlText: string, namePrefix: string = ""): BrioMaterial[] {
        const materials: BrioMaterial[] = [];
        let currentName = "";
        let currentColor: CSSColor = "#ffffff";
        let currentOpacity = 1;

        const flushCurrent = () => {
            if (currentName) {
                materials.push(
                    new BrioMaterial(`${namePrefix}${currentName}`, {
                        color: currentColor,
                        opacity: currentOpacity,
                        shading: "lambert",
                    }),
                );
            }
        };

        const lines = mtlText.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.startsWith("#")) continue;

            const tokens = line.split(/\s+/);
            const keyword = tokens[0].toLowerCase();

            if (keyword === "newmtl") {
                flushCurrent();
                currentName = tokens[1] ?? `mat_${materials.length}`;
                currentColor = "#ffffff";
                currentOpacity = 1;
            } else if (keyword === "kd") {
                const r = Math.min(255, Math.max(0, Math.round(parseFloat(tokens[1] || "1") * 255)));
                const g = Math.min(255, Math.max(0, Math.round(parseFloat(tokens[2] || "1") * 255)));
                const b = Math.min(255, Math.max(0, Math.round(parseFloat(tokens[3] || "1") * 255)));
                currentColor = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
            } else if (keyword === "d") {
                currentOpacity = parseFloat(tokens[1] || "1");
            } else if (keyword === "tr") {
                currentOpacity = 1 - parseFloat(tokens[1] || "0");
            }
        }

        flushCurrent();
        return materials;
    }
    /**
     * Parses raw Wavefront `.obj` text and optional `.mtl` text into meshes and materials.
     * Meshes split on `o`/`g` statements and whenever `usemtl` switches material inside a group; each mesh
     * is bound to its `usemtl` material through `meshMaterials` (`""` when it has none, or when the
     * material is not in the `.mtl`, which is reported in `warnings`).
     *
     * @param objText Raw `.obj` text content
     * @param mtlText Optional raw `.mtl` text content
     * @param modelName Optional model identifier prefix
     * @returns Decoded `ParsedModelData`
     * @throws {ModelLimitError} When the text or a group exceeds `ModelLoaderLimits`
     */
    public static parse(objText: string, mtlText?: string, modelName: string = "model"): ParsedModelData {
        const maxBytes = getModelLoaderLimits().maxFileBytes;
        assertByteLimit("OBJ text", objText.length, maxBytes);
        if (mtlText) assertByteLimit("MTL text", mtlText.length, maxBytes);
        const materials: BrioMaterial[] = mtlText ? OBJLoader.parseMTL(mtlText, `${modelName}/`) : [];
        const materialNames = new Set(materials.map((m) => m.name));

        const groups = parseOBJGeometry(objText, { split: true });
        const usedNames = new Set<string>();
        const meshes: BrioMesh[] = [];
        const meshMaterials: string[] = [];
        const warnings: string[] = [];
        const missing = new Set<string>();

        for (let i = 0; i < groups.length; i++) {
            const g = groups[i];
            let name = g.group
                ? `${modelName}/${g.group}`
                : i === 0
                  ? `${modelName}/default`
                  : `${modelName}/group_${i}`;
            // A group split by usemtl, or a repeated group name, must not overwrite another mesh
            if (usedNames.has(name) && g.material) name = `${name}_${g.material}`;
            const base = name;
            for (let k = 1; usedNames.has(name); k++) name = `${base}_${k}`;
            usedNames.add(name);

            meshes.push(new BrioMesh(name, g.positions, g.normals, g.uvs, g.indices));

            const materialName = g.material ? `${modelName}/${g.material}` : "";
            if (materialName && !materialNames.has(materialName)) {
                if (!missing.has(g.material)) {
                    missing.add(g.material);
                    warnings.push(
                        `OBJ material '${g.material}' (usemtl) is not defined in the MTL file.`,
                    );
                }
                meshMaterials.push("");
            } else {
                meshMaterials.push(materialName);
            }
        }

        return { meshes, materials, meshMaterials, warnings };
    }

    /**
     * Computes flat surface normals per triangle for geometries without defined normals.
     *
     * @param positions Vertex position array
     * @param indices Triangle index array
     * @returns Computed normal array
     */
    public static computeFlatNormals(
        positions: Float32Array,
        indices: Uint16Array | Uint32Array,
    ): Float32Array {
        return computeOBJFlatNormals(positions, indices);
    }

    /**
     * Asynchronously loads a Wavefront `.obj` file and its optional companion `.mtl` from URLs.
     *
     * @param url URL path to the `.obj` file
     * @param options Optional loading settings (`mtlSource`, `modelName`)
     * @returns Decoded `ParsedModelData`
     */
    public static async load(url: string, options: OBJLoaderOptions = {}): Promise<ParsedModelData> {
        const decoder = new TextDecoder("utf-8");
        const objText = decoder.decode(await fetchLimited(url, "OBJ asset"));

        let mtlText: string | undefined;
        if (options.mtlSource) {
            if (options.mtlSource.includes("newmtl") || options.mtlSource.includes("Kd")) {
                mtlText = options.mtlSource;
            } else {
                try {
                    mtlText = decoder.decode(await fetchLimited(options.mtlSource, "MTL file"));
                } catch {
                    // Fall back to no MTL if fetch fails
                }
            }
        } else {
            // Check for mtllib declaration in OBJ
            const mtllibMatch = objText.match(/^\s*mtllib\s+(.+)$/m);
            if (mtllibMatch && mtllibMatch[1]) {
                const mtlFilename = mtllibMatch[1].trim();
                const baseUrl = url.substring(0, url.lastIndexOf("/") + 1);
                const mtlUrl = `${baseUrl}${mtlFilename}`;
                try {
                    mtlText = decoder.decode(await fetchLimited(mtlUrl, "MTL file"));
                } catch {
                    // Ignore missing companion MTL
                }
            }
        }

        const modelName = options.modelName ?? url.split("/").pop()?.replace(/\.[^/.]+$/, "") ?? "model";
        return OBJLoader.parse(objText, mtlText, modelName);
    }
}
