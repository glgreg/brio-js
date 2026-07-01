export class BrioAssetManager {
    #objects = new Map();
    #sprites = new Map();
    #audios = new Map();
    #maps = new Map();
    #cameras = new Map();
    #scenes = new Map();
    #spritesheet = new Map();
    get objects() {
        return this.#objects;
    }
    get sprites() {
        return this.#sprites;
    }
    get audios() {
        return this.#audios;
    }
    get maps() {
        return this.#maps;
    }
    get cameras() {
        return this.#cameras;
    }
    get scenes() {
        return this.#scenes;
    }
    get spritesheets() {
        return this.#spritesheet;
    }
}
