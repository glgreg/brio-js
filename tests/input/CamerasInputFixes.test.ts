import { afterEach, describe, expect, it, vi } from "vitest";
import { BrioCamera2D } from "../../src/cameras/BrioCamera2D";
import { BrioViewport } from "../../src/core/BrioViewport";
import { BrioConsole } from "../../src/debugging/BrioConsole";
import { BrioKeyboard } from "../../src/input/BrioKeyboard";
import { BrioMouse } from "../../src/input/BrioMouse";
import { BrioTouch } from "../../src/input/BrioTouch";

const keyDown = (key: string, repeat = false): void => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, repeat }));
};
const keyUp = (key: string): void => {
    window.dispatchEvent(new KeyboardEvent("keyup", { key }));
};

const makeKeyboard = (): BrioKeyboard => new BrioKeyboard(new Map(), new Map(), new BrioConsole());

const setVisibility = (state: DocumentVisibilityState): void => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
    document.dispatchEvent(new Event("visibilitychange"));
};

afterEach(() => {
    Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "visible",
    });
});

describe("CamerasInput: BrioKeyboard latched edges", () => {
    it("reports a tap shorter than one frame as pressed and released for exactly one frame", () => {
        const kb = makeKeyboard();
        kb.endFrame();

        keyDown("z");
        keyUp("z");
        expect(kb.isDown("z")).toBe(false);
        expect(kb.isPressed("z")).toBe(true);
        expect(kb.isUp("z")).toBe(true);

        kb.endFrame();
        expect(kb.isPressed("z")).toBe(false);
        expect(kb.isUp("z")).toBe(false);
        kb.removeListener();
    });

    it("does not report OS key repeat as new presses", () => {
        const kb = makeKeyboard();
        kb.endFrame();
        keyDown("x");
        kb.endFrame();
        keyDown("x", true);
        expect(kb.isDown("x")).toBe(true);
        expect(kb.isPressed("x")).toBe(false);
        keyUp("x");
        kb.removeListener();
    });

    it("snapshots the previous-state map in endFrame", () => {
        const state = new Map<string, boolean>();
        const prev = new Map<string, boolean>();
        const kb = new BrioKeyboard(state, prev, new BrioConsole());
        keyDown("a");
        kb.endFrame();
        expect(prev.get("a")).toBe(true);
        keyUp("a");
        kb.endFrame();
        expect(prev.get("a")).toBe(false);
        kb.removeListener();
    });

    it("latches global releases once syncGlobalFrame runs", () => {
        BrioKeyboard.globalIsDown("q");
        BrioKeyboard.syncGlobalFrame();
        keyDown("q");
        keyUp("q");
        expect(BrioKeyboard.globalIsUp("q")).toBe(true);
        BrioKeyboard.syncGlobalFrame();
        expect(BrioKeyboard.globalIsUp("q")).toBe(false);
    });
});

describe("CamerasInput: focus loss releases held input", () => {
    it("releases held keys on window blur and reports isUp", () => {
        const kb = makeKeyboard();
        kb.endFrame();
        keyDown("ArrowLeft");
        kb.endFrame();
        window.dispatchEvent(new Event("blur"));
        expect(kb.isDown("ArrowLeft")).toBe(false);
        expect(kb.isUp("ArrowLeft")).toBe(true);
        expect(BrioKeyboard.globalIsDown("ArrowLeft")).toBe(false);
        kb.removeListener();
    });

    it("releases held keys when the page becomes hidden", () => {
        const kb = makeKeyboard();
        keyDown("d");
        setVisibility("hidden");
        expect(kb.isDown("d")).toBe(false);
        kb.removeListener();
    });

    it("releases held mouse buttons on blur and clears touches", () => {
        const canvas = document.createElement("canvas");
        const mouse = new BrioMouse(canvas);
        const touch = new BrioTouch(canvas);
        canvas.dispatchEvent(new MouseEvent("mousedown", { button: 2 }));
        mouse.endFrame();
        window.dispatchEvent(new Event("blur"));
        expect(mouse.isDown("right")).toBe(false);
        expect(mouse.isUp("right")).toBe(true);
        expect(touch.touchCount).toBe(0);
        mouse.removeListener();
        touch.removeListener();
    });
});

describe("CamerasInput: idempotent listener attachment", () => {
    it("detaches the previous keyboard sharing the same state maps", () => {
        const state = new Map<string, boolean>();
        const prev = new Map<string, boolean>();
        const first = new BrioKeyboard(state, prev, new BrioConsole());
        const onEscape = vi.fn();
        first.customActions.set("Escape", onEscape);
        const second = new BrioKeyboard(state, prev, new BrioConsole());
        expect(first.isAttached).toBe(false);
        expect(second.isAttached).toBe(true);
        keyDown("Escape");
        expect(onEscape).not.toHaveBeenCalled();
        keyUp("Escape");
        second.removeListener();
        second.removeListener();
        expect(second.isAttached).toBe(false);
    });

    it("never registers mouse or touch listeners twice on the same target", () => {
        const canvas = document.createElement("canvas");
        const spy = vi.spyOn(canvas, "addEventListener");
        const mouse = new BrioMouse(canvas);
        mouse.attach();
        const count = spy.mock.calls.length;
        const replacement = new BrioMouse(canvas);
        expect(mouse.isAttached).toBe(false);
        expect(spy.mock.calls.length).toBe(count * 2);

        canvas.dispatchEvent(new MouseEvent("mousedown", { button: 0 }));
        expect(mouse.isDown("left")).toBe(false);
        expect(replacement.isDown("left")).toBe(true);
        window.dispatchEvent(new MouseEvent("mouseup", { button: 0 }));
        replacement.removeListener();

        const t1 = new BrioTouch(canvas);
        const t2 = new BrioTouch(canvas);
        expect(t1.isAttached).toBe(false);
        expect(t2.isAttached).toBe(true);
        t2.removeListener();
        spy.mockRestore();
    });
});

describe("CamerasInput: BrioMouse", () => {
    it("reports a click shorter than one frame once", () => {
        const canvas = document.createElement("canvas");
        const mouse = new BrioMouse(canvas);
        canvas.dispatchEvent(new MouseEvent("mousedown", { button: 0 }));
        window.dispatchEvent(new MouseEvent("mouseup", { button: 0 }));
        expect(mouse.isDown("left")).toBe(false);
        expect(mouse.isPressed("left")).toBe(true);
        expect(mouse.isUp("left")).toBe(true);
        mouse.endFrame();
        expect(mouse.isPressed("left")).toBe(false);
        expect(mouse.isUp("left")).toBe(false);
        mouse.removeListener();
    });

    it("maps the pointer through a rotated split-screen camera", () => {
        const canvas = document.createElement("canvas");
        canvas.width = 800;
        canvas.height = 600;
        const mouse = new BrioMouse(canvas);
        canvas.dispatchEvent(new MouseEvent("mousemove", { clientX: 600, clientY: 300 }));

        // Right half of the canvas: (600, 300) is the viewport center, which rotation leaves in place
        const cam = new BrioCamera2D(
            "p2",
            { x: 1000, y: 2000 },
            { x: 400, y: 600 },
            new BrioViewport(0.5, 0, 0.5, 1),
        );
        cam.rotation = 1.2;
        const world = mouse.getWorldPosition(cam);
        expect(world.x).toBeCloseTo(1200, 6);
        expect(world.y).toBeCloseTo(2300, 6);

        const scaled = mouse.getWorldPosition(cam, 2);
        expect(scaled.x).toBeCloseTo(1000 + 100, 6);
        expect(scaled.y).toBeCloseTo(2000 + 150, 6);
        mouse.removeListener();
    });
});
