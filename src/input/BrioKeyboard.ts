import { BrioConsole } from "../debugging/BrioConsole";
import { KeyboardKey } from "../tools/base_types";

/**
 * Manages keyboard input state (`isDown`, `isPressed`, `isUp`) and custom key-press callbacks (`customActions`).
 * Activated via `game.useKeyboard()` and accessed via `game.keyboard`.
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
    static #globalInitialized: boolean = false;

    /** Map storing current frame key states (`true` while held down, `false` when released). */
    #keyboardState: Map<string, boolean>;
    /** Map storing previous frame key states for transition detection (`isPressed` and `isUp`). */
    #keyboardPrevState: Map<string, boolean>;
    #keyDownListenerId?: (event: KeyboardEvent) => void;
    #keyUpListenerId?: (event: KeyboardEvent) => void;
    #console: BrioConsole;

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
     * Creates a new `BrioKeyboard` controller and attaches `keydown`/`keyup` listeners to `window`.
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
        this.#addListener();
    }

    static #ensureGlobalListener(): void {
        if (this.#globalInitialized || typeof window === "undefined") return;
        this.#globalInitialized = true;

        window.addEventListener("keydown", (event: KeyboardEvent) => {
            this.#globalState.set(event.key, true);
        });
        window.addEventListener("keyup", (event: KeyboardEvent) => {
            this.#globalState.set(event.key, false);
        });
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
     * Checks globally whether `key` was released on the current frame.
     *
     * @param key Standard `KeyboardEvent.key` identifier
     * @returns `true` if `key` transitioned from down to up
     * @example
     * ```ts
     * if (BrioKeyboard.globalIsUp("z")) {
     *     player.shoot();
     * }
     * ```
     */
    public static globalIsUp(key: KeyboardKey): boolean {
        this.#ensureGlobalListener();
        return this.#globalPrevState.get(key) === true && this.#globalState.get(key) === false;
    }

    /**
     * Synchronizes global previous-frame key states at the end of a game frame.
     */
    public static syncGlobalFrame(): void {
        if (!this.#globalInitialized) return;
        this.#globalPrevState.clear();
        for (const [k, v] of this.#globalState.entries()) {
            this.#globalPrevState.set(k, v);
        }
    }

    #addListener() {
        this.#keyDownListenerId = (event: KeyboardEvent) => {
            if (this.preventDefaultKeys.has(event.key)) {
                event.preventDefault();
            }

            this.#keyboardState.set(event.key, true);
            BrioKeyboard.#globalState.set(event.key, true);

            const customHandler = this.#customEventMaps.get(event.key);
            if (customHandler) {
                customHandler();
            }
        };
        this.#keyUpListenerId = (event: KeyboardEvent) => {
            if (this.preventDefaultKeys.has(event.key)) {
                event.preventDefault();
            }

            if (this.#keyboardState.get(event.key) === true) {
                this.#keyboardState.set(event.key, false);
            }
            BrioKeyboard.#globalState.set(event.key, false);
        };

        window.addEventListener("keydown", this.#keyDownListenerId);
        window.addEventListener("keyup", this.#keyUpListenerId);
        this.#console.out("info", "Keyboard Event Listener sucessfuly created.");
    }

    /**
     * Removes the `keydown` and `keyup` event listeners registered on `window`.
     *
     * @example
     * ```ts
     * game.useKeyboard();
     * game.keyboard.removeListener();
     * ```
     */
    public removeListener(): void {
        if (this.#keyDownListenerId !== undefined && this.#keyUpListenerId !== undefined) {
            window.removeEventListener("keydown", this.#keyDownListenerId);
            window.removeEventListener("keyup", this.#keyUpListenerId);
            this.#console.out("info", "Keyboard Event Listener sucessfuly removed.");
        }
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
     * Returns `true` only on the single frame when `key` transitions from not pressed to pressed.
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
        const wasKeyDown = this.#keyboardPrevState.get(key) === true;
        const isKeyDown = this.#keyboardState.get(key) === true;
        return !wasKeyDown && isKeyDown;
    }

    /**
     * Returns `true` only on the single frame when `key` transitions from pressed to released.
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
        if (!this.#keyboardState.has(key)) return false;

        const wasKeyDown = this.#keyboardPrevState.get(key) === true;
        const isKeyDown = this.#keyboardState.get(key) === false;
        return wasKeyDown && isKeyDown;
    }

    /**
     * Map storing immediate callback functions triggered whenever a mapped `KeyboardEvent.key` is pressed.
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

