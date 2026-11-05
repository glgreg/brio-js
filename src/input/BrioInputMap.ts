import { KeyboardKey } from "../tools/base_types";
import type { BrioGamepad, GamepadButtonName } from "./BrioGamepad";
import { GAMEPAD_BUTTON_NAMES } from "./BrioGamepad";
import type { BrioKeyboard } from "./BrioKeyboard";
import { otherLetterCase } from "./BrioKeyboard";
import type { BrioMouse, MouseButton } from "./BrioMouse";
import { MOUSE_BUTTON_NAMES } from "./BrioMouse";
import type { BrioTouch } from "./BrioTouch";

/**
 * Input device of an `InputBinding`.
 *
 * @example
 * ```ts
 * const devices: InputDevice[] = ["keyboard", "gamepad"];
 * ```
 */
export type InputDevice = "keyboard" | "mouse" | "gamepad" | "touch";

/**
 * Binds an action to a keyboard key (`KeyboardEvent.key`, the same values `BrioKeyboard` uses). Single letters
 * match both cases, so `"w"` keeps working while Shift is held.
 *
 * @example
 * ```ts
 * const jump: KeyboardBinding = { device: "keyboard", key: " " };
 * ```
 */
export interface KeyboardBinding {
    /** Discriminant. */
    readonly device: "keyboard";
    /** `KeyboardEvent.key` value (`" "`, `"ArrowLeft"`, `"w"`, `"Shift"`...). */
    readonly key: KeyboardKey;
}

/**
 * Binds an action to a mouse button.
 *
 * @example
 * ```ts
 * const fire: MouseBinding = { device: "mouse", button: "left" };
 * ```
 */
export interface MouseBinding {
    /** Discriminant. */
    readonly device: "mouse";
    /** Mouse button name. */
    readonly button: MouseButton;
}

/**
 * Binds an action to a gamepad button (W3C Standard Gamepad names). Its `value()` is the analog button value,
 * so triggers (`l2`, `r2`) report pressure.
 *
 * @example
 * ```ts
 * const jump: GamepadButtonBinding = { device: "gamepad", button: "south" };
 * ```
 */
export interface GamepadButtonBinding {
    /** Discriminant. */
    readonly device: "gamepad";
    /** Standard button name. */
    readonly button: GamepadButtonName;
    /**
     * 0-based controller index.
     * @default 0
     */
    readonly pad?: number;
}

/**
 * Binds an action to one direction of a gamepad axis (standard mapping: `0`/`1` left stick X/Y, `2`/`3` right
 * stick X/Y; positive Y points down). The action is down while `axis * direction >= threshold`; its `value()`
 * is the deflection in that direction past the gamepad `deadzone`, rescaled to `[0, 1]`.
 *
 * @example
 * ```ts
 * const left: GamepadAxisBinding = { device: "gamepad", axis: 0, direction: -1 };
 * ```
 */
export interface GamepadAxisBinding {
    /** Discriminant. */
    readonly device: "gamepad";
    /** Axis index. */
    readonly axis: number;
    /** Direction of the axis that drives the action. */
    readonly direction: 1 | -1;
    /**
     * Deflection in `(0, 1)` from which the action counts as down (`isDown`, `isPressed`, `isUp`).
     * @default 0.5
     */
    readonly threshold?: number;
    /**
     * 0-based controller index.
     * @default 0
     */
    readonly pad?: number;
}

/**
 * Binds an action to the touch screen: down while at least one finger touches the target.
 *
 * @example
 * ```ts
 * const jump: TouchBinding = { device: "touch" };
 * ```
 */
export interface TouchBinding {
    /** Discriminant. */
    readonly device: "touch";
}

/**
 * One physical input that drives an action of a `BrioInputMap`, discriminated by `device`.
 *
 * @example
 * ```ts
 * const bindings: InputBinding[] = [
 *     { device: "keyboard", key: " " },
 *     { device: "gamepad", button: "south" },
 * ];
 * ```
 */
export type InputBinding =
    | KeyboardBinding
    | MouseBinding
    | GamepadButtonBinding
    | GamepadAxisBinding
    | TouchBinding;

/**
 * An `InputBinding`, or a plain `KeyboardEvent.key` string as shorthand for a `KeyboardBinding`.
 *
 * @example
 * ```ts
 * input.bind("jump", " ", { device: "gamepad", button: "south" });
 * ```
 */
export type InputBindingLike = InputBinding | KeyboardKey;

/**
 * Controllers a `BrioInputMap` reads. Missing controllers make their bindings report "up" / `0`.
 *
 * @example
 * ```ts
 * const input = new BrioInputMap({ keyboard: game.keyboard, gamepad: game.gamepad });
 * ```
 */
export interface InputMapControllers {
    /** Keyboard controller (`game.keyboard`). */
    keyboard?: BrioKeyboard;
    /** Mouse controller (`game.mouse`). */
    mouse?: BrioMouse;
    /** Gamepad controller (`game.gamepad`). */
    gamepad?: BrioGamepad;
    /** Touch controller (`game.touch`). */
    touch?: BrioTouch;
}

/**
 * Plain, JSON-serializable form of a `BrioInputMap`'s bindings (`toJSON()`, `load()`), suitable for
 * `BrioStorage`.
 *
 * @example
 * ```ts
 * const saved: InputMapJSON = { version: 1, actions: { jump: [{ device: "keyboard", key: " " }] } };
 * ```
 */
export interface InputMapJSON {
    /** Format version, currently `1`. */
    version: 1;
    /** Bindings per action name. An empty array means "explicitly unbound". */
    actions: Record<string, InputBinding[]>;
}

/**
 * Options of `BrioInputMap.load()`.
 *
 * @example
 * ```ts
 * input.load(saved, { onlyKnownActions: true });
 * ```
 */
export interface InputMapLoadOptions {
    /**
     * Skip (and report) actions that the map does not already have, for example actions removed in a newer
     * version of the game.
     * @default false
     */
    onlyKnownActions?: boolean;
}

/**
 * Outcome of `BrioInputMap.load()`.
 *
 * @example
 * ```ts
 * const report = input.load(saved);
 * if (report.issues.length > 0) console.warn(report.issues);
 * ```
 */
export interface InputMapLoadReport {
    /** Actions whose bindings were replaced. */
    readonly applied: readonly string[];
    /** Human-readable description of every skipped action or binding. */
    readonly issues: readonly string[];
}

/**
 * Options of `BrioInputMap.captureNext()`.
 *
 * @example
 * ```ts
 * const binding = await input.captureNext({ devices: ["gamepad"] });
 * ```
 */
export interface InputCaptureOptions {
    /**
     * Devices whose presses are captured.
     * @default ["keyboard", "mouse", "gamepad"]
     */
    devices?: readonly InputDevice[];
    /** Aborts the capture; the promise then rejects with `signal.reason`. */
    signal?: AbortSignal;
}

/** Per-action state, allocated at bind time so queries never allocate. */
interface ActionState {
    /** Normalized, frozen bindings. */
    readonly bindings: InputBinding[];
    /** Other-case letter per keyboard binding (`"W"` for `"w"`), or `undefined`. */
    readonly altKeys: (KeyboardKey | undefined)[];
    /** Whether the action was down when the previous frame closed. */
    wasDown: boolean;
}

/** Pending `captureNext()` request. */
interface CaptureRequest {
    readonly resolve: (binding: InputBinding) => void;
    readonly reject: (reason: unknown) => void;
    readonly keyboard: boolean;
    readonly mouse: boolean;
    readonly gamepad: boolean;
    readonly signal: AbortSignal | undefined;
    readonly onAbort: () => void;
    /** Presses of the frame in which the capture started (such as the click on a "rebind" button) are skipped. */
    armed: boolean;
}

const EMPTY_BINDINGS: readonly InputBinding[] = Object.freeze([]);
const DEFAULT_AXIS_THRESHOLD = 0.5;
/** Pads scanned by `captureNext()`; browsers report at most four. */
const CAPTURE_PADS = 4;
const CURRENT_VERSION = 1;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const isPadIndex = (value: unknown): value is number =>
    typeof value === "number" && Number.isInteger(value) && value >= 0;

/** Validates `value` and returns a frozen, normalized copy; throws an `Error` describing the problem. */
const normalizeBinding = (value: unknown): InputBinding => {
    if (typeof value === "string") {
        if (value.length === 0) throw new Error("keyboard key must be a non-empty string");
        return Object.freeze({ device: "keyboard", key: value as KeyboardKey });
    }
    if (!isRecord(value))
        throw new Error("binding must be a key string or an object with `device`");
    switch (value.device) {
        case "keyboard": {
            if (typeof value.key !== "string" || value.key.length === 0) {
                throw new Error("keyboard binding needs a non-empty `key`");
            }
            // Any non-empty string is accepted: the `KeyboardKey` union cannot be checked at runtime
            return Object.freeze({ device: "keyboard", key: value.key as KeyboardKey });
        }
        case "mouse": {
            if (!MOUSE_BUTTON_NAMES.includes(value.button as MouseButton)) {
                throw new Error(`unknown mouse button ${JSON.stringify(value.button)}`);
            }
            return Object.freeze({ device: "mouse", button: value.button as MouseButton });
        }
        case "gamepad": {
            const pad = value.pad ?? 0;
            if (!isPadIndex(pad)) throw new Error("gamepad `pad` must be an integer >= 0");
            if ("axis" in value) {
                if (!isPadIndex(value.axis))
                    throw new Error("gamepad `axis` must be an integer >= 0");
                if (value.direction !== 1 && value.direction !== -1) {
                    throw new Error("gamepad axis `direction` must be 1 or -1");
                }
                const threshold = value.threshold ?? DEFAULT_AXIS_THRESHOLD;
                if (typeof threshold !== "number" || !(threshold > 0 && threshold < 1)) {
                    throw new Error("gamepad axis `threshold` must be a number in (0, 1)");
                }
                return Object.freeze({
                    device: "gamepad",
                    axis: value.axis,
                    direction: value.direction,
                    threshold,
                    pad,
                });
            }
            if (!GAMEPAD_BUTTON_NAMES.includes(value.button as GamepadButtonName)) {
                throw new Error(`unknown gamepad button ${JSON.stringify(value.button)}`);
            }
            return Object.freeze({
                device: "gamepad",
                button: value.button as GamepadButtonName,
                pad,
            });
        }
        case "touch":
            return Object.freeze({ device: "touch" });
        default:
            throw new Error(`unknown device ${JSON.stringify(value.device)}`);
    }
};

/** Field-wise equality of two normalized bindings. */
const sameBinding = (a: InputBinding, b: InputBinding): boolean => {
    if (a.device !== b.device) return false;
    switch (a.device) {
        case "keyboard":
            return a.key === (b as KeyboardBinding).key;
        case "mouse":
            return a.button === (b as MouseBinding).button;
        case "touch":
            return true;
        case "gamepad": {
            const other = b as GamepadButtonBinding | GamepadAxisBinding;
            if (a.pad !== other.pad) return false;
            if ("axis" in a) {
                return (
                    "axis" in other &&
                    a.axis === other.axis &&
                    a.direction === other.direction &&
                    a.threshold === other.threshold
                );
            }
            return "button" in other && a.button === other.button;
        }
    }
};

const lowerLetter = (key: string): KeyboardKey =>
    (key.length === 1 ? key.toLowerCase() : key) as KeyboardKey;

/**
 * Action mapping with runtime rebinding (`BrioInputMap`). Gameplay code asks about actions (`"jump"`,
 * `"moveLeft"`) instead of physical inputs, and each action is bound to any number of keys, mouse buttons,
 * gamepad buttons, gamepad axis directions or the touch screen. Bindings can be changed at runtime, saved
 * with `toJSON()` and restored with `load()`.
 *
 * Queries aggregate every binding of the action. An action is down while any binding is down. It is pressed
 * on the frame it becomes down after being up when the previous frame closed (a tap shorter than one frame,
 * latched by the controllers, counts), and up on the frame it stops being down, so a sub-frame tap reports
 * `isPressed` and `isUp` together, as the controllers do. Pressing a second binding while the action is
 * already held is not a new press. Unknown action names report `false` / `0`.
 *
 * `endFrame()` must run exactly once per frame after game code (`BrioGame` does it); it snapshots each
 * action's state for the next frame's edges.
 *
 * @typeParam A Action names, for autocompletion (defaults to any string)
 * @example
 * ```ts
 * const input = game.input;
 * input.bind("jump", " ", "w", BrioInputMap.padButton("south"));
 * input.bind("left", "ArrowLeft", "a", BrioInputMap.padAxis(0, -1));
 * input.bind("right", "ArrowRight", "d", BrioInputMap.padAxis(0, 1));
 *
 * game.update((updater, dt) => {
 *     player.transform.position.x += input.axis("left", "right") * 200 * dt;
 *     if (input.isPressed("jump")) player.jump();
 * });
 *
 * // settings screen
 * await storage.set("bindings", input.toJSON());
 * input.load(await storage.get("bindings"));
 * ```
 */
export class BrioInputMap<A extends string = string> {
    #keyboard: BrioKeyboard | undefined;
    #mouse: BrioMouse | undefined;
    #gamepad: BrioGamepad | undefined;
    #touch: BrioTouch | undefined;

    readonly #states: Map<string, ActionState> = new Map();
    readonly #actionNames: A[] = [];
    #capture: CaptureRequest | undefined = undefined;
    readonly #snapshot: (state: ActionState) => void;

    /**
     * Creates an empty input map reading `controllers`. Controllers can also be assigned later
     * (`setControllers()` or the `keyboard`/`mouse`/`gamepad`/`touch` properties), since games usually create
     * them on demand.
     *
     * @param controllers Controllers the map reads (defaults to none)
     */
    constructor(controllers: InputMapControllers = {}) {
        this.#keyboard = controllers.keyboard;
        this.#mouse = controllers.mouse;
        this.#gamepad = controllers.gamepad;
        this.#touch = controllers.touch;
        this.#snapshot = (state: ActionState) => {
            state.wasDown = this.#anyDown(state);
        };
    }

    // #region --> BINDING HELPERS

    /**
     * Creates a `KeyboardBinding`.
     *
     * @param key `KeyboardEvent.key` value
     * @returns The binding
     * @example
     * ```ts
     * input.bind("pause", BrioInputMap.key("Escape"));
     * ```
     */
    public static key(key: KeyboardKey): KeyboardBinding {
        return { device: "keyboard", key };
    }

    /**
     * Creates a `MouseBinding`.
     *
     * @param button Mouse button name
     * @returns The binding
     * @example
     * ```ts
     * input.bind("fire", BrioInputMap.mouseButton("left"));
     * ```
     */
    public static mouseButton(button: MouseButton): MouseBinding {
        return { device: "mouse", button };
    }

    /**
     * Creates a `GamepadButtonBinding`.
     *
     * @param button Standard button name
     * @param pad 0-based controller index (defaults to `0`)
     * @returns The binding
     * @example
     * ```ts
     * input.bind("jump", BrioInputMap.padButton("south"));
     * ```
     */
    public static padButton(button: GamepadButtonName, pad: number = 0): GamepadButtonBinding {
        return { device: "gamepad", button, pad };
    }

    /**
     * Creates a `GamepadAxisBinding`.
     *
     * @param axis Axis index (`0`/`1` left stick X/Y, `2`/`3` right stick X/Y)
     * @param direction Direction of the axis that drives the action
     * @param threshold Deflection in `(0, 1)` from which the action is down (defaults to `0.5`)
     * @param pad 0-based controller index (defaults to `0`)
     * @returns The binding
     * @example
     * ```ts
     * input.bind("left", BrioInputMap.padAxis(0, -1));
     * ```
     */
    public static padAxis(
        axis: number,
        direction: 1 | -1,
        threshold: number = DEFAULT_AXIS_THRESHOLD,
        pad: number = 0,
    ): GamepadAxisBinding {
        return { device: "gamepad", axis, direction, threshold, pad };
    }

    /**
     * Creates a `TouchBinding` (any finger on the screen).
     *
     * @returns The binding
     * @example
     * ```ts
     * input.bind("jump", " ", BrioInputMap.anyTouch());
     * ```
     */
    public static anyTouch(): TouchBinding {
        return { device: "touch" };
    }

    /**
     * Creates a map from serialized bindings (see `load()`). Invalid bindings are skipped; use `load()` on a
     * new map to read the report.
     *
     * @param json Value produced by `toJSON()` (object or JSON string)
     * @param controllers Controllers the map reads (defaults to none)
     * @returns The new map
     * @throws {Error} When `json` is structurally invalid
     * @example
     * ```ts
     * const input = BrioInputMap.fromJSON(await storage.get("bindings"), { keyboard: game.keyboard });
     * ```
     */
    public static fromJSON<A extends string = string>(
        json: unknown,
        controllers: InputMapControllers = {},
    ): BrioInputMap<A> {
        const map = new BrioInputMap<A>(controllers);
        map.load(json);
        return map;
    }

    // #endregion

    // #region --> CONTROLLERS

    /** Keyboard controller read by keyboard bindings. */
    public get keyboard(): BrioKeyboard | undefined {
        return this.#keyboard;
    }
    public set keyboard(value: BrioKeyboard | undefined) {
        this.#keyboard = value;
    }

    /** Mouse controller read by mouse bindings. */
    public get mouse(): BrioMouse | undefined {
        return this.#mouse;
    }
    public set mouse(value: BrioMouse | undefined) {
        this.#mouse = value;
    }

    /** Gamepad controller read by gamepad bindings. */
    public get gamepad(): BrioGamepad | undefined {
        return this.#gamepad;
    }
    public set gamepad(value: BrioGamepad | undefined) {
        this.#gamepad = value;
    }

    /** Touch controller read by touch bindings. */
    public get touch(): BrioTouch | undefined {
        return this.#touch;
    }
    public set touch(value: BrioTouch | undefined) {
        this.#touch = value;
    }

    /**
     * Assigns the controllers present in `controllers` (a key set to `undefined` removes that controller;
     * absent keys are left unchanged).
     *
     * @param controllers Controllers to assign
     * @example
     * ```ts
     * input.setControllers({ keyboard: game.keyboard, gamepad: game.gamepad });
     * ```
     */
    public setControllers(controllers: InputMapControllers): void {
        if ("keyboard" in controllers) this.#keyboard = controllers.keyboard;
        if ("mouse" in controllers) this.#mouse = controllers.mouse;
        if ("gamepad" in controllers) this.#gamepad = controllers.gamepad;
        if ("touch" in controllers) this.#touch = controllers.touch;
    }

    // #endregion

    // #region --> BINDINGS

    /** Names of every action the map knows, in creation order (live array owned by the map). */
    public get actions(): readonly A[] {
        return this.#actionNames;
    }

    /**
     * Checks whether `action` exists (it may have no bindings).
     *
     * @param action Action name
     * @returns `true` when the action exists
     * @example
     * ```ts
     * if (!input.has("dash")) input.bind("dash", "Shift");
     * ```
     */
    public has(action: string): boolean {
        return this.#states.has(action);
    }

    /**
     * Adds bindings to `action`, creating the action if needed. Duplicates of an existing binding are ignored;
     * a plain string is a keyboard key. Adding a binding never fabricates an edge: an input already held when
     * it is bound does not report `isPressed`.
     *
     * @param action Action name
     * @param inputs Bindings to add
     * @returns This map, for chaining
     * @throws {Error} When `action` is empty or a binding is invalid (nothing is added then)
     * @example
     * ```ts
     * input.bind("jump", " ", "ArrowUp").bind("fire", BrioInputMap.mouseButton("left"));
     * ```
     */
    public bind(action: A, ...inputs: InputBindingLike[]): this {
        const normalized = this.#normalizeAll(action, inputs);
        const state = this.#ensureState(action);
        for (let i = 0; i < normalized.length; i++) this.#addBinding(state, normalized[i]);
        state.wasDown = this.#anyDown(state);
        return this;
    }

    /**
     * Replaces every binding of `action` (creating the action if needed). With no inputs, the action stays
     * known but unbound.
     *
     * @param action Action name
     * @param inputs New bindings
     * @returns This map, for chaining
     * @throws {Error} When `action` is empty or a binding is invalid (nothing changes then)
     * @example
     * ```ts
     * input.rebind("jump", await input.captureNext());
     * ```
     */
    public rebind(action: A, ...inputs: InputBindingLike[]): this {
        const normalized = this.#normalizeAll(action, inputs);
        const state = this.#ensureState(action);
        state.bindings.length = 0;
        state.altKeys.length = 0;
        for (let i = 0; i < normalized.length; i++) this.#addBinding(state, normalized[i]);
        state.wasDown = this.#anyDown(state);
        return this;
    }

    /**
     * Removes one binding from `action`, or every binding when `input` is omitted. The action itself stays
     * known (use `clear()` to forget it).
     *
     * @param action Action name
     * @param input Binding to remove (field-wise match, a plain string is a keyboard key)
     * @returns `true` when at least one binding was removed
     * @example
     * ```ts
     * input.unbind("jump", "w");
     * ```
     */
    public unbind(action: A, input?: InputBindingLike): boolean {
        const state = this.#states.get(action);
        if (state === undefined) return false;
        const { bindings, altKeys } = state;
        if (input === undefined) {
            const removed = bindings.length > 0;
            bindings.length = 0;
            altKeys.length = 0;
            state.wasDown = false;
            return removed;
        }
        let target: InputBinding;
        try {
            target = normalizeBinding(input);
        } catch {
            return false;
        }
        for (let i = 0; i < bindings.length; i++) {
            if (sameBinding(bindings[i], target)) {
                bindings.splice(i, 1);
                altKeys.splice(i, 1);
                state.wasDown = this.#anyDown(state);
                return true;
            }
        }
        return false;
    }

    /**
     * Forgets `action` and its bindings, or every action when `action` is omitted.
     *
     * @param action Action name (defaults to all actions)
     * @example
     * ```ts
     * input.clear();
     * ```
     */
    public clear(action?: A): void {
        if (action === undefined) {
            this.#states.clear();
            this.#actionNames.length = 0;
            return;
        }
        if (!this.#states.delete(action)) return;
        const index = this.#actionNames.indexOf(action);
        if (index >= 0) this.#actionNames.splice(index, 1);
    }

    /**
     * Returns the bindings of `action` (normalized: gamepad bindings carry `pad`, axis bindings carry
     * `threshold`). The array is a live view owned by the map.
     *
     * @param action Action name
     * @returns The bindings, empty for an unknown action
     * @example
     * ```ts
     * const label = input.getBindings("jump").map(describeBinding).join(" / ");
     * ```
     */
    public getBindings(action: string): readonly InputBinding[] {
        return this.#states.get(action)?.bindings ?? EMPTY_BINDINGS;
    }

    // #endregion

    // #region --> QUERIES

    /**
     * Checks whether any binding of `action` is down. Always `false` while `captureNext()` is pending.
     *
     * @param action Action name
     * @returns `true` while the action is held
     * @example
     * ```ts
     * if (input.isDown("run")) speed *= 2;
     * ```
     */
    public isDown(action: A): boolean {
        if (this.#capture !== undefined) return false;
        const state = this.#states.get(action);
        return state !== undefined && this.#anyDown(state);
    }

    /**
     * Checks whether `action` went down during the current frame: it was up when the previous frame closed
     * and a binding is down now or was tapped during this frame. Always `false` while `captureNext()` is
     * pending.
     *
     * @param action Action name
     * @returns `true` only on the press frame
     * @example
     * ```ts
     * if (input.isPressed("jump")) player.jump();
     * ```
     */
    public isPressed(action: A): boolean {
        if (this.#capture !== undefined) return false;
        const state = this.#states.get(action);
        if (state === undefined || state.wasDown) return false;
        return this.#anyDown(state) || this.#anyPressedEdge(state);
    }

    /**
     * Checks whether `action` was released during the current frame: no binding is down now, and the action
     * was down when the previous frame closed or was tapped during this frame. Always `false` while
     * `captureNext()` is pending.
     *
     * @param action Action name
     * @returns `true` only on the release frame
     * @example
     * ```ts
     * if (input.isUp("charge")) player.releaseShot();
     * ```
     */
    public isUp(action: A): boolean {
        if (this.#capture !== undefined) return false;
        const state = this.#states.get(action);
        if (state === undefined || this.#anyDown(state)) return false;
        return state.wasDown || this.#anyPressedEdge(state);
    }

    /**
     * Returns the analog strength of `action` in `[0, 1]`: the largest value among its bindings. Digital
     * bindings report `0` or `1`, gamepad buttons their analog value (trigger pressure) and gamepad axes their
     * deflection past the gamepad deadzone. Always `0` while `captureNext()` is pending.
     *
     * @param action Action name
     * @returns Strength in `[0, 1]`, `0` for an unknown action
     * @example
     * ```ts
     * car.throttle = input.value("accelerate");
     * ```
     */
    public value(action: A): number {
        if (this.#capture !== undefined) return 0;
        const state = this.#states.get(action);
        if (state === undefined) return 0;
        const { bindings, altKeys } = state;
        let max = 0;
        for (let i = 0; i < bindings.length; i++) {
            const v = this.#bindingValue(bindings[i], altKeys[i]);
            if (v > max) max = v;
        }
        return max;
    }

    /**
     * Combines two actions into a signed axis: `value(positiveAction) - value(negativeAction)`, in `[-1, 1]`.
     *
     * @param negativeAction Action pulling towards `-1` (e.g. `"left"`)
     * @param positiveAction Action pulling towards `+1` (e.g. `"right"`)
     * @returns Axis value in `[-1, 1]`
     * @example
     * ```ts
     * player.velocity.x = input.axis("left", "right") * 200;
     * ```
     */
    public axis(negativeAction: A, positiveAction: A): number {
        return this.value(positiveAction) - this.value(negativeAction);
    }

    /**
     * Closes the input frame for the map: records which actions are down, for the next frame's `isPressed` /
     * `isUp`, and settles a pending `captureNext()`. Must run exactly once per frame, after game code and before
     * the controllers' own `endFrame()` (which consume the latched taps the map reads). `BrioGame` does it.
     *
     * @example
     * ```ts
     * // at the end of a custom frame loop
     * input.endFrame();
     * keyboard.endFrame();
     * ```
     */
    public endFrame(): void {
        this.#states.forEach(this.#snapshot);
        const capture = this.#capture;
        if (capture === undefined) return;
        if (!capture.armed) {
            capture.armed = true;
            return;
        }
        const binding = this.#findPressed(capture);
        if (binding !== undefined) {
            this.#endCapture(capture);
            capture.resolve(binding);
        }
    }

    // #endregion

    // #region --> CAPTURE

    /** Whether a `captureNext()` request is pending (action queries are suppressed meanwhile). */
    public get isCapturing(): boolean {
        return this.#capture !== undefined;
    }

    /**
     * Waits for the next key, mouse button or gamepad button press and resolves with its binding, for
     * "press a key" rebinding screens. Presses are detected in `endFrame()`; presses in the frame where the
     * capture starts (such as the click that opened it) are ignored, and keys already held do not count.
     * While pending, every action query reports `false` / `0`, so the captured press does not also trigger
     * gameplay or menu actions. Letters resolve in lowercase. A new call cancels the pending one. Gamepad axes
     * are not captured.
     *
     * @param options Devices to listen to and an optional `AbortSignal`
     * @returns A promise resolving with the pressed input, rejecting with an `AbortError` when cancelled
     * @example
     * ```ts
     * const binding = await game.input.captureNext();
     * game.input.rebind("jump", binding);
     *
     * // inside update(), before the frame ends: Escape cancels
     * if (game.input.isCapturing && game.keyboard.isPressed("Escape")) game.input.cancelCapture();
     * ```
     */
    public captureNext(options: InputCaptureOptions = {}): Promise<InputBinding> {
        this.cancelCapture();
        const { signal } = options;
        if (signal?.aborted) return Promise.reject(signal.reason);
        const devices = options.devices ?? ["keyboard", "mouse", "gamepad"];
        return new Promise<InputBinding>((resolve, reject) => {
            const request: CaptureRequest = {
                resolve,
                reject,
                keyboard: devices.includes("keyboard"),
                mouse: devices.includes("mouse"),
                gamepad: devices.includes("gamepad"),
                signal,
                onAbort: () => {
                    if (this.#capture !== request) return;
                    this.#endCapture(request);
                    reject(signal?.reason);
                },
                armed: false,
            };
            signal?.addEventListener("abort", request.onAbort, { once: true });
            this.#capture = request;
        });
    }

    /**
     * Cancels a pending `captureNext()`, whose promise rejects with an `AbortError` `DOMException`. Does
     * nothing when no capture is pending.
     *
     * @example
     * ```ts
     * input.cancelCapture();
     * ```
     */
    public cancelCapture(): void {
        const capture = this.#capture;
        if (capture === undefined) return;
        this.#endCapture(capture);
        capture.reject(new DOMException("Input capture was cancelled.", "AbortError"));
    }

    // #endregion

    // #region --> SERIALIZATION

    /**
     * Returns the bindings as a plain object (copies), ready for `JSON.stringify` or `BrioStorage`.
     *
     * @returns Serializable bindings
     * @example
     * ```ts
     * await BrioStorage.local.set("bindings", game.input.toJSON());
     * ```
     */
    public toJSON(): InputMapJSON {
        const actions: Record<string, InputBinding[]> = {};
        this.#states.forEach((state, name) => {
            actions[name] = state.bindings.map((binding) => ({ ...binding }));
        });
        return { version: CURRENT_VERSION, actions };
    }

    /**
     * Replaces the bindings of every action present in `json` (creating unknown actions unless
     * `onlyKnownActions` is set); actions absent from `json` keep their current bindings, so defaults for
     * actions added later survive an old save. Invalid bindings are skipped and reported; an action whose
     * bindings are all invalid keeps its current ones, while an empty array unbinds it.
     *
     * @param json Value produced by `toJSON()` (object or JSON string)
     * @param options Load options
     * @returns Which actions were applied and what was skipped
     * @throws {Error} When `json` is structurally invalid (not an object, unsupported `version`, `actions`
     * not an object, or an action value not an array); nothing changes then
     * @example
     * ```ts
     * const defaults = input.toJSON();
     * const report = input.load(await storage.get("bindings") ?? defaults);
     * ```
     */
    public load(json: unknown, options: InputMapLoadOptions = {}): InputMapLoadReport {
        let data = json;
        if (typeof data === "string") {
            try {
                data = JSON.parse(data);
            } catch {
                throw new Error("BrioInputMap.load: the string is not valid JSON.");
            }
        }
        if (!isRecord(data)) throw new Error("BrioInputMap.load: expected an object.");
        if (data.version !== undefined && data.version !== CURRENT_VERSION) {
            throw new Error(
                `BrioInputMap.load: unsupported version ${JSON.stringify(data.version)}.`,
            );
        }
        const actions = data.actions;
        if (!isRecord(actions)) throw new Error("BrioInputMap.load: `actions` must be an object.");
        const names = Object.keys(actions);
        for (let i = 0; i < names.length; i++) {
            if (!Array.isArray(actions[names[i]])) {
                throw new Error(
                    `BrioInputMap.load: bindings of ${JSON.stringify(names[i])} must be an array.`,
                );
            }
        }

        const applied: string[] = [];
        const issues: string[] = [];
        const pending: [string, InputBinding[]][] = [];
        for (let i = 0; i < names.length; i++) {
            const name = names[i];
            const entries = actions[name] as unknown[];
            if (name.length === 0) {
                issues.push("empty action name skipped");
                continue;
            }
            if (options.onlyKnownActions === true && !this.#states.has(name)) {
                issues.push(`unknown action ${JSON.stringify(name)} skipped`);
                continue;
            }
            const valid: InputBinding[] = [];
            for (let j = 0; j < entries.length; j++) {
                try {
                    valid.push(normalizeBinding(entries[j]));
                } catch (error) {
                    issues.push(`${name}[${j}]: ${(error as Error).message}`);
                }
            }
            if (entries.length > 0 && valid.length === 0) {
                issues.push(`${JSON.stringify(name)} kept its bindings (no valid entry)`);
                continue;
            }
            pending.push([name, valid]);
        }
        for (let i = 0; i < pending.length; i++) {
            const [name, valid] = pending[i];
            const state = this.#ensureState(name as A);
            state.bindings.length = 0;
            state.altKeys.length = 0;
            for (let j = 0; j < valid.length; j++) this.#addBinding(state, valid[j]);
            state.wasDown = this.#anyDown(state);
            applied.push(name);
        }
        return { applied, issues };
    }

    // #endregion

    // #region --> INTERNALS

    #normalizeAll(action: string, inputs: readonly InputBindingLike[]): InputBinding[] {
        if (typeof action !== "string" || action.length === 0) {
            throw new Error("BrioInputMap: action names must be non-empty strings.");
        }
        const out: InputBinding[] = [];
        for (let i = 0; i < inputs.length; i++) {
            try {
                out.push(normalizeBinding(inputs[i]));
            } catch (error) {
                throw new Error(
                    `BrioInputMap: invalid binding #${i} for "${action}": ${(error as Error).message}.`,
                );
            }
        }
        return out;
    }

    #ensureState(action: A): ActionState {
        let state = this.#states.get(action);
        if (state === undefined) {
            state = { bindings: [], altKeys: [], wasDown: false };
            this.#states.set(action, state);
            this.#actionNames.push(action);
        }
        return state;
    }

    #addBinding(state: ActionState, binding: InputBinding): void {
        const { bindings } = state;
        for (let i = 0; i < bindings.length; i++) {
            if (sameBinding(bindings[i], binding)) return;
        }
        bindings.push(binding);
        state.altKeys.push(
            binding.device === "keyboard"
                ? (otherLetterCase(binding.key) as KeyboardKey | undefined)
                : undefined,
        );
    }

    #anyDown(state: ActionState): boolean {
        const { bindings, altKeys } = state;
        for (let i = 0; i < bindings.length; i++) {
            if (this.#bindingDown(bindings[i], altKeys[i])) return true;
        }
        return false;
    }

    #anyPressedEdge(state: ActionState): boolean {
        const { bindings, altKeys } = state;
        for (let i = 0; i < bindings.length; i++) {
            if (this.#bindingPressedEdge(bindings[i], altKeys[i])) return true;
        }
        return false;
    }

    #bindingDown(binding: InputBinding, altKey: KeyboardKey | undefined): boolean {
        switch (binding.device) {
            case "keyboard": {
                const keyboard = this.#keyboard;
                if (keyboard === undefined) return false;
                return (
                    keyboard.isDown(binding.key) ||
                    (altKey !== undefined && keyboard.isDown(altKey))
                );
            }
            case "mouse":
                return this.#mouse !== undefined && this.#mouse.isDown(binding.button);
            case "gamepad": {
                const gamepad = this.#gamepad;
                if (gamepad === undefined) return false;
                if ("axis" in binding) {
                    const deflection =
                        gamepad.getAxis(binding.axis, binding.pad) * binding.direction;
                    return deflection >= (binding.threshold ?? DEFAULT_AXIS_THRESHOLD);
                }
                return gamepad.isDown(binding.button, binding.pad);
            }
            case "touch":
                return this.#touch !== undefined && this.#touch.isTouching;
        }
    }

    /** Latched press edge of the controller (taps shorter than one frame); axes and touch have none. */
    #bindingPressedEdge(binding: InputBinding, altKey: KeyboardKey | undefined): boolean {
        switch (binding.device) {
            case "keyboard": {
                const keyboard = this.#keyboard;
                if (keyboard === undefined) return false;
                return (
                    keyboard.isPressed(binding.key) ||
                    (altKey !== undefined && keyboard.isPressed(altKey))
                );
            }
            case "mouse":
                return this.#mouse !== undefined && this.#mouse.isPressed(binding.button);
            case "gamepad":
                return (
                    this.#gamepad !== undefined &&
                    "button" in binding &&
                    this.#gamepad.isPressed(binding.button, binding.pad)
                );
            case "touch":
                return false;
        }
    }

    #bindingValue(binding: InputBinding, altKey: KeyboardKey | undefined): number {
        if (binding.device !== "gamepad") return this.#bindingDown(binding, altKey) ? 1 : 0;
        const gamepad = this.#gamepad;
        if (gamepad === undefined) return 0;
        if ("button" in binding) return gamepad.getButtonValue(binding.button, binding.pad);
        const deflection = gamepad.getAxis(binding.axis, binding.pad) * binding.direction;
        const deadzone = gamepad.deadzone;
        if (deflection <= deadzone) return 0;
        return Math.min(1, (deflection - deadzone) / (1 - deadzone));
    }

    #findPressed(capture: CaptureRequest): InputBinding | undefined {
        const keyboard = this.#keyboard;
        if (capture.keyboard && keyboard !== undefined) {
            for (const key of keyboard.pressedKeys) {
                return { device: "keyboard", key: lowerLetter(key) };
            }
        }
        const mouse = this.#mouse;
        if (capture.mouse && mouse !== undefined) {
            for (let i = 0; i < MOUSE_BUTTON_NAMES.length; i++) {
                const button = MOUSE_BUTTON_NAMES[i];
                if (mouse.isPressed(button)) return { device: "mouse", button };
            }
        }
        const gamepad = this.#gamepad;
        if (capture.gamepad && gamepad !== undefined) {
            for (let pad = 0; pad < CAPTURE_PADS; pad++) {
                if (!gamepad.isConnected(pad)) continue;
                for (let i = 0; i < GAMEPAD_BUTTON_NAMES.length; i++) {
                    const button = GAMEPAD_BUTTON_NAMES[i];
                    if (gamepad.isPressed(button, pad)) return { device: "gamepad", button, pad };
                }
            }
        }
        return undefined;
    }

    #endCapture(capture: CaptureRequest): void {
        if (this.#capture === capture) this.#capture = undefined;
        capture.signal?.removeEventListener("abort", capture.onAbort);
    }

    // #endregion
}
