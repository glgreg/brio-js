import { BrioCamera2D } from "../cameras/BrioCamera2D";
import { BrioVec2, Vec2 } from "../math/vec2";

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

/**
 * Mouse input controller (`BrioMouse`) tracking pointer position (canvas-relative and world-space),
 * movement delta, scroll wheel delta, and button states (`isDown`, `isPressed`, `isUp`).
 *
 * Press and release edges are latched by the DOM events and consumed by `endFrame()`, so a click shorter than
 * one frame still reports `isPressed` and `isUp` once. Held buttons are released when the window loses focus
 * or the page is hidden.
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
    #wheelDelta: number = 0;
    #attached: boolean = false;

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
    readonly #releaseHeld: (value: boolean, button: number) => void;

    /**
     * Creates a new `BrioMouse` controller bound to `target` (typically the game's `HTMLCanvasElement` or `window`)
     * and attaches its listeners. If another controller is attached to the same `target`, that controller is
     * detached first, so creating a second controller for the same canvas never doubles the listeners.
     *
     * @param target Target DOM element or `window` (defaults to `window`)
     * @param preventContextMenu Whether to suppress the right-click context menu on `target` (defaults to `true`)
     */
    constructor(target: HTMLElement | Window = window, preventContextMenu: boolean = true) {
        this.#target = target;

        this.#onMouseMove = (e: MouseEvent) => {
            let nextX = e.clientX;
            let nextY = e.clientY;
            if (this.#target instanceof HTMLElement) {
                const rect = this.#target.getBoundingClientRect();
                const scaleX =
                    this.#target instanceof HTMLCanvasElement && rect.width > 0
                        ? this.#target.width / rect.width
                        : 1;
                const scaleY =
                    this.#target instanceof HTMLCanvasElement && rect.height > 0
                        ? this.#target.height / rect.height
                        : 1;
                nextX = (e.clientX - rect.left) * scaleX;
                nextY = (e.clientY - rect.top) * scaleY;
            }
            this.#delta.set(
                this.#delta.x + (nextX - this.#position.x),
                this.#delta.y + (nextY - this.#position.y),
            );
            this.#position.set(nextX, nextY);
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

    /** Pointer movement delta `{ x, y }` accumulated during the current frame. */
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
     * Returns the pointer coordinates converted into 2D world space through `camera`, honoring its rotation,
     * zoom, shake and viewport (split-screen, minimaps). When the target is a canvas, the position is read as
     * canvas pixels and the camera viewport offset is applied; otherwise it is read as viewport-local pixels.
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
        if (typeof HTMLCanvasElement !== "undefined" && target instanceof HTMLCanvasElement) {
            return camera.screenToWorld(
                this.#position,
                { canvasWidth: target.width, canvasHeight: target.height, scale },
                out,
            );
        }
        return camera.screenToWorld(this.#position, { scale }, out);
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
        }
        this.#attached = true;
        BrioMouse.#activeByTarget.set(this.#target, this);
    }

    /**
     * Detaches all DOM event listeners registered by this `BrioMouse` instance. Idempotent.
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
        }
        this.#attached = false;
        if (BrioMouse.#activeByTarget.get(this.#target) === this) {
            BrioMouse.#activeByTarget.delete(this.#target);
        }
    }
}
