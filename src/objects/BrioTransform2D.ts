import { ComponentStorage, DirtyFlag } from "../ecs/ComponentStorage";
import { clamp } from "../math/BrioMath";
import type { Vec2, Vec2Bool } from "../math/index";
import { BrioVec2, create } from "../math/vec2";

/**
 * Contract representing a 2D spatial transform component with local and world hierarchy support.
 */
export interface Transform2D {
    /** Local 2D position in pixels. */
    position: Vec2;
    /** Base unscaled dimensions in pixels. */
    size: Vec2;
    /** Initial unscaled dimensions recorded when the transform was initialized. */
    initialSize: Vec2;
    /** Effective rendered dimensions (`|size * scale|`) in pixels. */
    renderSize: Vec2;
    /** Scale multiplier along the X and Y axes. */
    scale: Vec2;
    /** Horizontal and vertical mirror flags. */
    flip: Vec2Bool;
    /** Normalized origin point in `[0, 1]` for rotation and skew. */
    pivot: Vec2;
    /** Clockwise rotation angle in radians. */
    rotation: number;
    /** Skew angles in radians along the X and Y axes. */
    skew: Vec2;
    /** Whether the object is visible during rendering. */
    visibility: boolean;
    /** Opacity factor clamped to `[0, 1]`. */
    opacity: number;
    /** Non-negative rendering depth order (z-index). */
    layer: number;
    /** Optional parent `BrioTransform2D` in the scene hierarchy. */
    parent?: BrioTransform2D;
    /** Read-only list of child `BrioTransform2D` nodes attached to this transform. */
    readonly children: readonly BrioTransform2D[];
}

/**
 * Concrete 2D spatial transformation class (`position`, `size`, `scale`, `rotation`, `skew`, `pivot`, `flip`, `visibility`, `opacity`, `layer`),
 * supporting parent-child scene hierarchy (`worldPosition`, `worldScale`, `worldRotation`) and direct ECS `ComponentStorage` binding.
 *
 * @example
 * ```ts
 * const parent = new BrioTransform2D({ x: 100, y: 50 }, { x: 64, y: 64 });
 * const child = new BrioTransform2D({ x: 20, y: 10 }, { x: 16, y: 16 });
 * parent.addChild(child);
 * console.log(child.worldPosition); // { x: 120, y: 60 }
 * ```
 */
export class BrioTransform2D implements Transform2D {
    #position: BrioVec2;
    #size: BrioVec2;
    #initialSize: Vec2;
    #renderSize: BrioVec2;
    #rotation: number = 0;
    #scale: BrioVec2;
    #pivot: BrioVec2;
    #skew: BrioVec2;
    #flip: Vec2Bool = { x: false, y: false };
    #visibility: boolean = true;
    #opacity: number = 1;
    #layer: number = 1;

    #parent?: BrioTransform2D;
    #children: BrioTransform2D[] = [];
    #ecsStorage?: ComponentStorage;
    #entityId: number = -1;

    /**
     * Creates a new `BrioTransform2D` instance.
     *
     * @param position Initial 2D position `{ x, y }` (defaults to `{ x: 0, y: 0 }`)
     * @param size Initial base dimensions `{ x, y }` (defaults to `{ x: 0, y: 0 }`)
     * @example
     * ```ts
     * const transform = new BrioTransform2D({ x: 0, y: 0 }, { x: 32, y: 32 });
     * ```
     */
    constructor(position: Vec2 = create(0, 0), size: Vec2 = create(0, 0)) {
        this.#position = new BrioVec2(position.x, position.y, () => {
            this.#markDirty();
        });
        this.#initialSize = create(Math.abs(size.x), Math.abs(size.y));
        this.#renderSize = new BrioVec2(Math.abs(size.x), Math.abs(size.y));

        this.#size = new BrioVec2(size.x, size.y, (x, y) => {
            this.#flipSpriteVec2({ x, y });
            const absX = Math.abs(x);
            const absY = Math.abs(y);
            this.#size.setSilent(absX, absY);
            if (this.#initialSize.x === 0 && absX > 0) this.#initialSize.x = absX;
            if (this.#initialSize.y === 0 && absY > 0) this.#initialSize.y = absY;
            this.#updateRenderSize();
            this.#markDirty();
        });

        this.#scale = new BrioVec2(1, 1, (x, y) => {
            this.#flipSpriteVec2({ x, y });
            this.#updateRenderSize();
            this.#markDirty();
        });

        this.#pivot = new BrioVec2(0.5, 0.5, (x, y) => {
            this.#pivot.setSilent(clamp(x, 0, 1), clamp(y, 0, 1));
            this.#markDirty();
        });

        this.#skew = new BrioVec2(0, 0, () => {
            this.#markDirty();
        });
    }

    /**
     * Binds this transform's vectors and scalar fields directly to an entity slot in `ComponentStorage`.
     *
     * @param storage Target ECS `ComponentStorage`
     * @param entityId Allocated entity ID
     * @returns This `BrioTransform2D` instance
     * @example
     * ```ts
     * transform.bindECS(world.storage, entityId);
     * ```
     */
    public bindECS(storage: ComponentStorage, entityId: number): this {
        this.#ecsStorage = storage;
        this.#entityId = entityId;
        const base = storage.getTransform2DOffset(entityId);
        const buf = storage.transform2D;

        this.#position.bindBuffer(buf, base);
        this.#size.bindBuffer(buf, base + 2);
        this.#scale.bindBuffer(buf, base + 4);
        this.#pivot.bindBuffer(buf, base + 6);
        this.#skew.bindBuffer(buf, base + 8);
        this.#renderSize.bindBuffer(buf, base + 10);
        buf[base + 12] = this.#rotation;
        buf[base + 13] = this.#opacity;
        buf[base + 14] = this.#layer;
        return this;
    }

    /**
     * Local 2D coordinates (`x`, `y`) of the object in pixels.
     *
     * @default { x: 0, y: 0 }
     * @example
     * ```ts
     * player.transform.position.x += 200 * dt;
     * ```
     */
    public set position(position: Vec2) {
        this.#position.set(position.x, position.y);
    }
    public get position(): Vec2 {
        return this.#position;
    }

    /**
     * Computed world-space 2D position accounting for parent hierarchy translation, rotation, and scale.
     *
     * @example
     * ```ts
     * const worldPos = weapon.transform.worldPosition;
     * ```
     */
    public get worldPosition(): Vec2 {
        if (!this.#parent) {
            return { x: this.#position.x, y: this.#position.y };
        }
        const parentWorldPos = this.#parent.worldPosition;
        const parentWorldScale = this.#parent.worldScale;
        const parentWorldRot = this.#parent.worldRotation;

        const scaledX = this.#position.x * parentWorldScale.x;
        const scaledY = this.#position.y * parentWorldScale.y;

        if (parentWorldRot === 0) {
            return {
                x: parentWorldPos.x + scaledX,
                y: parentWorldPos.y + scaledY,
            };
        }

        const cos = Math.cos(parentWorldRot);
        const sin = Math.sin(parentWorldRot);
        return {
            x: parentWorldPos.x + (scaledX * cos - scaledY * sin),
            y: parentWorldPos.y + (scaledX * sin + scaledY * cos),
        };
    }

    /**
     * Base unscaled dimensions (`x` width, `y` height) of the object in pixels.
     */
    public set size(size: Vec2) {
        this.#size.set(size.x, size.y);
    }
    public get size(): Vec2 {
        return this.#size;
    }

    /**
     * Initial unscaled dimensions recorded when the object's size was first non-zero.
     */
    public get initialSize(): Vec2 {
        return this.#initialSize;
    }

    /**
     * Computed rendering dimensions (`|size.x * scale.x|`, `|size.y * scale.y|`) in pixels.
     */
    public get renderSize(): Vec2 {
        return this.#renderSize;
    }

    /**
     * Local clockwise rotation angle of the object in radians around its `pivot`.
     *
     * @default 0
     */
    public set rotation(radian: number) {
        this.#rotation = radian;
        if (this.#ecsStorage && this.#entityId >= 0) {
            const base = this.#ecsStorage.getTransform2DOffset(this.#entityId);
            this.#ecsStorage.transform2D[base + 12] = radian;
        }
        this.#markDirty();
    }
    public get rotation(): number {
        if (this.#ecsStorage && this.#entityId >= 0) {
            const base = this.#ecsStorage.getTransform2DOffset(this.#entityId);
            return this.#ecsStorage.transform2D[base + 12];
        }
        return this.#rotation;
    }

    /**
     * Computed world-space rotation angle in radians accounting for parent hierarchy.
     */
    public get worldRotation(): number {
        return this.#parent ? this.#parent.worldRotation + this.rotation : this.rotation;
    }

    /**
     * Local scale multiplier of the object on the X and Y axes.
     *
     * @default { x: 1, y: 1 }
     */
    public set scale(scale: Vec2) {
        this.#scale.set(scale.x, scale.y);
    }
    public get scale(): Vec2 {
        return this.#scale;
    }

    /**
     * Computed world-space scale accounting for parent hierarchy.
     */
    public get worldScale(): Vec2 {
        if (!this.#parent) {
            return { x: this.#scale.x, y: this.#scale.y };
        }
        const ps = this.#parent.worldScale;
        return { x: ps.x * this.#scale.x, y: ps.y * this.#scale.y };
    }

    /**
     * Horizontal (`x`) and vertical (`y`) mirror flags.
     */
    public set flip(flip: Vec2Bool) {
        this.#flip.x = flip.x;
        this.#flip.y = flip.y;
        this.#markDirty();
    }
    public get flip(): Vec2Bool {
        return this.#flip;
    }

    /**
     * Skew angles in radians along the X and Y axes relative to `pivot`.
     */
    public set skew(skew: Vec2) {
        this.#skew.set(skew.x, skew.y);
    }
    public get skew(): Vec2 {
        return this.#skew;
    }

    /**
     * Normalized pivot point in `[0, 1]` used as the origin for rotation and skew.
     */
    public set pivot(pivot: Vec2) {
        this.#pivot.set(pivot.x, pivot.y);
    }
    public get pivot(): Vec2 {
        return this.#pivot;
    }

    /**
     * Controls whether the object is rendered on the canvas.
     */
    public set visibility(visibility: boolean) {
        this.#visibility = visibility;
        this.#markDirty();
    }
    public get visibility(): boolean {
        return this.#visibility;
    }

    /**
     * Opacity level clamped to `[0, 1]`.
     */
    public set opacity(opacity: number) {
        this.#opacity = clamp(opacity, 0, 1);
        if (this.#ecsStorage && this.#entityId >= 0) {
            const base = this.#ecsStorage.getTransform2DOffset(this.#entityId);
            this.#ecsStorage.transform2D[base + 13] = this.#opacity;
        }
        this.#markDirty();
    }
    public get opacity(): number {
        if (this.#ecsStorage && this.#entityId >= 0) {
            const base = this.#ecsStorage.getTransform2DOffset(this.#entityId);
            return this.#ecsStorage.transform2D[base + 13];
        }
        return this.#opacity;
    }

    /**
     * Rendering depth layer (z-index). Negative values are converted to their absolute value.
     */
    public set layer(layer: number) {
        this.#layer = Math.abs(layer);
        if (this.#ecsStorage && this.#entityId >= 0) {
            const base = this.#ecsStorage.getTransform2DOffset(this.#entityId);
            this.#ecsStorage.transform2D[base + 14] = this.#layer;
        }
        this.#markDirty();
    }
    public get layer(): number {
        if (this.#ecsStorage && this.#entityId >= 0) {
            const base = this.#ecsStorage.getTransform2DOffset(this.#entityId);
            return this.#ecsStorage.transform2D[base + 14];
        }
        return this.#layer;
    }

    /**
     * Optional parent `BrioTransform2D` in the scene hierarchy.
     */
    public get parent(): BrioTransform2D | undefined {
        return this.#parent;
    }

    public set parent(newParent: BrioTransform2D | undefined) {
        if (this.#parent === newParent) return;
        if (this.#parent) {
            this.#parent.removeChild(this);
        }
        if (newParent) {
            newParent.addChild(this);
        }
    }

    /**
     * Read-only array of child `BrioTransform2D` instances attached to this transform.
     */
    public get children(): readonly BrioTransform2D[] {
        return this.#children;
    }

    /**
     * Attaches `child` to this transform in the 2D hierarchy.
     *
     * @param child Child `BrioTransform2D` to attach
     * @returns This `BrioTransform2D` instance
     * @example
     * ```ts
     * player.transform.addChild(shield.transform);
     * ```
     */
    public addChild(child: BrioTransform2D): this {
        if (child === this) {
            throw new Error("BrioTransform2D cannot be a child of itself.");
        }
        if (child.#parent === this) return this;
        if (child.#parent) {
            child.#parent.removeChild(child);
        }
        child.#parent = this;
        this.#children.push(child);
        child.#markDirty();
        return this;
    }

    /**
     * Detaches `child` from this transform's children list.
     *
     * @param child Child `BrioTransform2D` to remove
     * @returns This `BrioTransform2D` instance
     */
    public removeChild(child: BrioTransform2D): this {
        const idx = this.#children.indexOf(child);
        if (idx !== -1) {
            this.#children.splice(idx, 1);
            child.#parent = undefined;
            child.#markDirty();
        }
        return this;
    }

    #markDirty(): void {
        if (this.#ecsStorage && this.#entityId >= 0) {
            this.#ecsStorage.markDirty(this.#entityId, DirtyFlag.TRANSFORM | DirtyFlag.RENDER);
        }
        for (let i = 0; i < this.#children.length; i++) {
            this.#children[i].#markDirty();
        }
    }

    #flipSprite(axis: "x" | "y", value: number) {
        if (axis === "x") {
            this.#flip.x = value < 0;
        } else {
            this.#flip.y = value < 0;
        }
    }

    #flipSpriteVec2(values: Vec2) {
        if (values.x < 0) this.#flipSprite("x", values.x);
        if (values.y < 0) this.#flipSprite("y", values.y);
    }

    #updateRenderSize() {
        this.#renderSize.setSilent(
            Math.abs(this.#size.x * this.#scale.x),
            Math.abs(this.#size.y * this.#scale.y),
        );
    }
}

export default BrioTransform2D;
