import { BrioCamera2D, CameraScreenSpace2D } from "../cameras/BrioCamera2D";
import { BrioVec2, Vec2 } from "../math/vec2";
import { InputLogicalSize, mapClientToTarget } from "./InputSpace";

/**
 * Standard mouse button names mapped from `MouseEvent.button`.
 */
export type MouseButton = "left" | "middle" | "right" | "back" | "forward";

const BUTTON_INDEX_MAP: Record<MouseButton, number> = {
    left: 0,
    middle: 1,
    right: 2,
    back: 3,
    forward: 4,
};

/** Every `MouseButton` in `MouseEvent.button` index order (`MOUSE_BUTTON_NAMES[i]` is button `i`). */
export const MOUSE_BUTTON_NAMES: readonly MouseButton[] = Object.freeze([
    "left",
    "middle",
    "right",
    "back",
    "forward",
]);

/**
 * Mouse input controller (`BrioMouse`) tracking pointer position (canvas-relative and world-space),
 * movement delta, scroll wheel delta, and button states (`isDown`, `isPressed`, `isUp`).
 *
 * Press and release edges are latched by the DOM events and consumed by `endFrame()`, so a click shorter than
 * one frame still reports `isPressed` and `isUp` once. Held buttons are released when the window loses focus
 * or the page is hidden.
 *
 * On a canvas, positions are canvas pixels: the backing store size by default, or `logicalSize` when set (HiDPI
 * canvases whose backing store is larger than the game's logical resolution). While the pointer is locked
 * (`requestPointerLock()`), `position` stays frozen and `delta` accumulates the raw `movementX`/`movementY`.
 *
 * @example
 * ```ts
 * const mouse = new BrioMouse(canvas);
 * if (mouse.isPressed("left")) {
 *     console.log("Clicked at:", mouse.position);
 * }
 * mouse.endFrame(); // once per frame, after game code (BrioGame does it)
 * ```
 */
export class BrioMouse {
    /** Attached controller per event target, so a second controller on the same target replaces the first. */
    static #activeByTarget: WeakMap<HTMLElement | Window, BrioMouse> = new WeakMap();

    readonly #target: HTMLElement | Window;
    readonly #position: BrioVec2 = new BrioVec2(0, 0);
    readonly #delta: BrioVec2 = new BrioVec2(0, 0);
    readonly #mapped: { x: number; y: number } = { x: 0, y: 0 };
    /** Reused screen space for `getWorldPosition`, so the conversion does not allocate. */
    readonly #screenSpace: CameraScreenSpace2D = {
        canvasWidth: undefined,
        canvasHeight: undefined,
        scale: 1,
    };
    #wheelDelta: number = 0;
    #attached: boolean = false;
    #logicalSize: InputLogicalSize | undefined = undefined;
    #pointerLocked: boolean = false;
    /** After the lock is released the cursor reappears elsewhere: the next move re-bases without a delta jump. */
    #resyncPosition: boolean = false;
    #lockResolve: (() => void) | undefined = undefined;
    #lockReject: ((reason: Error) => void) | undefined = undefined;

    readonly #currentButtons = new Map<number, boolean>();
    /** Buttons that went down since the last `endFrame()`. */
    readonly #pressedEdges = new Set<number>();
    /** Buttons that went up since the last `endFrame()`. */
    readonly #releasedEdges = new Set<number>();

    readonly #onMouseMove: (e: MouseEvent) => void;
    readonly #onMouseDown: (e: MouseEvent) => void;
    readonly #onMouseUp: (e: MouseEvent) => void;
    readonly #onWheel: (e: WheelEvent) => void;
    readonly #onContextMenu: (e: MouseEvent) => void;
    readonly #onBlur: () => void;
    readonly #onVisibilityChange: () => void;
    readonly #onPointerLockChange: () => void;
    readonly #onPointerLockError: () => void;
    readonly #releaseHeld: (value: boolean, button: number) => void;

    /**
     * Creates a new `BrioMouse` controller bound to `target` (typically the game's `HTMLCanvasElement` or `window`)
     * and attaches its listeners. If another controller is attached to the same `target`, that controller is
     * detached first, so creating a second controller for the same canvas never doubles the listeners.
     *
     * @param target Target DOM element or `window` (defaults to `window`)
     * @param preventContextMenu Whether to suppress the right-click context menu on `target` (defaults to `true`)
     * @param logicalSize Optional logical coordinate space for canvas positions (see `logicalSize`)
     */
    constructor(
        target: HTMLElement | Window = window,
        preventContextMenu: boolean = true,
        logicalSize?: InputLogicalSize,
    ) {
        this.#target = target;
        this.#logicalSize = logicalSize;

        this.#onMouseMove = (e: MouseEvent) => {
            if (this.#pointerLocked) {
                // Locked: the cursor is hidden and clientX/Y are frozen, only relative motion is meaningful
                this.#delta.set(
                    this.#delta.x + (e.movementX || 0),
                    this.#delta.y + (e.movementY || 0),
                );
                return;
            }
            const mapped = this.#mapped;
            mapClientToTarget(this.#target, this.#logicalSize, e.clientX, e.clientY, mapped);
            if (this.#resyncPosition) {
                this.#resyncPosition = false;
            } else {
                this.#delta.set(
                    this.#delta.x + (mapped.x - this.#position.x),
                    this.#delta.y + (mapped.y - this.#position.y),
                );
            }
            this.#position.set(mapped.x, mapped.y);
        };

        this.#onMouseDown = (e: MouseEvent) => {
            if (this.#currentButtons.get(e.button) !== true) {
                this.#pressedEdges.add(e.button);
            }
            this.#currentButtons.set(e.button, true);
        };

        this.#onMouseUp = (e: MouseEvent) => {
            if (this.#currentButtons.get(e.button) === true) {
                this.#releasedEdges.add(e.button);
            }
            this.#currentButtons.set(e.button, false);
        };

        this.#onWheel = (e: WheelEvent) => {
            this.#wheelDelta += e.deltaY;
        };

        this.#onContextMenu = (e: MouseEvent) => {
            if (preventContextMenu) {
                e.preventDefault();
            }
        };

        this.#onBlur = () => {
            this.releaseAll();
        };

        this.#onVisibilityChange = () => {
            if (typeof document !== "undefined" && document.visibilityState === "hidden") {
                this.releaseAll();
            }
        };

        this.#onPointerLockChange = () => {
            const locked =
                typeof document !== "undefined" && document.pointerLockElement === this.#target;
            if (this.#pointerLocked && !locked) this.#resyncPosition = true;
            this.#pointerLocked = locked;
            if (locked) this.#settleLock(undefined);
            else if (this.#lockResolve) {
                this.#settleLock(new Error("Pointer lock was taken by another element."));
            }
        };

        this.#onPointerLockError = () => {
            this.#settleLock(new Error("Pointer lock request was denied by the browser."));
        };

        this.#releaseHeld = (value: boolean, button: number) => {
            if (value) {
                this.#currentButtons.set(button, false);
                this.#releasedEdges.add(button);
            }
        };

        this.attach();
    }

    /** Current pointer position `{ x, y }` in canvas pixels. */
    public get position(): Vec2 {
        return this.#position;
    }

    /**
     * Pointer movement delta `{ x, y }` accumulated during the current frame. Unlocked, it is the change of
     * `position` (canvas pixels); while the pointer is locked, it is the sum of raw `movementX`/`movementY`
     * (device-dependent CSS pixels, not scaled to the canvas), the input for mouse-look.
     */
    public get delta(): Vec2 {
        return this.#delta;
    }

    /** Scroll wheel vertical delta accumulated during the current frame. */
    public get wheelDelta(): number {
        return this.#wheelDelta;
    }

    /** Whether this controller currently has its DOM listeners attached. */
    public get isAttached(): boolean {
        return this.#attached;
    }

    /**
     * Logical coordinate space for canvas positions. When set, client coordinates are scaled by
     * `logicalSize.width / rect.width` (and height) instead of the canvas backing store size, so a HiDPI
     * canvas still reports positions in game pixels; `getWorldPosition` uses the same size. It is read on
     * every event, so pass a live object (such as the game) rather than a copy of its numbers.
     *
     * @default undefined (backing store `canvas.width` / `canvas.height`)
     * @example
     * ```ts
     * game.mouse.logicalSize = game;
     * ```
     */
    public get logicalSize(): InputLogicalSize | undefined {
        return this.#logicalSize;
    }
    public set logicalSize(value: InputLogicalSize | undefined) {
        this.#logicalSize = value;
    }

    /**
     * Whether the pointer is currently locked to this controller's target (`document.pointerLockElement`), as
     * reported by the latest `pointerlockchange` event.
     *
     * @example
     * ```ts
     * if (game.mouse.isPointerLocked) camera.yaw -= game.mouse.delta.x * 0.002;
     * ```
     */
    public get isPointerLocked(): boolean {
        return this.#pointerLocked;
    }

    /**
     * Locks the pointer to the target element (Pointer Lock API) for mouse-look: the cursor is hidden,
     * `position` stays where it was and `delta` reports raw relative motion. Browsers only grant the lock
     * inside a user gesture (a click or key handler), and the user can always leave it with Escape. Browsers
     * whose `requestPointerLock()` returns nothing are handled through the `pointerlockchange` and
     * `pointerlockerror` events.
     *
     * @param options Optional `PointerLockOptions` (e.g. `{ unadjustedMovement: true }` to bypass OS mouse
     * acceleration where supported)
     * @returns A promise that resolves once the lock is active, and rejects when the target is not an element,
     * the API is unavailable, or the browser denies the request
     * @example
     * ```ts
     * canvas.addEventListener("click", () => {
     *     game.mouse.requestPointerLock().catch(() => {});
     * });
     * ```
     */
    public requestPointerLock(options?: PointerLockOptions): Promise<void> {
        const target = this.#target;
        if (!(target instanceof HTMLElement) || typeof target.requestPointerLock !== "function") {
            return Promise.reject(
                new Error(
                    "Pointer lock needs an element target that supports requestPointerLock().",
                ),
            );
        }
        if (this.#pointerLocked) return Promise.resolve();
        // A newer request supersedes an unsettled one
        this.#settleLock(new Error("Pointer lock request was superseded."));
        const pending = new Promise<void>((resolve, reject) => {
            this.#lockResolve = resolve;
            this.#lockReject = reject;
        });
        let result: Promise<void> | undefined;
        try {
            result = target.requestPointerLock(options) as Promise<void> | undefined;
        } catch (error) {
            this.#settleLock(error instanceof Error ? error : new Error(String(error)));
            return pending;
        }
        if (result && typeof result.then === "function") {
            result.then(
                () => this.#settleLock(undefined),
                (error: unknown) =>
                    this.#settleLock(error instanceof Error ? error : new Error(String(error))),
            );
        }
        return pending;
    }

    /**
     * Releases the pointer lock if this controller's target holds it. Safe to call at any time.
     *
     * @example
     * ```ts
     * if (game.keyboard.isPressed("Escape")) game.mouse.exitPointerLock();
     * ```
     */
    public exitPointerLock(): void {
        if (typeof document === "undefined") return;
        if (
            document.pointerLockElement === this.#target &&
            typeof document.exitPointerLock === "function"
        ) {
            document.exitPointerLock();
        }
    }

    /** Resolves (`error` undefined) or rejects the pending lock request, if any. */
    #settleLock(error: Error | undefined): void {
        const resolve = this.#lockResolve;
        const reject = this.#lockReject;
        this.#lockResolve = undefined;
        this.#lockReject = undefined;
        if (error === undefined) resolve?.();
        else reject?.(error);
    }

    /**
     * Returns the pointer coordinates converted into 2D world space through `camera`, honoring its rotation,
     * zoom, shake and viewport (split-screen, minimaps). When the target is a canvas, the position is read as
     * canvas pixels (in the `logicalSize` space when set) and the camera viewport offset is applied; otherwise it
     * is read as viewport-local pixels.
     *
     * @param camera Active `BrioCamera2D`
     * @param scale Global render scale (`game.scale`) (defaults to `1`)
     * @param out Optional destination object, to avoid allocating
     * @returns World-space pointer position `{ x, y }` (`out` when given)
     * @example
     * ```ts
     * const worldCursor = game.mouse.getWorldPosition(mainCamera, game.scale);
     * ```
     */
    public getWorldPosition(camera: BrioCamera2D, scale: number = 1, out?: Vec2): Vec2 {
        const target = this.#target;
        const space = this.#screenSpace;
        space.scale = scale;
        if (typeof HTMLCanvasElement !== "undefined" && target instanceof HTMLCanvasElement) {
            const logical = this.#logicalSize;
            space.canvasWidth = logical !== undefined ? logical.width : target.width;
            space.canvasHeight = logical !== undefined ? logical.height : target.height;
        } else {
            space.canvasWidth = undefined;
            space.canvasHeight = undefined;
        }
        return camera.screenToWorld(this.#position, space, out);
    }

    /**
     * Checks whether `button` is currently held down.
     *
     * @param button Mouse button name (`"left"`, `"middle"`, `"right"`, `"back"`, `"forward"`)
     * @returns `true` while held down
     * @example
     * ```ts
     * if (mouse.isDown("left")) { ... }
     * ```
     */
    public isDown(button: MouseButton = "left"): boolean {
        const idx = BUTTON_INDEX_MAP[button];
        return this.#currentButtons.get(idx) === true;
    }

    /**
     * Checks whether `button` went down during the current frame. A click shorter than one frame still
     * reports `true` once (together with `isUp`).
     *
     * @param button Mouse button name
     * @returns `true` only on the initial press frame
     * @example
     * ```ts
     * if (mouse.isPressed("left")) {
     *     player.shoot();
     * }
     * ```
     */
    public isPressed(button: MouseButton = "left"): boolean {
        return this.#pressedEdges.has(BUTTON_INDEX_MAP[button]);
    }

    /**
     * Checks whether `button` was released during the current frame (including releases forced by window
     * `blur`).
     *
     * @param button Mouse button name
     * @returns `true` only on the release frame
     * @example
     * ```ts
     * if (mouse.isUp("right")) { ... }
     * ```
     */
    public isUp(button: MouseButton = "left"): boolean {
        return this.#releasedEdges.has(BUTTON_INDEX_MAP[button]);
    }

    /**
     * Releases every held button as if its `mouseup` had arrived (each reports `isUp` on the current frame).
     * Called automatically on window `blur` and when the page becomes hidden.
     *
     * @example
     * ```ts
     * game.mouse.releaseAll();
     * ```
     */
    public releaseAll(): void {
        this.#currentButtons.forEach(this.#releaseHeld);
    }

    /**
     * Closes the input frame: consumes the latched press/release edges and resets per-frame deltas
     * (`delta`, `wheelDelta`). Must run exactly once per frame, after game code.
     *
     * @example
     * ```ts
     * mouse.endFrame();
     * ```
     */
    public endFrame(): void {
        this.#pressedEdges.clear();
        this.#releasedEdges.clear();
        this.#delta.set(0, 0);
        this.#wheelDelta = 0;
    }

    /**
     * Attaches the DOM listeners. Idempotent: calling it while attached does nothing. Any other controller
     * attached to the same target is detached first.
     *
     * @example
     * ```ts
     * game.mouse.removeListener();
     * game.mouse.attach();
     * ```
     */
    public attach(): void {
        if (this.#attached) return;
        const previous = BrioMouse.#activeByTarget.get(this.#target);
        if (previous && previous !== this) previous.removeListener();

        this.#target.addEventListener("mousemove", this.#onMouseMove as EventListener);
        this.#target.addEventListener("mousedown", this.#onMouseDown as EventListener);
        window.addEventListener("mouseup", this.#onMouseUp);
        this.#target.addEventListener("wheel", this.#onWheel as EventListener, { passive: true });
        this.#target.addEventListener("contextmenu", this.#onContextMenu as EventListener);
        window.addEventListener("blur", this.#onBlur);
        if (typeof document !== "undefined") {
            document.addEventListener("visibilitychange", this.#onVisibilityChange);
            document.addEventListener("pointerlockchange", this.#onPointerLockChange);
            document.addEventListener("pointerlockerror", this.#onPointerLockError);
            this.#pointerLocked = document.pointerLockElement === this.#target;
        }
        this.#attached = true;
        BrioMouse.#activeByTarget.set(this.#target, this);
    }

    /**
     * Detaches all DOM event listeners registered by this `BrioMouse` instance and rejects a pending
     * `requestPointerLock()`. Idempotent. An active pointer lock is left alone (`exitPointerLock()` ends it).
     *
     * @example
     * ```ts
     * game.mouse.removeListener();
     * ```
     */
    public removeListener(): void {
        if (!this.#attached) return;
        this.#target.removeEventListener("mousemove", this.#onMouseMove as EventListener);
        this.#target.removeEventListener("mousedown", this.#onMouseDown as EventListener);
        window.removeEventListener("mouseup", this.#onMouseUp);
        this.#target.removeEventListener("wheel", this.#onWheel as EventListener);
        this.#target.removeEventListener("contextmenu", this.#onContextMenu as EventListener);
        window.removeEventListener("blur", this.#onBlur);
        if (typeof document !== "undefined") {
            document.removeEventListener("visibilitychange", this.#onVisibilityChange);
            document.removeEventListener("pointerlockchange", this.#onPointerLockChange);
            document.removeEventListener("pointerlockerror", this.#onPointerLockError);
        }
        // Without the listeners a pending request could never settle
        this.#settleLock(new Error("Mouse controller was detached."));
        this.#attached = false;
        if (BrioMouse.#activeByTarget.get(this.#target) === this) {
            BrioMouse.#activeByTarget.delete(this.#target);
        }
    }
}
