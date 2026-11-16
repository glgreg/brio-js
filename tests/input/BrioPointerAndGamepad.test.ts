import { afterEach, describe, expect, it, vi } from "vitest";
import { BrioCamera2D } from "../../src/cameras/BrioCamera2D";
import { BrioGamepad } from "../../src/input/BrioGamepad";
import { BrioMouse } from "../../src/input/BrioMouse";
import { BrioTouch } from "../../src/input/BrioTouch";
import { createFakePad, installFakeGamepads, setButton } from "./inputTestUtils";

const cleanups: (() => void)[] = [];
afterEach(() => {
    while (cleanups.length > 0) cleanups.pop()!();
});

/** Fakes `document.pointerLockElement` and fires `pointerlockchange`. */
const setLockElement = (element: Element | null): void => {
    Object.defineProperty(document, "pointerLockElement", {
        configurable: true,
        get: () => element,
    });
    document.dispatchEvent(new Event("pointerlockchange"));
};

const move = (
    target: EventTarget,
    clientX: number,
    clientY: number,
    movementX = 0,
    movementY = 0,
): void => {
    const event = new MouseEvent("mousemove", { clientX, clientY });
    Object.defineProperty(event, "movementX", { value: movementX });
    Object.defineProperty(event, "movementY", { value: movementY });
    target.dispatchEvent(event);
};

/** A 400x300 CSS box at the page origin. */
const sizeCanvas = (canvas: HTMLCanvasElement, width: number, height: number): void => {
    canvas.width = width;
    canvas.height = height;
    canvas.getBoundingClientRect = () =>
        ({ left: 0, top: 0, width: 400, height: 300, right: 400, bottom: 300 }) as DOMRect;
};

const makeMouse = (canvas: HTMLCanvasElement): BrioMouse => {
    const mouse = new BrioMouse(canvas);
    cleanups.push(() => {
        mouse.removeListener();
        setLockElement(null);
    });
    return mouse;
};

describe("BrioMouse: pointer lock", () => {
    it("tracks lock state and accumulates raw movement while locked", () => {
        const canvas = document.createElement("canvas");
        sizeCanvas(canvas, 400, 300);
        const mouse = makeMouse(canvas);
        move(canvas, 100, 50);
        mouse.endFrame();

        setLockElement(canvas);
        expect(mouse.isPointerLocked).toBe(true);
        move(canvas, 100, 50, 7, -3);
        move(canvas, 100, 50, 5, 1);
        expect(mouse.delta).toEqual({ x: 12, y: -2 });
        expect(mouse.position).toEqual({ x: 100, y: 50 });
        mouse.endFrame();
        expect(mouse.delta).toEqual({ x: 0, y: 0 });

        // After unlocking, the cursor reappears elsewhere: no delta spike on the first move
        setLockElement(null);
        expect(mouse.isPointerLocked).toBe(false);
        move(canvas, 300, 200);
        expect(mouse.position).toEqual({ x: 300, y: 200 });
        expect(mouse.delta).toEqual({ x: 0, y: 0 });
        move(canvas, 310, 200);
        expect(mouse.delta).toEqual({ x: 10, y: 0 });
    });

    it("ignores a lock held by another element", () => {
        const canvas = document.createElement("canvas");
        const mouse = makeMouse(canvas);
        setLockElement(document.createElement("div"));
        expect(mouse.isPointerLocked).toBe(false);
    });

    it("resolves when requestPointerLock returns a promise", async () => {
        const canvas = document.createElement("canvas");
        const mouse = makeMouse(canvas);
        const request = vi.fn(() => {
            setLockElement(canvas);
            return Promise.resolve();
        });
        canvas.requestPointerLock = request as unknown as typeof canvas.requestPointerLock;
        await expect(mouse.requestPointerLock({ unadjustedMovement: true })).resolves.toBe(
            undefined,
        );
        expect(request).toHaveBeenCalledWith({ unadjustedMovement: true });
        expect(mouse.isPointerLocked).toBe(true);
        await expect(mouse.requestPointerLock()).resolves.toBe(undefined);
        expect(request).toHaveBeenCalledTimes(1);
    });

    it("settles through events when requestPointerLock returns undefined", async () => {
        const canvas = document.createElement("canvas");
        const mouse = makeMouse(canvas);
        canvas.requestPointerLock = (() =>
            undefined) as unknown as typeof canvas.requestPointerLock;

        const granted = mouse.requestPointerLock();
        setLockElement(canvas);
        await expect(granted).resolves.toBe(undefined);
        setLockElement(null);

        const denied = mouse.requestPointerLock();
        document.dispatchEvent(new Event("pointerlockerror"));
        await expect(denied).rejects.toThrow(/denied/);
    });

    it("rejects without an element target and when detached while pending", async () => {
        const windowMouse = new BrioMouse(window);
        await expect(windowMouse.requestPointerLock()).rejects.toThrow(Error);
        windowMouse.removeListener();

        const canvas = document.createElement("canvas");
        const mouse = makeMouse(canvas);
        canvas.requestPointerLock = (() =>
            undefined) as unknown as typeof canvas.requestPointerLock;
        const pending = mouse.requestPointerLock();
        mouse.removeListener();
        await expect(pending).rejects.toThrow(/detached/);
    });

    it("exits only a lock it holds and detaches the lock listeners", () => {
        const canvas = document.createElement("canvas");
        const mouse = makeMouse(canvas);
        const exit = vi.fn();
        document.exitPointerLock = exit;
        mouse.exitPointerLock();
        expect(exit).not.toHaveBeenCalled();
        setLockElement(canvas);
        mouse.exitPointerLock();
        expect(exit).toHaveBeenCalledTimes(1);

        const removeSpy = vi.spyOn(document, "removeEventListener");
        mouse.removeListener();
        const removed = removeSpy.mock.calls.map((call) => call[0]);
        expect(removed).toContain("pointerlockchange");
        expect(removed).toContain("pointerlockerror");
        removeSpy.mockRestore();
    });
});

describe("BrioMouse and BrioTouch: logical size", () => {
    it("maps HiDPI canvases into the logical size, read live", () => {
        const canvas = document.createElement("canvas");
        // Backing store at devicePixelRatio 2 for a 400x300 game shown in a 400x300 CSS box
        sizeCanvas(canvas, 800, 600);
        const game = { width: 400, height: 300 };
        const mouse = makeMouse(canvas);

        move(canvas, 100, 60);
        expect(mouse.position).toEqual({ x: 200, y: 120 });

        mouse.logicalSize = game;
        move(canvas, 100, 60);
        expect(mouse.position).toEqual({ x: 100, y: 60 });

        game.width = 200;
        game.height = 150;
        move(canvas, 100, 60);
        expect(mouse.position).toEqual({ x: 50, y: 30 });
    });

    it("uses the logical size in getWorldPosition", () => {
        const canvas = document.createElement("canvas");
        sizeCanvas(canvas, 800, 600);
        const mouse = makeMouse(canvas);
        mouse.logicalSize = { width: 400, height: 300 };
        move(canvas, 200, 150);
        const camera = new BrioCamera2D("cam", { x: 0, y: 0 }, { x: 400, y: 300 });
        const spy = vi.spyOn(camera, "screenToWorld");
        mouse.getWorldPosition(camera, 2);
        expect(spy.mock.calls[0][1]).toEqual({ canvasWidth: 400, canvasHeight: 300, scale: 2 });
    });

    it("maps touches into the logical size", () => {
        const canvas = document.createElement("canvas");
        sizeCanvas(canvas, 800, 600);
        const touch = new BrioTouch(canvas, { width: 400, height: 300 });
        cleanups.push(() => touch.removeListener());
        const start = new Event("touchstart") as Event & { changedTouches: unknown };
        start.changedTouches = [{ identifier: 3, clientX: 40, clientY: 30 }];
        canvas.dispatchEvent(start);
        expect(touch.primaryPosition).toEqual({ x: 40, y: 30 });

        touch.logicalSize = undefined;
        const moveEvent = new Event("touchmove") as Event & { changedTouches: unknown };
        moveEvent.changedTouches = [{ identifier: 3, clientX: 40, clientY: 30 }];
        canvas.dispatchEvent(moveEvent);
        expect(touch.primaryPosition).toEqual({ x: 80, y: 60 });
        expect(touch.touches[0]).toMatchObject({ startX: 40, startY: 30 });
    });
});

describe("BrioGamepad: latched polling", () => {
    it("keeps the poll-per-frame behavior until endFrame is used", () => {
        const pad = createFakePad();
        cleanups.push(installFakeGamepads([pad]));
        const gamepad = new BrioGamepad();
        setButton(pad, 0, true);
        gamepad.poll();
        expect(gamepad.isPressed("south")).toBe(true);
        gamepad.poll();
        expect(gamepad.isPressed("south")).toBe(false);
        setButton(pad, 0, false);
        gamepad.poll();
        expect(gamepad.isUp("south")).toBe(true);
    });

    it("latches a tap caught between two polls of the same frame", () => {
        const pad = createFakePad();
        cleanups.push(installFakeGamepads([pad]));
        const gamepad = new BrioGamepad();
        gamepad.endFrame();

        gamepad.poll();
        setButton(pad, 1, true);
        gamepad.poll();
        setButton(pad, 1, false);
        gamepad.poll();
        expect(gamepad.isDown("east")).toBe(false);
        expect(gamepad.isPressed("east")).toBe(true);
        expect(gamepad.isUp("east")).toBe(true);
        gamepad.endFrame();
        gamepad.poll();
        expect(gamepad.isPressed("east")).toBe(false);
        expect(gamepad.isUp("east")).toBe(false);
    });

    it("reads axes, analog buttons and sticks from the snapshot", () => {
        const pad = createFakePad();
        pad.axes = [0.05, -0.05, 0.8, 0];
        setButton(pad, 6, true, 0.4);
        cleanups.push(installFakeGamepads([pad]));
        const gamepad = new BrioGamepad(0.15);
        gamepad.poll();
        expect(gamepad.isConnected(0)).toBe(true);
        expect(gamepad.isConnected(1)).toBe(false);
        expect(gamepad.getAxis(2)).toBeCloseTo(0.8, 5);
        expect(gamepad.getAxis(9)).toBe(0);
        expect(gamepad.getButtonValue("l2")).toBeCloseTo(0.4, 5);
        expect(gamepad.getLeftStick()).toEqual({ x: 0, y: 0 });
        const out = { x: 0, y: 0 };
        expect(gamepad.getRightStick(0, out)).toBe(out);
        expect(out.x).toBeGreaterThan(0.7);
        // The snapshot only changes on poll
        pad.axes[2] = 0;
        expect(gamepad.getAxis(2)).toBeCloseTo(0.8, 5);
    });

    it("releases held buttons when a pad disconnects", () => {
        const pad = createFakePad();
        const pads: (ReturnType<typeof createFakePad> | null)[] = [pad];
        cleanups.push(installFakeGamepads(pads));
        const gamepad = new BrioGamepad();
        gamepad.endFrame();
        setButton(pad, 9, true);
        gamepad.poll();
        gamepad.endFrame();
        pads[0] = null;
        gamepad.poll();
        expect(gamepad.isConnected(0)).toBe(false);
        expect(gamepad.isDown("start")).toBe(false);
        expect(gamepad.isUp("start")).toBe(true);
    });
});
