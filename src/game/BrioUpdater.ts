// -> Used in the "update" step method, in the param of the callbackFn

import { BrioAudio } from "../assets/BrioAudio";
import { BrioSprite } from "../assets/BrioSprite";
import { BrioConsole } from "../debugging/BrioConsole";
import { BrioCamera } from "../not-implemented/BrioCamera";
import { BrioMap } from "../not-implemented/BrioMap";
import { BrioObject } from "../objects/BrioObject";
import { BrioAssetManager } from "./BrioAssetManager";
import { GameState } from "./BrioGame";
import { BrioSpriteRenderer } from "./BrioSpriteRenderer";

/** An interface for the updater object used as a parameter for callbackFn in the update step */
export interface UpdaterObjectParam {
    // -> object loader
    /** Logs the available objects that were loaded */
    logObjectKeys: () => void;
    /** Returns the BrioSprite object with the given name */
    getSprite: (spriteName: string) => BrioSprite;
    /** Returns the BrioAudio object with the given name */
    getAudio: (audioName: string) => BrioAudio;
    /** Returns the BrioObject with the given name */
    getObject: <T extends BrioObject>(gameObjectName: string) => T;
    /** Returns the GameMap with the given name */
    getMap: (mapName: string) => BrioMap;
    /** Returns the GameCamera with the given name */
    // getCamera: (cameraName: string) => BrioCamera;

    // -> render functions
    /** Animates a given named game object and its properties */
    animateFromName: (gameObjectName: string) => void;
    /** Animates the given game object */
    animate: <T extends BrioObject>(object: T | string) => void;
    /** Animates instances of a given array of game objects */
    animateMany: (gameObjects: BrioObject[]) => void;
    /** Animates clone instances of a object whiout animating the original object */
    animateInstancesOf: <T extends BrioObject>(gameObject: T | string) => void;

    /** Runs only once time the logic inside the block code */
    // runOnce: (identifier: string, callbackFn: () => void) => void;

    /** Returns true if the update loop is running and false if it is paused */
    // isRunning: boolean;
    /** Pauses the update animation loop, essencialy freezing the game */
    // pause: () => void;
    /** Resumes the update animation loop */
    // resume: () => void;
    // endgame: () => void;
}

export class BrioUpdater implements UpdaterObjectParam {
    #assets: BrioAssetManager;
    #console: BrioConsole;
    #render: BrioSpriteRenderer;

    #isUpdating: boolean = true;

    constructor(assets: BrioAssetManager, render: BrioSpriteRenderer, console: BrioConsole) {
        this.#assets = assets;
        this.#render = render;
        this.#console = console;
    }

    logObjectKeys() {
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
    getSprite(spriteName: string) {
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

        if (this.#assets.sprites.has(spriteName)) {
            const spr = this.#assets.sprites.get(spriteName);
            if (spr !== undefined) {
                return spr;
            }
        }

        return BrioSprite.getEmptyInstance();
    }
    getAudio(audioName: string) {
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

        if (this.#assets.audios.has(audioName)) {
            const aud = this.#assets.audios.get(audioName);
            if (aud !== undefined) {
                return aud;
            }
        }

        return BrioAudio.getEmptyInstance();
    }
    getObject<T extends BrioObject>(gameObjectName: string) {
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

        if (this.#assets.objects.has(gameObjectName)) {
            const obj = this.#assets.objects.get(gameObjectName);
            if (obj) return obj as T;
        }

        return BrioObject.getEmptyInstance() as T;
    }
    getMap(gameMapName: string) {
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

        if (this.#assets.maps.has(gameMapName)) {
            const map = this.#assets.maps.get(gameMapName);
            if (map !== undefined) {
                return map;
            }
        }

        return BrioMap.getEmptyInstance();
    }
    animateFromName(gameObjectName: string) {
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
        if (this.#assets.objects.has(gameObjectName)) {
            const gameObject = this.#assets.objects.get(gameObjectName);

            if (gameObject) {
                this.#render.renderObject(gameObject);
            }
        }
    }
    animate<T extends BrioObject>(gameObject: string | T) {
        if (!gameObject) return;

        const isBrioObjectLike = gameObject instanceof BrioObject;
        const gameObjectName = isBrioObjectLike ? gameObject.name : gameObject;

        const object = this.#assets.objects.get(gameObjectName);
        if (object) this.#render.renderObject(object);
    }
    animateMany(gameObjects: BrioObject[]) {
        if (!gameObjects) return;

        for (let i = 0; i < gameObjects.length; i++) {
            if (this.#assets.objects.has(gameObjects[i].name)) {
                const gameObject = this.#assets.objects.get(gameObjects[i].name);

                if (gameObject) {
                    this.#render.renderObject(gameObject);
                }
            }
        }
    }
    animateInstancesOf<T extends BrioObject>(gameObject: string | T) {
        if (!gameObject) return;

        const isBrioObjectLike = gameObject instanceof BrioObject;
        const gameObjectName = isBrioObjectLike ? gameObject.name : gameObject;

        const object = this.#assets.objects.get(gameObjectName);

        if (object && object.clonesInstantiatedValue > 0) {
            for (let i = 1; i <= object.clonesInstantiatedValue; ++i) {
                this.animate(`${object.name}-${i}`);
            }
        }
    }

    // runOnce(identifier: string, callbackFn: () => void) {}
    // pause() {}
    // resume() {}

    // runOnce(identifier, callbackFn) {
    //     if (!this.#updaterRunOnceKeys.has(identifier)) {
    //         callbackFn();
    //         this.#console.out("info", `Runned once with the ID: ${identifier}.`);

    //         this.#updaterRunOnceKeys.add(identifier);
    //     }
    // }
    // pause() {
    //     if (this.#isUpdating) {
    //         this.#currentState = GameState.UNSET;
    //         this.#isUpdating = false;
    //         this.#console.out("info", "Game stopped!");
    //         cancelAnimationFrame(this.#updateFrameId);
    //     }
    // }
    // resume() {
    //     if (!this.#isUpdating) {
    //         this.#currentState = GameState.UPDATE;
    //         this.#isUpdating = true;
    //         this.#console.out("info", "Game resumed!");
    //         if (this.#updateLoopLogic) {
    //             requestAnimationFrame(this.#updateLoopLogic);
    //         }
    //     }
    // }
    // endgame() {}
}
