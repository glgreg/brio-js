import { Vec2 } from "../math/vec2";

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
 * Tracks active `TouchPoint` contacts, primary touch coordinates, and touch count.
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
    readonly #target: HTMLElement | Window;
    readonly #touches = new Map<number, TouchPoint>();

    readonly #onTouchStart: (e: TouchEvent) => void;
    readonly #onTouchMove: (e: TouchEvent) => void;
    readonly #onTouchEnd: (e: TouchEvent) => void;

    /**
     * Creates a new `BrioTouch` controller bound to `target`.
     *
     * @param target Target DOM element or `window` (defaults to `window`)
     */
    constructor(target: HTMLElement | Window = window) {
        this.#target = target;

        const mapCoord = (clientX: number, clientY: number): Vec2 => {
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
                return {
                    x: (clientX - rect.left) * scaleX,
                    y: (clientY - rect.top) * scaleY,
                };
            }
            return { x: clientX, y: clientY };
        };

        this.#onTouchStart = (e: TouchEvent) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                const pt = mapCoord(t.clientX, t.clientY);
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
            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                const existing = this.#touches.get(t.identifier);
                const pt = mapCoord(t.clientX, t.clientY);
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

        this.#target.addEventListener("touchstart", this.#onTouchStart as EventListener, {
            passive: true,
        });
        this.#target.addEventListener("touchmove", this.#onTouchMove as EventListener, {
            passive: true,
        });
        window.addEventListener("touchend", this.#onTouchEnd, { passive: true });
        window.addEventListener("touchcancel", this.#onTouchEnd, { passive: true });
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
     * Detaches all touch event listeners.
     */
    public removeListener(): void {
        this.#target.removeEventListener("touchstart", this.#onTouchStart as EventListener);
        this.#target.removeEventListener("touchmove", this.#onTouchMove as EventListener);
        window.removeEventListener("touchend", this.#onTouchEnd);
        window.removeEventListener("touchcancel", this.#onTouchEnd);
    }
}
