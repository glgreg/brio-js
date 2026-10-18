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
 * @example
 * ```ts
 * const mouse = new BrioMouse(canvas);
 * if (mouse.isPressed("left")) {
 *     console.log("Clicked at:", mouse.position);
 * }
 * ```
 */
export class BrioMouse {
    readonly #target: HTMLElement | Window;
    readonly #position: BrioVec2 = new BrioVec2(0, 0);
    readonly #delta: BrioVec2 = new BrioVec2(0, 0);
    #wheelDelta: number = 0;

    readonly #currentButtons = new Map<number, boolean>();
    readonly #previousButtons = new Map<number, boolean>();

    readonly #onMouseMove: (e: MouseEvent) => void;
    readonly #onMouseDown: (e: MouseEvent) => void;
    readonly #onMouseUp: (e: MouseEvent) => void;
    readonly #onWheel: (e: WheelEvent) => void;
    readonly #onContextMenu: (e: MouseEvent) => void;

    /**
     * Creates a new `BrioMouse` controller bound to `target` (typically the game's `HTMLCanvasElement` or `window`).
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
            this.#currentButtons.set(e.button, true);
        };

        this.#onMouseUp = (e: MouseEvent) => {
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

        this.#target.addEventListener("mousemove", this.#onMouseMove as EventListener);
        this.#target.addEventListener("mousedown", this.#onMouseDown as EventListener);
        window.addEventListener("mouseup", this.#onMouseUp);
        this.#target.addEventListener("wheel", this.#onWheel as EventListener, { passive: true });
        this.#target.addEventListener("contextmenu", this.#onContextMenu as EventListener);
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

    /**
     * Returns the pointer coordinates converted into 2D world space using `camera`.
     *
     * @param camera Active `BrioCamera2D`
     * @returns World-space pointer position `{ x, y }`
     * @example
     * ```ts
     * const worldCursor = mouse.getWorldPosition(mainCamera);
     * ```
     */
    public getWorldPosition(camera: BrioCamera2D): Vec2 {
        return camera.screenToWorld(this.#position);
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
     * Checks whether `button` was just pressed on the current frame (down now, up on the previous frame).
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
        const idx = BUTTON_INDEX_MAP[button];
        return this.#currentButtons.get(idx) === true && this.#previousButtons.get(idx) !== true;
    }

    /**
     * Checks whether `button` was just released on the current frame (up now, down on the previous frame).
     *
     * @param button Mouse button name
     * @returns `true` only on the release frame
     * @example
     * ```ts
     * if (mouse.isUp("right")) { ... }
     * ```
     */
    public isUp(button: MouseButton = "left"): boolean {
        const idx = BUTTON_INDEX_MAP[button];
        return this.#currentButtons.get(idx) === false && this.#previousButtons.get(idx) === true;
    }

    /**
     * Synchronizes button states and resets per-frame deltas (`delta`, `wheelDelta`) at the end of a frame.
     */
    public endFrame(): void {
        this.#previousButtons.clear();
        for (const [btn, state] of this.#currentButtons.entries()) {
            this.#previousButtons.set(btn, state);
        }
        this.#delta.set(0, 0);
        this.#wheelDelta = 0;
    }

    /**
     * Detaches all DOM event listeners registered by this `BrioMouse` instance.
     */
    public removeListener(): void {
        this.#target.removeEventListener("mousemove", this.#onMouseMove as EventListener);
        this.#target.removeEventListener("mousedown", this.#onMouseDown as EventListener);
        window.removeEventListener("mouseup", this.#onMouseUp);
        this.#target.removeEventListener("wheel", this.#onWheel as EventListener);
        this.#target.removeEventListener("contextmenu", this.#onContextMenu as EventListener);
    }
}
