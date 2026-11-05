import { assertByteLimit, getModelLoaderLimits, ModelLimitError } from "./limits";

/**
 * Geometry of one OBJ mesh (an `o`/`g` group, or a run of faces sharing one `usemtl` material), already
 * converted to the flat typed buffers `BrioMesh` stores.
 */
export interface OBJGeometryGroup {
    /** Group name as written in the file (`o`/`g`), or `""` for faces before any group statement. */
    group: string;
    /** Material named by the active `usemtl` statement, or `""` when none was active. */
    material: string;
    /** Flat `[x, y, z, ...]` positions. */
    positions: Float32Array;
    /** Flat `[nx, ny, nz, ...]` normals (flat normals are computed when the file has no `vn`). */
    normals: Float32Array;
    /** Flat `[u, v, ...]` texture coordinates. */
    uvs: Float32Array;
    /** Triangle indices; `Uint32Array` above 65535 vertices. */
    indices: Uint16Array | Uint32Array;
}

/**
 * Options of `parseOBJGeometry`.
 */
export interface OBJGeometryOptions {
    /**
     * Whether `o`/`g` statements and `usemtl` changes start a new group (`OBJLoader`); when `false`, every
     * face lands in one group (`BrioMesh.fromOBJ`).
     */
    split: boolean;
}

/** Mutable accumulator of one group while the file is read. */
interface GroupAccumulator {
    group: string;
    material: string;
    positions: number[];
    normals: number[];
    uvs: number[];
    indices: number[];
    vertexCache: Map<string, number>;
}

/** Resolves a 1-based (or negative, relative) OBJ index into a 0-based index, `-1` when absent. */
function resolveIndex(token: string | undefined, count: number): number {
    if (!token) return -1;
    const value = parseInt(token, 10);
    if (!Number.isFinite(value) || value === 0) return -1;
    return value > 0 ? value - 1 : count + value;
}

/**
 * Computes flat surface normals per triangle for geometries without defined normals.
 *
 * @param positions Vertex position array
 * @param indices Triangle index array
 * @returns Computed normal array
 */
export function computeOBJFlatNormals(
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
 * Parses Wavefront `.obj` geometry (`v`, `vt`, `vn`, `f` with fan triangulation, `o`/`g`, `usemtl`) into
 * typed buffers. It is the single OBJ geometry parser shared by `OBJLoader.parse` and `BrioMesh.fromOBJ`,
 * so both enforce `ModelLoaderLimits`: the text is capped by `maxFileBytes` and each group's decoded
 * components by `maxAccessorComponents`.
 *
 * @param objText Raw `.obj` text
 * @param options Grouping behavior
 * @returns Non-empty groups in file order (a single empty group when the file has no faces)
 * @throws {ModelLimitError} When a limit is exceeded
 * @example
 * ```ts
 * const groups = parseOBJGeometry(objText, { split: true });
 * ```
 */
export function parseOBJGeometry(objText: string, options: OBJGeometryOptions): OBJGeometryGroup[] {
    const limits = getModelLoaderLimits();
    assertByteLimit("OBJ text", objText.length, limits.maxFileBytes);
    const maxComponents = limits.maxAccessorComponents;

    const rawPos: number[] = [];
    const rawUV: number[] = [];
    const rawNorm: number[] = [];
    const groups: GroupAccumulator[] = [];

    const createGroup = (group: string, material: string): GroupAccumulator => {
        const acc: GroupAccumulator = {
            group,
            material,
            positions: [],
            normals: [],
            uvs: [],
            indices: [],
            vertexCache: new Map(),
        };
        groups.push(acc);
        return acc;
    };

    let groupName = "";
    let materialName = "";
    let current = createGroup(groupName, materialName);

    const addFaceVertex = (token: string): number => {
        const cached = current.vertexCache.get(token);
        if (cached !== undefined) return cached;

        const parts = token.split("/");
        const v = resolveIndex(parts[0], rawPos.length / 3);
        const vt = resolveIndex(parts[1], rawUV.length / 2);
        const vn = resolveIndex(parts[2], rawNorm.length / 3);

        const newIndex = current.positions.length / 3;
        if (current.positions.length + 3 > maxComponents) {
            throw new ModelLimitError(
                `OBJ group '${current.group}' decodes more than ${maxComponents} components.`,
            );
        }
        const hasV = v >= 0 && v * 3 < rawPos.length;
        current.positions.push(
            hasV ? rawPos[v * 3] : 0,
            hasV ? rawPos[v * 3 + 1] : 0,
            hasV ? rawPos[v * 3 + 2] : 0,
        );
        const hasVt = vt >= 0 && vt * 2 < rawUV.length;
        current.uvs.push(hasVt ? rawUV[vt * 2] : 0, hasVt ? rawUV[vt * 2 + 1] : 0);
        const hasVn = vn >= 0 && vn * 3 < rawNorm.length;
        current.normals.push(
            hasVn ? rawNorm[vn * 3] : 0,
            hasVn ? rawNorm[vn * 3 + 1] : 1,
            hasVn ? rawNorm[vn * 3 + 2] : 0,
        );
        current.vertexCache.set(token, newIndex);
        return newIndex;
    };

    const lines = objText.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith("#")) continue;

        const tokens = line.split(/\s+/);
        const keyword = tokens[0];

        if (keyword === "v") {
            rawPos.push(
                parseFloat(tokens[1]) || 0,
                parseFloat(tokens[2]) || 0,
                parseFloat(tokens[3]) || 0,
            );
        } else if (keyword === "vt") {
            rawUV.push(parseFloat(tokens[1]) || 0, parseFloat(tokens[2]) || 0);
        } else if (keyword === "vn") {
            rawNorm.push(
                parseFloat(tokens[1]) || 0,
                parseFloat(tokens[2]) || 0,
                parseFloat(tokens[3]) || 0,
            );
        } else if (!options.split) {
            if (keyword === "f") addFace(tokens);
        } else if (keyword === "o" || keyword === "g") {
            groupName = tokens.slice(1).join(" ");
            if (current.indices.length > 0) {
                current = createGroup(groupName, materialName);
            } else {
                current.group = groupName;
                current.material = materialName;
            }
        } else if (keyword === "usemtl") {
            materialName = tokens.slice(1).join(" ");
            if (current.indices.length > 0) {
                if (current.material !== materialName) {
                    current = createGroup(groupName, materialName);
                }
            } else {
                current.material = materialName;
            }
        } else if (keyword === "f") {
            addFace(tokens);
        }
    }

    function addFace(tokens: string[]): void {
        if (tokens.length < 4) return;
        const first = addFaceVertex(tokens[1]);
        let previous = addFaceVertex(tokens[2]);
        // Polygon fan triangulation (3 vertices = 1 triangle, 4 vertices = 2 triangles, ...)
        for (let t = 3; t < tokens.length; t++) {
            const next = addFaceVertex(tokens[t]);
            current.indices.push(first, previous, next);
            previous = next;
        }
    }

    const hasNormals = rawNorm.length > 0;
    const nonEmpty = groups.filter((g) => g.positions.length > 0 && g.indices.length > 0);
    return (nonEmpty.length > 0 ? nonEmpty : groups.slice(0, 1)).map((g) => {
        const vertexCount = g.positions.length / 3;
        const positions = new Float32Array(g.positions);
        const indices =
            vertexCount > 65535 ? new Uint32Array(g.indices) : new Uint16Array(g.indices);
        return {
            group: g.group,
            material: g.material,
            positions,
            normals: hasNormals
                ? new Float32Array(g.normals)
                : computeOBJFlatNormals(positions, indices),
            uvs: new Float32Array(g.uvs),
            indices,
        };
    });
}
