/**
 * Configures a custom starting timestamp (in seconds) for a named `BrioAudio` inside `BrioAudio.playTogether()`.
 */
export interface StartingTime {
    /** Unique identifier (`audio.name`) of the target `BrioAudio`. */
    name: string;
    /** Starting playback offset in seconds. */
    time: number;
}

/**
 * Playback iteration modes supported by `BrioAudio.playTogether()`.
 */
export type IterationTypes = "once" | "many" | "loop";

/**
 * Configuration options for `BrioAudio.playTogether()`.
 */
export interface PlayTogetherConfig {
    /** Playback iteration mode (`"once"`, `"loop"`, or `"many"`). Defaults to `"once"`. */
    iterationType?: IterationTypes;
    /** Number of sequential repetitions when `iterationType` is `"many"`. */
    iterationQuantity?: number;
    /** Optional list of starting offsets per audio name. */
    startingTime?: StartingTime[];
}

/**
 * Represents an audio asset that can be preloaded, played (overlapping or single-instance),
 * looped, paused, resumed, or orchestrated in groups (`playTogether`, `playInSequence`).
 *
 * @example
 * ```ts
 * game.preload(() => {
 *     const audLaser = new BrioAudio("aud_laser", "./assets/audios/laser.wav");
 *     return [audLaser];
 * });
 * ```
 */
export class BrioAudio {
    /** Unique identifier of the audio asset. */
    #name: string;
    /** Source URL of the audio file. */
    #src: string;
    /** Underlying `HTMLAudioElement` instance. */
    #element: HTMLAudioElement;

    static #emptyInstance?: BrioAudio;

    /**
     * Creates a new `BrioAudio` asset instance.
     *
     * @param name Unique identifier for the audio asset
     * @param src Relative or absolute URL to the audio file
     * @example
     * ```ts
     * game.preload(() => {
     *     const audJump = new BrioAudio("aud_player_jump", "./assets/audios/player_jump.mp3");
     *     return [audJump];
     * });
     * ```
     */
    constructor(name: string, src: string) {
        this.#name = name;
        this.#src = src;

        this.#element = new Audio(this.#src);
    }

    /**
     * GETTERS AND SETTERS -------------------------------------------------------------
     */

    /**
     * Returns the unique identifier name of this `BrioAudio`.
     *
     * @example
     * ```ts
     * const aud = new BrioAudio("aud_player_jump", "./assets/audios/player_jump.mp3");
     * console.log(aud.name); // "aud_player_jump"
     * ```
     */
    public get name(): string {
        return this.#name;
    }

    /**
     * Returns the source URL of this `BrioAudio`.
     *
     * @example
     * ```ts
     * const aud = new BrioAudio("aud_player_jump", "./assets/audios/player_jump.mp3");
     * console.log(aud.src); // "./assets/audios/player_jump.mp3"
     * ```
     */
    public get src(): string {
        return this.#src;
    }

    /**
     * Returns the underlying `HTMLAudioElement` of this `BrioAudio`.
     *
     * @example
     * ```ts
     * const aud = new BrioAudio("aud_player_jump", "./assets/audios/player_jump.mp3");
     * aud.element.volume = 0.5;
     * ```
     */
    public get element(): HTMLAudioElement {
        return this.#element;
    }

    /**
     * Returns the duration of the audio track in seconds, rounded to two decimal places.
     *
     * @example
     * ```ts
     * const aud = assets.getAudio("aud_main_song");
     * console.log(aud.duration); // 122.03
     * ```
     */
    public get duration(): number {
        return Math.round(this.#element.duration * 100) / 100;
    }

    /**
     * Indicates whether the underlying audio element is currently paused.
     *
     * @example
     * ```ts
     * if (bgm.isPaused) {
     *     bgm.resume();
     * }
     * ```
     */
    public get isPaused(): boolean {
        return this.#element.paused;
    }

    /**
     * PUBLIC METHODS -------------------------------------------------------------------
     */

    /**
     * Plays the audio immediately by cloning the underlying audio node, allowing multiple
     * overlapping instances of the same sound effect (e.g. rapid gunfire) to play simultaneously.
     *
     * @example
     * ```ts
     * game.load((assets) => {
     *     const audLaser = assets.getAudio("aud_laser");
     *     audLaser.play();
     *     return [];
     * });
     * ```
     */
    public play(): void {
        const sound = this.#element.cloneNode(true) as HTMLAudioElement;
        sound.loop = false;
        sound.volume = this.#element.volume;
        sound.play();
    }

    /**
     * Plays the audio once on the primary `HTMLAudioElement` only if it is currently paused.
     * Prevents overlapping playback of the same audio instance until it finishes.
     *
     * @example
     * ```ts
     * game.load((assets) => {
     *     const audJump = assets.getAudio("aud_player_jump");
     *     audJump.playOnce();
     *     return [];
     * });
     * ```
     */
    public playOnce(): void {
        this.#element.loop = false;
        if (this.#element.paused) {
            this.#element.play();
        }
    }

    /**
     * Starts playing the audio from a specific timestamp (in seconds) if currently paused.
     *
     * @param timeInSeconds Playback start offset in seconds
     * @example
     * ```ts
     * game.load((assets) => {
     *     const audSong = assets.getAudio("aud_main_song");
     *     audSong.playFromTime(20.5); // Skips the first 20.5 seconds
     *     return [];
     * });
     * ```
     */
    public playFromTime(timeInSeconds: number): void {
        if (this.#element.paused) {
            this.#element.currentTime = timeInSeconds;
            this.#element.play();
        }
    }

    /**
     * Plays the audio `iterations` times in sequence, with an optional `delay` (in milliseconds) between plays.
     * Automatically cleans up its `"ended"` event listener once the final iteration starts.
     *
     * @param iterations Total number of times the audio should play (`>= 1`)
     * @param delay Optional delay in milliseconds between sequential plays
     * @example
     * ```ts
     * game.load((assets) => {
     *     const audBeep = assets.getAudio("aud_alarm");
     *     audBeep.playMany(3, 250); // Plays 3 times with a 250ms pause between each
     *     return [];
     * });
     * ```
     */
    public playMany(iterations: number, delay?: number): void {
        if (iterations <= 0) return;

        this.#element.loop = false;
        this.#element.currentTime = 0;

        if (iterations === 1) {
            this.#element.play();
            return;
        }

        let playCount = 0;

        const handleEnded = () => {
            playCount++;

            if (playCount < iterations - 1) {
                this.#element.currentTime = 0;
                this.#element.play();
            } else if (playCount === iterations - 1) {
                this.#element.currentTime = 0;
                this.#element.play();
                this.#element.removeEventListener("ended", onEndedListener);
            }
        };

        const onEndedListener = delay
            ? () => {
                  setTimeout(() => {
                      handleEnded();
                  }, delay);
              }
            : handleEnded;

        this.#element.play();
        this.#element.addEventListener("ended", onEndedListener);
    }

    /**
     * Plays the audio continuously on a loop if it is currently paused.
     *
     * @example
     * ```ts
     * game.load((assets) => {
     *     const bgm = assets.getAudio("aud_bgm");
     *     bgm.playLoop();
     *     return [];
     * });
     * ```
     */
    public playLoop(): void {
        if (this.#element.paused) {
            this.#element.loop = true;
            this.#element.play();
        }
    }

    /**
     * Pauses the audio if it is currently playing.
     *
     * @example
     * ```ts
     * const bgm = updater.getAudio("aud_bgm");
     * bgm.pause();
     * ```
     */
    public pause(): void {
        if (!this.#element.paused) {
            this.#element.pause();
        }
    }

    /**
     * Resumes playback of the audio if it is currently paused.
     *
     * @example
     * ```ts
     * const bgm = updater.getAudio("aud_bgm");
     * bgm.resume();
     * ```
     */
    public resume(): void {
        if (this.#element.paused) {
            this.#element.play();
        }
    }

    /**
     * Plays `quantity` overlapping instances of the audio simultaneously.
     *
     * @param quantity Number of simultaneous audio instances to trigger
     * @example
     * ```ts
     * const audExplosion = updater.getAudio("aud_explosion");
     * audExplosion.playManyAtTime(3);
     * ```
     */
    public playManyAtTime(quantity: number): void {
        for (let i = 0; i < quantity; i++) {
            this.play();
        }
    }

    /**
     * STATIC METHODS -------------------------------------------------------------------
     */

    /**
     * Plays multiple `BrioAudio` instances simultaneously with shared iteration and start-time configuration.
     *
     * @param audios Array of `BrioAudio` instances to play together
     * @param configurationObject Optional configuration for iteration mode, count, and per-audio starting offsets
     * @throws {Error} When `iterationType` is `"many"` without a valid `iterationQuantity >= 1`, or when `iterationType` is invalid
     * @example
     * ```ts
     * const audFire = assets.getAudio("aud_fire");
     * const audExplosion = assets.getAudio("aud_explosion");
     * BrioAudio.playTogether([audFire, audExplosion], {
     *     iterationType: "once",
     *     startingTime: [{ name: "aud_explosion", time: 0.5 }],
     * });
     * ```
     */
    public static playTogether(
        audios: BrioAudio[],
        configurationObject?: PlayTogetherConfig,
    ): void {
        if (!configurationObject) {
            audios.forEach((audio) => {
                audio.playOnce();
            });

            return;
        }

        if (configurationObject.startingTime && configurationObject.startingTime.length > 0) {
            for (const entry of configurationObject.startingTime) {
                const target = audios.find((a) => a.name === entry.name);
                if (target) {
                    target.element.currentTime = Math.max(0, entry.time);
                }
            }
        }

        const iterationType = configurationObject.iterationType ?? "once";

        switch (iterationType) {
            case "once":
                audios.forEach((audio) => {
                    audio.playOnce();
                });
                break;

            case "loop":
                audios.forEach((audio) => {
                    audio.playLoop();
                });
                break;

            case "many":
                if (
                    !configurationObject.iterationQuantity ||
                    typeof configurationObject.iterationQuantity !== "number" ||
                    configurationObject.iterationQuantity < 1
                ) {
                    throw new Error(
                        "Error iterating through audios: when using iterationType: 'many' you need to add iterationQuantity: [value greater than 0]",
                    );
                }

                audios.forEach((audio) => {
                    if (configurationObject.iterationQuantity) {
                        audio.playMany(configurationObject.iterationQuantity);
                    }
                });
                break;

            default:
                throw new Error(
                    "Error playing through audios: iterationType should be 'once', 'loop' or 'many'",
                );
        }
    }

    /**
     * Plays an array of `BrioAudio` tracks sequentially one after another.
     *
     * @param audios Non-empty array of `BrioAudio` tracks to play in order
     * @returns A Promise that resolves once all tracks in the sequence have finished playing
     * @throws {Error} When `audios` is not a non-empty array
     * @example
     * ```ts
     * await BrioAudio.playInSequence([audIntro, audMainTheme]);
     * ```
     */
    public static playInSequence(audios: BrioAudio[]): Promise<void> {
        if (!audios || audios.length === 0 || !Array.isArray(audios)) {
            throw new Error("playInSequence method shoud receive an Array of BrioAudio objects");
        }

        const playSingleAudio = (audio: HTMLAudioElement) => {
            return new Promise<void>((resolve) => {
                const onEnded = () => cleanup();
                const onError = () => cleanup();

                const cleanup = () => {
                    audio.removeEventListener("ended", onEnded);
                    audio.removeEventListener("error", onError);
                    resolve();
                };

                audio.currentTime = 0;

                audio.addEventListener("ended", onEnded, { once: true });
                audio.addEventListener("error", onError, { once: true });

                audio.play().catch(cleanup);
            });
        };

        const playNext = async (index: number): Promise<void> => {
            if (index >= audios.length) return;
            await playSingleAudio(audios[index].#element);
            await playNext(index + 1);
        };

        return playNext(0);
    }

    /**
     * Returns a shared singleton fallback `BrioAudio` instance when a requested audio asset is not found.
     *
     * @returns Fallback empty `BrioAudio` instance
     */
    public static getEmptyInstance(): BrioAudio {
        if (this.#emptyInstance === undefined) {
            const instance = new BrioAudio("", "");
            this.#emptyInstance = instance;

            return this.#emptyInstance;
        } else {
            return this.#emptyInstance;
        }
    }
}

