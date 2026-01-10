import { BrioConsole } from "../debugging/BrioConsole";

export function radToDeg(radValue: number): number {
    return (radValue * 180) / Math.PI;
}

export function degToRad(degValue: number): number {
    return (degValue * Math.PI) / 180;
}

export function clamp(value: number, min: number, max: number) {
    if (min > max) throw new Error("clamp.min was set to higher than clamp.max");
    return Math.min(Math.max(value, min), max);
}
