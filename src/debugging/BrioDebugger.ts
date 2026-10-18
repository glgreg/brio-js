import { CanvasFPSPosition } from "../game/BrioSpriteRenderer";
import { BrioConsole } from "./BrioConsole";

interface DebugConsoleProperties {
    /** Enables standard state logs, loaded assets/objects reporting, and basic error messages */
    enabled: boolean;
    /** Displays the user file stack trace for log calls */
    showStackTrace: boolean;
    /** Displays internal BrioJS stack traces for debugging engine calls */
    showInternalStackTrace: boolean;
}

interface DebugGridProperties {
    enabled: boolean;
    width: number;
    height: number;
    /** Renders X and Y axis center rulers on the canvas */
    showAxisRulers: boolean;
}

interface DebugFPSOverlayProperties {
    enabled: boolean;
    position: CanvasFPSPosition;
    offset: number;
    size: number;
    backgroundColor: string;
    textColor: string;
}

interface DebugRenderProperties {
    grid: DebugGridProperties;
    showRenderBounds: boolean;
    showCollisionBounds: boolean;
    fpsOverlay: DebugFPSOverlayProperties;
}

/**
 * Manages visual and console debugging configurations for a `BrioGame` instance.
 * Pre-allocates its configuration views once in the constructor to prevent per-frame closure allocations.
 */
export class BrioDebugger {
    #console: BrioConsole;
    #consoleConfig: DebugConsoleProperties = {
        enabled: false,
        showStackTrace: false,
        showInternalStackTrace: false,
    };
    #renderConfig: DebugRenderProperties = {
        showRenderBounds: false,
        showCollisionBounds: false,
        fpsOverlay: {
            enabled: false,
            position: "right-top",
            offset: 16,
            size: 16,
            backgroundColor: "#000",
            textColor: "#fff",
        },
        grid: {
            enabled: false,
            width: 32,
            height: 32,
            showAxisRulers: false,
        },
    };

    #consoleView: DebugConsoleProperties;
    #gridView: DebugGridProperties;
    #fpsOverlayView: DebugFPSOverlayProperties;
    #renderView: DebugRenderProperties;

    constructor(consoleInstance: BrioConsole) {
        this.#console = consoleInstance;
        const config = this.#consoleConfig;
        const gridConfig = this.#renderConfig.grid;
        const fpsConfig = this.#renderConfig.fpsOverlay;
        const renderConfig = this.#renderConfig;

        this.#consoleView = {
            set enabled(shouldEnable: boolean) {
                if (!config.enabled && shouldEnable) {
                    consoleInstance.enabled = shouldEnable;
                    config.enabled = shouldEnable;
                    consoleInstance.out("info", "Console logs are now enabled.");
                } else {
                    consoleInstance.enabled = shouldEnable;
                    config.enabled = shouldEnable;
                }
            },
            get enabled() {
                return config.enabled;
            },
            set showStackTrace(shouldEnable: boolean) {
                consoleInstance.showStackTrace = shouldEnable;
                config.showStackTrace = shouldEnable;
            },
            get showStackTrace() {
                return config.showStackTrace;
            },
            set showInternalStackTrace(shouldEnable: boolean) {
                consoleInstance.showInternalStackTrace = shouldEnable;
                config.showInternalStackTrace = shouldEnable;
            },
            get showInternalStackTrace() {
                return config.showInternalStackTrace;
            },
        };

        this.#gridView = {
            set enabled(shouldEnable: boolean) {
                gridConfig.enabled = shouldEnable;
            },
            get enabled() {
                return gridConfig.enabled;
            },
            set width(cellWidth: number) {
                gridConfig.width = Math.round(cellWidth);
            },
            get width() {
                return gridConfig.width;
            },
            set height(cellHeight: number) {
                gridConfig.height = Math.round(cellHeight);
            },
            get height() {
                return gridConfig.height;
            },
            set showAxisRulers(shouldEnable: boolean) {
                gridConfig.showAxisRulers = shouldEnable;
            },
            get showAxisRulers() {
                return gridConfig.showAxisRulers;
            },
        };

        this.#fpsOverlayView = {
            set enabled(shouldEnable: boolean) {
                fpsConfig.enabled = shouldEnable;
            },
            get enabled() {
                return fpsConfig.enabled;
            },
            set position(canvasPosition: CanvasFPSPosition) {
                fpsConfig.position = canvasPosition;
            },
            get position() {
                return fpsConfig.position;
            },
            set offset(canvasOffset: number) {
                fpsConfig.offset = canvasOffset;
            },
            get offset() {
                return fpsConfig.offset;
            },
            set size(overlaySize: number) {
                fpsConfig.size = overlaySize;
            },
            get size() {
                return fpsConfig.size;
            },
            set backgroundColor(backgroundColor: string) {
                fpsConfig.backgroundColor = backgroundColor;
            },
            get backgroundColor() {
                return fpsConfig.backgroundColor;
            },
            set textColor(textColor: string) {
                fpsConfig.textColor = textColor;
            },
            get textColor() {
                return fpsConfig.textColor;
            },
        };

        const gridView = this.#gridView;
        const fpsOverlayView = this.#fpsOverlayView;

        this.#renderView = {
            get grid() {
                return gridView;
            },
            set showRenderBounds(shouldEnable: boolean) {
                renderConfig.showRenderBounds = shouldEnable;
            },
            get showRenderBounds() {
                return renderConfig.showRenderBounds;
            },
            set showCollisionBounds(shouldEnable: boolean) {
                renderConfig.showCollisionBounds = shouldEnable;
            },
            get showCollisionBounds() {
                return renderConfig.showCollisionBounds;
            },
            get fpsOverlay() {
                return fpsOverlayView;
            },
        };
    }

    public get console(): DebugConsoleProperties {
        return this.#consoleView;
    }

    public get render(): DebugRenderProperties {
        return this.#renderView;
    }
}
