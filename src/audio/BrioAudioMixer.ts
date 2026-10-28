/**
 * Mixing bus a `BrioAudio` is routed through. `"bgm"` and `"sfx"` feed `"master"`, which feeds the speakers.
 */
export type AudioBusName = "master" | "bgm" | "sfx";

/** User gestures that browsers accept for resuming a suspended `AudioContext` (autoplay policy). */
const UNLOCK_EVENTS = ["pointerdown", "keydown", "touchend", "mousedown"] as const;

interface BusState {
    volume: number;
    muted: boolean;
    gain?: GainNode;
}

/**
 * Global audio mixer of BrioJS (`BrioAudioMixer`), built on the **Web Audio API**.
 *
 * Owns one lazily created `AudioContext` and three `GainNode` buses: `"master"` (to the speakers) fed by `"bgm"`
 * (music) and `"sfx"` (effects). Browsers create the context suspended until a user gesture; the first access
 * installs one-shot listeners that resume it on the first pointer, key, or touch event, so sounds started before
 * that (e.g. music in `load()`) begin as soon as the player interacts.
 *
 * Runtimes without Web Audio (old browsers, Node.js, jsdom) fall back to `HTMLAudioElement` playback in
 * `BrioAudio`, with bus volumes and mutes applied to each element's `volume`.
 *
 * @example
 * ```ts
 * BrioAudioMixer.setVolume("bgm", 0.4);
 * BrioAudioMixer.mute("sfx", true);
 * await BrioAudioMixer.unlock(); // inside a click handler
 * ```
 */
export class BrioAudioMixer {
    static #context?: AudioContext | null;
    static readonly #buses: Record<AudioBusName, BusState> = {
        master: { volume: 1, muted: false },
        bgm: { volume: 1, muted: false },
        sfx: { volume: 1, muted: false },
    };
    static #unlockTarget?: EventTarget;
    static #unlockHandler?: () => void;
    /** Callbacks of fallback (`HTMLAudioElement`) audios, re-run whenever a bus volume or mute changes. */
    static readonly #volumeListeners = new Set<() => void>();

    /** Whether the runtime exposes the Web Audio API (`AudioContext` or `webkitAudioContext`). */
    public static get isSupported(): boolean {
        return BrioAudioMixer.#contextConstructor() !== undefined;
    }

    /**
     * Shared `AudioContext`, created on first access (`undefined` when Web Audio is unavailable or creation failed).
     */
    public static get context(): AudioContext | undefined {
        if (BrioAudioMixer.#context === undefined) {
            const Ctor = BrioAudioMixer.#contextConstructor();
            let context: AudioContext | null = null;
            if (Ctor) {
                try {
                    context = new Ctor();
                } catch {
                    context = null;
                }
            }
            BrioAudioMixer.#context = context;
            if (context) {
                BrioAudioMixer.#createBuses(context);
                BrioAudioMixer.enableAutoUnlock();
            }
        }
        return BrioAudioMixer.#context ?? undefined;
    }

    /** Whether the `AudioContext` is running (unlocked by a user gesture), or `true` in fallback mode. */
    public static get isUnlocked(): boolean {
        const context = BrioAudioMixer.#context;
        return !context || context.state === "running";
    }

    /**
     * `GainNode` input of `bus`, where `BrioAudio` voices connect (`undefined` in fallback mode).
     *
     * @param bus Target bus
     * @returns The bus input node
     */
    public static busInput(bus: AudioBusName): GainNode | undefined {
        if (!BrioAudioMixer.context) return undefined;
        return BrioAudioMixer.#buses[bus].gain;
    }

    /**
     * Sets the volume of `bus` (clamped to `[0, 1]`).
     *
     * @param bus Target bus
     * @param volume Linear volume in `[0, 1]`
     * @example
     * ```ts
     * BrioAudioMixer.setVolume("master", 0.8);
     * ```
     */
    public static setVolume(bus: AudioBusName, volume: number): void {
        const state = BrioAudioMixer.#buses[bus];
        state.volume = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1;
        BrioAudioMixer.#applyBus(state);
    }

    /**
     * Volume of `bus` in `[0, 1]` (ignoring mutes).
     *
     * @param bus Target bus
     */
    public static getVolume(bus: AudioBusName): number {
        return BrioAudioMixer.#buses[bus].volume;
    }

    /**
     * Mutes or unmutes `bus` without losing its volume.
     *
     * @param bus Target bus
     * @param muted `true` to silence the bus
     */
    public static mute(bus: AudioBusName, muted: boolean = true): void {
        const state = BrioAudioMixer.#buses[bus];
        state.muted = muted;
        BrioAudioMixer.#applyBus(state);
    }

    /**
     * Whether `bus` is muted.
     *
     * @param bus Target bus
     */
    public static isMuted(bus: AudioBusName): boolean {
        return BrioAudioMixer.#buses[bus].muted;
    }

    /**
     * Audible volume of `bus` after its own and the master volume and mutes (`0` when muted).
     *
     * @param bus Target bus
     * @returns Effective linear volume in `[0, 1]`
     */
    public static effectiveVolume(bus: AudioBusName): number {
        const master = BrioAudioMixer.#buses.master;
        const masterVolume = master.muted ? 0 : master.volume;
        if (bus === "master") return masterVolume;
        const state = BrioAudioMixer.#buses[bus];
        return state.muted ? 0 : state.volume * masterVolume;
    }

    /**
     * Resumes the `AudioContext`. Must run inside (or after) a user gesture to satisfy autoplay policies.
     *
     * @returns Resolves to `true` once the context is running (always `true` in fallback mode)
     */
    public static async unlock(): Promise<boolean> {
        const context = BrioAudioMixer.context;
        if (!context) return true;
        if (context.state !== "running") {
            try {
                await context.resume();
            } catch {
                return false;
            }
        }
        const running = context.state === "running";
        if (running) BrioAudioMixer.#removeUnlockListeners();
        return running;
    }

    /**
     * Installs one-shot listeners that call `unlock()` on the first user gesture on `target`
     * (done automatically when the context is created; the default target is `document`).
     *
     * @param target Event target receiving user gestures
     */
    public static enableAutoUnlock(target?: EventTarget): void {
        const eventTarget = target ?? (typeof document !== "undefined" ? document : undefined);
        if (!eventTarget || BrioAudioMixer.#unlockTarget === eventTarget) return;
        BrioAudioMixer.#removeUnlockListeners();
        const handler = (): void => {
            void BrioAudioMixer.unlock();
        };
        for (const type of UNLOCK_EVENTS) eventTarget.addEventListener(type, handler);
        BrioAudioMixer.#unlockTarget = eventTarget;
        BrioAudioMixer.#unlockHandler = handler;
    }

    /**
     * Suspends the `AudioContext` (e.g. while the game is paused or the tab is hidden).
     */
    public static async suspend(): Promise<void> {
        const context = BrioAudioMixer.#context;
        if (context && context.state === "running") await context.suspend();
    }

    /**
     * Decodes encoded audio bytes into an `AudioBuffer` on the shared context.
     *
     * @param data Encoded audio file bytes (`.wav`, `.mp3`, `.ogg`, ...)
     * @returns The decoded buffer, or `undefined` in fallback mode
     */
    public static async decode(data: ArrayBuffer): Promise<AudioBuffer | undefined> {
        const context = BrioAudioMixer.context;
        if (!context) return undefined;
        return context.decodeAudioData(data);
    }

    /**
     * Registers a callback re-run whenever a bus volume or mute changes (used by fallback audios).
     *
     * @param listener Callback to register
     * @returns Function that unregisters the callback
     * @internal
     */
    public static onVolumeChange(listener: () => void): () => void {
        BrioAudioMixer.#volumeListeners.add(listener);
        return () => BrioAudioMixer.#volumeListeners.delete(listener);
    }

    /**
     * Closes the context, removes unlock listeners, and restores default volumes (used by tests and teardown).
     */
    public static reset(): void {
        BrioAudioMixer.#removeUnlockListeners();
        const context = BrioAudioMixer.#context;
        if (context && typeof context.close === "function") void context.close().catch(() => {});
        BrioAudioMixer.#context = undefined;
        for (const bus of Object.values(BrioAudioMixer.#buses)) {
            bus.volume = 1;
            bus.muted = false;
            bus.gain = undefined;
        }
        BrioAudioMixer.#volumeListeners.clear();
    }

    static #contextConstructor(): (new () => AudioContext) | undefined {
        if (typeof globalThis === "undefined") return undefined;
        const g = globalThis as unknown as {
            AudioContext?: new () => AudioContext;
            webkitAudioContext?: new () => AudioContext;
        };
        return g.AudioContext ?? g.webkitAudioContext;
    }

    static #createBuses(context: AudioContext): void {
        const buses = BrioAudioMixer.#buses;
        buses.master.gain = context.createGain();
        buses.master.gain.connect(context.destination);
        buses.bgm.gain = context.createGain();
        buses.bgm.gain.connect(buses.master.gain);
        buses.sfx.gain = context.createGain();
        buses.sfx.gain.connect(buses.master.gain);
        for (const bus of Object.values(buses)) BrioAudioMixer.#applyBus(bus);
    }

    static #applyBus(state: BusState): void {
        if (state.gain) state.gain.gain.value = state.muted ? 0 : state.volume;
        BrioAudioMixer.#volumeListeners.forEach((listener) => listener());
    }

    static #removeUnlockListeners(): void {
        const target = BrioAudioMixer.#unlockTarget;
        const handler = BrioAudioMixer.#unlockHandler;
        if (target && handler) {
            for (const type of UNLOCK_EVENTS) target.removeEventListener(type, handler);
        }
        BrioAudioMixer.#unlockTarget = undefined;
        BrioAudioMixer.#unlockHandler = undefined;
    }
}
