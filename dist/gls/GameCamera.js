export class GameCamera {
    #name;
    #pos;
    #size;
    #map;
    #target;
    constructor(id, pos, size, map) {
        this.#name = id;
        this.#pos = pos;
        this.#size = size;
        this.#map = map;
    }
    get name() {
        return this.#name;
    }
    get map() {
        return this.#map;
    }
    get pos() {
        const self = this;
        return {
            get x() {
                return self.#pos.x;
            },
            set x(value) {
                self.#pos.x = value;
            },
            get y() {
                return self.#pos.y;
            },
            set y(value) {
                self.#pos.y = value;
            },
        };
    }
    get size() {
        const self = this;
        return {
            get x() {
                return self.#size.x;
            },
            set x(value) {
                self.#size.x = value;
            },
            get y() {
                return self.#size.y;
            },
            set y(value) {
                self.#size.y = value;
            },
        };
    }
}
