import { Vec3 } from "../math/vec3";

/**
 * 3D geometric surface (`BrioMesh`) composed of contiguous `positions` (`Float32Array`),
 * `normals` (`Float32Array`), `uvs` (`Float32Array`), and triangle `indices` (`Uint16Array | Uint32Array`).
 * Includes built-in procedural generators (`createBox`, `createPlane`, `createSphere`) and a
 * zero-dependency Wavefront `.obj` parser (`fromOBJ`).
 *
 * @example
 * ```ts
 * const boxMesh = BrioMesh.createBox("mesh_crate", 2, 2, 2);
 * const customMesh = BrioMesh.fromOBJ("mesh_ship", objText);
 * ```
 */
export class BrioMesh {
    readonly #name: string;
    /** Interleaved or flat 3D vertex positions (`x, y, z` per vertex). */
    public readonly positions: Float32Array;
    /** 3D vertex normals (`nx, ny, nz` per vertex). */
    public readonly normals: Float32Array;
    /** 2D texture coordinates (`u, v` per vertex). */
    public readonly uvs: Float32Array;
    /** Triangle vertex indices (`3` indices per triangle). */
    public readonly indices: Uint16Array | Uint32Array;

    /**
     * Creates a new `BrioMesh` instance from typed geometry buffers.
     *
     * @param name Unique mesh identifier
     * @param positions Flat `[x, y, z, ...]` vertex buffer
     * @param normals Flat `[nx, ny, nz, ...]` normal buffer
     * @param uvs Flat `[u, v, ...]` UV buffer
     * @param indices Triangle index buffer (`Uint16Array` or `Uint32Array`)
     */
    constructor(
        name: string,
        positions: Float32Array,
        normals: Float32Array,
        uvs: Float32Array,
        indices: Uint16Array | Uint32Array,
    ) {
        this.#name = name;
        this.positions = positions;
        this.normals = normals;
        this.uvs = uvs;
        this.indices = indices;
    }

    /** Unique identifier of the mesh. */
    public get name(): string {
        return this.#name;
    }

    /** Number of vertices in the mesh (`positions.length / 3`). */
    public get vertexCount(): number {
        return Math.floor(this.positions.length / 3);
    }

    /** Number of triangles in the mesh (`indices.length / 3`). */
    public get triangleCount(): number {
        return Math.floor(this.indices.length / 3);
    }

    /**
     * Generates a 3D box (cuboid) mesh centered at the origin `(0, 0, 0)` with dimensions `width x height x depth`.
     *
     * @param name Unique mesh identifier
     * @param width Box width along X (defaults to `1`)
     * @param height Box height along Y (defaults to `1`)
     * @param depth Box depth along Z (defaults to `1`)
     * @returns Generated `BrioMesh` with 24 vertices and 12 triangles (36 indices)
     * @example
     * ```ts
     * const cube = BrioMesh.createBox("mesh_cube", 2, 2, 2);
     * ```
     */
    public static createBox(
        name: string,
        width: number = 1,
        height: number = 1,
        depth: number = 1,
    ): BrioMesh {
        const hx = width * 0.5;
        const hy = height * 0.5;
        const hz = depth * 0.5;

        // 6 faces * 4 vertices = 24 vertices
        const positions = new Float32Array([
            // Front (+Z)
            -hx, -hy, hz, hx, -hy, hz, hx, hy, hz, -hx, hy, hz,
            // Back (-Z)
            hx, -hy, -hz, -hx, -hy, -hz, -hx, hy, -hz, hx, hy, -hz,
            // Top (+Y)
            -hx, hy, hz, hx, hy, hz, hx, hy, -hz, -hx, hy, -hz,
            // Bottom (-Y)
            -hx, -hy, -hz, hx, -hy, -hz, hx, -hy, hz, -hx, -hy, hz,
            // Right (+X)
            hx, -hy, hz, hx, -hy, -hz, hx, hy, -hz, hx, hy, hz,
            // Left (-X)
            -hx, -hy, -hz, -hx, -hy, hz, -hx, hy, hz, -hx, hy, -hz,
        ]);

        const normals = new Float32Array([
            // Front
            0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
            // Back
            0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
            // Top
            0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
            // Bottom
            0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
            // Right
            1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
            // Left
            -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
        ]);

        const uvs = new Float32Array([
            0, 0, 1, 0, 1, 1, 0, 1,
            0, 0, 1, 0, 1, 1, 0, 1,
            0, 0, 1, 0, 1, 1, 0, 1,
            0, 0, 1, 0, 1, 1, 0, 1,
            0, 0, 1, 0, 1, 1, 0, 1,
            0, 0, 1, 0, 1, 1, 0, 1,
        ]);

        const indices = new Uint16Array(36);
        for (let face = 0; face < 6; face++) {
            const vOffset = face * 4;
            const iOffset = face * 6;
            indices[iOffset] = vOffset;
            indices[iOffset + 1] = vOffset + 1;
            indices[iOffset + 2] = vOffset + 2;
            indices[iOffset + 3] = vOffset;
            indices[iOffset + 4] = vOffset + 2;
            indices[iOffset + 5] = vOffset + 3;
        }

        return new BrioMesh(name, positions, normals, uvs, indices);
    }

    /**
     * Generates a horizontal XZ plane mesh centered at the origin `(0, 0, 0)`.
     *
     * @param name Unique mesh identifier
     * @param width Plane width along X (defaults to `10`)
     * @param depth Plane depth along Z (defaults to `10`)
     * @returns Generated `BrioMesh` with 4 vertices and 2 triangles
     * @example
     * ```ts
     * const ground = BrioMesh.createPlane("mesh_ground", 50, 50);
     * ```
     */
    public static createPlane(name: string, width: number = 10, depth: number = 10): BrioMesh {
        const hx = width * 0.5;
        const hz = depth * 0.5;

        const positions = new Float32Array([-hx, 0, hz, hx, 0, hz, hx, 0, -hz, -hx, 0, -hz]);
        const normals = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]);
        const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
        const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);

        return new BrioMesh(name, positions, normals, uvs, indices);
    }

    /**
     * Generates a UV sphere mesh centered at the origin `(0, 0, 0)`.
     *
     * @param name Unique mesh identifier
     * @param radius Sphere radius (defaults to `1`)
     * @param segments Number of latitude/longitude subdivisions (defaults to `12`)
     * @returns Generated `BrioMesh`
     * @example
     * ```ts
     * const ball = BrioMesh.createSphere("mesh_ball", 1.5, 16);
     * ```
     */
    public static createSphere(
        name: string,
        radius: number = 1,
        segments: number = 12,
    ): BrioMesh {
        const rings = Math.max(3, Math.floor(segments));
        const sectors = Math.max(3, Math.floor(segments));

        const posList: number[] = [];
        const normList: number[] = [];
        const uvList: number[] = [];
        const idxList: number[] = [];

        for (let r = 0; r <= rings; r++) {
            const v = r / rings;
            const phi = v * Math.PI;
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);

            for (let s = 0; s <= sectors; s++) {
                const u = s / sectors;
                const theta = u * Math.PI * 2;
                const nx = Math.cos(theta) * sinPhi;
                const ny = cosPhi;
                const nz = Math.sin(theta) * sinPhi;

                posList.push(nx * radius, ny * radius, nz * radius);
                normList.push(nx, ny, nz);
                uvList.push(u, v);
            }
        }

        for (let r = 0; r < rings; r++) {
            for (let s = 0; s < sectors; s++) {
                const first = r * (sectors + 1) + s;
                const second = first + sectors + 1;
                idxList.push(first, second, first + 1);
                idxList.push(second, second + 1, first + 1);
            }
        }

        return new BrioMesh(
            name,
            new Float32Array(posList),
            new Float32Array(normList),
            new Float32Array(uvList),
            new Uint16Array(idxList),
        );
    }

    /**
     * Parses a Wavefront `.obj` ASCII string into a `BrioMesh` (supports `v`, `vt`, `vn`, and triangle/quad `f` faces).
     *
     * @param name Unique mesh identifier
     * @param objSource Raw `.obj` file text content
     * @returns Parsed `BrioMesh`
     * @example
     * ```ts
     * const mesh = BrioMesh.fromOBJ("mesh_pyramid", objFileContent);
     * ```
     */
    public static fromOBJ(name: string, objSource: string): BrioMesh {
        const rawPos: [number, number, number][] = [];
        const rawUV: [number, number][] = [];
        const rawNorm: [number, number, number][] = [];

        const outPos: number[] = [];
        const outUV: number[] = [];
        const outNorm: number[] = [];
        const outIndices: number[] = [];
        const vertexCache = new Map<string, number>();

        const addFaceVertex = (token: string): number => {
            const cached = vertexCache.get(token);
            if (cached !== undefined) return cached;

            const parts = token.split("/");
            const vIdx = parseInt(parts[0], 10) - 1;
            const vtIdx = parts[1] ? parseInt(parts[1], 10) - 1 : -1;
            const vnIdx = parts[2] ? parseInt(parts[2], 10) - 1 : -1;

            const p = rawPos[vIdx] ?? [0, 0, 0];
            const uv = vtIdx >= 0 && rawUV[vtIdx] ? rawUV[vtIdx] : [0, 0];
            const n = vnIdx >= 0 && rawNorm[vnIdx] ? rawNorm[vnIdx] : [0, 1, 0];

            const newIndex = outPos.length / 3;
            outPos.push(p[0], p[1], p[2]);
            outUV.push(uv[0], uv[1]);
            outNorm.push(n[0], n[1], n[2]);
            vertexCache.set(token, newIndex);
            return newIndex;
        };

        const lines = objSource.split(/\r?\n/);
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
            } else if (keyword === "f") {
                const faceVertices = tokens.slice(1).map(addFaceVertex);
                for (let t = 1; t < faceVertices.length - 1; t++) {
                    outIndices.push(faceVertices[0], faceVertices[t], faceVertices[t + 1]);
                }
            }
        }

        return new BrioMesh(
            name,
            new Float32Array(outPos),
            new Float32Array(outNorm),
            new Float32Array(outUV),
            new Uint16Array(outIndices),
        );
    }

    /**
     * Computes the axis-aligned bounding box (AABB) enclosing all vertex positions in this mesh.
     *
     * @returns Object containing `min`, `max`, `size`, and `center` vectors
     * @example
     * ```ts
     * const bbox = mesh.computeBoundingBox();
     * console.log(bbox.size.x, bbox.size.y, bbox.size.z);
     * ```
     */
    public computeBoundingBox(): { min: Vec3; max: Vec3; size: Vec3; center: Vec3 } {
        const positions = this.positions;
        if (positions.length === 0) {
            return {
                min: { x: 0, y: 0, z: 0 },
                max: { x: 0, y: 0, z: 0 },
                size: { x: 0, y: 0, z: 0 },
                center: { x: 0, y: 0, z: 0 },
            };
        }

        let minX = positions[0];
        let minY = positions[1];
        let minZ = positions[2];
        let maxX = minX;
        let maxY = minY;
        let maxZ = minZ;

        for (let i = 3; i < positions.length; i += 3) {
            const x = positions[i];
            const y = positions[i + 1];
            const z = positions[i + 2];

            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (z < minZ) minZ = z;

            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
            if (z > maxZ) maxZ = z;
        }

        return {
            min: { x: minX, y: minY, z: minZ },
            max: { x: maxX, y: maxY, z: maxZ },
            size: { x: maxX - minX, y: maxY - minY, z: maxZ - minZ },
            center: {
                x: (minX + maxX) * 0.5,
                y: (minY + maxY) * 0.5,
                z: (minZ + maxZ) * 0.5,
            },
        };
    }

    static #emptyInstance?: BrioMesh;

    /**
     * Returns a cached empty fallback `BrioMesh` instance.
     */
    public static getEmptyInstance(): BrioMesh {
        if (!BrioMesh.#emptyInstance) {
            BrioMesh.#emptyInstance = new BrioMesh(
                "empty_mesh",
                new Float32Array(0),
                new Float32Array(0),
                new Float32Array(0),
                new Uint16Array(0),
            );
        }
        return BrioMesh.#emptyInstance;
    }
}

