import { BrioConsole } from "../../src/debugging/BrioConsole";
import { BrioKeyboard } from "../../src/input/BrioKeyboard";

/** Mutable fake of one W3C Standard Gamepad; tests flip `buttons[i].pressed` and `axes[i]` between polls. */
export interface FakePad {
    connected: boolean;
    index: number;
    id: string;
    mapping: "standard";
    axes: number[];
    buttons: { pressed: boolean; touched: boolean; value: number }[];
    timestamp: number;
    vibrationActuator: null;
}

export const createFakePad = (index = 0): FakePad => ({
    connected: true,
    index,
    id: `FakePad${index}`,
    mapping: "standard",
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
    timestamp: 0,
    vibrationActuator: null,
});

export const setButton = (pad: FakePad, index: number, pressed: boolean, value?: number): void => {
    pad.buttons[index].pressed = pressed;
    pad.buttons[index].value = value ?? (pressed ? 1 : 0);
};

/** Replaces `navigator.getGamepads` with a fake returning `pads`; returns the restore function. */
export const installFakeGamepads = (pads: (FakePad | null)[]): (() => void) => {
    const original = navigator.getGamepads;
    navigator.getGamepads = () => pads as unknown as ReturnType<typeof navigator.getGamepads>;
    return () => {
        navigator.getGamepads = original;
    };
};

export const keyDown = (key: string): void => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key }));
};

export const keyUp = (key: string): void => {
    window.dispatchEvent(new KeyboardEvent("keyup", { key }));
};

export const makeKeyboard = (): BrioKeyboard =>
    new BrioKeyboard(new Map(), new Map(), new BrioConsole());
