import { Vec2 } from "../math/vec2";
import { InputLogicalSize, mapClientToTarget } from "./InputSpace";

/**
 * Represents a single active touch contact point on the screen.
 */
export interface TouchPoint {
    /** Unique touch identifier from `Touch.identifier`. */
    id: number;
    /** Current X position in canvas/element pixels. */
    x: number;
    /** Current Y position in canvas/element pixels. */
    y: number;
    /** Initial X position where this touch started. */
    startX: number;
    /** Initial Y position where this touch started. */
    startY: number;
}

/**
 * Multi-touch input controller (`BrioTouch`) for Web Mobile and Capacitor environments.
 * Tracks active `TouchPoint` contacts, primary touch coordinates, and touch count. Active contacts are
 * cleared when the window loses focus or the page is hidden. On a canvas, positions are canvas pixels: the
 * backing store size by default, or `logicalSize` when set (HiDPI canvases).
 *
 * @example
 * ```ts
 * const touch = new BrioTouch(canvas);
 * if (touch.isTouching) {
 *     player.transform.position.x = touch.primaryPosition.x;
 * }
 * ```
 */
export class BrioTouch {
    /** Attached controller per event target, so a second controller on the same target replaces the first. */
    static #activeByTarget: WeakMap<HTMLElement | Window, BrioTouch> = new WeakMap();

    readonly #target: HTMLElement | Window;
    readonly #touches = new Map<number, TouchPoint>();
    readonly #mapped: { x: number; y: number } = { x: 0, y: 0 };
    #attached: boolean = false;
    #logicalSize: InputLogicalSize | undefined = undefined;

    readonly #onTouchStart: (e: TouchEvent) => void;
    readonly #onTouchMove: (e: TouchEvent) => void;
    readonly #onTouchEnd: (e: TouchEvent) => void;
    readonly #onBlur: () => void;
    readonly #onVisibilityChange: () => void;

    /**
     * Creates a new `BrioTouch` controller bound to `target` and attaches its listeners. If another controller
     * is attached to the same `target`, that controller is detached first, so creating a second controller for
     * the same canvas never doubles the listeners.
     *
     * @param target Target DOM element or `window` (defaults to `window`)
     * @param logicalSize Optional logical coordinate space for canvas positions (see `logicalSize`)
     */
    constructor(target: HTMLElement | Window = window, logicalSize?: InputLogicalSize) {
        this.#target = target;
        this.#logicalSize = logicalSize;

        this.#onTouchStart = (e: TouchEvent) => {
            const pt = this.#mapped;
            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                mapClientToTarget(this.#target, this.#logicalSize, t.clientX, t.clientY, pt);
                this.#touches.set(t.identifier, {
                    id: t.identifier,
                    x: pt.x,
                    y: pt.y,
                    startX: pt.x,
                    startY: pt.y,
                });
            }
        };

        this.#onTouchMove = (e: TouchEvent) => {
            const pt = this.#mapped;
            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                const existing = this.#touches.get(t.identifier);
                mapClientToTarget(this.#target, this.#logicalSize, t.clientX, t.clientY, pt);
                if (existing) {
                    existing.x = pt.x;
                    existing.y = pt.y;
                } else {
                    this.#touches.set(t.identifier, {
                        id: t.identifier,
                        x: pt.x,
                        y: pt.y,
                        startX: pt.x,
                        startY: pt.y,
                    });
                }
            }
        };

        this.#onTouchEnd = (e: TouchEvent) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                this.#touches.delete(t.identifier);
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

        this.attach();
    }

    /** Whether this controller currently has its DOM listeners attached. */
    public get isAttached(): boolean {
        return this.#attached;
    }

    /**
     * Logical coordinate space for canvas positions. When set, client coordinates are scaled by
     * `logicalSize.width / rect.width` (and height) instead of the canvas backing store size, so a HiDPI
     * canvas still reports touches in game pixels. It is read on every event, so pass a live object (such as
     * the game) rather than a copy of its numbers.
     *
     * @default undefined (backing store `canvas.width` / `canvas.height`)
     * @example
     * ```ts
     * game.touch.logicalSize = game;
     * ```
     */
    public get logicalSize(): InputLogicalSize | undefined {
        return this.#logicalSize;
    }
    public set logicalSize(value: InputLogicalSize | undefined) {
        this.#logicalSize = value;
    }

    /**
     * Attaches the DOM listeners. Idempotent: calling it while attached does nothing. Any other controller
     * attached to the same target is detached first.
     *
     * @example
     * ```ts
     * game.touch.removeListener();
     * game.touch.attach();
     * ```
     */
    public attach(): void {
        if (this.#attached) return;
        const previous = BrioTouch.#activeByTarget.get(this.#target);
        if (previous && previous !== this) previous.removeListener();

        this.#target.addEventListener("touchstart", this.#onTouchStart as EventListener, {
            passive: true,
        });
        this.#target.addEventListener("touchmove", this.#onTouchMove as EventListener, {
            passive: true,
        });
        window.addEventListener("touchend", this.#onTouchEnd, { passive: true });
        window.addEventListener("touchcancel", this.#onTouchEnd, { passive: true });
        window.addEventListener("blur", this.#onBlur);
        if (typeof document !== "undefined") {
            document.addEventListener("visibilitychange", this.#onVisibilityChange);
        }
        this.#attached = true;
        BrioTouch.#activeByTarget.set(this.#target, this);
    }

    /**
     * Clears every active touch contact, as if all fingers were lifted. Called automatically on window
     * `blur` and when the page becomes hidden.
     *
     * @example
     * ```ts
     * game.touch.releaseAll();
     * ```
     */
    public releaseAll(): void {
        this.#touches.clear();
    }

    /** Indicates whether at least one finger is currently touching the screen. */
    public get isTouching(): boolean {
        return this.#touches.size > 0;
    }

    /** Number of simultaneous active touch contacts. */
    public get touchCount(): number {
        return this.#touches.size;
    }

    /** Array of all active `TouchPoint` contacts. */
    public get touches(): TouchPoint[] {
        return Array.from(this.#touches.values());
    }

    /** Position `{ x, y }` of the first active touch contact, or `{ x: 0, y: 0 }` if none. */
    public get primaryPosition(): Vec2 {
        const first = this.#touches.values().next().value as TouchPoint | undefined;
        return first ? { x: first.x, y: first.y } : { x: 0, y: 0 };
    }

    /**
     * Detaches all touch event listeners. Idempotent.
     *
     * @example
     * ```ts
     * game.touch.removeListener();
     * ```
     */
    public removeListener(): void {
        if (!this.#attached) return;
        this.#target.removeEventListener("touchstart", this.#onTouchStart as EventListener);
        this.#target.removeEventListener("touchmove", this.#onTouchMove as EventListener);
        window.removeEventListener("touchend", this.#onTouchEnd);
        window.removeEventListener("touchcancel", this.#onTouchEnd);
        window.removeEventListener("blur", this.#onBlur);
        if (typeof document !== "undefined") {
            document.removeEventListener("visibilitychange", this.#onVisibilityChange);
        }
        this.#attached = false;
        if (BrioTouch.#activeByTarget.get(this.#target) === this) {
            BrioTouch.#activeByTarget.delete(this.#target);
        }
    }
}
