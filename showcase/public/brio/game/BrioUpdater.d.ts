import { BrioAudio } from "../assets/BrioAudio.js";
import { BrioSprite } from "../assets/BrioSprite.js";
import { BrioConsole } from "../debugging/BrioConsole.js";
import { BrioMap } from "../not-implemented/BrioMap.js";
import { BrioObject } from "../objects/BrioObject.js";
import { BrioAssetManager } from "./BrioAssetManager.js";
import { BrioSpriteRenderer } from "./BrioSpriteRenderer.js";
/** An interface for the updater object used as a parameter for callbackFn in the update step */
export interface UpdaterObjectParam {
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
    /** Animates a given named game object and its properties */
    animateFromName: (gameObjectName: string) => void;
    /** Animates the given game object */
    animate: <T extends BrioObject>(object: T | string) => void;
    /** Animates instances of a given array of game objects */
    animateMany: (gameObjects: BrioObject[]) => void;
    /** Animates clone instances of a object whiout animating the original object */
    animateInstancesOf: <T extends BrioObject>(gameObject: T | string) => void;
}
export declare class BrioUpdater implements UpdaterObjectParam {
    #private;
    constructor(assets: BrioAssetManager, render: BrioSpriteRenderer, console: BrioConsole);
    logObjectKeys(): void;
    getSprite(spriteName: string): BrioSprite;
    getAudio(audioName: string): BrioAudio;
    getObject<T extends BrioObject>(gameObjectName: string): T;
    getMap(gameMapName: string): BrioMap;
    animateFromName(gameObjectName: string): void;
    animate<T extends BrioObject>(gameObject: string | T): void;
    animateMany(gameObjects: BrioObject[]): void;
    animateInstancesOf<T extends BrioObject>(gameObject: string | T): void;
}
//# sourceMappingURL=BrioUpdater.d.ts.map
