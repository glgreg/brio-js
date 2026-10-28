import { BrioConsole } from "../debugging/BrioConsole";
import { KeyboardKey } from "../tools/base_types";

/**
 * Manages keyboard input state (`isDown`, `isPressed`, `isUp`) and custom key-press callbacks (`customActions`).
 * Activated via `game.useKeyboard()` and accessed via `game.keyboard`.
 *
 * Press and release edges are latched by the DOM events and consumed by `endFrame()`, so a key tapped
 * faster than one frame (down and up between two frames) still reports `isPressed` and `isUp` for exactly one
 * frame. Held keys are released when the window loses focus or the page is hidden, so a key held while
 * alt-tabbing does not stay stuck down.
 *
 * @example
 * ```ts
 * game.useKeyboard();
 *
 * game.update((updater, dt) => {
 *     const player = updater.getObject("obj_player");
 *     if (game.keyboard.isDown("ArrowRight")) {
 *         player.transform.position.x += 250 * dt;
 *     }
 *     if (game.keyboard.isPressed(" ")) {
 *         player.jump();
 *     }
 * });
 * ```
 */
export class BrioKeyboard {
    static #globalState: Map<string, boolean> = new Map();
    static #globalPrevState: Map<string, boolean> = new Map();
    static #globalReleased: Set<string> = new Set();
    static #globalInitialized: boolean = false;
    static #globalSynced: boolean = false;
    /** Attached controller per state map, so a second controller over the same maps replaces the first. */
    static #activeByState: WeakMap<Map<string, boolean>, BrioKeyboard> = new WeakMap();

    /** Map storing current frame key states (`true` while held down, `false` when released). */
    #keyboardState: Map<string, boolean>;
    /** Map storing previous frame key states for transition detection (`isPressed` and `isUp`). */
    #keyboardPrevState: Map<string, boolean>;
    /** Keys that went down since the last `endFrame()`. */
    readonly #pressedEdges: Set<string> = new Set();
    /** Keys that went up since the last `endFrame()`. */
    readonly #releasedEdges: Set<string> = new Set();
    /** Becomes `true` on the first `endFrame()`; edges are then read from the latches instead of the maps. */
    #frameSynced: boolean = false;
    #attached: boolean = false;
    #console: BrioConsole;

    readonly #onKeyDown: (event: KeyboardEvent) => void;
    readonly #onKeyUp: (event: KeyboardEvent) => void;
    readonly #onBlur: () => void;
    readonly #onVisibilityChange: () => void;
    readonly #copyToPrev: (value: boolean, key: string) => void;
    readonly #releaseHeld: (value: boolean, key: string) => void;

    #customEventMaps: Map<KeyboardKey, () => void> = new Map();

    /**
     * Set of keys whose default browser action (such as page scrolling on Arrow keys or Space)
     * will be suppressed via `event.preventDefault()`. Browser shortcuts like `F12` or `F5` are preserved.
     */
    public readonly preventDefaultKeys: Set<KeyboardKey> = new Set([
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        " ",
        "Tab",
    ]);

    /**
     * Creates a new `BrioKeyboard` controller and attaches `keydown`/`keyup`/`blur` listeners to `window`
     * (plus `visibilitychange` on `document`). If another controller is attached over the same
     * `keyboardStateMap`, that controller is detached first, so creating a second controller for the same game
     * never doubles the listeners.
     *
     * @param keyboardStateMap Map tracking current frame key states
     * @param keyboardPrevStateMap Map tracking previous frame key states
     * @param console Engine `BrioConsole` instance for diagnostic logging
     */
    constructor(
        keyboardStateMap: Map<string, boolean>,
        keyboardPrevStateMap: Map<string, boolean>,
        console: BrioConsole,
    ) {
        this.#console = console;
        this.#keyboardState = keyboardStateMap;
        this.#keyboardPrevState = keyboardPrevStateMap;

        this.#onKeyDown = (event: KeyboardEvent) => {
            if (this.preventDefaultKeys.has(event.key)) {
                event.preventDefault();
            }

            // OS key repeat sends keydown again while held: only the first one is a press edge
            if (this.#keyboardState.get(event.key) !== true) {
                this.#pressedEdges.add(event.key);
            }
            this.#keyboardState.set(event.key, true);
            BrioKeyboard.#globalKeyDown(event.key);

            const customHandler = this.#customEventMaps.get(event.key);
            if (customHandler) {
                customHandler();
            }
        };
        this.#onKeyUp = (event: KeyboardEvent) => {
            if (this.preventDefaultKeys.has(event.key)) {
                event.preventDefault();
            }

            if (this.#keyboardState.get(event.key) === true) {
                this.#keyboardState.set(event.key, false);
                this.#releasedEdges.add(event.key);
            }
            BrioKeyboard.#globalKeyUp(event.key);
        };
        this.#onBlur = () => {
            this.releaseAll();
        };
        this.#onVisibilityChange = () => {
            if (typeof document !== "undefined" && document.visibilityState === "hidden") {
                this.releaseAll();
            }
        };
        this.#copyToPrev = (value: boolean, key: string) => {
            this.#keyboardPrevState.set(key, value);
        };
        this.#releaseHeld = (value: boolean, key: string) => {
            if (value) {
                this.#keyboardState.set(key, false);
                this.#releasedEdges.add(key);
            }
        };

        this.attach();
    }

    static #ensureGlobalListener(): void {
        if (this.#globalInitialized || typeof window === "undefined") return;
        this.#globalInitialized = true;

        window.addEventListener("keydown", (event: KeyboardEvent) => {
            BrioKeyboard.#globalKeyDown(event.key);
        });
        window.addEventListener("keyup", (event: KeyboardEvent) => {
            BrioKeyboard.#globalKeyUp(event.key);
        });
        window.addEventListener("blur", () => {
            BrioKeyboard.#globalState.forEach(BrioKeyboard.#releaseGlobalHeld);
        });
    }

    static #globalKeyDown(key: string): void {
        this.#globalState.set(key, true);
    }

    /** Idempotent: both the global listener and every controller forward `keyup` here. */
    static #globalKeyUp(key: string): void {
        if (this.#globalState.get(key) === true) {
            this.#globalReleased.add(key);
        }
        this.#globalState.set(key, false);
    }

    static #releaseGlobalHeld(value: boolean, key: string): void {
        if (value) BrioKeyboard.#globalKeyUp(key);
    }

    static #copyGlobalToPrev(value: boolean, key: string): void {
        BrioKeyboard.#globalPrevState.set(key, value);
    }

    /**
     * Checks globally whether `key` is currently held down without requiring an instance reference.
     *
     * @param key Standard `KeyboardEvent.key` identifier
     * @returns `true` while the key is held down
     * @example
     * ```ts
     * if (BrioKeyboard.globalIsDown("ArrowUp")) {
     *     player.moveUp();
     * }
     * ```
     */
    public static globalIsDown(key: KeyboardKey): boolean {
        this.#ensureGlobalListener();
        return this.#globalState.get(key) === true;
    }

    /**
     * Checks globally whether `key` was released on the current frame. Requires
     * `BrioKeyboard.syncGlobalFrame()` to run once at the end of every frame; once it has run, releases are
     * latched, so a tap shorter than one frame is still reported.
     *
     * @param key Standard `KeyboardEvent.key` identifier
     * @returns `true` if `key` transitioned from down to up during the current frame
     * @example
     * ```ts
     * if (BrioKeyboard.globalIsUp("z")) {
     *     player.shoot();
     * }
     * ```
     */
    public static globalIsUp(key: KeyboardKey): boolean {
        this.#ensureGlobalListener();
        if (this.#globalSynced) return this.#globalReleased.has(key);
        return this.#globalPrevState.get(key) === true && this.#globalState.get(key) === false;
    }

    /**
     * Closes the global frame: consumes the latched releases read by `globalIsUp()` and snapshots the global
     * key states. Must be called exactly once per frame, after game code ran (`BrioGame` does it at the end of
     * each frame). It is a no-op until `globalIsDown()`/`globalIsUp()` installed the global listener.
     *
     * @example
     * ```ts
     * // at the end of a custom frame loop
     * BrioKeyboard.syncGlobalFrame();
     * ```
     */
    public static syncGlobalFrame(): void {
        if (!this.#globalInitialized) return;
        this.#globalSynced = true;
        this.#globalReleased.clear();
        this.#globalState.forEach(BrioKeyboard.#copyGlobalToPrev);
    }

    /** Whether this controller currently has its DOM listeners attached. */
    public get isAttached(): boolean {
        return this.#attached;
    }

    /**
     * Attaches the DOM listeners. Idempotent: calling it while attached does nothing. Any other controller
     * attached over the same state map is detached first.
     *
     * @example
     * ```ts
     * game.keyboard.removeListener();
     * game.keyboard.attach();
     * ```
     */
    public attach(): void {
        if (this.#attached || typeof window === "undefined") return;
        const previous = BrioKeyboard.#activeByState.get(this.#keyboardState);
        if (previous && previous !== this) previous.removeListener();

        window.addEventListener("keydown", this.#onKeyDown);
        window.addEventListener("keyup", this.#onKeyUp);
        window.addEventListener("blur", this.#onBlur);
        if (typeof document !== "undefined") {
            document.addEventListener("visibilitychange", this.#onVisibilityChange);
        }
        this.#attached = true;
        BrioKeyboard.#activeByState.set(this.#keyboardState, this);
        this.#console.out("info", "Keyboard event listeners attached.");
    }

    /**
     * Removes the `keydown`, `keyup`, `blur` and `visibilitychange` listeners. Idempotent.
     *
     * @example
     * ```ts
     * game.useKeyboard();
     * game.keyboard.removeListener();
     * ```
     */
    public removeListener(): void {
        if (!this.#attached) return;
        window.removeEventListener("keydown", this.#onKeyDown);
        window.removeEventListener("keyup", this.#onKeyUp);
        window.removeEventListener("blur", this.#onBlur);
        if (typeof document !== "undefined") {
            document.removeEventListener("visibilitychange", this.#onVisibilityChange);
        }
        this.#attached = false;
        if (BrioKeyboard.#activeByState.get(this.#keyboardState) === this) {
            BrioKeyboard.#activeByState.delete(this.#keyboardState);
        }
        this.#console.out("info", "Keyboard event listeners removed.");
    }

    /**
     * Releases every held key as if its `keyup` had arrived (each reports `isUp` on the current frame).
     * Called automatically on window `blur` and when the page becomes hidden.
     *
     * @example
     * ```ts
     * game.keyboard.releaseAll();
     * ```
     */
    public releaseAll(): void {
        this.#keyboardState.forEach(this.#releaseHeld);
        BrioKeyboard.#globalState.forEach(BrioKeyboard.#releaseGlobalHeld);
    }

    /**
     * Closes the input frame: consumes the latched press/release edges and snapshots the current key states
     * into the previous-state map. Must run exactly once per frame, after game code (`BrioGame` calls it at
     * the end of each frame). Until it is first called, `isPressed`/`isUp` fall back to comparing the two
     * state maps, which an external owner of the maps may snapshot itself.
     *
     * @example
     * ```ts
     * // at the end of a custom frame loop
     * keyboard.endFrame();
     * ```
     */
    public endFrame(): void {
        this.#frameSynced = true;
        this.#pressedEdges.clear();
        this.#releasedEdges.clear();
        // Keys are never removed from the current map, so overwriting every entry keeps both maps equal
        // without churning their backing storage
        this.#keyboardState.forEach(this.#copyToPrev);
    }

    /**
     * Returns `true` for every frame in which the specified `key` is held down.
     *
     * @param key Standard `KeyboardEvent.key` identifier (e.g. `"ArrowUp"`, `" "`, `"z"`)
     * @returns `true` while the key is held down, otherwise `false`
     * @example
     * ```ts
     * game.update((updater, dt) => {
     *     const player = updater.getObject("obj_player");
     *     if (game.keyboard.isDown(" ")) {
     *         player.transform.position.y -= 100 * dt;
     *     }
     * });
     * ```
     */
    public isDown(key: KeyboardKey): boolean {
        return this.#keyboardState.get(key) === true;
    }

    /**
     * Returns `true` only on the frame when `key` went down. A tap shorter than one frame still reports
     * `true` once (together with `isUp`).
     *
     * @param key Standard `KeyboardEvent.key` identifier
     * @returns `true` on the initial press frame, otherwise `false`
     * @example
     * ```ts
     * game.update((updater, dt) => {
     *     const player = updater.getObject("obj_player");
     *     if (game.keyboard.isPressed("z")) {
     *         player.shoot();
     *     }
     * });
     * ```
     */
    public isPressed(key: KeyboardKey): boolean {
        if (this.#frameSynced) return this.#pressedEdges.has(key);
        const wasKeyDown = this.#keyboardPrevState.get(key) === true;
        const isKeyDown = this.#keyboardState.get(key) === true;
        return !wasKeyDown && isKeyDown;
    }

    /**
     * Returns `true` only on the frame when `key` was released (including releases forced by window `blur`).
     * A tap shorter than one frame still reports `true` once (together with `isPressed`).
     *
     * @param key Standard `KeyboardEvent.key` identifier
     * @returns `true` on the release frame, otherwise `false`
     * @example
     * ```ts
     * game.update((updater, dt) => {
     *     const player = updater.getObject("obj_player");
     *     if (game.keyboard.isUp("z")) {
     *         player.transform.flip.x = !player.transform.flip.x;
     *     }
     * });
     * ```
     */
    public isUp(key: KeyboardKey): boolean {
        if (this.#frameSynced) return this.#releasedEdges.has(key);
        if (!this.#keyboardState.has(key)) return false;

        const wasKeyDown = this.#keyboardPrevState.get(key) === true;
        const isKeyUp = this.#keyboardState.get(key) === false;
        return wasKeyDown && isKeyUp;
    }

    /**
     * Map storing immediate callback functions triggered whenever a mapped `KeyboardEvent.key` is pressed.
     * Callbacks run synchronously inside `keydown`, including OS key-repeat events.
     *
     * @example
     * ```ts
     * game.useKeyboard();
     * game.keyboard.customActions.set("Escape", () => {
     *     if (game.isRunning) game.pause();
     *     else game.resume();
     * });
     * ```
     */
    public get customActions(): Map<KeyboardKey, () => void> {
        return this.#customEventMaps;
    }
}
