import { vi } from "vitest";
import { RecordedCall } from "./recordingContext";

/** WebGL2 enum values used by `WebGL2Backend` (real values, so assertions read like the spec). */
const CONSTANTS: Record<string, number> = {
    DEPTH_BUFFER_BIT: 0x0100,
    COLOR_BUFFER_BIT: 0x4000,
    LINES: 0x0001,
    TRIANGLES: 0x0004,
    ONE: 1,
    ONE_MINUS_SRC_ALPHA: 0x0303,
    CW: 0x0900,
    CCW: 0x0901,
    BACK: 0x0405,
    CULL_FACE: 0x0b44,
    DEPTH_TEST: 0x0b71,
    SCISSOR_TEST: 0x0c11,
    BLEND: 0x0be2,
    LEQUAL: 0x0203,
    ARRAY_BUFFER: 0x8892,
    ELEMENT_ARRAY_BUFFER: 0x8893,
    STATIC_DRAW: 0x88e4,
    FLOAT: 0x1406,
    UNSIGNED_BYTE: 0x1401,
    UNSIGNED_SHORT: 0x1403,
    UNSIGNED_INT: 0x1405,
    VERTEX_SHADER: 0x8b31,
    FRAGMENT_SHADER: 0x8b30,
    COMPILE_STATUS: 0x8b81,
    LINK_STATUS: 0x8b82,
    TEXTURE_2D: 0x0de1,
    TEXTURE0: 0x84c0,
    RGBA: 0x1908,
    SRGB8_ALPHA8: 0x8c43,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,
    LINEAR: 0x2601,
    LINEAR_MIPMAP_LINEAR: 0x2703,
    REPEAT: 0x2901,
    UNPACK_FLIP_Y_WEBGL: 0x9240,
    UNPACK_PREMULTIPLY_ALPHA_WEBGL: 0x9241,
    UNPACK_COLORSPACE_CONVERSION_WEBGL: 0x9243,
    NONE: 0,
};

/**
 * Creates a fake `WebGL2RenderingContext` that records every call in order. Object-creating calls return
 * unique handles, shader/program status queries succeed, and extensions are unavailable.
 *
 * @returns The fake context, its call log, and helpers to count / filter calls
 */
export function createFakeWebGL2(): {
    gl: WebGL2RenderingContext;
    calls: RecordedCall[];
    count: (name: string) => number;
    callsOf: (name: string) => unknown[][];
    clear: () => void;
} {
    const calls: RecordedCall[] = [];
    let nextHandle = 1;
    const returns: Record<string, (...args: unknown[]) => unknown> = {
        getShaderParameter: () => true,
        getProgramParameter: () => true,
        getUniformLocation: (_program, name) => ({ uniform: name }),
        getExtension: () => null,
        getParameter: () => 16,
        getShaderInfoLog: () => "",
        getProgramInfoLog: () => "",
    };
    const methods = new Map<string, ReturnType<typeof vi.fn>>();

    const gl = new Proxy(
        {},
        {
            get(_target, prop) {
                if (typeof prop !== "string") return undefined;
                if (prop in CONSTANTS) return CONSTANTS[prop];
                let method = methods.get(prop);
                if (!method) {
                    method = vi.fn((...args: unknown[]) => {
                        calls.push({ name: prop, args });
                        if (returns[prop]) return returns[prop](...args);
                        if (prop.startsWith("create")) return { handle: nextHandle++, kind: prop };
                        return undefined;
                    });
                    methods.set(prop, method);
                }
                return method;
            },
        },
    ) as WebGL2RenderingContext;

    return {
        gl,
        calls,
        count: (name) => calls.filter((c) => c.name === name).length,
        callsOf: (name) => calls.filter((c) => c.name === name).map((c) => c.args),
        clear: () => {
            calls.length = 0;
        },
    };
}

export { CONSTANTS as GL };
