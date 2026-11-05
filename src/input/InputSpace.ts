/**
 * Logical coordinate space for pointer positions (`BrioMouse.logicalSize`, `BrioTouch.logicalSize`). Any object
 * with `width`/`height`, such as the `BrioGame` itself, works; it is read on every event, so resizes apply
 * immediately.
 *
 * @example
 * ```ts
 * game.mouse.logicalSize = game; // positions in game.width x game.height, whatever the backing store
 * ```
 */
export interface InputLogicalSize {
    /** Logical width in pixels. */
    readonly width: number;
    /** Logical height in pixels. */
    readonly height: number;
}

/**
 * Maps client coordinates into the coordinate space of `target`: viewport pixels for `window`, element-local
 * CSS pixels for elements, canvas pixels for a canvas (`logical` size when given, otherwise the backing
 * store `width`/`height`). Writes into `out` so event handlers do not allocate.
 *
 * @param target Event target of the controller
 * @param logical Optional logical canvas size (`logicalSize`)
 * @param clientX `clientX` of the event
 * @param clientY `clientY` of the event
 * @param out Destination object
 * @example
 * ```ts
 * const point = { x: 0, y: 0 };
 * mapClientToTarget(canvas, game, event.clientX, event.clientY, point);
 * ```
 */
export function mapClientToTarget(
    target: HTMLElement | Window,
    logical: InputLogicalSize | undefined,
    clientX: number,
    clientY: number,
    out: { x: number; y: number },
): void {
    if (!(target instanceof HTMLElement)) {
        out.x = clientX;
        out.y = clientY;
        return;
    }
    const rect = target.getBoundingClientRect();
    let scaleX = 1;
    let scaleY = 1;
    if (target instanceof HTMLCanvasElement) {
        const width = logical !== undefined ? logical.width : target.width;
        const height = logical !== undefined ? logical.height : target.height;
        if (rect.width > 0) scaleX = width / rect.width;
        if (rect.height > 0) scaleY = height / rect.height;
    }
    out.x = (clientX - rect.left) * scaleX;
    out.y = (clientY - rect.top) * scaleY;
}
