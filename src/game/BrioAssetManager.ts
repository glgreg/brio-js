import { BrioAudio } from "../assets/BrioAudio";
import { BrioSprite } from "../assets/BrioSprite";
import { BrioAtlas } from "../assets/BrioAtlas";
import { BrioCamera } from "../not-implemented/BrioCamera";
import { BrioMap } from "../not-implemented/BrioMap";
import { BrioScene } from "../not-implemented/BrioScene";
import { BrioObject } from "../objects/BrioObject";

/**
 * Contract describing the central asset and entity registries managed by `BrioGame`.
 */
export interface BrioAssets {
    /** Map of active `BrioObject` entities keyed by `name`. */
    objects: Map<string, BrioObject>;
    /** Map of preloaded `BrioSprite` assets keyed by `name`. */
    sprites: Map<string, BrioSprite>;
    /** Map of preloaded `BrioAudio` assets keyed by `name`. */
    audios: Map<string, BrioAudio>;
    /** Map of loaded `BrioMap` instances keyed by `name`. */
    maps: Map<string, BrioMap>;
    /** Map of loaded `BrioCamera` instances keyed by `name`. */
    cameras: Map<string, BrioCamera>;
    /** Map of registered `BrioScene` instances keyed by `name`. */
    scenes: Map<string, BrioScene>;
    /** Map of preloaded `BrioAtlas` texture atlases keyed by `name`. */
    atlases: Map<string, BrioAtlas>;
}

/**
 * Central in-memory registry for all preloaded assets (`sprites`, `audios`, `atlases`)
 * and active scene objects (`objects`, `maps`, `cameras`, `scenes`).
 *
 * @example
 * ```ts
 * const manager = new BrioAssetManager();
 * manager.sprites.set(sprPlayer.name, sprPlayer);
 * ```
 */
export class BrioAssetManager implements BrioAssets {
    #objects = new Map<string, BrioObject>();
    #sprites = new Map<string, BrioSprite>();
    #audios = new Map<string, BrioAudio>();
    #maps = new Map<string, BrioMap>();
    #cameras = new Map<string, BrioCamera>();
    #scenes = new Map<string, BrioScene>();
    #atlases = new Map<string, BrioAtlas>();

    /** Map of active `BrioObject` entities keyed by `name`. */
    public get objects(): Map<string, BrioObject> {
        return this.#objects;
    }

    /** Map of preloaded `BrioSprite` assets keyed by `name`. */
    public get sprites(): Map<string, BrioSprite> {
        return this.#sprites;
    }

    /** Map of preloaded `BrioAudio` assets keyed by `name`. */
    public get audios(): Map<string, BrioAudio> {
        return this.#audios;
    }

    /** Map of loaded `BrioMap` instances keyed by `name`. */
    public get maps(): Map<string, BrioMap> {
        return this.#maps;
    }

    /** Map of loaded `BrioCamera` instances keyed by `name`. */
    public get cameras(): Map<string, BrioCamera> {
        return this.#cameras;
    }

    /** Map of registered `BrioScene` instances keyed by `name`. */
    public get scenes(): Map<string, BrioScene> {
        return this.#scenes;
    }

    /** Map of preloaded `BrioAtlas` texture atlases keyed by `name`. */
    public get atlases(): Map<string, BrioAtlas> {
        return this.#atlases;
    }
}

