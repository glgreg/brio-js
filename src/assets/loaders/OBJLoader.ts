import { BrioMesh } from "../BrioMesh";
import { BrioMaterial } from "../BrioMaterial";
import { CSSColor } from "../../tools/base_types";

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
}

/**
 * Zero-dependency Wavefront `.obj` (geometry) and `.mtl` (material library) parser and loader.
 * Supports multi-group meshes (`o`, `g`), smooth UV/normal vertex indexing, polygon fan triangulation,
 * automatic flat normal generation, and companion material binding.
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
     * @returns Array of parsed `BrioMaterial` instances
     */
    public static parseMTL(mtlText: string): BrioMaterial[] {
        const materials: BrioMaterial[] = [];
        let currentName = "";
        let currentColor: CSSColor = "#ffffff";
        let currentOpacity = 1;

        const flushCurrent = () => {
            if (currentName) {
                materials.push(
                    new BrioMaterial(currentName, {
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
     *
     * @param objText Raw `.obj` text content
     * @param mtlText Optional raw `.mtl` text content
     * @param modelName Optional model identifier prefix
     * @returns Decoded `ParsedModelData`
     */
    public static parse(objText: string, mtlText?: string, modelName: string = "model"): ParsedModelData {
        const materials: BrioMaterial[] = mtlText ? OBJLoader.parseMTL(mtlText) : [];
        const rawPos: [number, number, number][] = [];
        const rawUV: [number, number][] = [];
        const rawNorm: [number, number, number][] = [];

        interface GroupAccumulator {
            name: string;
            positions: number[];
            normals: number[];
            uvs: number[];
            indices: number[];
            vertexCache: Map<string, number>;
        }

        const groups: GroupAccumulator[] = [];
        let currentGroup: GroupAccumulator = {
            name: `${modelName}_default`,
            positions: [],
            normals: [],
            uvs: [],
            indices: [],
            vertexCache: new Map(),
        };
        groups.push(currentGroup);

        const addFaceVertex = (group: GroupAccumulator, token: string): number => {
            const cached = group.vertexCache.get(token);
            if (cached !== undefined) return cached;

            const parts = token.split("/");
            const vIdx = parseInt(parts[0], 10) - 1;
            const vtIdx = parts[1] ? parseInt(parts[1], 10) - 1 : -1;
            const vnIdx = parts[2] ? parseInt(parts[2], 10) - 1 : -1;

            const p = rawPos[vIdx] ?? [0, 0, 0];
            const uv = vtIdx >= 0 && rawUV[vtIdx] ? rawUV[vtIdx] : [0, 0];
            const n = vnIdx >= 0 && rawNorm[vnIdx] ? rawNorm[vnIdx] : [0, 1, 0];

            const newIndex = group.positions.length / 3;
            group.positions.push(p[0], p[1], p[2]);
            group.uvs.push(uv[0], uv[1]);
            group.normals.push(n[0], n[1], n[2]);
            group.vertexCache.set(token, newIndex);
            return newIndex;
        };

        const lines = objText.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.startsWith("#")) continue;

            const tokens = line.split(/\s+/);
            const keyword = tokens[0];

            if (keyword === "v") {
                rawPos.push([
                    parseFloat(tokens[1]) || 0,
                    parseFloat(tokens[2]) || 0,
                    parseFloat(tokens[3]) || 0,
                ]);
            } else if (keyword === "vt") {
                rawUV.push([parseFloat(tokens[1]) || 0, parseFloat(tokens[2]) || 0]);
            } else if (keyword === "vn") {
                rawNorm.push([
                    parseFloat(tokens[1]) || 0,
                    parseFloat(tokens[2]) || 0,
                    parseFloat(tokens[3]) || 0,
                ]);
            } else if (keyword === "o" || keyword === "g") {
                const groupName = tokens[1] ? `${modelName}_${tokens[1]}` : `${modelName}_group_${groups.length}`;
                if (currentGroup.positions.length > 0) {
                    currentGroup = {
                        name: groupName,
                        positions: [],
                        normals: [],
                        uvs: [],
                        indices: [],
                        vertexCache: new Map(),
                    };
                    groups.push(currentGroup);
                } else {
                    currentGroup.name = groupName;
                }
            } else if (keyword === "f") {
                const faceTokens = tokens.slice(1);
                if (faceTokens.length < 3) continue;

                const faceIndices = faceTokens.map((t) => addFaceVertex(currentGroup, t));
                // Triangulate polygon fans (3 vertices = 1 triangle, 4 vertices = 2 triangles, etc.)
                for (let t = 1; t < faceIndices.length - 1; t++) {
                    currentGroup.indices.push(faceIndices[0], faceIndices[t], faceIndices[t + 1]);
                }
            }
        }

        const validGroups = groups.filter((g) => g.positions.length > 0 && g.indices.length > 0);
        const meshes: BrioMesh[] = (validGroups.length > 0 ? validGroups : groups).map((g) => {
            const indexArray =
                g.positions.length / 3 > 65535
                    ? new Uint32Array(g.indices)
                    : new Uint16Array(g.indices);

            const posArray = new Float32Array(g.positions);
            let normArray: Float32Array;
            if (rawNorm.length === 0) {
                normArray = OBJLoader.computeFlatNormals(posArray, indexArray);
            } else {
                normArray = new Float32Array(g.normals);
            }

            return new BrioMesh(
                g.name,
                posArray,
                normArray,
                new Float32Array(g.uvs),
                indexArray,
            );
        });

        return { meshes, materials };
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
     * Asynchronously loads a Wavefront `.obj` file and its optional companion `.mtl` from URLs.
     *
     * @param url URL path to the `.obj` file
     * @param options Optional loading settings (`mtlSource`, `modelName`)
     * @returns Decoded `ParsedModelData`
     */
    public static async load(url: string, options: OBJLoaderOptions = {}): Promise<ParsedModelData> {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch OBJ asset from '${url}': HTTP ${response.status}`);
        }
        const objText = await response.text();

        let mtlText: string | undefined;
        if (options.mtlSource) {
            if (options.mtlSource.includes("newmtl") || options.mtlSource.includes("Kd")) {
                mtlText = options.mtlSource;
            } else {
                try {
                    const mtlResponse = await fetch(options.mtlSource);
                    if (mtlResponse.ok) {
                        mtlText = await mtlResponse.text();
                    }
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
                    const mtlResponse = await fetch(mtlUrl);
                    if (mtlResponse.ok) {
                        mtlText = await mtlResponse.text();
                    }
                } catch {
                    // Ignore missing companion MTL
                }
            }
        }

        const modelName = options.modelName ?? url.split("/").pop()?.replace(/\.[^/.]+$/, "") ?? "model";
        return OBJLoader.parse(objText, mtlText, modelName);
    }
}
