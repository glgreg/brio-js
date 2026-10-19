import { BrioAtlas } from "../assets/BrioAtlas";
import { BrioAudio } from "../assets/BrioAudio";
import { BrioSprite } from "../assets/BrioSprite";
import { BrioModel } from "../assets/BrioModel";
import { BrioConsole } from "../debugging/BrioConsole";
import { BrioCamera } from "../not-implemented/BrioCamera";
import { BrioMap } from "../not-implemented/BrioMap";
import { BrioObject } from "../objects/BrioObject";
import { BrioObject3D } from "../objects/BrioObject3D";
import { BrioAssetManager } from "./BrioAssetManager";
import { BrioSpriteRenderer } from "./BrioSpriteRenderer";

/**
 * Contract for the `updater` parameter passed into `game.update((updater, dt) => { ... })`.
 */
export interface UpdaterObjectParam {
    /** Logs the keys of all currently loaded game objects, maps, cameras, and models to `BrioConsole`. */
    logObjectKeys: () => void;
    /** Retrieves a preloaded `BrioSprite` by its unique `spriteName`, or an empty fallback instance if not found. */
    getSprite: (spriteName: string) => BrioSprite;
    /** Retrieves a preloaded `BrioAudio` by its unique `audioName`, or an empty fallback instance if not found. */
    getAudio: (audioName: string) => BrioAudio;
    /** Retrieves a preloaded `BrioAtlas` by its unique `atlasName`, or `undefined` if not found. */
    getAtlas: (atlasName: string) => BrioAtlas | undefined;
    /** Retrieves a preloaded `BrioModel` by its unique `modelName`, or an empty fallback instance if not found. */
    getModel: (modelName: string) => BrioModel;
    /** Retrieves a loaded `BrioObject` (or subclass `T`) by its unique `gameObjectName`, or an empty fallback instance if not found. */
    getObject: <T extends BrioObject>(gameObjectName: string) => T;
    /** Retrieves a loaded `BrioObject3D` by its unique `gameObjectName`, or an empty fallback instance if not found. */
    getObject3D: (gameObjectName: string) => BrioObject3D;
    /** Retrieves a loaded `BrioMap` by its unique `mapName`, or an empty fallback instance if not found. */
    getMap: (mapName: string) => BrioMap;
    /** Retrieves a loaded `BrioCamera` by its unique `cameraName`, or an empty fallback instance if not found. */
    getCamera: (cameraName: string) => BrioCamera;
}

/**
 * Context helper passed to the `game.update((updater, dt) => ...)` callback on every frame.
 * Provides safe, deduplicated-error access to loaded `BrioObject`, `BrioSprite`, `BrioAudio`, `BrioAtlas`, `BrioMap`, and `BrioCamera` instances.
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
     * Logs the names of all currently loaded `BrioObject`, `BrioMap`, and `BrioCamera` instances to `BrioConsole`.
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
        this.#assets.cameras.forEach((_, key) => {
            loadedCameras += key + "\n";
        });
        this.#assets.maps.forEach((_, key) => {
            loadedMaps += key + "\n";
        });

        loadedObjects = loadedObjects.slice(0, -1);
        loadedCameras = loadedCameras.slice(0, -1);
        loadedMaps = loadedMaps.slice(0, -1);

        this.#console.out("info", `Currently loaded game objects: \n\n${loadedObjects}`);
        this.#console.out("info", `Currently loaded game maps: \n\n${loadedMaps}`);
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
     * Retrieves a loaded `BrioObject` (or subclass `T`) by its `gameObjectName`.
     * If not found, logs a deduplicated error once and returns `BrioObject.getEmptyInstance()`.
     *
     * @param gameObjectName Unique identifier of the game object
     * @returns Matching `BrioObject` cast to `T`, or the empty fallback instance
     * @example
     * ```ts
     * const player = updater.getObject<Player>("obj_player");
     * ```
     */
    public getObject<T extends BrioObject>(gameObjectName: string): T {
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

        return BrioObject.getEmptyInstance() as T;
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
     * Retrieves a loaded `BrioMap` by its `gameMapName`.
     * If not found, logs a deduplicated error once and returns `BrioMap.getEmptyInstance()`.
     *
     * @param gameMapName Unique identifier of the map
     * @returns Matching `BrioMap` or the empty fallback instance
     * @example
     * ```ts
     * const map = updater.getMap("map_level_1");
     * ```
     */
    public getMap(gameMapName: string): BrioMap {
        if (
            !this.#assets.maps.has(gameMapName) &&
            !this.#console.loggedErrors.has(`loadError: ${gameMapName}`)
        ) {
            this.#console.out(
                "error",
                `Named game map '${gameMapName}' was not found in the loaded resources, check if you loaded it correctly and gave it the right name.`,
            );
            this.#console.loggedErrors.add(`loadError: ${gameMapName}`);
        }

        const map = this.#assets.maps.get(gameMapName);
        if (map !== undefined) {
            return map;
        }

        return BrioMap.getEmptyInstance();
    }

    /**
     * Retrieves a loaded `BrioCamera` by its `cameraName`.
     * If not found, logs a deduplicated error once and returns `BrioCamera.getEmptyInstance()`.
     *
     * @param cameraName Unique identifier of the camera
     * @returns Matching `BrioCamera` or the empty fallback instance
     * @example
     * ```ts
     * const cam = updater.getCamera("cam_main");
     * ```
     */
    public getCamera(cameraName: string): BrioCamera {
        if (
            !this.#assets.cameras.has(cameraName) &&
            !this.#console.loggedErrors.has(`loadError: ${cameraName}`)
        ) {
            this.#console.out(
                "error",
                `Named game camera '${cameraName}' was not found in the loaded resources, check if you loaded it correctly and gave it the right name.`,
            );
            this.#console.loggedErrors.add(`loadError: ${cameraName}`);
        }

        const cam = this.#assets.cameras.get(cameraName);
        if (cam !== undefined) {
            return cam;
        }

        return BrioCamera.getEmptyInstance();
    }
}

