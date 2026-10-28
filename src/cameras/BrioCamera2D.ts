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
 * Describes the screen space used by `BrioCamera2D.worldToScreen()` and `screenToWorld()`. Every field is
 * optional; omitting all of them keeps the viewport-local, unscaled conversion.
 *
 * @example
 * ```ts
 * const space: CameraScreenSpace2D = { canvasWidth: game.width, canvasHeight: game.height, scale: game.scale };
 * const world = camera.screenToWorld(game.mouse.position, space);
 * ```
 */
export interface CameraScreenSpace2D {
    /**
     * Canvas width in pixels (`game.width`). Together with `canvasHeight`, screen coordinates become canvas
     * pixels and the camera viewport offset is applied (split-screen, minimaps).
     */
    canvasWidth?: number;
    /** Canvas height in pixels (`game.height`). Used only when `canvasWidth` is also given. */
    canvasHeight?: number;
    /**
     * Global render scale (`game.scale`); non-positive values fall back to `1`.
     * @default 1
     */
    scale?: number;
    /**
     * Scroll factor of the layer the point belongs to (`BrioLayer.scrollFactor`).
     * @default { x: 1, y: 1 }
     */
    scrollFactor?: Vec2;
}

/** Scratch storage for a resolved `CameraScreenSpace2D`, so coordinate conversions do not allocate. */
const SCREEN_SPACE = {
    offsetX: 0,
    offsetY: 0,
    viewW: 0,
    viewH: 0,
    scale: 1,
    scrollX: 1,
    scrollY: 1,
};

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
    /**
     * Random source of the screen shake (`Math.random` when unset). `BrioGame.addCamera()` assigns `game.random`,
     * so shakes are reproducible with a fixed seed.
     */
    public random?: { next(): number };
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
     * @param lerpFactor Fraction of the remaining distance covered per 60 Hz frame, in `(0, 1]` (`1` = instant lock,
     * `0.1` = smooth lag); applied framerate-independently as `1 - (1 - lerpFactor)^(dt * 60)`
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
            // `lerpFactor` is the fraction covered per 60 Hz frame; raising its complement to `dt * 60` covers
            // the same distance per second at any framerate (120 Hz takes two smaller steps, 30 Hz one larger)
            const t =
                this.#followLerp >= 1 ? 1 : 1 - Math.pow(1 - this.#followLerp, Math.max(0, dt) * 60);
            let nextX = lerp(this.#pos.x, desiredPosX, t);
            let nextY = lerp(this.#pos.y, desiredPosY, t);
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
                const rx = this.random ? this.random.next() : Math.random();
                const ry = this.random ? this.random.next() : Math.random();
                this.#shakeOffset.x = (rx * 2 - 1) * currentMag;
                this.#shakeOffset.y = (ry * 2 - 1) * currentMag;
            }
        }
    }

    /**
     * Converts a 2D point from world space into screen pixels, applying exactly the transform the compositor
     * draws with: shake-adjusted position, layer scroll factor, `game.scale`, `zoom` and `rotation` (around the
     * viewport center).
     *
     * Without `space.canvasWidth`/`space.canvasHeight` the result is in viewport-local pixels (origin at the
     * top-left of this camera's viewport, sized by `size`). With both, the result is in canvas pixels and the
     * viewport offset is included, so split-screen and minimap cameras map correctly.
     *
     * @param worldPos World-space coordinates `{ x, y }`
     * @param space Optional screen-space description (canvas size, `game.scale`, layer scroll factor)
     * @param out Optional destination object, to avoid allocating in hot paths
     * @returns Screen-space coordinates `{ x, y }` (`out` when given)
     * @example
     * ```ts
     * const local = camera.worldToScreen(player.transform.position);
     * const canvasPt = camera.worldToScreen(player.transform.position, {
     *     canvasWidth: game.width,
     *     canvasHeight: game.height,
     *     scale: game.scale,
     * });
     * ```
     */
    public worldToScreen(worldPos: Vec2, space?: CameraScreenSpace2D, out?: Vec2): Vec2 {
        const result = out ?? { x: 0, y: 0 };
        this.#resolveScreenSpace(space);
        const sp = SCREEN_SPACE;
        const k = this.#zoom * sp.scale;
        const halfW = sp.viewW * 0.5;
        const halfH = sp.viewH * 0.5;
        // Relative to the viewport center, before the camera rotation
        let x = (worldPos.x - this.renderX * sp.scrollX) * k - halfW;
        let y = (worldPos.y - this.renderY * sp.scrollY) * k - halfH;
        if (this.#rotation !== 0) {
            // The compositor rotates the canvas by `-rotation`
            const cos = Math.cos(this.#rotation);
            const sin = Math.sin(this.#rotation);
            const rx = x * cos + y * sin;
            y = -x * sin + y * cos;
            x = rx;
        }
        result.x = sp.offsetX + halfW + x;
        result.y = sp.offsetY + halfH + y;
        return result;
    }

    /**
     * Converts a 2D point from screen pixels into world space; the exact inverse of `worldToScreen()` (rotation,
     * `zoom`, `game.scale`, layer scroll factor, shake and, when the canvas size is given, the viewport offset).
     *
     * Without `space.canvasWidth`/`space.canvasHeight`, `screenPos` is read as viewport-local pixels. With both,
     * it is read as canvas pixels, which is what `BrioMouse.position` reports.
     *
     * @param screenPos Screen-space coordinates `{ x, y }`
     * @param space Optional screen-space description (canvas size, `game.scale`, layer scroll factor)
     * @param out Optional destination object, to avoid allocating in hot paths
     * @returns World-space coordinates `{ x, y }` (`out` when given)
     * @example
     * ```ts
     * const worldClick = camera.screenToWorld(game.mouse.position, {
     *     canvasWidth: game.width,
     *     canvasHeight: game.height,
     *     scale: game.scale,
     * });
     * ```
     */
    public screenToWorld(screenPos: Vec2, space?: CameraScreenSpace2D, out?: Vec2): Vec2 {
        const result = out ?? { x: 0, y: 0 };
        this.#resolveScreenSpace(space);
        const sp = SCREEN_SPACE;
        const k = this.#zoom * sp.scale;
        const halfW = sp.viewW * 0.5;
        const halfH = sp.viewH * 0.5;
        let x = screenPos.x - sp.offsetX - halfW;
        let y = screenPos.y - sp.offsetY - halfH;
        if (this.#rotation !== 0) {
            const cos = Math.cos(this.#rotation);
            const sin = Math.sin(this.#rotation);
            const rx = x * cos - y * sin;
            y = x * sin + y * cos;
            x = rx;
        }
        result.x = (x + halfW) / k + this.renderX * sp.scrollX;
        result.y = (y + halfH) / k + this.renderY * sp.scrollY;
        return result;
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

    /**
     * Fills `SCREEN_SPACE` from `space`, mirroring the compositor: the viewport rectangle is rounded from the
     * canvas size exactly as `BrioCompositor` does, and falls back to `size` in viewport-local mode.
     */
    #resolveScreenSpace(space: CameraScreenSpace2D | undefined): void {
        const sp = SCREEN_SPACE;
        const canvasW = space?.canvasWidth;
        const canvasH = space?.canvasHeight;
        if (canvasW !== undefined && canvasH !== undefined) {
            const vp = this.#viewport;
            sp.offsetX = Math.round(vp.x * canvasW);
            sp.offsetY = Math.round(vp.y * canvasH);
            sp.viewW = Math.round(vp.width * canvasW);
            sp.viewH = Math.round(vp.height * canvasH);
        } else {
            sp.offsetX = 0;
            sp.offsetY = 0;
            sp.viewW = this.#size.x;
            sp.viewH = this.#size.y;
        }
        const scale = space?.scale ?? 1;
        sp.scale = scale > 0 ? scale : 1;
        sp.scrollX = space?.scrollFactor?.x ?? 1;
        sp.scrollY = space?.scrollFactor?.y ?? 1;
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
