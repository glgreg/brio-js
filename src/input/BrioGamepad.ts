import { Vec2 } from "../math/vec2";

/**
 * Canonical W3C Standard Gamepad button names.
 */
export type GamepadButtonName =
    | "south"
    | "east"
    | "west"
    | "north"
    | "l1"
    | "r1"
    | "l2"
    | "r2"
    | "select"
    | "start"
    | "l3"
    | "r3"
    | "up"
    | "down"
    | "left"
    | "right"
    | "home";

const GAMEPAD_BUTTON_INDEX: Record<GamepadButtonName, number> = {
    south: 0,
    east: 1,
    west: 2,
    north: 3,
    l1: 4,
    r1: 5,
    l2: 6,
    r2: 7,
    select: 8,
    start: 9,
    l3: 10,
    r3: 11,
    up: 12,
    down: 13,
    left: 14,
    right: 15,
    home: 16,
};

/** Every `GamepadButtonName` in W3C Standard Gamepad index order (`GAMEPAD_BUTTON_NAMES[i]` is button `i`). */
export const GAMEPAD_BUTTON_NAMES: readonly GamepadButtonName[] = Object.freeze([
    "south",
    "east",
    "west",
    "north",
    "l1",
    "r1",
    "l2",
    "r2",
    "select",
    "start",
    "l3",
    "r3",
    "up",
    "down",
    "left",
    "right",
    "home",
]);

/** Buttons and axes tracked per pad; extra ones reported by exotic devices are ignored. */
const MAX_BUTTONS = 32;
const MAX_AXES = 16;
/** Pad slots tracked; `navigator.getGamepads()` reports at most four in current browsers. */
const MAX_PADS = 8;

/** Per-pad state, allocated once when a pad index is first seen connected. */
interface PadState {
    connected: boolean;
    buttonCount: number;
    axisCount: number;
    readonly down: Uint8Array;
    readonly pressed: Uint8Array;
    readonly released: Uint8Array;
    readonly values: Float32Array;
    readonly axes: Float32Array;
}

const createPadState = (): PadState => ({
    connected: false,
    buttonCount: 0,
    axisCount: 0,
    down: new Uint8Array(MAX_BUTTONS),
    pressed: new Uint8Array(MAX_BUTTONS),
    released: new Uint8Array(MAX_BUTTONS),
    values: new Float32Array(MAX_BUTTONS),
    axes: new Float32Array(MAX_AXES),
});

/**
 * Gamepad input controller (`BrioGamepad`) polling the W3C Gamepad API with radial deadzone filtering,
 * button transition detection (`isDown`, `isPressed`, `isUp`), analog stick, axis and trigger reading
 * (`getLeftStick`, `getRightStick`, `getAxis`, `getButtonValue`), and dual-rumble haptic vibration (`vibrate`).
 *
 * The Gamepad API has no button events, so state is sampled by `poll()`. Every read returns the snapshot of
 * the latest `poll()`. Once `endFrame()` runs once per frame, press and release edges are latched across any
 * number of `poll()` calls and consumed by `endFrame()`, so a tap caught by any poll of the frame reports
 * `isPressed` and `isUp` for exactly one frame. Without `endFrame()`, each `poll()` starts a new edge frame.
 *
 * @example
 * ```ts
 * const gamepad = new BrioGamepad(0.15);
 * gamepad.poll();
 * const move = gamepad.getLeftStick(0);
 * if (gamepad.isPressed("south", 0)) {
 *     player.jump();
 * }
 * gamepad.endFrame(); // once per frame, after game code
 * ```
 */
export class BrioGamepad {
    #deadzone: number;
    readonly #pads: (PadState | undefined)[] = [];
    /** Becomes `true` on the first `endFrame()`; edges then survive until `endFrame()` instead of `poll()`. */
    #frameSynced: boolean = false;

    /**
     * Creates a new `BrioGamepad` controller.
     *
     * @param deadzone Analog stick radial deadzone in `[0, 0.9]` (defaults to `0.15`)
     */
    constructor(deadzone: number = 0.15) {
        this.#deadzone = Math.max(0, Math.min(0.9, deadzone));
    }

    /** Analog stick radial deadzone in `[0, 0.9]`. Also the per-axis deadzone used by `BrioInputMap`. */
    public get deadzone(): number {
        return this.#deadzone;
    }
    public set deadzone(value: number) {
        this.#deadzone = Math.max(0, Math.min(0.9, value));
    }

    /**
     * Samples `navigator.getGamepads()` into the controller snapshot (buttons, analog values, axes) and records
     * press/release edges. Safe to call several times per frame: once `endFrame()` closes frames, edges
     * accumulate until it runs, so extra polls (for example during a long frame) only add chances to catch a
     * short tap. A pad that disconnects releases its held buttons.
     *
     * @example
     * ```ts
     * gamepad.poll();
     * ```
     */
    public poll(): void {
        const pads = this.#pads;
        if (!this.#frameSynced) this.#clearEdges();

        const source =
            typeof navigator !== "undefined" && typeof navigator.getGamepads === "function"
                ? navigator.getGamepads()
                : null;
        const count = source ? Math.min(source.length, MAX_PADS) : 0;

        for (let padIdx = 0; padIdx < count; padIdx++) {
            const pad = source![padIdx];
            if (!pad || !pad.connected) {
                const state = pads[padIdx];
                if (state?.connected) this.#disconnect(state);
                continue;
            }
            const state = pads[padIdx] ?? (pads[padIdx] = createPadState());
            state.connected = true;

            const buttonCount = Math.min(pad.buttons.length, MAX_BUTTONS);
            for (let b = 0; b < buttonCount; b++) {
                const btn = pad.buttons[b];
                const isDown = btn ? btn.pressed : false;
                const wasDown = state.down[b] === 1;
                if (isDown && !wasDown) state.pressed[b] = 1;
                else if (!isDown && wasDown) state.released[b] = 1;
                state.down[b] = isDown ? 1 : 0;
                state.values[b] = btn ? Math.max(0, Math.min(1, btn.value)) : 0;
            }
            // Buttons beyond the new count (a remapped device) go up instead of staying stuck
            for (let b = buttonCount; b < state.buttonCount; b++) {
                if (state.down[b] === 1) state.released[b] = 1;
                state.down[b] = 0;
                state.values[b] = 0;
            }
            state.buttonCount = buttonCount;

            const axisCount = Math.min(pad.axes.length, MAX_AXES);
            for (let a = 0; a < axisCount; a++) {
                const v = pad.axes[a];
                state.axes[a] = Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0;
            }
            for (let a = axisCount; a < state.axisCount; a++) state.axes[a] = 0;
            state.axisCount = axisCount;
        }
        // Pads beyond the reported list (or every pad when the API is missing) are disconnected
        for (let padIdx = count; padIdx < pads.length; padIdx++) {
            const state = pads[padIdx];
            if (state?.connected) this.#disconnect(state);
        }
    }

    /**
     * Closes the input frame: consumes the latched press/release edges. Must run exactly once per frame, after
     * game code. Until it is first called, every `poll()` starts a new edge frame instead (the behavior of
     * callers that poll exactly once per frame and never call `endFrame()`).
     *
     * @example
     * ```ts
     * gamepad.endFrame();
     * ```
     */
    public endFrame(): void {
        this.#frameSynced = true;
        this.#clearEdges();
    }

    /**
     * Whether a pad is connected at `padIndex` according to the latest `poll()`.
     *
     * @param padIndex 0-based controller index (defaults to `0`)
     * @returns `true` while the pad is connected
     * @example
     * ```ts
     * if (!game.gamepad.isConnected(0)) showHint("Connect a controller");
     * ```
     */
    public isConnected(padIndex: number = 0): boolean {
        return this.#pads[padIndex]?.connected === true;
    }

    /**
     * Checks whether `button` is held down on controller `padIndex`.
     *
     * @param button Standard button name (e.g. `"south"`, `"start"`, `"r1"`)
     * @param padIndex 0-based controller index (defaults to `0`)
     * @returns `true` while pressed
     * @example
     * ```ts
     * if (gamepad.isDown("r2", 0)) { ... }
     * ```
     */
    public isDown(button: GamepadButtonName, padIndex: number = 0): boolean {
        const pad = this.#pads[padIndex];
        return pad !== undefined && pad.down[GAMEPAD_BUTTON_INDEX[button]] === 1;
    }

    /**
     * Checks whether `button` went down during the current frame. With `endFrame()` closing frames, a tap
     * caught by any `poll()` of the frame reports `true` once (together with `isUp`).
     *
     * @param button Standard button name
     * @param padIndex 0-based controller index (defaults to `0`)
     * @returns `true` only on the initial press frame
     * @example
     * ```ts
     * if (gamepad.isPressed("south")) player.jump();
     * ```
     */
    public isPressed(button: GamepadButtonName, padIndex: number = 0): boolean {
        const pad = this.#pads[padIndex];
        return pad !== undefined && pad.pressed[GAMEPAD_BUTTON_INDEX[button]] === 1;
    }

    /**
     * Checks whether `button` was released during the current frame (including releases caused by the pad
     * disconnecting).
     *
     * @param button Standard button name
     * @param padIndex 0-based controller index (defaults to `0`)
     * @returns `true` only on the release frame
     * @example
     * ```ts
     * if (gamepad.isUp("r2")) bow.release();
     * ```
     */
    public isUp(button: GamepadButtonName, padIndex: number = 0): boolean {
        const pad = this.#pads[padIndex];
        return pad !== undefined && pad.released[GAMEPAD_BUTTON_INDEX[button]] === 1;
    }

    /**
     * Returns the analog value of `button` in `[0, 1]` (pressure for triggers `l2`/`r2`; `0` or `1` for digital
     * buttons on most pads).
     *
     * @param button Standard button name
     * @param padIndex 0-based controller index (defaults to `0`)
     * @returns Analog value in `[0, 1]`, `0` when the pad is not connected
     * @example
     * ```ts
     * const throttle = game.gamepad.getButtonValue("r2");
     * ```
     */
    public getButtonValue(button: GamepadButtonName, padIndex: number = 0): number {
        const pad = this.#pads[padIndex];
        if (pad === undefined) return 0;
        const idx = GAMEPAD_BUTTON_INDEX[button];
        const value = pad.values[idx];
        // Some devices report `pressed` with a zero value for digital buttons
        return pad.down[idx] === 1 && value === 0 ? 1 : value;
    }

    /**
     * Returns the raw value of axis `axisIndex` in `[-1, 1]`, without deadzone (standard mapping: `0`/`1` left
     * stick X/Y, `2`/`3` right stick X/Y; positive Y points down).
     *
     * @param axisIndex Axis index
     * @param padIndex 0-based controller index (defaults to `0`)
     * @returns Raw axis value, `0` when the pad or axis does not exist
     * @example
     * ```ts
     * const steer = game.gamepad.getAxis(0);
     * ```
     */
    public getAxis(axisIndex: number, padIndex: number = 0): number {
        const pad = this.#pads[padIndex];
        if (pad === undefined || axisIndex < 0 || axisIndex >= pad.axisCount) return 0;
        return pad.axes[axisIndex];
    }

    /**
     * Returns the deadzone-filtered left analog stick vector `{ x, y }` in `[-1, 1]` for `padIndex`, from the
     * latest `poll()`.
     *
     * @param padIndex 0-based controller index (defaults to `0`)
     * @param out Optional destination object, to avoid allocating
     * @returns Filtered `{ x, y }` stick vector (`out` when given)
     * @example
     * ```ts
     * const leftStick = gamepad.getLeftStick(0);
     * ```
     */
    public getLeftStick(padIndex: number = 0, out?: Vec2): Vec2 {
        return this.#readStick(padIndex, 0, 1, out);
    }

    /**
     * Returns the deadzone-filtered right analog stick vector `{ x, y }` in `[-1, 1]` for `padIndex`, from the
     * latest `poll()`.
     *
     * @param padIndex 0-based controller index (defaults to `0`)
     * @param out Optional destination object, to avoid allocating
     * @returns Filtered `{ x, y }` stick vector (`out` when given)
     * @example
     * ```ts
     * const aim = gamepad.getRightStick(0, scratch);
     * ```
     */
    public getRightStick(padIndex: number = 0, out?: Vec2): Vec2 {
        return this.#readStick(padIndex, 2, 3, out);
    }

    /**
     * Triggers haptic vibration on controller `padIndex` if supported by the browser/device.
     *
     * @param durationMs Vibration duration in milliseconds
     * @param weakMagnitude High-frequency (weak) motor intensity in `[0, 1]` (defaults to `0.5`)
     * @param strongMagnitude Low-frequency (strong) motor intensity in `[0, 1]` (defaults to `0.5`)
     * @param padIndex 0-based controller index (defaults to `0`)
     * @example
     * ```ts
     * gamepad.vibrate(150, 0.4, 0.8, 0);
     * ```
     */
    public vibrate(
        durationMs: number,
        weakMagnitude: number = 0.5,
        strongMagnitude: number = 0.5,
        padIndex: number = 0,
    ): void {
        if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return;
        const pad = navigator.getGamepads()[padIndex];
        if (!pad || !pad.vibrationActuator) return;

        pad.vibrationActuator
            .playEffect("dual-rumble", {
                startDelay: 0,
                duration: Math.max(0, durationMs),
                weakMagnitude: Math.max(0, Math.min(1, weakMagnitude)),
                strongMagnitude: Math.max(0, Math.min(1, strongMagnitude)),
            })
            .catch(() => {});
    }

    #clearEdges(): void {
        const pads = this.#pads;
        for (let i = 0; i < pads.length; i++) {
            const pad = pads[i];
            if (pad === undefined) continue;
            pad.pressed.fill(0);
            pad.released.fill(0);
        }
    }

    #disconnect(state: PadState): void {
        for (let b = 0; b < state.buttonCount; b++) {
            if (state.down[b] === 1) state.released[b] = 1;
        }
        state.down.fill(0);
        state.values.fill(0);
        state.axes.fill(0);
        state.connected = false;
        state.buttonCount = 0;
        state.axisCount = 0;
    }

    #readStick(padIndex: number, axisXIndex: number, axisYIndex: number, out?: Vec2): Vec2 {
        const result = out ?? { x: 0, y: 0 };
        const rawX = this.getAxis(axisXIndex, padIndex);
        const rawY = this.getAxis(axisYIndex, padIndex);
        const mag = Math.hypot(rawX, rawY);

        if (mag <= this.#deadzone) {
            result.x = 0;
            result.y = 0;
            return result;
        }

        const rescaledMag = Math.min(1, (mag - this.#deadzone) / (1 - this.#deadzone));
        result.x = (rawX / mag) * rescaledMag;
        result.y = (rawY / mag) * rescaledMag;
        return result;
    }
}
