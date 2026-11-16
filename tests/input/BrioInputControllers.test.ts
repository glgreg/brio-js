import { describe, expect, it } from "vitest";
import { BrioGamepad } from "../../src/input/BrioGamepad";
import { BrioMouse } from "../../src/input/BrioMouse";
import { BrioTouch } from "../../src/input/BrioTouch";

describe("BrioMouse, BrioTouch & BrioGamepad Input Controllers", () => {
    it("tracks pointer movement, buttons, and frame transitions in BrioMouse", () => {
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const mouse = new BrioMouse(canvas);

        canvas.dispatchEvent(new MouseEvent("mousemove", { clientX: 120, clientY: 80 }));
        expect(mouse.position).toEqual({ x: 120, y: 80 });
        expect(mouse.delta).toEqual({ x: 120, y: 80 });

        canvas.dispatchEvent(new MouseEvent("mousedown", { button: 0 }));
        expect(mouse.isDown("left")).toBe(true);
        expect(mouse.isPressed("left")).toBe(true);

        mouse.endFrame();
        expect(mouse.isDown("left")).toBe(true);
        expect(mouse.isPressed("left")).toBe(false);
        expect(mouse.delta).toEqual({ x: 0, y: 0 });

        window.dispatchEvent(new MouseEvent("mouseup", { button: 0 }));
        expect(mouse.isDown("left")).toBe(false);
        expect(mouse.isUp("left")).toBe(true);

        mouse.endFrame();
        expect(mouse.isUp("left")).toBe(false);
        mouse.removeListener();
    });

    it("polls W3C Gamepad API with radial deadzone filtering in BrioGamepad", () => {
        const originalGetGamepads = navigator.getGamepads;
        const mockButtons = Array.from({ length: 17 }, (_, i) => ({
            pressed: i === 0, // south button pressed
            touched: i === 0,
            value: i === 0 ? 1 : 0,
        }));
        navigator.getGamepads = () =>
            [
                {
                    connected: true,
                    index: 0,
                    id: "MockPad",
                    mapping: "standard",
                    axes: [0.05, -0.05, 0.8, 0.0], // left stick inside deadzone, right stick outside
                    buttons: mockButtons,
                    timestamp: 100,
                    hapticActuators: [],
                    vibrationActuator: null,
                } as unknown as Gamepad,
            ] as unknown as ReturnType<typeof navigator.getGamepads>;

        const gamepad = new BrioGamepad(0.15);
        gamepad.poll();

        expect(gamepad.isDown("south", 0)).toBe(true);
        expect(gamepad.isPressed("south", 0)).toBe(true);
        expect(gamepad.getLeftStick(0)).toEqual({ x: 0, y: 0 });
        expect(gamepad.getRightStick(0).x).toBeGreaterThan(0.7);

        gamepad.poll();
        expect(gamepad.isPressed("south", 0)).toBe(false);

        navigator.getGamepads = originalGetGamepads;
    });

    it("initializes and detaches listeners cleanly on BrioTouch", () => {
        const canvas = document.createElement("canvas");
        const touch = new BrioTouch(canvas);
        expect(touch.isTouching).toBe(false);
        expect(touch.touchCount).toBe(0);
        expect(touch.primaryPosition).toEqual({ x: 0, y: 0 });
        touch.removeListener();
    });
});
