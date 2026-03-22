import { BrioAudio } from "../assets/BrioAudio";
import { BrioSprite } from "../assets/BrioSprite";
import { BrioAtlas } from "../assets/BrioAtlas";
import { BrioCamera } from "../not-implemented/BrioCamera";
import { BrioMap } from "../not-implemented/BrioMap";
import { BrioScene } from "../not-implemented/BrioScene";
import { BrioObject } from "../objects/BrioObject";

interface BrioAssets {
    objects: Map<string, BrioObject>;
    sprites: Map<string, BrioSprite>;
    audios: Map<string, BrioAudio>;
    maps: Map<string, BrioMap>;
    cameras: Map<string, BrioCamera>;
    scenes: Map<string, BrioScene>;
    spritesheets: Map<string, BrioAtlas>;
}

export class BrioAssetManager implements BrioAssets {
    #objects = new Map<string, BrioObject>();
    #sprites = new Map<string, BrioSprite>();
    #audios = new Map<string, BrioAudio>();

    #maps = new Map<string, BrioMap>();
    #cameras = new Map<string, BrioCamera>();
    #scenes = new Map<string, BrioScene>();
    #spritesheet = new Map<string, BrioAtlas>();

    public get objects() {
        return this.#objects;
    }
    public get sprites() {
        return this.#sprites;
    }
    public get audios() {
        return this.#audios;
    }
    public get maps() {
        return this.#maps;
    }
    public get cameras() {
        return this.#cameras;
    }
    public get scenes() {
        return this.#scenes;
    }
    public get spritesheets() {
        return this.#spritesheet;
    }
}
