/**
 * Parses a color already normalized by a canvas context (`"#rrggbb"` or `"rgba(r, g, b, a)"`),
 * plus short `"#rgb"` hex, into `[r, g, b, a]` (`r, g, b` in `0..255`, `a` in `0..1`).
 * Returns `undefined` for anything else.
 *
 * @param color Normalized CSS color string
 * @returns `[r, g, b, a]` or `undefined`
 */
export function parseCanvasColor(color: string): [number, number, number, number] | undefined {
    if (color[0] === "#") {
        const hex =
            color.length === 4 ? color.replace(/[0-9a-f]/gi, "$&$&").slice(1) : color.slice(1);
        if (hex.length !== 6) return undefined;
        const value = Number.parseInt(hex, 16);
        if (Number.isNaN(value)) return undefined;
        return [(value >> 16) & 255, (value >> 8) & 255, value & 255, 1];
    }
    const match =
        /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(color);
    if (!match) return undefined;
    return [
        Number(match[1]),
        Number(match[2]),
        Number(match[3]),
        match[4] === undefined ? 1 : Number(match[4]),
    ];
}

/**
 * Converts one sRGB-encoded channel in `[0, 1]` to linear light (sRGB EOTF, IEC 61966-2-1).
 *
 * @param c sRGB channel value in `[0, 1]`
 * @returns Linear channel value in `[0, 1]`
 */
export function srgbToLinear(c: number): number {
    return c <= 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4);
}

/**
 * Converts one linear-light channel in `[0, 1]` to sRGB encoding (sRGB OETF, IEC 61966-2-1).
 *
 * @param c Linear channel value in `[0, 1]`
 * @returns sRGB channel value in `[0, 1]`
 */
export function linearToSrgb(c: number): number {
    return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 0.41666) - 0.055;
}
