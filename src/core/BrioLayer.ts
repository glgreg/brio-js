import { BrioVec2, Vec2 } from "../math/vec2";
import { BrioObject } from "../objects/BrioObject";

/**
 * Rendering and update policy for a `BrioLayer`:
 * - `"static"`: Redraws only when marked dirty (ideal for static backgrounds or tilemaps).
 * - `"parallax"`: Scrolls relative to the active camera using `scrollFactor`.
 * - `"dynamic"`: Redraws every frame for moving gameplay entities.
 * - `"ui"`: Renders in Screen Space (ignoring world camera offset/zoom), ordered by `order` for stacked UI (e.g. dialogue boxes under HUD overlays).
 */
export type LayerPolicy = "static" | "parallax" | "dynamic" | "ui";

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
 * happen only when needed rather than on every frame.
 *
 * @example
 * ```ts
 * const bgLayer = new BrioLayer({ name: "far_mountains", order: 0, policy: "parallax", scrollFactor: { x: 0.25, y: 0.1 } });
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
    readonly #objects: BrioObject[] = [];

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
            options.scrollFactor ??
            (this.#policy === "ui" ? { x: 0, y: 0 } : { x: 1, y: 1 });
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

    /** Indicates whether this layer needs to be redrawn (always `true` for `"dynamic"` layers). */
    public get isDirty(): boolean {
        return this.#policy === "dynamic" || this.#dirty;
    }

    /**
     * Marks this layer as dirty so `"static"` layers will redraw on the next frame.
     */
    public markDirty(): void {
        this.#dirty = true;
    }

    /**
     * Clears the dirty flag after a frame render completes.
     */
    public clearDirty(): void {
        this.#dirty = false;
    }

    /**
     * Adds a `BrioObject` to this layer and marks the internal object order as dirty.
     *
     * @param object Object to add
     * @example
     * ```ts
     * hudLayer.addObject(healthBar);
     * ```
     */
    public addObject(object: BrioObject): void {
        if (!this.#objects.includes(object)) {
            this.#objects.push(object);
            this.#orderDirty = true;
            this.#dirty = true;
        }
    }

    /**
     * Removes a `BrioObject` from this layer.
     *
     * @param object Object to remove
     * @returns `true` if removed
     */
    public removeObject(object: BrioObject): boolean {
        const idx = this.#objects.indexOf(object);
        if (idx !== -1) {
            this.#objects.splice(idx, 1);
            this.#dirty = true;
            return true;
        }
        return false;
    }

    /**
     * Returns the objects in this layer sorted by `transform.layer`, re-sorting only when dirty.
     * Eliminates per-frame `Array.from(...).sort(...)` allocations.
     *
     * @returns Read-only sorted array of `BrioObject` instances
     */
    public getSortedObjects(): readonly BrioObject[] {
        if (this.#orderDirty) {
            this.#objects.sort((a, b) => a.transform.layer - b.transform.layer);
            this.#orderDirty = false;
        }
        return this.#objects;
    }

    /**
     * Marks the internal object Z-order as needing a re-sort on the next `getSortedObjects()` call.
     */
    public markOrderDirty(): void {
        this.#orderDirty = true;
        this.#dirty = true;
    }
}
