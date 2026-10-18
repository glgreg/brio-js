import { BrioMap } from "./BrioMap";
import { BrioObject } from "../objects/BrioObject";
import { Vec2 } from "../math/index";
import { BrioVec2 } from "../math/vec2";

/**
 * Represents a 2D viewport camera bound to a `BrioMap` and optional target `BrioObject`.
 * Uses pre-allocated `BrioVec2` instances for `pos` and `size` to avoid per-access object allocations.
 *
 * @example
 * ```ts
 * const camera = new BrioCamera("cam_main", { x: 0, y: 0 }, { x: 640, y: 480 }, worldMap);
 * camera.pos.x += 100 * dt;
 * ```
 */
export class BrioCamera {
    #name: string;
    #pos: BrioVec2;
    #size: BrioVec2;
    #map: BrioMap;
    #target?: BrioObject;

    static #emptyInstance?: BrioCamera;

    /**
     * Creates a new `BrioCamera` instance.
     *
     * @param id Unique identifier for the camera
     * @param pos Initial 2D position `{ x, y }`
     * @param size Viewport dimensions `{ x, y }`
     * @param map Associated `BrioMap` instance
     */
    constructor(id: string, pos: Vec2, size: Vec2, map: BrioMap) {
        this.#name = id;
        this.#pos = new BrioVec2(pos.x, pos.y);
        this.#size = new BrioVec2(size.x, size.y);
        this.#map = map;
    }

    /** Unique identifier of the camera. */
    public get name(): string {
        return this.#name;
    }

    /** Reference to the `BrioMap` associated with this camera. */
    public get map(): BrioMap {
        return this.#map;
    }

    /** Optional `BrioObject` target followed by this camera. */
    public get target(): BrioObject | undefined {
        return this.#target;
    }

    public set target(target: BrioObject | undefined) {
        this.#target = target;
    }

    /**
     * World position of the camera viewport.
     *
     * @example
     * ```ts
     * camera.pos.x = player.transform.position.x;
     * ```
     */
    public get pos(): Vec2 {
        return this.#pos;
    }

    public set pos(value: Vec2) {
        this.#pos.set(value.x, value.y);
    }

    /**
     * Dimensions (`x` width, `y` height) of the camera viewport.
     *
     * @example
     * ```ts
     * camera.size = { x: 640, y: 480 };
     * ```
     */
    public get size(): Vec2 {
        return this.#size;
    }

    public set size(value: Vec2) {
        this.#size.set(value.x, value.y);
    }

    /**
     * Returns a shared singleton fallback `BrioCamera` instance.
     */
    public static getEmptyInstance(): BrioCamera {
        if (!this.#emptyInstance) {
            this.#emptyInstance = new BrioCamera(
                "",
                { x: 0, y: 0 },
                { x: 0, y: 0 },
                BrioMap.getEmptyInstance(),
            );
        }
        return this.#emptyInstance;
    }
}

