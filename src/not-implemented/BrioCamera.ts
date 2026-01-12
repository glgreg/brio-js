import { BrioMap } from "./BrioMap";
import { BrioObject } from "../objects/BrioObject";
import { Vec2 } from "../math/index";

export class BrioCamera {
    #name: string;
    #pos: Vec2;
    #size: Vec2;
    #map: BrioMap;
    #target?: BrioObject;

    constructor(id: string, pos: Vec2, size: Vec2, map: BrioMap) {
        this.#name = id;
        this.#pos = pos;
        this.#size = size;
        this.#map = map;
    }

    public get name() {
        return this.#name;
    }
    public get map() {
        return this.#map;
    }

    public get pos(): Vec2 {
        const self = this;
        return {
            get x() {
                return self.#pos.x;
            },
            set x(value: number) {
                self.#pos.x = value;
            },
            get y() {
                return self.#pos.y;
            },
            set y(value: number) {
                self.#pos.y = value;
            },
        };
    }

    public get size(): Vec2 {
        const self = this;
        return {
            get x() {
                return self.#size.x;
            },
            set x(value: number) {
                self.#size.x = value;
            },
            get y() {
                return self.#size.y;
            },
            set y(value: number) {
                self.#size.y = value;
            },
        };
    }
}
