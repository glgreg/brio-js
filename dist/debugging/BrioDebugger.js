export class BrioDebugger {
    #console;
    #consoleConfig = {
        enabled: false,
        showStackTrace: false,
        showInternalStackTrace: false,
    };
    #renderConfig = {
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
    constructor(console) {
        this.#console = console;
    }
    get console() {
        const config = this.#consoleConfig;
        const console = this.#console;
        return {
            set enabled(shouldEnable) {
                if (!config.enabled && shouldEnable) {
                    console.enabled = shouldEnable;
                    config.enabled = shouldEnable;
                    console.out("info", "Console logs are now enabled.");
                }
            },
            get enabled() {
                return config.enabled;
            },
            set showStackTrace(shouldEnable) {
                console.showStackTrace = shouldEnable;
                config.showStackTrace = shouldEnable;
            },
            get showStackTrace() {
                return config.showStackTrace;
            },
            set showInternalStackTrace(shouldEnable) {
                console.showInternalStackTrace = shouldEnable;
                config.showInternalStackTrace = shouldEnable;
            },
            get showInternalStackTrace() {
                return config.showInternalStackTrace;
            },
        };
    }
    get render() {
        const self = this;
        return {
            get grid() {
                return self.#grid;
            },
            set showRenderBounds(shouldEnable) {
                self.#renderConfig.showRenderBounds = shouldEnable;
            },
            get showRenderBounds() {
                return self.#renderConfig.showRenderBounds;
            },
            set showCollisionBounds(shouldEnable) {
                self.#renderConfig.showCollisionBounds = shouldEnable;
            },
            get showCollisionBounds() {
                return self.#renderConfig.showCollisionBounds;
            },
            get fpsOverlay() {
                return self.#renderConfig.fpsOverlay;
            },
        };
    }
    get #grid() {
        const self = this.#renderConfig.grid;
        return {
            set enabled(shouldEnable) {
                self.enabled = shouldEnable;
            },
            get enabled() {
                return self.enabled;
            },
            set width(cellWidth) {
                self.width = Math.round(cellWidth);
            },
            get width() {
                return self.width;
            },
            set height(cellHeight) {
                self.height = Math.round(cellHeight);
            },
            get height() {
                return self.height;
            },
            set showAxisRulers(shouldEnable) {
                self.showAxisRulers = shouldEnable;
            },
            get showAxisRulers() {
                return self.showAxisRulers;
            },
        };
    }
    get #fpsOverlay() {
        const self = this.#renderConfig.fpsOverlay;
        return {
            set enabled(shouldEnable) {
                self.enabled = shouldEnable;
            },
            get enabled() {
                return self.enabled;
            },
            set position(canvasPosition) {
                self.position = canvasPosition;
            },
            get position() {
                return self.position;
            },
            set offset(canvasOffset) {
                self.offset = canvasOffset;
            },
            get offset() {
                return self.offset;
            },
            set size(overlaySize) {
                self.size = overlaySize;
            },
            get size() {
                return self.size;
            },
            set backgroundColor(backgroundColor) {
                self.backgroundColor = backgroundColor;
            },
            get backgroundColor() {
                return self.backgroundColor;
            },
            set textColor(textColor) {
                self.textColor = textColor;
            },
            get textColor() {
                return self.textColor;
            },
        };
    }
}
