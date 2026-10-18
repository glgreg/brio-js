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

/**
 * Gamepad input controller (`BrioGamepad`) polling the W3C Gamepad API with radial deadzone filtering,
 * single-frame button transition detection (`isDown`, `isPressed`, `isUp`), analog stick reading (`getLeftStick`, `getRightStick`),
 * and dual-rumble haptic vibration (`vibrate`).
 *
 * @example
 * ```ts
 * const gamepad = new BrioGamepad(0.15);
 * gamepad.poll();
 * const move = gamepad.getLeftStick(0);
 * if (gamepad.isPressed("south", 0)) {
 *     player.jump();
 * }
 * ```
 */
export class BrioGamepad {
    #deadzone: number;
    readonly #currentButtons = new Map<string, boolean>();
    readonly #previousButtons = new Map<string, boolean>();

    /**
     * Creates a new `BrioGamepad` controller.
     *
     * @param deadzone Analog stick radial deadzone in `[0, 0.9]` (defaults to `0.15`)
     */
    constructor(deadzone: number = 0.15) {
        this.#deadzone = Math.max(0, Math.min(0.9, deadzone));
    }

    /** Analog stick radial deadzone in `[0, 0.9]`. */
    public get deadzone(): number {
        return this.#deadzone;
    }
    public set deadzone(value: number) {
        this.#deadzone = Math.max(0, Math.min(0.9, value));
    }

    /**
     * Polls `navigator.getGamepads()` and updates internal button states for frame-accurate `isPressed` / `isUp` checks.
     * Call once per frame before reading gamepad state.
     *
     * @example
     * ```ts
     * gamepad.poll();
     * ```
     */
    public poll(): void {
        this.#previousButtons.clear();
        for (const [k, v] of this.#currentButtons.entries()) {
            this.#previousButtons.set(k, v);
        }
        this.#currentButtons.clear();

        if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") {
            return;
        }

        const pads = navigator.getGamepads();
        if (!pads) return;

        for (let padIdx = 0; padIdx < pads.length; padIdx++) {
            const pad = pads[padIdx];
            if (!pad || !pad.connected) continue;

            for (let btnIdx = 0; btnIdx < pad.buttons.length; btnIdx++) {
                const btn = pad.buttons[btnIdx];
                this.#currentButtons.set(`${padIdx}:${btnIdx}`, Boolean(btn && btn.pressed));
            }
        }
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
        const key = `${padIndex}:${GAMEPAD_BUTTON_INDEX[button]}`;
        return this.#currentButtons.get(key) === true;
    }

    /**
     * Checks whether `button` was just pressed on the current frame.
     *
     * @param button Standard button name
     * @param padIndex 0-based controller index (defaults to `0`)
     * @returns `true` only on the initial press frame
     */
    public isPressed(button: GamepadButtonName, padIndex: number = 0): boolean {
        const key = `${padIndex}:${GAMEPAD_BUTTON_INDEX[button]}`;
        return this.#currentButtons.get(key) === true && this.#previousButtons.get(key) !== true;
    }

    /**
     * Checks whether `button` was just released on the current frame.
     *
     * @param button Standard button name
     * @param padIndex 0-based controller index (defaults to `0`)
     * @returns `true` only on the release frame
     */
    public isUp(button: GamepadButtonName, padIndex: number = 0): boolean {
        const key = `${padIndex}:${GAMEPAD_BUTTON_INDEX[button]}`;
        return this.#currentButtons.get(key) === false && this.#previousButtons.get(key) === true;
    }

    /**
     * Returns the deadzone-filtered left analog stick vector `{ x, y }` in `[-1, 1]` for `padIndex`.
     *
     * @param padIndex 0-based controller index (defaults to `0`)
     * @returns Filtered `{ x, y }` stick vector
     * @example
     * ```ts
     * const leftStick = gamepad.getLeftStick(0);
     * ```
     */
    public getLeftStick(padIndex: number = 0): Vec2 {
        return this.#readStick(padIndex, 0, 1);
    }

    /**
     * Returns the deadzone-filtered right analog stick vector `{ x, y }` in `[-1, 1]` for `padIndex`.
     *
     * @param padIndex 0-based controller index (defaults to `0`)
     * @returns Filtered `{ x, y }` stick vector
     */
    public getRightStick(padIndex: number = 0): Vec2 {
        return this.#readStick(padIndex, 2, 3);
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

    #readStick(padIndex: number, axisXIndex: number, axisYIndex: number): Vec2 {
        if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") {
            return { x: 0, y: 0 };
        }
        const pad = navigator.getGamepads()[padIndex];
        if (!pad || !pad.connected) return { x: 0, y: 0 };

        const rawX = pad.axes[axisXIndex] ?? 0;
        const rawY = pad.axes[axisYIndex] ?? 0;
        const mag = Math.hypot(rawX, rawY);

        if (mag <= this.#deadzone) {
            return { x: 0, y: 0 };
        }

        const rescaledMag = Math.min(1, (mag - this.#deadzone) / (1 - this.#deadzone));
        return {
            x: (rawX / mag) * rescaledMag,
            y: (rawY / mag) * rescaledMag,
        };
    }
}
