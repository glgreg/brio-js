import { vi } from "vitest";

/** A single recorded 2D context call (`name` + arguments). */
export interface RecordedCall {
    name: string;
    args: unknown[];
}

const METHODS = [
    "save",
    "restore",
    "scale",
    "translate",
    "rotate",
    "transform",
    "setTransform",
    "clearRect",
    "fillRect",
    "drawImage",
    "beginPath",
    "closePath",
    "moveTo",
    "lineTo",
    "rect",
    "arc",
    "clip",
    "fill",
    "stroke",
    "fillText",
    "reset",
] as const;

/**
 * Creates a fake `CanvasRenderingContext2D` that records every method call in order,
 * so tests can assert the exact draw sequence produced by the compositor.
 *
 * @returns The fake context and its call log
 */
export function createRecordingContext(): {
    ctx: CanvasRenderingContext2D;
    calls: RecordedCall[];
    count: (name: string) => number;
    clear: () => void;
} {
    const calls: RecordedCall[] = [];
    const ctx: Record<string, unknown> = {
        imageSmoothingEnabled: true,
        imageSmoothingQuality: "medium",
        globalAlpha: 1,
        lineWidth: 1,
        strokeStyle: "#000",
        fillStyle: "#000",
        font: "16px monospace",
        textRendering: "auto",
    };
    for (const name of METHODS) {
        ctx[name] = vi.fn((...args: unknown[]) => {
            calls.push({ name, args });
        });
    }
    return {
        ctx: ctx as unknown as CanvasRenderingContext2D,
        calls,
        count: (name: string) => calls.filter((c) => c.name === name).length,
        clear: () => {
            calls.length = 0;
        },
    };
}
