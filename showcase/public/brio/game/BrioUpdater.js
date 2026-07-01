// -> Used in the "update" step method, in the param of the callbackFn
import { BrioAudio } from "../assets/BrioAudio.js";
import { BrioSprite } from "../assets/BrioSprite.js";
import { BrioMap } from "../not-implemented/BrioMap.js";
import { BrioObject } from "../objects/BrioObject.js";
export class BrioUpdater {
    #assets;
    #console;
    #render;
    #isUpdating = true;
    constructor(assets, render, console) {
        this.#assets = assets;
        this.#render = render;
        this.#console = console;
    }
    logObjectKeys() {
        let loadedObjects = "";
        let loadedCameras = "";
        let loadedMaps = "";
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
    getSprite(spriteName) {
        if (!this.#assets.sprites.has(spriteName) &&
            !this.#console.loggedErrors.has(`loadError: ${spriteName}`)) {
            this.#console.out("error", `Named sprite asset '${spriteName}' was not found in the preloaded resources, check if you preloaded it correctly and gave it the right name.`);
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
    getAudio(audioName) {
        if (!this.#assets.audios.has(audioName) &&
            !this.#console.loggedErrors.has(`loadError: ${audioName}`)) {
            this.#console.out("error", `Named audio asset '${audioName}' was not found in the preloaded resources, check if you preloaded it correctly and gave it the right name.`);
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
    getObject(gameObjectName) {
        if (!this.#assets.objects.has(gameObjectName) &&
            !this.#console.loggedErrors.has(`loadError: ${gameObjectName}`)) {
            this.#console.out("error", `Named game object '${gameObjectName}' was not found in the loaded resources, check if you loaded it correctly and gave it the right name.`);
            this.#console.loggedErrors.add(`loadError: ${gameObjectName}`);
        }
        if (this.#assets.objects.has(gameObjectName)) {
            const obj = this.#assets.objects.get(gameObjectName);
            if (obj)
                return obj;
        }
        return BrioObject.getEmptyInstance();
    }
    getMap(gameMapName) {
        if (!this.#assets.maps.has(gameMapName) &&
            !this.#console.loggedErrors.has(`loadError: ${gameMapName}`)) {
            this.#console.out("error", `Named game map '${gameMapName}' was not found in the loaded resources, check if you loaded it correctly and gave it the right name.`);
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
    animateFromName(gameObjectName) {
        if (!this.#assets.objects.has(gameObjectName) &&
            !this.#console.loggedErrors.has(`loadError: ${gameObjectName}`)) {
            this.#console.out("error", `Named game object '${gameObjectName}' was not found in the loaded resources, check if you loaded it correctly and gave it the right name.`);
            this.#console.loggedErrors.add(`loadError: ${gameObjectName}`);
        }
        if (this.#assets.objects.has(gameObjectName)) {
            const gameObject = this.#assets.objects.get(gameObjectName);
            if (gameObject) {
                this.#render.renderObject(gameObject);
            }
        }
    }
    animate(gameObject) {
        if (!gameObject)
            return;
        const isBrioObjectLike = gameObject instanceof BrioObject;
        const gameObjectName = isBrioObjectLike ? gameObject.name : gameObject;
        const object = this.#assets.objects.get(gameObjectName);
        if (object)
            this.#render.renderObject(object);
    }
    animateMany(gameObjects) {
        if (!gameObjects)
            return;
        for (let i = 0; i < gameObjects.length; i++) {
            if (this.#assets.objects.has(gameObjects[i].name)) {
                const gameObject = this.#assets.objects.get(gameObjects[i].name);
                if (gameObject) {
                    this.#render.renderObject(gameObject);
                }
            }
        }
    }
    animateInstancesOf(gameObject) {
        if (!gameObject)
            return;
        const isBrioObjectLike = gameObject instanceof BrioObject;
        const gameObjectName = isBrioObjectLike ? gameObject.name : gameObject;
        const object = this.#assets.objects.get(gameObjectName);
        if (object && object.clonesInstantiatedValue > 0) {
            for (let i = 1; i <= object.clonesInstantiatedValue; ++i) {
                this.animate(`${object.name}-${i}`);
            }
        }
    }
}
