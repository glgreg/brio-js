import { BrioMesh } from "./BrioMesh";
import { BrioMaterial } from "./BrioMaterial";
import { Vec3 } from "../math/vec3";
import { BrioObject3D } from "../objects/BrioObject3D";
import { OBJLoader } from "./loaders/OBJLoader";
import { GLBLoader } from "./loaders/GLBLoader";
import { GLTFLoader } from "./loaders/GLTFLoader";

/**
 * Supported 3D model container and geometry formats.
 */
export type ModelFormat = "glb" | "gltf" | "obj" | "auto";

/**
 * Configuration options for creating and loading a `BrioModel`.
 */
export interface BrioModelOptions {
    /** Explicit file format override (`"glb"`, `"gltf"`, `"obj"`, or `"auto"`). */
    format?: ModelFormat;
    /** Optional companion Wavefront `.mtl` material file path or raw text (for `.obj` models). */
    mtlSource?: string;
}

/**
 * Axis-aligned bounding box (AABB) enclosing all vertices in a 3D model.
 */
export interface ModelBoundingBox {
    /** Minimum spatial coordinates `(minX, minY, minZ)`. */
    min: Vec3;
    /** Maximum spatial coordinates `(maxX, maxY, maxZ)`. */
    max: Vec3;
    /** Spatial extents `(width, height, depth)`. */
    size: Vec3;
    /** Center spatial coordinate `((min + max) / 2)`. */
    center: Vec3;
}

/**
 * 3D model asset (`BrioModel`) representing decoded geometry (`BrioMesh`), materials (`BrioMaterial`),
 * and bounding dimensions. Follows the unified BrioJS asset lifecycle (`preload()` -> `load()` -> `update()`).
 *
 * @example
 * ```ts
 * game.preload(() => [
 *     new BrioModel("mod_ship", "./assets/models/ship.glb"),
 * ]);
 *
 * game.load((assets) => {
 *     const shipModel = assets.getModel("mod_ship");
 *     const ship = new BrioObject3D("obj_ship", shipModel.primaryMesh?.name);
 *     return [ship];
 * });
 * ```
 */
export class BrioModel {
    readonly #name: string;
    readonly #url: string;
    readonly #options: BrioModelOptions;
    #format: ModelFormat;
    #meshes = new Map<string, BrioMesh>();
    #materials = new Map<string, BrioMaterial>();
    #boundingBox: ModelBoundingBox = {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 0, y: 0, z: 0 },
        size: { x: 0, y: 0, z: 0 },
        center: { x: 0, y: 0, z: 0 },
    };
    #isLoaded: boolean = false;

    static #emptyInstance?: BrioModel;

    /**
     * Creates a new `BrioModel` asset handle.
     *
     * @param name Unique model identifier
     * @param url URL path to the 3D file (`.glb`, `.gltf`, or `.obj`)
     * @param options Optional loading options
     */
    constructor(name: string, url: string, options: BrioModelOptions = {}) {
        this.#name = name;
        this.#url = url;
        this.#options = options;
        this.#format = options.format ?? "auto";
    }

    /** Unique identifier of the model asset. */
    public get name(): string {
        return this.#name;
    }

    /** Source URL path of the 3D model file. */
    public get url(): string {
        return this.#url;
    }

    /** Detected or configured file format (`"glb"`, `"gltf"`, or `"obj"`). */
    public get format(): ModelFormat {
        return this.#format;
    }

    /** Map of all decoded `BrioMesh` geometries keyed by mesh name. */
    public get meshes(): Map<string, BrioMesh> {
        return this.#meshes;
    }

    /** Map of all decoded `BrioMaterial` surfaces keyed by material name. */
    public get materials(): Map<string, BrioMaterial> {
        return this.#materials;
    }

    /** First or primary `BrioMesh` in this model, or `undefined` if none. */
    public get primaryMesh(): BrioMesh | undefined {
        for (const mesh of this.#meshes.values()) {
            return mesh;
        }
        return undefined;
    }

    /** First or primary `BrioMaterial` in this model, or `undefined` if none. */
    public get primaryMaterial(): BrioMaterial | undefined {
        for (const mat of this.#materials.values()) {
            return mat;
        }
        return undefined;
    }

    /** Combined axis-aligned bounding box enclosing all meshes in this model. */
    public get boundingBox(): ModelBoundingBox {
        return this.#boundingBox;
    }

    /** Indicates whether this model's geometry and materials have finished loading. */
    public get isLoaded(): boolean {
        return this.#isLoaded;
    }

    /**
     * Asynchronously loads and decodes the 3D model asset.
     * Called automatically during `game.preload()`.
     *
     * @returns This `BrioModel` instance once loading finishes
     */
    public async load(): Promise<this> {
        let detectedFormat = this.#format;
        if (detectedFormat === "auto") {
            const cleanUrl = this.#url.split("?")[0].toLowerCase();
            if (cleanUrl.endsWith(".glb")) {
                detectedFormat = "glb";
            } else if (cleanUrl.endsWith(".gltf")) {
                detectedFormat = "gltf";
            } else if (cleanUrl.endsWith(".obj")) {
                detectedFormat = "obj";
            } else {
                detectedFormat = "glb";
            }
            this.#format = detectedFormat;
        }

        let parsedData: { meshes: BrioMesh[]; materials: BrioMaterial[] };

        if (detectedFormat === "glb") {
            parsedData = await GLBLoader.load(this.#url, this.#name);
        } else if (detectedFormat === "gltf") {
            parsedData = await GLTFLoader.load(this.#url, this.#name);
        } else if (detectedFormat === "obj") {
            parsedData = await OBJLoader.load(this.#url, {
                mtlSource: this.#options.mtlSource,
                modelName: this.#name,
            });
        } else {
            throw new Error(`Unsupported 3D model format '${detectedFormat}' for asset '${this.#name}'.`);
        }

        this.#meshes.clear();
        for (const mesh of parsedData.meshes) {
            this.#meshes.set(mesh.name, mesh);
        }

        this.#materials.clear();
        for (const mat of parsedData.materials) {
            this.#materials.set(mat.name, mat);
        }

        this.#recomputeBoundingBox();
        this.#isLoaded = true;
        return this;
    }

    #recomputeBoundingBox(): void {
        let minX = Infinity;
        let minY = Infinity;
        let minZ = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        let maxZ = -Infinity;
        let hasVertices = false;

        for (const mesh of this.#meshes.values()) {
            const bbox = mesh.computeBoundingBox();
            if (mesh.positions.length > 0) {
                hasVertices = true;
                if (bbox.min.x < minX) minX = bbox.min.x;
                if (bbox.min.y < minY) minY = bbox.min.y;
                if (bbox.min.z < minZ) minZ = bbox.min.z;

                if (bbox.max.x > maxX) maxX = bbox.max.x;
                if (bbox.max.y > maxY) maxY = bbox.max.y;
                if (bbox.max.z > maxZ) maxZ = bbox.max.z;
            }
        }

        if (!hasVertices) {
            this.#boundingBox = {
                min: { x: 0, y: 0, z: 0 },
                max: { x: 0, y: 0, z: 0 },
                size: { x: 0, y: 0, z: 0 },
                center: { x: 0, y: 0, z: 0 },
            };
            return;
        }

        this.#boundingBox = {
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

    /**
     * Instantiates this model as a scene graph `BrioObject3D` entity.
     * If the model contains multiple sub-meshes, creates a root container entity
     * with child `BrioObject3D` nodes for each sub-mesh part.
     * Also attaches a matching 3D box collider configured from the model bounding box.
     *
     * @param objectName Unique entity name
     * @returns Instantiated `BrioObject3D` root entity
     * @example
     * ```ts
     * const ship = shipModel.instantiate("obj_ship");
     * ```
     */
    public instantiate(objectName: string): BrioObject3D {
        const meshesArr = Array.from(this.#meshes.values());
        const materialsArr = Array.from(this.#materials.values());

        if (meshesArr.length === 0) {
            return new BrioObject3D(objectName);
        }

        if (meshesArr.length === 1) {
            const root = new BrioObject3D(
                objectName,
                meshesArr[0].name,
                materialsArr[0]?.name ?? "",
            );
            root.addCollider3D("box", "solid", this.#boundingBox.center, this.#boundingBox.size);
            return root;
        }

        const root = new BrioObject3D(objectName);
        for (let i = 0; i < meshesArr.length; i++) {
            const mesh = meshesArr[i];
            const mat = materialsArr[i] ?? materialsArr[0];
            const child = new BrioObject3D(
                `${objectName}_part_${i}`,
                mesh.name,
                mat?.name ?? "",
            );
            root.transform.addChild(child.transform);
        }

        root.addCollider3D("box", "solid", this.#boundingBox.center, this.#boundingBox.size);
        return root;
    }

    /**
     * Creates a `BrioModel` directly from pre-existing `BrioMesh` and `BrioMaterial` instances.
     *
     * @param name Unique model identifier
     * @param meshes Array of geometric meshes
     * @param materials Optional array of surface materials
     * @returns Instantiated and pre-populated `BrioModel`
     * @example
     * ```ts
     * const boxMesh = BrioMesh.createBox("mesh_box", 2, 2, 2);
     * const model = BrioModel.fromData("mod_box", [boxMesh]);
     * ```
     */
    public static fromData(
        name: string,
        meshes: BrioMesh[],
        materials: BrioMaterial[] = [],
    ): BrioModel {
        const model = new BrioModel(name, "");
        for (const mesh of meshes) {
            model.#meshes.set(mesh.name, mesh);
        }
        for (const mat of materials) {
            model.#materials.set(mat.name, mat);
        }
        model.#recomputeBoundingBox();
        model.#isLoaded = true;
        return model;
    }

    /**
     * Returns a cached empty fallback `BrioModel` instance.
     */
    public static getEmptyInstance(): BrioModel {
        if (!BrioModel.#emptyInstance) {
            BrioModel.#emptyInstance = new BrioModel("empty_model", "");
            BrioModel.#emptyInstance.#isLoaded = true;
        }
        return BrioModel.#emptyInstance;
    }
}
