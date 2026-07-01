export function radToDeg(radValue) {
    return (radValue * 180) / Math.PI;
}
export function degToRad(degValue) {
    return (degValue * Math.PI) / 180;
}
export function clamp(value, min, max) {
    if (min > max)
        throw new Error("clamp.min was set to higher than clamp.max");
    return Math.min(Math.max(value, min), max);
}
