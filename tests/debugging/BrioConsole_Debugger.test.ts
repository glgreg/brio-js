import { describe, it, expect, vi } from "vitest";
import { BrioConsole } from "../../src/debugging/BrioConsole";
import { BrioDebugger } from "../../src/debugging/BrioDebugger";

describe("BrioConsole & BrioDebugger", () => {
    it("logs messages only when enabled and deduplicates error/exception IDs", () => {
        const brioConsole = new BrioConsole();
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        // Disabled by default
        brioConsole.error(0);
        expect(errorSpy).not.toHaveBeenCalled();

        // Enable console
        brioConsole.enabled = true;
        brioConsole.error(0);
        brioConsole.error(0); // Second call with same ID must be deduplicated
        expect(errorSpy).toHaveBeenCalledTimes(1);

        brioConsole.exception(0);
        brioConsole.exception(0); // Second call with same ID must be deduplicated
        expect(warnSpy).toHaveBeenCalledTimes(1);

        errorSpy.mockRestore();
        warnSpy.mockRestore();
    });

    it("does not allocate new wrapper objects on every BrioDebugger getter access", () => {
        const brioConsole = new BrioConsole();
        const dbg = new BrioDebugger(brioConsole);

        const consoleRef1 = dbg.console;
        const consoleRef2 = dbg.console;
        expect(consoleRef1).toBe(consoleRef2);

        const renderRef1 = dbg.render;
        const renderRef2 = dbg.render;
        expect(renderRef1).toBe(renderRef2);

        const gridRef1 = dbg.render.grid;
        const gridRef2 = dbg.render.grid;
        expect(gridRef1).toBe(gridRef2);

        const fpsRef1 = dbg.render.fpsOverlay;
        const fpsRef2 = dbg.render.fpsOverlay;
        expect(fpsRef1).toBe(fpsRef2);

        dbg.render.grid.width = 48.7;
        expect(dbg.render.grid.width).toBe(49);
    });
});
