import { BrioViewport } from "../core/BrioViewport";
import { clamp, lerp } from "../math/BrioMath";
import { BrioVec2, Vec2 } from "../math/vec2";
import { BrioObject2D } from "../objects/BrioObject2D";

/** Distance (world pixels) under which a following camera snaps to its destination. */
const FOLLOW_SNAP_EPSILON = 0.01;

/**
 * Axis-aligned bounding rectangle confining a `BrioCamera2D` in world space.
 */
export interface CameraBounds2D {
    /** Minimum X world coordinate. */
    minX: number;
    /** Minimum Y world coordinate. */
    minY: number;
    /** Maximum X world coordinate. */
    maxX: number;
    /** Maximum Y world coordinate. */
    maxY: number;
}

/**
 * Orthographic 2D observer (`BrioCamera2D`) defining which portion of a 2D scene is visible within a target `BrioViewport`.
 * Supports smooth target following (`lerp` and `deadzone`), `zoom`, `rotation`, world boundary confinement (`setBounds`),
 * screen `shake`, coordinate conversion (`worldToScreen`, `screenToWorld`), and 2D frustum culling (`isVisible`).
 *
 * @example
 * ```ts
 * const camera = new BrioCamera2D("cam_main", { x: 0, y: 0 }, { x: 640, y: 480 });
 * camera.follow(player, 0.1, { x: 64, y: 48 });
 * camera.setBounds(0, 0, 3200, 1200);
 * camera.shake(8, 0.3);
 * ```
 */
export class BrioCamera2D {
    readonly #name: string;
    readonly #pos: BrioVec2;
    readonly #size: BrioVec2;
    #zoom: number = 1;
    #rotation: number = 0;
    #viewport: BrioViewport;

    #target?: BrioObject2D;
    #followLerp: number = 1;
    #deadzone: Vec2 = { x: 0, y: 0 };
    #bounds?: CameraBounds2D;

    #shakeIntensity: number = 0;
    #shakeDuration: number = 0;
    #shakeElapsed: number = 0;
    #shakeOffset: Vec2 = { x: 0, y: 0 };

    static #emptyInstance?: BrioCamera2D;

    /**
     * Creates a new `BrioCamera2D` instance.
     *
     * @param name Unique camera identifier
     * @param pos Initial top-left world position `{ x, y }` (defaults to `{ x: 0, y: 0 }`)
     * @param size Viewport dimensions `{ x, y }` in pixels (defaults to `{ x: 640, y: 480 }`)
     * @param viewport Optional normalized screen `BrioViewport` (defaults to full-screen)
     */
    constructor(
        name: string,
        pos: Vec2 = { x: 0, y: 0 },
        size: Vec2 = { x: 640, y: 480 },
        viewport: BrioViewport = new BrioViewport(0, 0, 1, 1),
    ) {
        this.#name = name;
        this.#pos = new BrioVec2(pos.x, pos.y);
        this.#size = new BrioVec2(Math.max(1, size.x), Math.max(1, size.y));
        this.#viewport = viewport;
    }

    /** Unique identifier of the camera. */
    public get name(): string {
        return this.#name;
    }

    /** Top-left world position `{ x, y }` of the camera view. */
    public get pos(): Vec2 {
        return this.#pos;
    }
    public set pos(value: Vec2) {
        this.#pos.set(value.x, value.y);
        this.#applyBounds();
    }

    /** Effective camera X position including active screen shake offset (allocation-free). */
    public get renderX(): number {
        return this.#pos.x + this.#shakeOffset.x;
    }

    /** Effective camera Y position including active screen shake offset (allocation-free). */
    public get renderY(): number {
        return this.#pos.y + this.#shakeOffset.y;
    }

    /** Effective camera position including active screen shake offset. */
    public get renderPos(): Vec2 {
        return {
            x: this.#pos.x + this.#shakeOffset.x,
            y: this.#pos.y + this.#shakeOffset.y,
        };
    }

    /** Viewport dimensions `{ x, y }` in pixels. */
    public get size(): Vec2 {
        return this.#size;
    }
    public set size(value: Vec2) {
        this.#size.set(Math.max(1, value.x), Math.max(1, value.y));
        this.#applyBounds();
    }

    /** Zoom multiplier (`> 0`, where `1` is 100%, `2` is 2x zoom-in). */
    public get zoom(): number {
        return this.#zoom;
    }
    public set zoom(value: number) {
        this.#zoom = Math.max(0.01, value);
        this.#applyBounds();
    }

    /** Camera rotation angle in radians. */
    public get rotation(): number {
        return this.#rotation;
    }
    public set rotation(value: number) {
        this.#rotation = value;
    }

    /** Normalized screen region (`BrioViewport`) where this camera renders. */
    public get viewport(): BrioViewport {
        return this.#viewport;
    }
    public set viewport(value: BrioViewport) {
        this.#viewport = value;
    }

    /** Currently followed `BrioObject2D` target, if any. */
    public get target(): BrioObject2D | undefined {
        return this.#target;
    }

    /**
     * Configures the camera to follow `target` with optional smooth interpolation (`lerpFactor`) and a `deadzone`.
     *
     * @param target `BrioObject2D` to follow (or `undefined` to stop following)
     * @param lerpFactor Smoothing factor in `(0, 1]` (`1` = instant lock, `0.1` = smooth lag)
     * @param deadzone Width (`x`) and height (`y`) of the center deadzone where target movement does not pan the camera
     * @example
     * ```ts
     * camera.follow(player, 0.15, { x: 80, y: 60 });
     * ```
     */
    public follow(
        target: BrioObject2D | undefined,
        lerpFactor: number = 1,
        deadzone: Vec2 = { x: 0, y: 0 },
    ): void {
        this.#target = target;
        this.#followLerp = clamp(lerpFactor, 0.001, 1);
        this.#deadzone = { x: Math.max(0, deadzone.x), y: Math.max(0, deadzone.y) };
    }

    /**
     * Confines the camera view within the world rectangle `[minX, minY, maxX, maxY]`.
     *
     * @param minX Left world limit
     * @param minY Top world limit
     * @param maxX Right world limit
     * @param maxY Bottom world limit
     * @example
     * ```ts
     * camera.setBounds(0, 0, 4000, 2000);
     * ```
     */
    public setBounds(minX: number, minY: number, maxX: number, maxY: number): void {
        this.#bounds = { minX, minY, maxX, maxY };
        this.#applyBounds();
    }

    /**
     * Clears any world boundary confinement previously set via `setBounds`.
     */
    public clearBounds(): void {
        this.#bounds = undefined;
    }

    /**
     * Triggers a decaying screen shake effect of `intensity` pixels for `durationSeconds`.
     *
     * @param intensity Maximum pixel displacement
     * @param durationSeconds Duration of the shake in seconds
     * @example
     * ```ts
     * camera.shake(12, 0.25);
     * ```
     */
    public shake(intensity: number, durationSeconds: number): void {
        this.#shakeIntensity = Math.max(0, intensity);
        this.#shakeDuration = Math.max(0, durationSeconds);
        this.#shakeElapsed = 0;
    }

    /**
     * Updates target following, boundary confinement, and screen shake over `dt` seconds.
     *
     * @param dt Frame delta time in seconds
     * @example
     * ```ts
     * camera.update(dt);
     * ```
     */
    public update(dt: number): void {
        if (this.#target) {
            const viewW = this.#size.x / this.#zoom;
            const viewH = this.#size.y / this.#zoom;

            const targetCenterX =
                this.#target.transform.position.x + this.#target.transform.renderSize.x * 0.5;
            const targetCenterY =
                this.#target.transform.position.y + this.#target.transform.renderSize.y * 0.5;

            const camCenterX = this.#pos.x + viewW * 0.5;
            const camCenterY = this.#pos.y + viewH * 0.5;

            let desiredCenterX = camCenterX;
            let desiredCenterY = camCenterY;

            const halfDeadX = this.#deadzone.x * 0.5;
            const halfDeadY = this.#deadzone.y * 0.5;

            if (targetCenterX < camCenterX - halfDeadX) {
                desiredCenterX = targetCenterX + halfDeadX;
            } else if (targetCenterX > camCenterX + halfDeadX) {
                desiredCenterX = targetCenterX - halfDeadX;
            }

            if (targetCenterY < camCenterY - halfDeadY) {
                desiredCenterY = targetCenterY + halfDeadY;
            } else if (targetCenterY > camCenterY + halfDeadY) {
                desiredCenterY = targetCenterY - halfDeadY;
            }

            const desiredPosX = desiredCenterX - viewW * 0.5;
            const desiredPosY = desiredCenterY - viewH * 0.5;

            // Snap once within a hundredth of a pixel: an asymptotic lerp would otherwise move the camera
            // by sub-pixel amounts forever, invalidating cached "static" layers on every frame
            let nextX = lerp(this.#pos.x, desiredPosX, this.#followLerp);
            let nextY = lerp(this.#pos.y, desiredPosY, this.#followLerp);
            if (Math.abs(desiredPosX - nextX) < FOLLOW_SNAP_EPSILON) nextX = desiredPosX;
            if (Math.abs(desiredPosY - nextY) < FOLLOW_SNAP_EPSILON) nextY = desiredPosY;
            if (nextX !== this.#pos.x || nextY !== this.#pos.y) {
                this.#pos.set(nextX, nextY);
            }
        }

        this.#applyBounds();

        if (this.#shakeDuration > 0 && this.#shakeElapsed < this.#shakeDuration) {
            this.#shakeElapsed += dt;
            if (this.#shakeElapsed >= this.#shakeDuration) {
                this.#shakeOffset.x = 0;
                this.#shakeOffset.y = 0;
                this.#shakeDuration = 0;
            } else {
                const decay = 1 - this.#shakeElapsed / this.#shakeDuration;
                const currentMag = this.#shakeIntensity * decay;
                this.#shakeOffset.x = (Math.random() * 2 - 1) * currentMag;
                this.#shakeOffset.y = (Math.random() * 2 - 1) * currentMag;
            }
        }
    }

    /**
     * Converts a 2D point from world space into screen/viewport pixel coordinates.
     *
     * @param worldPos World-space coordinates `{ x, y }`
     * @returns Screen-space coordinates `{ x, y }`
     * @example
     * ```ts
     * const screenPt = camera.worldToScreen(player.transform.position);
     * ```
     */
    public worldToScreen(worldPos: Vec2): Vec2 {
        const rp = this.renderPos;
        return {
            x: (worldPos.x - rp.x) * this.#zoom,
            y: (worldPos.y - rp.y) * this.#zoom,
        };
    }

    /**
     * Converts a 2D point from screen/viewport pixel coordinates into world-space coordinates.
     *
     * @param screenPos Screen-space coordinates `{ x, y }`
     * @returns World-space coordinates `{ x, y }`
     * @example
     * ```ts
     * const worldClick = camera.screenToWorld(mousePos);
     * ```
     */
    public screenToWorld(screenPos: Vec2): Vec2 {
        const rp = this.renderPos;
        return {
            x: screenPos.x / this.#zoom + rp.x,
            y: screenPos.y / this.#zoom + rp.y,
        };
    }

    /**
     * Performs 2D Frustum Culling to test whether `object` overlaps the visible camera rectangle.
     *
     * @param object 2D `BrioObject2D` to test
     * @returns `true` if `object` is visible and inside the camera frustum
     * @example
     * ```ts
     * if (camera.isVisible(enemy)) {
     *     renderer.renderObject(enemy);
     * }
     * ```
     */
    public isVisible(object: BrioObject2D): boolean {
        if (!object.transform.visibility || object.transform.opacity <= 0) return false;

        // Reads the shake-adjusted position directly so per-object culling does not allocate
        const rpX = this.#pos.x + this.#shakeOffset.x;
        const rpY = this.#pos.y + this.#shakeOffset.y;
        const viewW = this.#size.x / this.#zoom;
        const viewH = this.#size.y / this.#zoom;

        const ox = object.transform.position.x;
        const oy = object.transform.position.y;
        const ow = object.transform.renderSize.x;
        const oh = object.transform.renderSize.y;

        return !(ox + ow < rpX || ox > rpX + viewW || oy + oh < rpY || oy > rpY + viewH);
    }

    /**
     * Returns a shared singleton fallback `BrioCamera2D` instance.
     */
    public static getEmptyInstance(): BrioCamera2D {
        if (!this.#emptyInstance) {
            this.#emptyInstance = new BrioCamera2D("");
        }
        return this.#emptyInstance;
    }

    #applyBounds(): void {
        if (!this.#bounds) return;
        const viewW = this.#size.x / this.#zoom;
        const viewH = this.#size.y / this.#zoom;

        const maxAllowedX = Math.max(this.#bounds.minX, this.#bounds.maxX - viewW);
        const maxAllowedY = Math.max(this.#bounds.minY, this.#bounds.maxY - viewH);

        this.#pos.setSilent(
            clamp(this.#pos.x, this.#bounds.minX, maxAllowedX),
            clamp(this.#pos.y, this.#bounds.minY, maxAllowedY),
        );
    }
}
