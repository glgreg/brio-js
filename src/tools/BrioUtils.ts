import { BrioObject } from "../objects/BrioObject";
import { BrioGame } from "../game/BrioGame";

/**
 * Collection of general-purpose timing and boundary utility methods for BrioJS games.
 */
export class BrioUtils {
    /**
     * Repeatedly invokes `callbackFn` on every animation frame until `animationDuration` (in milliseconds) elapses.
     *
     * @param callbackFn Callback executed on each frame while the animation is active
     * @param animationDuration Duration in milliseconds before the loop automatically stops
     * @returns A function that can be called to cancel the animation loop early
     * @example
     * ```ts
     * const cancelDash = BrioUtils.timedAnimation(() => {
     *     player.transform.position.x += 12;
     * }, 300);
     * ```
     */
    public static timedAnimation(callbackFn: () => void, animationDuration: number): () => void {
        let animationFrameId: number = 0;
        let cancelled = false;

        const animationLoop = () => {
            if (cancelled) return;
            callbackFn();
            if (!cancelled) {
                animationFrameId = requestAnimationFrame(animationLoop);
            }
        };
        animationLoop();

        const timeoutId = setTimeout(() => {
            cancelled = true;
            cancelAnimationFrame(animationFrameId);
        }, animationDuration);

        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
            cancelAnimationFrame(animationFrameId);
        };
    }

    /**
     * Executes `callbackFn` once after `timeInMilliseconds` has elapsed.
     *
     * @param callbackFn Callback invoked after the delay
     * @param timeInMilliseconds Delay duration in milliseconds
     * @returns A function that cancels the scheduled callback if invoked before the timeout fires
     * @example
     * ```ts
     * BrioUtils.wait(() => {
     *     enemy.transform.visibility = true;
     * }, 1000);
     * ```
     */
    public static wait(callbackFn: () => void, timeInMilliseconds: number): () => void {
        const timeoutId = setTimeout(() => {
            callbackFn();
        }, timeInMilliseconds);

        return () => {
            clearTimeout(timeoutId);
        };
    }

    /**
     * Clamps a scrolling background or map `BrioObject` so its edges never move inside the visible `BrioGame` viewport.
     *
     * @param game Active `BrioGame` instance providing viewport `width`, `height`, and `scale`
     * @param target Map or background `BrioObject` whose `transform.position` will be constrained
     * @example
     * ```ts
     * game.update((updater, dt) => {
     *     const worldMap = updater.getObject("obj_background");
     *     BrioUtils.mapRestrainOffbound(game, worldMap);
     * });
     * ```
     */
    public static mapRestrainOffbound(game: BrioGame, target: BrioObject): void {
        if (target.transform.position.x >= 0) {
            target.transform.position.x = 0;
        } else if (
            target.transform.position.x <= -(target.transform.size.x * game.scale - game.width)
        ) {
            target.transform.position.x = -(target.transform.size.x * game.scale - game.width);
        }
        if (target.transform.position.y >= 0) {
            target.transform.position.y = 0;
        } else if (
            target.transform.position.y <= -(target.transform.size.y * game.scale - game.height)
        ) {
            target.transform.position.y = -(target.transform.size.y * game.scale - game.height);
        }
    }
}

