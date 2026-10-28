import { BrioAudio } from "../assets/BrioAudio";
import { BrioSprite } from "../assets/BrioSprite";
import { BrioAtlas } from "../assets/BrioAtlas";
import { BrioModel } from "../assets/BrioModel";
import { BrioMesh } from "../assets/BrioMesh";
import { BrioMaterial } from "../assets/BrioMaterial";
import { BrioTileMap } from "../assets/BrioTileMap";
import { BrioCamera2D } from "../cameras/BrioCamera2D";
import { BrioCamera3D } from "../cameras/BrioCamera3D";
import { BrioRegistry } from "../core/BrioRegistry";
import { BrioObject2D } from "../objects/BrioObject2D";
import { BrioObject3D } from "../objects/BrioObject3D";

/**
 * Contract describing the central asset and entity registries managed by `BrioGame`.
 */
export interface BrioAssets {
    /** Map of active `BrioObject2D` entities keyed by `name`. */
    objects: Map<string, BrioObject2D>;
    /** Registry of active `BrioObject3D` entities keyed by `name`. */
    objects3d: BrioRegistry<BrioObject3D>;
    /** Map of preloaded `BrioSprite` assets keyed by `name`. */
    sprites: Map<string, BrioSprite>;
    /** Map of preloaded `BrioAudio` assets keyed by `name`. */
    audios: Map<string, BrioAudio>;
    /** Map of preloaded `BrioModel` 3D model assets keyed by `name`. */
    models: Map<string, BrioModel>;
    /** Map of registered `BrioMesh` geometries keyed by `name` (from models or preloaded directly). */
    meshes: Map<string, BrioMesh>;
    /** Map of registered `BrioMaterial` surfaces keyed by `name` (from models or preloaded directly). */
    materials: Map<string, BrioMaterial>;
    /** Map of loaded `BrioTileMap` instances keyed by `name`. */
    tileMaps: Map<string, BrioTileMap>;
    /** Registry of `BrioCamera2D` instances keyed by `name`. */
    cameras2D: BrioRegistry<BrioCamera2D>;
    /** Registry of `BrioCamera3D` instances keyed by `name`. */
    cameras3D: BrioRegistry<BrioCamera3D>;
    /** Map of preloaded `BrioAtlas` texture atlases keyed by `name`. */
    atlases: Map<string, BrioAtlas>;
}

/**
 * Central in-memory registry for all preloaded assets (`sprites`, `audios`, `atlases`, `models`, `meshes`, `materials`)
 * and active scene content (`objects`, `objects3d`, `tileMaps`, `cameras2D`, `cameras3D`).
 *
 * @example
 * ```ts
 * const manager = new BrioAssetManager();
 * manager.sprites.set(sprPlayer.name, sprPlayer);
 * manager.models.set(modShip.name, modShip);
 * ```
 */
export class BrioAssetManager implements BrioAssets {
    readonly #objects = new Map<string, BrioObject2D>();
    readonly #objects3d = new BrioRegistry<BrioObject3D>();
    readonly #sprites = new Map<string, BrioSprite>();
    readonly #audios = new Map<string, BrioAudio>();
    readonly #models = new Map<string, BrioModel>();
    readonly #meshes = new Map<string, BrioMesh>();
    readonly #materials = new Map<string, BrioMaterial>();
    readonly #tileMaps = new Map<string, BrioTileMap>();
    readonly #cameras2D = new BrioRegistry<BrioCamera2D>();
    readonly #cameras3D = new BrioRegistry<BrioCamera3D>();
    readonly #atlases = new Map<string, BrioAtlas>();

    /** Map of active `BrioObject2D` entities keyed by `name`. */
    public get objects(): Map<string, BrioObject2D> {
        return this.#objects;
    }

    /** Registry of active `BrioObject3D` entities keyed by `name`. */
    public get objects3d(): BrioRegistry<BrioObject3D> {
        return this.#objects3d;
    }

    /** Map of preloaded `BrioSprite` assets keyed by `name`. */
    public get sprites(): Map<string, BrioSprite> {
        return this.#sprites;
    }

    /** Map of preloaded `BrioAudio` assets keyed by `name`. */
    public get audios(): Map<string, BrioAudio> {
        return this.#audios;
    }

    /** Map of preloaded `BrioModel` 3D model assets keyed by `name`. */
    public get models(): Map<string, BrioModel> {
        return this.#models;
    }

    /** Map of registered `BrioMesh` geometries keyed by `name`. */
    public get meshes(): Map<string, BrioMesh> {
        return this.#meshes;
    }

    /** Map of registered `BrioMaterial` surfaces keyed by `name`. */
    public get materials(): Map<string, BrioMaterial> {
        return this.#materials;
    }

    /** Map of loaded `BrioTileMap` instances keyed by `name`. */
    public get tileMaps(): Map<string, BrioTileMap> {
        return this.#tileMaps;
    }

    /** Registry of `BrioCamera2D` instances keyed by `name`. */
    public get cameras2D(): BrioRegistry<BrioCamera2D> {
        return this.#cameras2D;
    }

    /** Registry of `BrioCamera3D` instances keyed by `name`. */
    public get cameras3D(): BrioRegistry<BrioCamera3D> {
        return this.#cameras3D;
    }

    /** Map of preloaded `BrioAtlas` texture atlases keyed by `name`. */
    public get atlases(): Map<string, BrioAtlas> {
        return this.#atlases;
    }
}
