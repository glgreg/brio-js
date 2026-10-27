import { BrioAtlas } from "../assets/BrioAtlas";
import { BrioAudio } from "../assets/BrioAudio";
import { BrioSprite } from "../assets/BrioSprite";
import { BrioModel } from "../assets/BrioModel";
import { BrioConsole } from "../debugging/BrioConsole";
import { BrioTileMap } from "../assets/BrioTileMap";
import { BrioCamera2D } from "../cameras/BrioCamera2D";
import { BrioCamera3D } from "../cameras/BrioCamera3D";
import { BrioObject2D } from "../objects/BrioObject2D";
import { BrioObject3D } from "../objects/BrioObject3D";
import { BrioAssetManager } from "./BrioAssetManager";
import { BrioSpriteRenderer } from "./BrioSpriteRenderer";

/**
 * Contract for the `updater` parameter passed into `game.update((updater, dt) => { ... })`.
 */
export interface UpdaterObjectParam {
    /** Logs the keys of all currently loaded game objects, tile maps, and cameras to `BrioConsole`. */
    logObjectKeys: () => void;
    /** Retrieves a preloaded `BrioSprite` by its unique `spriteName`, or an empty fallback instance if not found. */
    getSprite: (spriteName: string) => BrioSprite;
    /** Retrieves a preloaded `BrioAudio` by its unique `audioName`, or an empty fallback instance if not found. */
    getAudio: (audioName: string) => BrioAudio;
    /** Retrieves a preloaded `BrioAtlas` by its unique `atlasName`, or `undefined` if not found. */
    getAtlas: (atlasName: string) => BrioAtlas | undefined;
    /** Retrieves a preloaded `BrioModel` by its unique `modelName`, or an empty fallback instance if not found. */
    getModel: (modelName: string) => BrioModel;
    /** Retrieves a loaded `BrioObject2D` (or subclass `T`) by its unique `gameObjectName`, or an empty fallback instance if not found. */
    getObject: <T extends BrioObject2D>(gameObjectName: string) => T;
    /** Retrieves a loaded `BrioObject3D` by its unique `gameObjectName`, or an empty fallback instance if not found. */
    getObject3D: (gameObjectName: string) => BrioObject3D;
    /** Retrieves a loaded `BrioTileMap` by its unique `tileMapName`, or `undefined` if not found. */
    getTileMap: (tileMapName: string) => BrioTileMap | undefined;
    /** Retrieves a registered `BrioCamera2D` by its unique `cameraName`, or an empty fallback instance if not found. */
    getCamera2D: (cameraName: string) => BrioCamera2D;
    /** Retrieves a registered `BrioCamera3D` by its unique `cameraName`, or `undefined` if not found. */
    getCamera3D: (cameraName: string) => BrioCamera3D | undefined;
}

/**
 * Context helper passed to the `game.update((updater, dt) => ...)` callback on every frame.
 * Provides safe, deduplicated-error access to loaded `BrioObject2D`, `BrioSprite`, `BrioAudio`, `BrioAtlas`, `BrioTileMap`, `BrioCamera2D`, and `BrioCamera3D` instances.
 *
 * @example
 * ```ts
 * game.update((updater, dt) => {
 *     const player = updater.getObject<Player>("obj_player");
 *     player.transform.position.x += 200 * dt;
 * });
 * ```
 */
export class BrioUpdater implements UpdaterObjectParam {
    #assets: BrioAssetManager;
    #console: BrioConsole;

    /**
     * Creates a new `BrioUpdater` instance.
     *
     * @param assets Central `BrioAssetManager` registry
     * @param render `BrioSpriteRenderer` instance
     * @param console `BrioConsole` instance for deduplicated lookup error reporting
     */
    constructor(assets: BrioAssetManager, render: BrioSpriteRenderer, console: BrioConsole) {
        this.#assets = assets;
        void render;
        this.#console = console;
    }

    /**
     * Logs the names of all currently loaded `BrioObject2D`, `BrioTileMap`, and camera instances to `BrioConsole`.
     *
     * @example
     * ```ts
     * updater.logObjectKeys();
     * ```
     */
    public logObjectKeys(): void {
        let loadedObjects: string = "";
        let loadedCameras: string = "";
        let loadedMaps: string = "";

        this.#assets.objects.forEach((_, key) => {
            loadedObjects += key + "\n";
        });
        this.#assets.cameras2D.map.forEach((_, key) => {
            loadedCameras += key + "\n";
        });
        this.#assets.cameras3D.map.forEach((_, key) => {
            loadedCameras += key + "\n";
        });
        this.#assets.tileMaps.forEach((_, key) => {
            loadedMaps += key + "\n";
        });

        loadedObjects = loadedObjects.slice(0, -1);
        loadedCameras = loadedCameras.slice(0, -1);
        loadedMaps = loadedMaps.slice(0, -1);

        this.#console.out("info", `Currently loaded game objects: \n\n${loadedObjects}`);
        this.#console.out("info", `Currently loaded tile maps: \n\n${loadedMaps}`);
        this.#console.out("info", `Currently loaded game cameras: \n\n${loadedCameras}`);
    }

    /**
     * Retrieves a preloaded `BrioSprite` by its `spriteName`.
     * If not found, logs a deduplicated error once and returns `BrioSprite.getEmptyInstance()`.
     *
     * @param spriteName Unique identifier of the sprite
     * @returns Matching `BrioSprite` or the empty fallback instance
     * @example
     * ```ts
     * const spr = updater.getSprite("spr_player");
     * ```
     */
    public getSprite(spriteName: string): BrioSprite {
        if (
            !this.#assets.sprites.has(spriteName) &&
            !this.#console.loggedErrors.has(`loadError: ${spriteName}`)
        ) {
            this.#console.out(
                "error",
                `Named sprite asset '${spriteName}' was not found in the preloaded resources, check if you preloaded it correctly and gave it the right name.`,
            );
            this.#console.loggedErrors.add(`loadError: ${spriteName}`);
        }

        const spr = this.#assets.sprites.get(spriteName);
        if (spr !== undefined) {
            return spr;
        }

        return BrioSprite.getEmptyInstance();
    }

    /**
     * Retrieves a preloaded `BrioAudio` by its `audioName`.
     * If not found, logs a deduplicated error once and returns `BrioAudio.getEmptyInstance()`.
     *
     * @param audioName Unique identifier of the audio asset
     * @returns Matching `BrioAudio` or the empty fallback instance
     * @example
     * ```ts
     * const sfx = updater.getAudio("aud_projectile");
     * sfx.play();
     * ```
     */
    public getAudio(audioName: string): BrioAudio {
        if (
            !this.#assets.audios.has(audioName) &&
            !this.#console.loggedErrors.has(`loadError: ${audioName}`)
        ) {
            this.#console.out(
                "error",
                `Named audio asset '${audioName}' was not found in the preloaded resources, check if you preloaded it correctly and gave it the right name.`,
            );
            this.#console.loggedErrors.add(`loadError: ${audioName}`);
        }

        const aud = this.#assets.audios.get(audioName);
        if (aud !== undefined) {
            return aud;
        }

        return BrioAudio.getEmptyInstance();
    }

    /**
     * Retrieves a preloaded `BrioAtlas` by its `atlasName`.
     * If not found, logs a deduplicated error once and returns `undefined`.
     *
     * @param atlasName Unique identifier of the texture atlas
     * @returns Matching `BrioAtlas` or `undefined`
     * @example
     * ```ts
     * const atlas = updater.getAtlas("world_atlas");
     * ```
     */
    public getAtlas(atlasName: string): BrioAtlas | undefined {
        if (
            !this.#assets.atlases.has(atlasName) &&
            !this.#console.loggedErrors.has(`loadError: ${atlasName}`)
        ) {
            this.#console.out(
                "error",
                `Named atlas asset '${atlasName}' was not found in the preloaded resources, check if you preloaded it correctly and gave it the right name.`,
            );
            this.#console.loggedErrors.add(`loadError: ${atlasName}`);
        }

        return this.#assets.atlases.get(atlasName);
    }

    /**
     * Retrieves a loaded `BrioObject2D` (or subclass `T`) by its `gameObjectName`.
     * If not found, logs a deduplicated error once and returns `BrioObject2D.getEmptyInstance()`.
     *
     * @param gameObjectName Unique identifier of the game object
     * @returns Matching `BrioObject2D` cast to `T`, or the empty fallback instance
     * @example
     * ```ts
     * const player = updater.getObject<Player>("obj_player");
     * ```
     */
    public getObject<T extends BrioObject2D>(gameObjectName: string): T {
        if (
            !this.#assets.objects.has(gameObjectName) &&
            !this.#console.loggedErrors.has(`loadError: ${gameObjectName}`)
        ) {
            this.#console.out(
                "error",
                `Named game object '${gameObjectName}' was not found in the loaded resources, check if you loaded it correctly and gave it the right name.`,
            );
            this.#console.loggedErrors.add(`loadError: ${gameObjectName}`);
        }

        const obj = this.#assets.objects.get(gameObjectName);
        if (obj) return obj as T;

        return BrioObject2D.getEmptyInstance() as T;
    }

    /**
     * Retrieves a loaded `BrioObject3D` by its `gameObjectName`.
     * If not found, logs a deduplicated error once and returns `BrioObject3D.getEmptyInstance()`.
     *
     * @param gameObjectName Unique identifier of the 3D game object
     * @returns Matching `BrioObject3D` or the empty fallback instance
     * @example
     * ```ts
     * const ship = updater.getObject3D("obj_ship");
     * ship.transform.position.z -= 10 * dt;
     * ```
     */
    public getObject3D(gameObjectName: string): BrioObject3D {
        if (
            !this.#assets.objects3d.has(gameObjectName) &&
            !this.#console.loggedErrors.has(`loadError: ${gameObjectName}`)
        ) {
            this.#console.out(
                "error",
                `Named 3D game object '${gameObjectName}' was not found in the loaded resources, check if you loaded it correctly and gave it the right name.`,
            );
            this.#console.loggedErrors.add(`loadError: ${gameObjectName}`);
        }

        const obj = this.#assets.objects3d.get(gameObjectName);
        if (obj) return obj;

        return BrioObject3D.getEmptyInstance();
    }

    /**
     * Retrieves a preloaded `BrioModel` by its `modelName`.
     * If not found, logs a deduplicated error once and returns `BrioModel.getEmptyInstance()`.
     *
     * @param modelName Unique identifier of the 3D model asset
     * @returns Matching `BrioModel` or the empty fallback instance
     * @example
     * ```ts
     * const model = updater.getModel("mod_ship");
     * ```
     */
    public getModel(modelName: string): BrioModel {
        if (
            !this.#assets.models.has(modelName) &&
            !this.#console.loggedErrors.has(`loadError: ${modelName}`)
        ) {
            this.#console.out(
                "error",
                `Named model asset '${modelName}' was not found in the preloaded resources, check if you preloaded it correctly and gave it the right name.`,
            );
            this.#console.loggedErrors.add(`loadError: ${modelName}`);
        }

        const model = this.#assets.models.get(modelName);
        if (model !== undefined) {
            return model;
        }

        return BrioModel.getEmptyInstance();
    }

    /**
     * Retrieves a loaded `BrioTileMap` by its `tileMapName`.
     * If not found, logs a deduplicated error once and returns `undefined`.
     *
     * @param tileMapName Unique identifier of the tile map
     * @returns Matching `BrioTileMap` or `undefined`
     * @example
     * ```ts
     * const level = updater.getTileMap("map_level_1");
     * ```
     */
    public getTileMap(tileMapName: string): BrioTileMap | undefined {
        const map = this.#assets.tileMaps.get(tileMapName);
        if (!map) this.#reportMissing("tile map", tileMapName);
        return map;
    }

    /**
     * Retrieves a registered `BrioCamera2D` by its `cameraName`.
     * If not found, logs a deduplicated error once and returns `BrioCamera2D.getEmptyInstance()`.
     *
     * @param cameraName Unique identifier of the camera
     * @returns Matching `BrioCamera2D` or the empty fallback instance
     * @example
     * ```ts
     * const cam = updater.getCamera2D("cam_p1");
     * ```
     */
    public getCamera2D(cameraName: string): BrioCamera2D {
        const cam = this.#assets.cameras2D.get(cameraName);
        if (cam) return cam;
        this.#reportMissing("2D camera", cameraName);
        return BrioCamera2D.getEmptyInstance();
    }

    /**
     * Retrieves a registered `BrioCamera3D` by its `cameraName`.
     * If not found, logs a deduplicated error once and returns `undefined`.
     *
     * @param cameraName Unique identifier of the camera
     * @returns Matching `BrioCamera3D` or `undefined`
     * @example
     * ```ts
     * const cam = updater.getCamera3D("cam_minimap");
     * ```
     */
    public getCamera3D(cameraName: string): BrioCamera3D | undefined {
        const cam = this.#assets.cameras3D.get(cameraName);
        if (!cam) this.#reportMissing("3D camera", cameraName);
        return cam;
    }

    #reportMissing(kind: string, name: string): void {
        const key = `loadError: ${name}`;
        if (this.#console.loggedErrors.has(key)) return;
        this.#console.out(
            "error",
            `Named ${kind} '${name}' was not found in the loaded resources, check if you loaded it correctly and gave it the right name.`,
        );
        this.#console.loggedErrors.add(key);
    }
}
