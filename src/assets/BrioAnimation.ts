import { BrioObject } from "../objects/BrioObject";

/**
 * Configuration options for creating a `BrioAnimation`.
 */
export interface BrioAnimationOptions {
    /** Unique identifier of the animation clip. */
    name: string;
    /** Ordered array of `BrioSprite` asset names making up the animation frames. */
    frames: string[];
    /** Playback speed in frames per second (defaults to `12`). */
    fps?: number;
    /** Whether the animation loops continuously (defaults to `true`). */
    loop?: boolean;
    /** Whether the animation reverses direction at the ends (ping-pong playback, defaults to `false`). */
    pingPong?: boolean;
    /** Optional callback invoked when a non-looping animation reaches its final frame. */
    onComplete?: () => void;
}

/**
 * Time-based sequence of sprite frames (`BrioAnimation`) driven by scene `deltaTime`.
 * Supports standard looping, one-shot playback with `onComplete` callback, and `pingPong` oscillation.
 *
 * @example
 * ```ts
 * const runAnim = new BrioAnimation({
 *     name: "anim_player_run",
 *     frames: ["spr_run_0", "spr_run_1", "spr_run_2", "spr_run_3"],
 *     fps: 12,
 *     loop: true,
 * });
 * runAnim.apply(player, dt);
 * ```
 */
export class BrioAnimation {
    readonly #name: string;
    readonly #frames: string[];
    #fps: number;
    #loop: boolean;
    #pingPong: boolean;
    #onComplete?: () => void;

    #currentIndex: number = 0;
    #elapsed: number = 0;
    #direction: 1 | -1 = 1;
    #playing: boolean = true;

    /**
     * Creates a new `BrioAnimation` clip.
     *
     * @param options Animation configuration
     * @throws {Error} When `frames` is empty
     */
    constructor(options: BrioAnimationOptions) {
        if (!options.frames || options.frames.length === 0) {
            throw new Error("BrioAnimation requires at least one frame.");
        }
        this.#name = options.name;
        this.#frames = options.frames.slice();
        this.#fps = Math.max(0.1, options.fps ?? 12);
        this.#loop = options.loop ?? true;
        this.#pingPong = options.pingPong ?? false;
        this.#onComplete = options.onComplete;
    }

    /** Unique identifier of this animation. */
    public get name(): string {
        return this.#name;
    }

    /** Read-only list of frame sprite names. */
    public get frames(): readonly string[] {
        return this.#frames;
    }

    /** Current frame index (`0 .. frames.length - 1`). */
    public get currentIndex(): number {
        return this.#currentIndex;
    }

    /** Name of the currently active `BrioSprite` frame. */
    public get currentFrame(): string {
        return this.#frames[this.#currentIndex];
    }

    /** Playback rate in frames per second. */
    public get fps(): number {
        return this.#fps;
    }
    public set fps(value: number) {
        this.#fps = Math.max(0.1, value);
    }

    /** Indicates whether the animation is currently playing. */
    public get isPlaying(): boolean {
        return this.#playing;
    }

    /**
     * Resets the animation to its first frame and starts playback.
     */
    public reset(): void {
        this.#currentIndex = 0;
        this.#elapsed = 0;
        this.#direction = 1;
        this.#playing = true;
    }

    /**
     * Pauses animation playback at the current frame.
     */
    public pause(): void {
        this.#playing = false;
    }

    /**
     * Resumes animation playback.
     */
    public resume(): void {
        this.#playing = true;
    }

    /**
     * Advances the animation clock by `dt` seconds and returns the active frame sprite name.
     *
     * @param dt Elapsed frame delta time in seconds
     * @returns Active `BrioSprite` frame name
     * @example
     * ```ts
     * player.sprite = walkAnim.update(dt);
     * ```
     */
    public update(dt: number): string {
        if (!this.#playing || dt <= 0 || this.#frames.length <= 1) {
            return this.#frames[this.#currentIndex];
        }

        const frameDuration = 1 / this.#fps;
        this.#elapsed += dt;

        while (this.#elapsed >= frameDuration && this.#playing) {
            this.#elapsed -= frameDuration;

            if (this.#pingPong) {
                const next = this.#currentIndex + this.#direction;
                if (next >= this.#frames.length) {
                    this.#direction = -1;
                    this.#currentIndex = Math.max(0, this.#frames.length - 2);
                } else if (next < 0) {
                    if (this.#loop) {
                        this.#direction = 1;
                        this.#currentIndex = Math.min(this.#frames.length - 1, 1);
                    } else {
                        this.#currentIndex = 0;
                        this.#playing = false;
                        if (this.#onComplete) this.#onComplete();
                    }
                } else {
                    this.#currentIndex = next;
                }
            } else {
                const next = this.#currentIndex + 1;
                if (next >= this.#frames.length) {
                    if (this.#loop) {
                        this.#currentIndex = 0;
                    } else {
                        this.#currentIndex = this.#frames.length - 1;
                        this.#playing = false;
                        if (this.#onComplete) this.#onComplete();
                    }
                } else {
                    this.#currentIndex = next;
                }
            }
        }

        return this.#frames[this.#currentIndex];
    }

    /**
     * Advances the animation by `dt` seconds and assigns `currentFrame` directly to `target.sprite`.
     *
     * @param target Target `BrioObject` whose `sprite` property will be updated
     * @param dt Elapsed frame delta time in seconds
     * @example
     * ```ts
     * runAnim.apply(player, dt);
     * ```
     */
    public apply(target: BrioObject, dt: number): void {
        target.sprite = this.update(dt);
    }
}
