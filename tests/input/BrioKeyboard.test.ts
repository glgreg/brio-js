import { describe, it, expect, vi } from "vitest";
import { BrioConsole } from "../../src/debugging/BrioConsole";
import { BrioKeyboard } from "../../src/input/BrioKeyboard";

describe("BrioKeyboard", () => {
    it("tracks keyDown, keyUp, isDown, isUp, and customActions accurately", () => {
        const state = new Map<string, boolean>();
        const prevState = new Map<string, boolean>();
        const brioConsole = new BrioConsole();
        const keyboard = new BrioKeyboard(state, prevState, brioConsole);

        const onEscape = vi.fn();
        keyboard.customActions.set("Escape", onEscape);

        // Press ArrowRight
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
        expect(keyboard.isDown("ArrowRight")).toBe(true);
        expect(keyboard.isUp("ArrowRight")).toBe(false);

        // Simulate frame boundary (copy state -> prevState)
        prevState.clear();
        for (const [k, v] of state) prevState.set(k, v);

        // Release ArrowRight
        window.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowRight" }));
        expect(keyboard.isDown("ArrowRight")).toBe(false);
        expect(keyboard.isUp("ArrowRight")).toBe(true);

        // Trigger custom action
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
        expect(onEscape).toHaveBeenCalledTimes(1);

        keyboard.removeListener();
    });
});
