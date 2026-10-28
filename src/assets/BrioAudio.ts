import { AudioBusName, BrioAudioMixer } from "../audio/BrioAudioMixer";

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
 * Options for creating a `BrioAudio`.
 */
export interface BrioAudioOptions {
    /** Mixer bus the audio plays through (`"sfx"` by default; use `"bgm"` for music). */
    bus?: Exclude<AudioBusName, "master">;
    /** Per-audio volume in `[0, 1]` (defaults to `1`), multiplied by the bus and master volumes. */
    volume?: number;
    /** Maximum overlapping `play()` voices; the oldest is stopped when exceeded (defaults to `16`). */
    maxVoices?: number;
}

/** One playing `AudioBufferSourceNode` (Web Audio mode). */
interface Voice {
    source: AudioBufferSourceNode;
    /** `AudioContext.currentTime` when the source started. */
    startedAt: number;
    /** Buffer offset (seconds) the source started from. */
    offset: number;
    loop: boolean;
}

/** Calls `element.play()` and swallows the rejection browsers raise when autoplay is blocked. */
function safePlay(element: HTMLAudioElement): void {
    try {
        const result = element.play() as Promise<void> | undefined;
        result?.catch?.(() => {});
    } catch {
        // jsdom and very old runtimes may throw synchronously
    }
}

/**
 * Represents an audio asset that can be preloaded, played (overlapping or single-instance),
 * looped, paused, resumed, or orchestrated in groups (`playTogether`, `playInSequence`).
 *
 * When the runtime supports the **Web Audio API**, `load()` (called by `game.preload()`) fetches and decodes the
 * file into an `AudioBuffer`, and every play creates an `AudioBufferSourceNode` routed through the audio's own
 * gain and its `BrioAudioMixer` bus (`"sfx"` or `"bgm"`), which feeds `"master"`. Otherwise it falls back to
 * `HTMLAudioElement` playback, with bus volumes applied to the element volume.
 *
 * @example
 * ```ts
 * game.preload(() => {
 *     const audLaser = new BrioAudio("aud_laser", "./assets/audios/laser.wav");
 *     const bgm = new BrioAudio("aud_theme", "./assets/audios/theme.ogg", { bus: "bgm", volume: 0.6 });
 *     return [audLaser, bgm];
 * });
 * ```
 */
export class BrioAudio {
    /** Unique identifier of the audio asset. */
    #name: string;
    /** Source URL of the audio file. */
    #src: string;
    /** Underlying `HTMLAudioElement`, created on first use (fallback playback and legacy access). */
    #element?: HTMLAudioElement;
    #bus: Exclude<AudioBusName, "master">;
    #volume: number;
    #maxVoices: number;

    /** Decoded audio data (Web Audio mode). */
    #buffer?: AudioBuffer;
    /** Per-audio gain feeding the bus input (Web Audio mode). */
    #output?: GainNode;
    /** Overlapping voices started by `play()`. */
    readonly #voices: Voice[] = [];
    /** Single-instance voice used by `playOnce`, `playLoop`, `playFromTime`, `playMany`, `pause`, `resume`. */
    #primary?: Voice;
    /** Offset and loop mode of the primary voice when it was paused. */
    #paused?: { offset: number; loop: boolean };
    #onPrimaryEnded?: () => void;
    #loaded: boolean = false;
    #unsubscribeVolume?: () => void;

    static #emptyInstance?: BrioAudio;

    /**
     * Creates a new `BrioAudio` asset instance.
     *
     * @param name Unique identifier for the audio asset
     * @param src Relative or absolute URL to the audio file
     * @param options Optional bus, volume, and voice limit
     * @example
     * ```ts
     * game.preload(() => {
     *     const audJump = new BrioAudio("aud_player_jump", "./assets/audios/player_jump.mp3");
     *     return [audJump];
     * });
     * ```
     */
    constructor(name: string, src: string, options: BrioAudioOptions = {}) {
        this.#name = name;
        this.#src = src;
        this.#bus = options.bus ?? "sfx";
        this.#volume = BrioAudio.#clampVolume(options.volume ?? 1);
        this.#maxVoices = Math.max(1, Math.floor(options.maxVoices ?? 16));
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
     * Returns the underlying `HTMLAudioElement` of this `BrioAudio` (created on first access).
     * In Web Audio mode playback does not use it.
     *
     * @example
     * ```ts
     * const aud = new BrioAudio("aud_player_jump", "./assets/audios/player_jump.mp3");
     * aud.element.preload = "auto";
     * ```
     */
    public get element(): HTMLAudioElement {
        if (!this.#element) {
            this.#element = new Audio(this.#src);
            this.#applyElementVolume();
            this.#unsubscribeVolume = BrioAudioMixer.onVolumeChange(() => this.#applyElementVolume());
        }
        return this.#element;
    }

    /** Mixer bus this audio plays through (`"sfx"` or `"bgm"`). */
    public get bus(): Exclude<AudioBusName, "master"> {
        return this.#bus;
    }
    public set bus(value: Exclude<AudioBusName, "master">) {
        if (value === this.#bus) return;
        this.#bus = value;
        if (this.#output) {
            this.#output.disconnect();
            const input = BrioAudioMixer.busInput(value);
            if (input) this.#output.connect(input);
        }
        this.#applyElementVolume();
    }

    /** Per-audio volume in `[0, 1]`, multiplied by the bus and master volumes. */
    public get volume(): number {
        return this.#volume;
    }
    public set volume(value: number) {
        this.#volume = BrioAudio.#clampVolume(value);
        if (this.#output) this.#output.gain.value = this.#volume;
        this.#applyElementVolume();
    }

    /** Whether the audio plays through the Web Audio API (decoded `AudioBuffer`) instead of `HTMLAudioElement`. */
    public get usesWebAudio(): boolean {
        return this.#buffer !== undefined;
    }

    /** Whether `load()` finished. */
    public get isLoaded(): boolean {
        return this.#loaded;
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
        const seconds = this.#buffer ? this.#buffer.duration : this.element.duration;
        return Math.round(seconds * 100) / 100;
    }

    /**
     * Indicates whether the single-instance playback (`playOnce`, `playLoop`, ...) is currently stopped or paused.
     *
     * @example
     * ```ts
     * if (bgm.isPaused) {
     *     bgm.resume();
     * }
     * ```
     */
    public get isPaused(): boolean {
        if (this.#buffer) return this.#primary === undefined;
        return this.element.paused;
    }

    /**
     * Number of voices currently playing (overlapping `play()` voices plus the single-instance voice).
     * Always `0` in fallback mode, where voices are not tracked.
     */
    public get activeVoices(): number {
        return this.#voices.length + (this.#primary ? 1 : 0);
    }

    /**
     * PUBLIC METHODS -------------------------------------------------------------------
     */

    /**
     * Loads the audio: with Web Audio, fetches and decodes it into an `AudioBuffer`; otherwise waits until the
     * `HTMLAudioElement` can play through. Called automatically by `game.preload()`.
     *
     * @returns Resolves once the audio is playable
     * @throws {Error} When the file cannot be fetched or decoded
     */
    public async load(): Promise<void> {
        if (this.#loaded) return;
        if (BrioAudioMixer.context && typeof fetch === "function") {
            const response = await fetch(this.#src);
            if (!response.ok) {
                throw new Error(`Error loading the audio '${this.#name}': HTTP ${response.status}`);
            }
            this.#buffer = await BrioAudioMixer.decode(await response.arrayBuffer());
        } else {
            await new Promise<void>((resolve, reject) => {
                const element = this.element;
                const onReady = (): void => {
                    cleanup();
                    resolve();
                };
                const onError = (): void => {
                    cleanup();
                    reject(new Error(`Error loading the audio '${this.#name}' from '${this.#src}'.`));
                };
                const cleanup = (): void => {
                    element.removeEventListener("canplaythrough", onReady);
                    element.removeEventListener("error", onError);
                };
                if (element.readyState >= 4) {
                    resolve();
                    return;
                }
                element.addEventListener("canplaythrough", onReady);
                element.addEventListener("error", onError);
            });
        }
        this.#loaded = true;
    }

    /**
     * Plays a new overlapping instance of the audio, allowing multiple instances of the same sound effect
     * (e.g. rapid gunfire) to play simultaneously. With Web Audio, at most `maxVoices` overlap.
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
        if (this.#buffer) {
            if (this.#voices.length >= this.#maxVoices) {
                this.#stopVoice(this.#voices.shift()!);
            }
            const voice = this.#startVoice(0, false, () => {
                const index = this.#voices.indexOf(voice!);
                if (index !== -1) this.#voices.splice(index, 1);
            });
            if (voice) this.#voices.push(voice);
            return;
        }
        const sound = this.element.cloneNode(true) as HTMLAudioElement;
        sound.loop = false;
        sound.volume = this.element.volume;
        safePlay(sound);
    }

    /**
     * Plays the audio once on the single-instance voice only if it is currently stopped or paused.
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
        if (this.#buffer) {
            if (!this.#primary) this.#startPrimary(0, false);
            return;
        }
        this.element.loop = false;
        if (this.element.paused) {
            safePlay(this.element);
        }
    }

    /**
     * Starts playing the audio from a specific timestamp (in seconds) if currently stopped or paused.
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
        if (this.#buffer) {
            if (!this.#primary) this.#startPrimary(Math.max(0, timeInSeconds), false);
            return;
        }
        if (this.element.paused) {
            this.element.currentTime = timeInSeconds;
            safePlay(this.element);
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

        if (this.#buffer) {
            this.#stopPrimary();
            let remaining = iterations;
            const next = (): void => {
                remaining--;
                this.#startPrimary(0, false, () => {
                    if (remaining <= 0) return;
                    if (delay) setTimeout(next, delay);
                    else next();
                });
            };
            next();
            return;
        }

        const element = this.element;
        element.loop = false;
        element.currentTime = 0;

        if (iterations === 1) {
            safePlay(element);
            return;
        }

        let playCount = 0;

        const handleEnded = () => {
            playCount++;

            if (playCount < iterations - 1) {
                element.currentTime = 0;
                safePlay(element);
            } else if (playCount === iterations - 1) {
                element.currentTime = 0;
                safePlay(element);
                element.removeEventListener("ended", onEndedListener);
            }
        };

        const onEndedListener = delay
            ? () => {
                  setTimeout(() => {
                      handleEnded();
                  }, delay);
              }
            : handleEnded;

        safePlay(element);
        element.addEventListener("ended", onEndedListener);
    }

    /**
     * Plays the audio continuously on a loop if it is currently stopped or paused.
     *
     * @param fromTime Optional start offset in seconds for the first iteration (defaults to `0`)
     * @example
     * ```ts
     * game.load((assets) => {
     *     const bgm = assets.getAudio("aud_bgm");
     *     bgm.playLoop();
     *     return [];
     * });
     * ```
     */
    public playLoop(fromTime: number = 0): void {
        if (this.#buffer) {
            if (!this.#primary) this.#startPrimary(Math.max(0, fromTime), true);
            return;
        }
        if (this.element.paused) {
            if (fromTime > 0) this.element.currentTime = fromTime;
            this.element.loop = true;
            safePlay(this.element);
        }
    }

    /**
     * Pauses the single-instance playback if it is currently playing (`resume()` continues from the same point).
     *
     * @example
     * ```ts
     * const bgm = updater.getAudio("aud_bgm");
     * bgm.pause();
     * ```
     */
    public pause(): void {
        if (this.#buffer) {
            const voice = this.#primary;
            if (!voice) return;
            const context = BrioAudioMixer.context!;
            const duration = this.#buffer.duration || 1;
            let offset = voice.offset + (context.currentTime - voice.startedAt);
            offset = voice.loop ? offset % duration : Math.min(offset, duration);
            this.#paused = { offset, loop: voice.loop };
            this.#onPrimaryEnded = undefined;
            this.#stopPrimary(false);
            return;
        }
        if (!this.element.paused) {
            this.element.pause();
        }
    }

    /**
     * Resumes the single-instance playback if it is currently paused.
     *
     * @example
     * ```ts
     * const bgm = updater.getAudio("aud_bgm");
     * bgm.resume();
     * ```
     */
    public resume(): void {
        if (this.#buffer) {
            if (this.#primary) return;
            const paused = this.#paused ?? { offset: 0, loop: false };
            this.#startPrimary(paused.offset, paused.loop);
            return;
        }
        if (this.element.paused) {
            safePlay(this.element);
        }
    }

    /**
     * Stops every voice of this audio and rewinds it (a later `resume()` starts from the beginning).
     *
     * @example
     * ```ts
     * bgm.stop();
     * ```
     */
    public stop(): void {
        if (this.#buffer) {
            while (this.#voices.length > 0) this.#stopVoice(this.#voices.pop()!);
            this.#onPrimaryEnded = undefined;
            this.#stopPrimary();
            return;
        }
        if (this.#element) {
            this.#element.pause();
            this.#element.currentTime = 0;
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
     * Stops playback and releases the decoded buffer, the audio graph nodes, and the mixer subscription.
     */
    public dispose(): void {
        this.stop();
        this.#output?.disconnect();
        this.#output = undefined;
        this.#buffer = undefined;
        this.#loaded = false;
        this.#unsubscribeVolume?.();
        this.#unsubscribeVolume = undefined;
    }

    /** Starts the single-instance voice; `onEnded` runs when it finishes naturally (not on pause/stop). */
    #startPrimary(offset: number, loop: boolean, onEnded?: () => void): void {
        this.#stopPrimary(false);
        this.#paused = undefined;
        this.#onPrimaryEnded = onEnded;
        this.#primary = this.#startVoice(offset, loop, () => {
            this.#primary = undefined;
            const callback = this.#onPrimaryEnded;
            this.#onPrimaryEnded = undefined;
            callback?.();
        });
    }

    #stopPrimary(clearPaused: boolean = true): void {
        if (clearPaused) this.#paused = undefined;
        const voice = this.#primary;
        this.#primary = undefined;
        if (voice) this.#stopVoice(voice);
    }

    /** Creates and starts a buffer source routed through this audio's gain and its bus. */
    #startVoice(offset: number, loop: boolean, onEnded: () => void): Voice | undefined {
        const context = BrioAudioMixer.context;
        if (!context || !this.#buffer) return undefined;
        if (!this.#output) {
            this.#output = context.createGain();
            this.#output.gain.value = this.#volume;
            const input = BrioAudioMixer.busInput(this.#bus);
            this.#output.connect(input ?? context.destination);
        }
        const source = context.createBufferSource();
        source.buffer = this.#buffer;
        source.loop = loop;
        source.connect(this.#output);
        const voice: Voice = { source, startedAt: context.currentTime, offset, loop };
        source.onended = () => {
            source.onended = null;
            source.disconnect();
            onEnded();
        };
        source.start(0, Math.min(offset, Math.max(0, this.#buffer.duration - 1e-4)));
        return voice;
    }

    /** Stops `voice` without running its natural-end callback. */
    #stopVoice(voice: Voice): void {
        voice.source.onended = null;
        try {
            voice.source.stop();
        } catch {
            // Already stopped
        }
        voice.source.disconnect();
    }

    /** Applies the per-audio volume times the effective bus volume to the fallback element. */
    #applyElementVolume(): void {
        if (!this.#element) return;
        this.#element.volume = BrioAudio.#clampVolume(
            this.#volume * BrioAudioMixer.effectiveVolume(this.#bus),
        );
    }

    /** Plays the single-instance voice from the start and resolves when it ends (or fails). */
    #playToEnd(): Promise<void> {
        if (this.#buffer) {
            return new Promise<void>((resolve) => {
                this.#startPrimary(0, false, resolve);
                if (!this.#primary) resolve();
            });
        }
        const audio = this.element;
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

            try {
                const result = audio.play() as Promise<void> | undefined;
                result?.catch?.(cleanup);
            } catch {
                cleanup();
            }
        });
    }

    static #clampVolume(value: number): number {
        return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
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

        const offsets = new Map<BrioAudio, number>();
        if (configurationObject.startingTime && configurationObject.startingTime.length > 0) {
            for (const entry of configurationObject.startingTime) {
                const target = audios.find((a) => a.name === entry.name);
                if (target) offsets.set(target, Math.max(0, entry.time));
            }
        }

        const iterationType = configurationObject.iterationType ?? "once";

        switch (iterationType) {
            case "once":
                audios.forEach((audio) => {
                    const offset = offsets.get(audio);
                    if (offset !== undefined) audio.playFromTime(offset);
                    else audio.playOnce();
                });
                break;

            case "loop":
                audios.forEach((audio) => {
                    audio.playLoop(offsets.get(audio) ?? 0);
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

        const playNext = async (index: number): Promise<void> => {
            if (index >= audios.length) return;
            await audios[index].#playToEnd();
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
