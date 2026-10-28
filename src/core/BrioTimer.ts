/**
 * Handle returned when scheduling a timer task in `BrioTimer`.
 * Allows pausing, resuming, or cancelling an individual scheduled task.
 *
 * @example
 * ```ts
 * const handle = timer.after(2.0, () => console.log("Boom!"));
 * handle.cancel();
 * ```
 */
export interface BrioTimerHandle {
    /** Unique numeric ID of the scheduled task. */
    readonly id: number;
    /** Cancels the task so it will no longer execute. */
    cancel(): void;
    /** Pauses this specific task without cancelling it. */
    pause(): void;
    /** Resumes this specific task if paused. */
    resume(): void;
    /** Indicates whether the task is still active in the scheduler. */
    readonly isActive: boolean;
}

interface ScheduledTask {
    id: number;
    type: "after" | "every" | "tween";
    duration: number;
    elapsed: number;
    remainingIterations: number;
    paused: boolean;
    cancelled: boolean;
    onTick: (progress: number) => void;
    onComplete?: () => void;
}

/**
 * Deterministic, frame-synchronized timer and tween scheduler driven by the scene/game `deltaTime` (in seconds).
 * Unlike browser `setTimeout` or `setInterval`, `BrioTimer` automatically respects game pause state
 * and never drifts when the browser tab is backgrounded.
 *
 * @example
 * ```ts
 * const timer = new BrioTimer();
 * timer.after(1.5, () => {
 *     console.log("1.5 seconds of active game time elapsed!");
 * });
 * // Inside game.update((updater, dt) => timer.update(dt)):
 * timer.update(0.016);
 * ```
 */
export class BrioTimer {
    #tasks: ScheduledTask[] = [];
    #nextId: number = 1;
    #paused: boolean = false;

    /** Indicates whether the entire `BrioTimer` scheduler is currently paused. */
    public get isPaused(): boolean {
        return this.#paused;
    }

    /** Number of active tasks currently registered in the scheduler. */
    public get activeTaskCount(): number {
        return this.#tasks.length;
    }

    /**
     * Schedules `callback` to execute once after `delaySeconds` of active game time.
     *
     * @param delaySeconds Delay in seconds (`>= 0`)
     * @param callback Function to invoke when the delay elapses
     * @returns Controllable `BrioTimerHandle`
     * @example
     * ```ts
     * timer.after(0.5, () => {
     *     enemy.transform.visibility = true;
     * });
     * ```
     */
    public after(delaySeconds: number, callback: () => void): BrioTimerHandle {
        return this.#register({
            type: "after",
            duration: Math.max(0, delaySeconds),
            remainingIterations: 1,
            onTick: () => callback(),
        });
    }

    /**
     * Schedules `callback` to execute repeatedly every `intervalSeconds` of active game time.
     *
     * @param intervalSeconds Interval in seconds (`> 0`)
     * @param callback Function invoked on each interval completion
     * @param iterations Maximum number of times to fire (defaults to `Infinity`)
     * @returns Controllable `BrioTimerHandle`
     * @example
     * ```ts
     * const spawner = timer.every(2.0, () => spawnEnemy(), 10);
     * ```
     */
    public every(
        intervalSeconds: number,
        callback: () => void,
        iterations: number = Infinity,
    ): BrioTimerHandle {
        return this.#register({
            type: "every",
            duration: Math.max(1e-6, intervalSeconds),
            remainingIterations: Math.max(0, iterations),
            onTick: () => callback(),
        });
    }

    /**
     * Smoothly interpolates a normalized progress value `t` in `[0, 1]` over `durationSeconds`
     * on every frame update, invoking `onUpdate(t)` each tick and `onComplete()` when finished.
     *
     * @param durationSeconds Total duration of the tween in seconds (`> 0`)
     * @param onUpdate Callback receiving normalized progress `t` in `[0, 1]`
     * @param onComplete Optional callback invoked once when `t` reaches `1`
     * @returns Controllable `BrioTimerHandle`
     * @example
     * ```ts
     * timer.tween(0.4, (t) => {
     *     player.transform.opacity = 1 - t;
     * }, () => game.destroy(player));
     * ```
     */
    public tween(
        durationSeconds: number,
        onUpdate: (progress: number) => void,
        onComplete?: () => void,
    ): BrioTimerHandle {
        return this.#register({
            type: "tween",
            duration: Math.max(1e-6, durationSeconds),
            remainingIterations: 1,
            onTick: onUpdate,
            onComplete,
        });
    }

    /**
     * Advances all active, non-paused tasks by `dt` seconds.
     *
     * @param dt Elapsed frame delta time in seconds
     * @example
     * ```ts
     * timer.update(dt);
     * ```
     */
    public update(dt: number): void {
        if (this.#paused || dt <= 0 || this.#tasks.length === 0) return;

        for (let i = 0; i < this.#tasks.length; i++) {
            const task = this.#tasks[i];
            if (task.cancelled || task.paused) continue;

            if (task.remainingIterations <= 0) {
                task.cancelled = true;
                continue;
            }

            task.elapsed += dt;

            if (task.type === "tween") {
                const progress = Math.min(1, task.elapsed / task.duration);
                task.onTick(progress);
                if (progress >= 1) {
                    task.cancelled = true;
                    if (task.onComplete) task.onComplete();
                }
            } else if (task.type === "after") {
                if (task.elapsed >= task.duration) {
                    task.cancelled = true;
                    task.onTick(1);
                }
            } else if (task.type === "every") {
                while (
                    task.elapsed >= task.duration &&
                    task.remainingIterations > 0 &&
                    !task.cancelled
                ) {
                    task.elapsed -= task.duration;
                    task.remainingIterations--;
                    task.onTick(1);
                    if (task.remainingIterations <= 0) {
                        task.cancelled = true;
                        if (task.onComplete) task.onComplete();
                    }
                }
            }
        }

        // Compact completed/cancelled tasks
        let writeIdx = 0;
        for (let readIdx = 0; readIdx < this.#tasks.length; readIdx++) {
            const task = this.#tasks[readIdx];
            if (!task.cancelled) {
                this.#tasks[writeIdx++] = task;
            }
        }
        this.#tasks.length = writeIdx;
    }

    /**
     * Pauses all tasks managed by this `BrioTimer`.
     */
    public pause(): void {
        this.#paused = true;
    }

    /**
     * Resumes all tasks managed by this `BrioTimer`.
     */
    public resume(): void {
        this.#paused = false;
    }

    /**
     * Cancels and removes all scheduled tasks.
     */
    public clear(): void {
        for (let i = 0; i < this.#tasks.length; i++) {
            this.#tasks[i].cancelled = true;
        }
        this.#tasks.length = 0;
    }

    #register(config: {
        type: "after" | "every" | "tween";
        duration: number;
        remainingIterations: number;
        onTick: (progress: number) => void;
        onComplete?: () => void;
    }): BrioTimerHandle {
        const task: ScheduledTask = {
            id: this.#nextId++,
            type: config.type,
            duration: config.duration,
            elapsed: 0,
            remainingIterations: config.remainingIterations,
            paused: false,
            cancelled: config.remainingIterations <= 0,
            onTick: config.onTick,
            onComplete: config.onComplete,
        };

        if (!task.cancelled) {
            this.#tasks.push(task);
        }

        return {
            get id() {
                return task.id;
            },
            cancel() {
                task.cancelled = true;
            },
            pause() {
                task.paused = true;
            },
            resume() {
                task.paused = false;
            },
            get isActive() {
                return !task.cancelled;
            },
        };
    }
}
