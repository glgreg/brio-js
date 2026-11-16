import type { BrioTileMap } from "../assets/BrioTileMap";
import { BrioVec2, Vec2 } from "../math/vec2";
import { BrioObject2D } from "../objects/BrioObject2D";

/**
 * Rendering and update policy for a `BrioLayer`:
 * - `"static"`: Redraws only when marked dirty (ideal for static backgrounds or tilemaps).
 * - `"parallax"`: Scrolls relative to the active camera using `scrollFactor`.
 * - `"dynamic"`: Redraws every frame for moving gameplay entities.
 * - `"ui"`: Renders in Screen Space (ignoring world camera offset/zoom), ordered by `order` for stacked UI (e.g. dialogue boxes under HUD overlays).
 */
export type LayerPolicy = "static" | "parallax" | "dynamic" | "ui";

/** Module-level comparator so in-place sorting never allocates a closure per frame. */
function compareDepth(a: BrioObject2D, b: BrioObject2D): number {
    return a.transform.depth - b.transform.depth;
}

/**
 * Configuration options for creating a `BrioLayer`.
 */
export interface BrioLayerOptions {
    /** Unique identifier of the layer. */
    name: string;
    /** Stacking order index (lower values render behind higher values). */
    order: number;
    /** Rendering update policy (defaults to `"dynamic"`). */
    policy?: LayerPolicy;
    /** Camera scroll multiplier for `"parallax"` layers (defaults to `{ x: 1, y: 1 }`). */
    scrollFactor?: Vec2;
    /** Whether this layer is visible (defaults to `true`). */
    visible?: boolean;
}

/**
 * Discrete rendering plane (`BrioLayer`) with a defined update policy (`"static"`, `"parallax"`, `"dynamic"`, or `"ui"`)
 * and stacking `order`. Maintains a pre-sorted list of objects and a dirty flag so sorting and static redraws
 * happen only when needed rather than on every frame. Tile maps added with `addTileMap` are drawn before the
 * layer's objects, in insertion order.
 *
 * @example
 * ```ts
 * const bgLayer = new BrioLayer({ name: "far_mountains", order: 0, policy: "parallax", scrollFactor: { x: 0.25, y: 0.1 } });
 * const groundLayer = new BrioLayer({ name: "ground", order: 10, policy: "static" });
 * groundLayer.addTileMap(levelMap);
 * const dialogueLayer = new BrioLayer({ name: "ui_dialogue", order: 100, policy: "ui" });
 * const hudLayer = new BrioLayer({ name: "ui_hud", order: 110, policy: "ui" });
 * ```
 */
export class BrioLayer {
    readonly #name: string;
    #order: number;
    #policy: LayerPolicy;
    readonly #scrollFactor: BrioVec2;
    #visible: boolean;
    #dirty: boolean = true;
    #orderDirty: boolean = false;
    readonly #objects: BrioObject2D[] = [];
    readonly #tileMaps: BrioTileMap[] = [];
    /** `version` of each tile map (same index as `#tileMaps`) at the last `clearDirty()`. */
    readonly #tileMapVersions: number[] = [];

    /**
     * Creates a new `BrioLayer`.
     *
     * @param options Layer configuration
     */
    constructor(options: BrioLayerOptions) {
        this.#name = options.name;
        this.#order = options.order;
        this.#policy = options.policy ?? "dynamic";
        const sf =
            options.scrollFactor ?? (this.#policy === "ui" ? { x: 0, y: 0 } : { x: 1, y: 1 });
        this.#scrollFactor = new BrioVec2(sf.x, sf.y, () => {
            this.#dirty = true;
        });
        this.#visible = options.visible ?? true;
    }

    /** Unique name of the layer. */
    public get name(): string {
        return this.#name;
    }

    /** Stacking order index of the layer. */
    public get order(): number {
        return this.#order;
    }
    public set order(value: number) {
        this.#order = value;
        this.#dirty = true;
    }

    /** Update policy (`"static"`, `"parallax"`, `"dynamic"`, or `"ui"`). */
    public get policy(): LayerPolicy {
        return this.#policy;
    }
    public set policy(value: LayerPolicy) {
        this.#policy = value;
        if (value === "ui") {
            this.#scrollFactor.set(0, 0);
        }
        this.#dirty = true;
    }

    /** Parallax scroll multiplier `{ x, y }` (`{ x: 0, y: 0 }` for Screen-Space UI). */
    public get scrollFactor(): Vec2 {
        return this.#scrollFactor;
    }
    public set scrollFactor(value: Vec2) {
        this.#scrollFactor.set(value.x, value.y);
    }

    /** Controls whether this layer is rendered. */
    public get visible(): boolean {
        return this.#visible;
    }
    public set visible(value: boolean) {
        this.#visible = value;
        this.#dirty = true;
    }

    /**
     * Indicates whether this layer needs to be redrawn: always `true` for `"dynamic"` layers; otherwise `true`
     * after `markDirty`, a membership, order or visibility change, or when one of its tile maps changed
     * (its `version` differs from the one seen at the last `clearDirty()`).
     */
    public get isDirty(): boolean {
        if (this.#policy === "dynamic" || this.#dirty) return true;
        const maps = this.#tileMaps;
        for (let i = 0; i < maps.length; i++) {
            if (maps[i].version !== this.#tileMapVersions[i]) return true;
        }
        return false;
    }

    /**
     * Marks this layer as dirty so `"static"` layers will redraw on the next frame.
     */
    public markDirty(): void {
        this.#dirty = true;
    }

    /**
     * Clears the dirty flag after a frame render completes and records the current `version` of every tile map.
     */
    public clearDirty(): void {
        this.#dirty = false;
        const maps = this.#tileMaps;
        for (let i = 0; i < maps.length; i++) {
            this.#tileMapVersions[i] = maps[i].version;
        }
    }

    /**
     * Adds a `BrioTileMap` to this layer (once). Tile maps are drawn before the layer's objects, in insertion
     * order, and a change to any of them marks the layer dirty.
     *
     * @param map Tile map to add
     * @example
     * ```ts
     * groundLayer.addTileMap(BrioTileMap.fromTiled(json, { layer: "ground", tileset: tiles }));
     * ```
     */
    public addTileMap(map: BrioTileMap): void {
        if (this.#tileMaps.includes(map)) return;
        this.#tileMaps.push(map);
        this.#tileMapVersions.push(map.version);
        this.#dirty = true;
    }

    /**
     * Removes a `BrioTileMap` from this layer.
     *
     * @param map Tile map to remove
     * @returns `true` if removed
     * @example
     * ```ts
     * groundLayer.removeTileMap(oldMap);
     * ```
     */
    public removeTileMap(map: BrioTileMap): boolean {
        const idx = this.#tileMaps.indexOf(map);
        if (idx === -1) return false;
        this.#tileMaps.splice(idx, 1);
        this.#tileMapVersions.splice(idx, 1);
        this.#dirty = true;
        return true;
    }

    /**
     * Checks whether `map` is assigned to this layer.
     *
     * @param map Tile map to look up
     * @returns `true` if assigned
     * @example
     * ```ts
     * if (!groundLayer.hasTileMap(map)) groundLayer.addTileMap(map);
     * ```
     */
    public hasTileMap(map: BrioTileMap): boolean {
        return this.#tileMaps.includes(map);
    }

    /**
     * Tile maps of this layer in insertion order (the live list, mutated in place; do not modify it).
     *
     * @example
     * ```ts
     * for (const map of layer.tileMaps) console.log(map.name);
     * ```
     */
    public get tileMaps(): readonly BrioTileMap[] {
        return this.#tileMaps;
    }

    /**
     * Adds a `BrioObject2D` to this layer and marks the internal object order as dirty.
     *
     * @param object Object to add
     * @example
     * ```ts
     * hudLayer.addObject(healthBar);
     * ```
     */
    public addObject(object: BrioObject2D): void {
        if (!this.#objects.includes(object)) {
            this.#objects.push(object);
            this.#orderDirty = true;
            this.#dirty = true;
        }
    }

    /**
     * Removes a `BrioObject2D` from this layer.
     *
     * @param object Object to remove
     * @returns `true` if removed
     */
    public removeObject(object: BrioObject2D): boolean {
        const idx = this.#objects.indexOf(object);
        if (idx !== -1) {
            this.#objects.splice(idx, 1);
            this.#dirty = true;
            return true;
        }
        return false;
    }

    /** Number of objects assigned to this layer. */
    public get objectCount(): number {
        return this.#objects.length;
    }

    /**
     * Checks whether `object` is assigned to this layer.
     *
     * @param object Object to look up
     * @returns `true` if assigned
     */
    public hasObject(object: BrioObject2D): boolean {
        return this.#objects.includes(object);
    }

    /**
     * Returns the objects in this layer sorted by `transform.depth` (drawing order inside the layer).
     * Sorting happens in place and only when the order is dirty or a depth changed, detected by an
     * $O(n)$ allocation-free scan, so the game loop never allocates or sorts a fresh array per frame.
     *
     * @returns Read-only sorted array of `BrioObject2D` instances
     */
    public getSortedObjects(): readonly BrioObject2D[] {
        const objects = this.#objects;
        if (!this.#orderDirty) {
            for (let i = 1; i < objects.length; i++) {
                if (objects[i - 1].transform.depth > objects[i].transform.depth) {
                    this.#orderDirty = true;
                    break;
                }
            }
        }
        if (this.#orderDirty) {
            objects.sort(compareDepth);
            this.#orderDirty = false;
            this.#dirty = true;
        }
        return objects;
    }

    /**
     * Marks the internal object Z-order as needing a re-sort on the next `getSortedObjects()` call.
     */
    public markOrderDirty(): void {
        this.#orderDirty = true;
        this.#dirty = true;
    }
}
