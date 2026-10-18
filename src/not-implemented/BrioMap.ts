import { BrioSprite } from "../assets/BrioSprite";
import { Vec2 } from "../math/index";

/**
 * Configuration properties used to construct a `BrioMap`.
 */
export interface MapProps {
    /** Unique identifier of the map. */
    name: string;
    /** World position `{ x, y }` of the map origin. */
    pos: Vec2;
    /** Total dimensions `{ x, y }` of the map in pixels. */
    size: Vec2;
    /** Background `BrioSprite` asset rendered for the map. */
    sprite: BrioSprite;
}

/**
 * Represents a 2D game map with spatial bounds and a background sprite.
 *
 * @example
 * ```ts
 * const levelMap = new BrioMap({
 *     name: "map_level_1",
 *     pos: { x: 0, y: 0 },
 *     size: { x: 2048, y: 1024 },
 *     sprite: assets.getSprite("spr_level_1"),
 * });
 * ```
 */
export class BrioMap {
    /** Unique identifier of the map. */
    name: string;
    /** Total dimensions `{ x, y }` of the map in pixels. */
    size: Vec2;
    /** World position `{ x, y }` of the map origin. */
    pos: Vec2;
    /** Attached `BrioSprite` asset. */
    sprite: BrioSprite;
    static #emptyInstance?: BrioMap;

    /**
     * Creates a new `BrioMap` instance.
     *
     * @param mapProps Map initialization properties
     */
    constructor(mapProps: MapProps) {
        this.pos = mapProps.pos;
        this.size = mapProps.size;
        this.name = mapProps.name;
        this.sprite = mapProps.sprite;
    }

    /**
     * Returns a shared singleton fallback `BrioMap` instance when a requested map is not found.
     */
    public static getEmptyInstance(): BrioMap {
        if (this.#emptyInstance === undefined) {
            const instance = new BrioMap({
                name: "",
                sprite: BrioSprite.getEmptyInstance(),
                pos: { x: 0, y: 0 },
                size: { x: 100, y: 100 },
            });
            this.#emptyInstance = instance;

            return this.#emptyInstance;
        } else {
            return this.#emptyInstance;
        }
    }
}

