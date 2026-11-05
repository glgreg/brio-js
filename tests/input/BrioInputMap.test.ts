import { afterEach, describe, expect, it } from "vitest";
import { BrioGamepad } from "../../src/input/BrioGamepad";
import { BrioInputMap, InputBinding } from "../../src/input/BrioInputMap";
import { BrioKeyboard } from "../../src/input/BrioKeyboard";
import { BrioMouse } from "../../src/input/BrioMouse";
import { BrioTouch } from "../../src/input/BrioTouch";
import {
    createFakePad,
    installFakeGamepads,
    keyDown,
    keyUp,
    makeKeyboard,
    setButton,
} from "./inputTestUtils";

const cleanups: (() => void)[] = [];
afterEach(() => {
    while (cleanups.length > 0) cleanups.pop()!();
});

const setupKeyboard = (): { keyboard: BrioKeyboard; input: BrioInputMap } => {
    const keyboard = makeKeyboard();
    keyboard.endFrame();
    cleanups.push(() => keyboard.removeListener());
    return { keyboard, input: new BrioInputMap({ keyboard }) };
};

/** Frame end in BrioGame order: the map first, then the controllers. */
const endFrame = (input: BrioInputMap, ...controllers: { endFrame(): void }[]): void => {
    input.endFrame();
    for (const controller of controllers) controller.endFrame();
};

describe("BrioInputMap: bindings", () => {
    it("binds keys, string shorthand and helpers, ignoring duplicates", () => {
        const input = new BrioInputMap();
        input.bind("jump", " ", BrioInputMap.key(" "), BrioInputMap.padButton("south"));
        input.bind("fire", BrioInputMap.mouseButton("left"), BrioInputMap.anyTouch());
        expect(input.actions).toEqual(["jump", "fire"]);
        expect(input.getBindings("jump")).toEqual([
            { device: "keyboard", key: " " },
            { device: "gamepad", button: "south", pad: 0 },
        ]);
        expect(input.getBindings("missing")).toEqual([]);
        expect(input.has("fire")).toBe(true);
    });

    it("rejects invalid bindings atomically", () => {
        const input = new BrioInputMap();
        input.bind("jump", " ");
        expect(() =>
            input.bind("jump", "w", { device: "mouse", button: "huge" } as unknown as InputBinding),
        ).toThrow(/invalid binding #1/);
        expect(input.getBindings("jump")).toHaveLength(1);
        expect(() => input.bind("", " ")).toThrow(/non-empty/);
    });

    it("unbinds, rebinds and clears", () => {
        const input = new BrioInputMap();
        input.bind("jump", " ", "w");
        expect(input.unbind("jump", "w")).toBe(true);
        expect(input.unbind("jump", "w")).toBe(false);
        expect(input.unbind("nope")).toBe(false);
        input.rebind("jump", "ArrowUp", BrioInputMap.padAxis(1, -1));
        expect(input.getBindings("jump")).toEqual([
            { device: "keyboard", key: "ArrowUp" },
            { device: "gamepad", axis: 1, direction: -1, threshold: 0.5, pad: 0 },
        ]);
        expect(input.unbind("jump")).toBe(true);
        expect(input.has("jump")).toBe(true);
        expect(input.getBindings("jump")).toEqual([]);
        input.bind("fire", "z");
        input.clear("jump");
        expect(input.actions).toEqual(["fire"]);
        input.clear();
        expect(input.actions).toEqual([]);
    });

    it("rejects unknown keys and actions at compile time when typed", () => {
        const input = new BrioInputMap<"jump" | "run">();
        input.bind("jump", " ");
        // @ts-expect-error "NotAKey" is not a KeyboardKey
        input.bind("run", "NotAKey");
        // @ts-expect-error "fly" is not an action of this map
        expect(input.isDown("fly")).toBe(false);
    });
});

describe("BrioInputMap: frame edges", () => {
    it("reports press, hold and release across frames", () => {
        const { keyboard, input } = setupKeyboard();
        input.bind("jump", " ");

        keyDown(" ");
        expect(input.isDown("jump")).toBe(true);
        expect(input.isPressed("jump")).toBe(true);
        expect(input.isUp("jump")).toBe(false);
        endFrame(input, keyboard);

        expect(input.isDown("jump")).toBe(true);
        expect(input.isPressed("jump")).toBe(false);
        keyUp(" ");
        expect(input.isDown("jump")).toBe(false);
        expect(input.isUp("jump")).toBe(true);
        endFrame(input, keyboard);

        expect(input.isUp("jump")).toBe(false);
        expect(input.isPressed("jump")).toBe(false);
    });

    it("reports a tap shorter than one frame as pressed and released once", () => {
        const { keyboard, input } = setupKeyboard();
        input.bind("jump", " ");
        keyDown(" ");
        keyUp(" ");
        expect(input.isDown("jump")).toBe(false);
        expect(input.isPressed("jump")).toBe(true);
        expect(input.isUp("jump")).toBe(true);
        endFrame(input, keyboard);
        expect(input.isPressed("jump")).toBe(false);
        expect(input.isUp("jump")).toBe(false);
    });

    it("aggregates several bindings: a second key while held is not a new press", () => {
        const { keyboard, input } = setupKeyboard();
        input.bind("left", "ArrowLeft", "a");
        keyDown("ArrowLeft");
        endFrame(input, keyboard);

        keyDown("a");
        expect(input.isPressed("left")).toBe(false);
        keyUp("ArrowLeft");
        expect(input.isDown("left")).toBe(true);
        expect(input.isUp("left")).toBe(false);
        endFrame(input, keyboard);

        keyUp("a");
        expect(input.isUp("left")).toBe(true);
        endFrame(input, keyboard);
    });

    it("matches letters in both cases, so Shift does not break or stick a binding", () => {
        const { keyboard, input } = setupKeyboard();
        input.bind("up", "w");
        input.bind("run", "Shift");
        keyDown("w");
        keyDown("Shift");
        expect(input.isDown("up")).toBe(true);
        expect(input.isDown("run")).toBe(true);
        endFrame(input, keyboard);
        // Released while Shift is held: the browser reports "W"
        keyUp("W");
        expect(keyboard.isDown("w")).toBe(false);
        expect(input.isDown("up")).toBe(false);
        expect(input.isUp("up")).toBe(true);
        keyUp("Shift");
    });

    it("does not fabricate a press when an already held input gets bound", () => {
        const { keyboard, input } = setupKeyboard();
        keyDown("x");
        endFrame(input, keyboard);
        input.bind("dash", "x");
        expect(input.isDown("dash")).toBe(true);
        expect(input.isPressed("dash")).toBe(false);
        keyUp("x");
    });

    it("returns false or 0 for unknown actions and missing controllers", () => {
        const input = new BrioInputMap();
        input.bind("jump", " ", BrioInputMap.mouseButton("left"), BrioInputMap.padAxis(0, 1));
        expect(input.isDown("jump")).toBe(false);
        expect(input.isPressed("nope")).toBe(false);
        expect(input.isUp("nope")).toBe(false);
        expect(input.value("nope")).toBe(0);
        expect(input.axis("nope", "jump")).toBe(0);
    });

    it("reads mouse buttons and touch through late-assigned controllers", () => {
        const canvas = document.createElement("canvas");
        const mouse = new BrioMouse(canvas);
        const touch = new BrioTouch(canvas);
        cleanups.push(
            () => mouse.removeListener(),
            () => touch.removeListener(),
        );
        const input = new BrioInputMap();
        input.bind("fire", BrioInputMap.mouseButton("right"));
        input.bind("tap", BrioInputMap.anyTouch());
        input.setControllers({ mouse });
        input.touch = touch;

        canvas.dispatchEvent(new MouseEvent("mousedown", { button: 2 }));
        expect(input.isPressed("fire")).toBe(true);
        expect(input.value("fire")).toBe(1);
        endFrame(input, mouse);
        window.dispatchEvent(new MouseEvent("mouseup", { button: 2 }));
        expect(input.isUp("fire")).toBe(true);

        const fakeTouch = { identifier: 1, clientX: 5, clientY: 5 };
        const start = new Event("touchstart") as Event & { changedTouches: unknown };
        start.changedTouches = [fakeTouch];
        canvas.dispatchEvent(start);
        expect(input.isPressed("tap")).toBe(true);
        input.setControllers({ touch: undefined });
        expect(input.isDown("tap")).toBe(false);
    });
});

describe("BrioInputMap: gamepad and axes", () => {
    it("drives actions from gamepad buttons, triggers and stick directions", () => {
        const pad = createFakePad();
        cleanups.push(installFakeGamepads([pad]));
        const gamepad = new BrioGamepad(0.2);
        const { keyboard, input } = setupKeyboard();
        input.gamepad = gamepad;
        input.bind("left", "ArrowLeft", BrioInputMap.padAxis(0, -1));
        input.bind("right", "ArrowRight", BrioInputMap.padAxis(0, 1));
        input.bind("accelerate", BrioInputMap.padButton("r2"));
        input.bind("jump", BrioInputMap.padButton("south"));

        pad.axes[0] = 0.6;
        setButton(pad, 7, true, 0.25);
        setButton(pad, 0, true);
        gamepad.poll();
        expect(input.isDown("right")).toBe(true);
        expect(input.isDown("left")).toBe(false);
        expect(input.value("right")).toBeCloseTo((0.6 - 0.2) / 0.8, 5);
        expect(input.axis("left", "right")).toBeCloseTo(0.5, 5);
        expect(input.value("accelerate")).toBeCloseTo(0.25, 5);
        expect(input.isPressed("jump")).toBe(true);
        endFrame(input, keyboard, gamepad);

        // Below the 0.5 threshold the action is up, while value() still reports the analog deflection
        pad.axes[0] = 0.4;
        gamepad.poll();
        expect(input.isDown("right")).toBe(false);
        expect(input.isUp("right")).toBe(true);
        expect(input.value("right")).toBeGreaterThan(0);

        // Keyboard and stick combine: full left key beats the partial stick
        keyDown("ArrowLeft");
        expect(input.axis("left", "right")).toBeCloseTo((0.4 - 0.2) / 0.8 - 1, 5);
        keyUp("ArrowLeft");
    });
});

describe("BrioInputMap: serialization", () => {
    it("round-trips through JSON", () => {
        const input = new BrioInputMap();
        input.bind("jump", " ", BrioInputMap.padButton("south", 1));
        input.bind("left", BrioInputMap.padAxis(0, -1, 0.3));
        input.bind("menu");
        const text = JSON.stringify(input);
        const copy = BrioInputMap.fromJSON(text);
        expect(copy.toJSON()).toEqual(input.toJSON());
        expect(copy.getBindings("menu")).toEqual([]);
        expect(JSON.parse(text).version).toBe(1);
    });

    it("returns copies from toJSON", () => {
        const input = new BrioInputMap();
        input.bind("jump", " ");
        const json = input.toJSON();
        (json.actions.jump[0] as { key: string }).key = "z";
        expect(input.getBindings("jump")[0]).toEqual({ device: "keyboard", key: " " });
    });

    it("skips and reports invalid entries, keeping defaults for absent or fully invalid actions", () => {
        const input = new BrioInputMap();
        input.bind("jump", " ");
        input.bind("fire", "z");
        input.bind("pause", "Escape");
        const report = input.load({
            version: 1,
            actions: {
                jump: ["w", { device: "gamepad", button: "nope" }, 42],
                fire: [{ device: "laser" }],
                dash: ["Shift"],
                menu: [],
            },
        });
        expect(report.applied).toEqual(["jump", "dash", "menu"]);
        expect(report.issues).toHaveLength(4);
        expect(input.getBindings("jump")).toEqual([{ device: "keyboard", key: "w" }]);
        expect(input.getBindings("fire")).toEqual([{ device: "keyboard", key: "z" }]);
        expect(input.getBindings("pause")).toEqual([{ device: "keyboard", key: "Escape" }]);
        expect(input.getBindings("dash")).toEqual([{ device: "keyboard", key: "Shift" }]);
        expect(input.has("menu")).toBe(true);
    });

    it("can restrict loading to known actions", () => {
        const input = new BrioInputMap();
        input.bind("jump", " ");
        const report = input.load(
            { actions: { jump: ["w"], removedAction: ["q"] } },
            { onlyKnownActions: true },
        );
        expect(report.applied).toEqual(["jump"]);
        expect(report.issues[0]).toMatch(/removedAction/);
        expect(input.has("removedAction")).toBe(false);
    });

    it("throws on structurally invalid data without changing anything", () => {
        const input = new BrioInputMap();
        input.bind("jump", " ");
        expect(() => input.load(null)).toThrow(Error);
        expect(() => input.load("{not json")).toThrow(/valid JSON/);
        expect(() => input.load({ version: 2, actions: {} })).toThrow(/version/);
        expect(() => input.load({ actions: [] })).toThrow(/actions/);
        expect(() => input.load({ actions: { jump: ["w"], fire: "z" } })).toThrow(/array/);
        expect(input.getBindings("jump")).toEqual([{ device: "keyboard", key: " " }]);
    });
});

describe("BrioInputMap: captureNext", () => {
    it("ignores the starting frame, suppresses actions and resolves with the next key", async () => {
        const { keyboard, input } = setupKeyboard();
        input.bind("jump", " ");
        const capture = input.captureNext();
        // Same frame as the call (e.g. the key that opened the menu) is ignored
        keyDown("Enter");
        expect(input.isCapturing).toBe(true);
        endFrame(input, keyboard);

        keyDown(" ");
        expect(input.isPressed("jump")).toBe(false);
        endFrame(input, keyboard);
        await expect(capture).resolves.toEqual({ device: "keyboard", key: " " });
        expect(input.isCapturing).toBe(false);
        // Still held after the capture: no new press
        expect(input.isPressed("jump")).toBe(false);
        keyUp(" ");
        keyUp("Enter");
    });

    it("captures letters in lowercase, mouse buttons and gamepad buttons", async () => {
        const pad = createFakePad();
        cleanups.push(installFakeGamepads([null, pad]));
        const canvas = document.createElement("canvas");
        const mouse = new BrioMouse(canvas);
        const gamepad = new BrioGamepad();
        cleanups.push(() => mouse.removeListener());
        const { keyboard, input } = setupKeyboard();
        input.setControllers({ mouse, gamepad });
        const frame = (): void => {
            gamepad.poll();
            endFrame(input, keyboard, mouse, gamepad);
        };

        let capture = input.captureNext();
        frame();
        keyDown("Q");
        frame();
        await expect(capture).resolves.toEqual({ device: "keyboard", key: "q" });
        keyUp("Q");

        capture = input.captureNext({ devices: ["mouse"] });
        frame();
        keyDown("e");
        canvas.dispatchEvent(new MouseEvent("mousedown", { button: 1 }));
        frame();
        await expect(capture).resolves.toEqual({ device: "mouse", button: "middle" });
        keyUp("e");
        window.dispatchEvent(new MouseEvent("mouseup", { button: 1 }));

        capture = input.captureNext({ devices: ["gamepad"] });
        frame();
        setButton(pad, 3, true);
        frame();
        await expect(capture).resolves.toEqual({ device: "gamepad", button: "north", pad: 1 });
    });

    it("cancels through cancelCapture, AbortSignal and a newer call", async () => {
        const { input } = setupKeyboard();
        const first = input.captureNext();
        const second = input.captureNext();
        await expect(first).rejects.toMatchObject({ name: "AbortError" });
        input.cancelCapture();
        await expect(second).rejects.toMatchObject({ name: "AbortError" });

        const controller = new AbortController();
        const third = input.captureNext({ signal: controller.signal });
        controller.abort(new Error("closed"));
        await expect(third).rejects.toThrow("closed");
        expect(input.isCapturing).toBe(false);
        await expect(input.captureNext({ signal: controller.signal })).rejects.toThrow("closed");
    });
});
