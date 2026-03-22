import { CanvasFPSPosition } from "../game/BrioSpriteRenderer";
import { BrioConsole } from "./BrioConsole";

interface DebugConsoleProperties {
    /** logs padrão de estado e mostrar quais assets e objetos foram carregados, além de erros básicos */
    enabled: boolean;
    /** mostra a stack trace dos arquivos do usuario, para que encontre os locais onde cada ação ocorre via suas chamadas */
    showStackTrace: boolean;
    /** mostra a stack trace dos arquivos internos de Brio, para que caso o usuário precise entender o que está criando a lógica ao qual ele está usando (e possivelmente o motivo de seus erros) */
    showInternalStackTrace: boolean;
}

interface DebugGridProperties {
    enabled: boolean;
    width: number;
    height: number;
    /** mostra reguas no eixo x e y para o usuário saber onde buscar centralização */
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
    showRenderBounds: boolean; // mostra as caixas/circulos de geometria dos sprites
    showCollisionBounds: boolean; // mostra as caixas/circulos de colisões dos objetos
    fpsOverlay: DebugFPSOverlayProperties; // mostra um overlay de fps do game loop
}

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

    constructor(console: BrioConsole) {
        this.#console = console;
    }

    get console(): DebugConsoleProperties {
        const config = this.#consoleConfig;
        const console = this.#console;

        return {
            set enabled(shouldEnable: boolean) {
                if (!config.enabled && shouldEnable) {
                    console.enabled = shouldEnable;
                    config.enabled = shouldEnable;
                    console.out("info", "Console logs are now enabled.");
                }
            },
            get enabled() {
                return config.enabled;
            },
            set showStackTrace(shouldEnable: boolean) {
                console.showStackTrace = shouldEnable;
                config.showStackTrace = shouldEnable;
            },
            get showStackTrace() {
                return config.showStackTrace;
            },
            set showInternalStackTrace(shouldEnable: boolean) {
                console.showInternalStackTrace = shouldEnable;
                config.showInternalStackTrace = shouldEnable;
            },
            get showInternalStackTrace() {
                return config.showInternalStackTrace;
            },
        };
    }

    get render(): DebugRenderProperties {
        const self = this;

        return {
            get grid() {
                return self.#grid;
            },
            set showRenderBounds(shouldEnable: boolean) {
                self.#renderConfig.showRenderBounds = shouldEnable;
            },
            get showRenderBounds() {
                return self.#renderConfig.showRenderBounds;
            },
            set showCollisionBounds(shouldEnable: boolean) {
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

    get #grid(): DebugGridProperties {
        const self = this.#renderConfig.grid;

        return {
            set enabled(shouldEnable: boolean) {
                self.enabled = shouldEnable;
            },
            get enabled() {
                return self.enabled;
            },
            set width(cellWidth: number) {
                self.width = Math.round(cellWidth);
            },
            get width() {
                return self.width;
            },
            set height(cellHeight: number) {
                self.height = Math.round(cellHeight);
            },
            get height() {
                return self.height;
            },
            set showAxisRulers(shouldEnable: boolean) {
                self.showAxisRulers = shouldEnable;
            },
            get showAxisRulers() {
                return self.showAxisRulers;
            },
        };
    }

    get #fpsOverlay(): DebugFPSOverlayProperties {
        const self = this.#renderConfig.fpsOverlay;

        return {
            set enabled(shouldEnable: boolean) {
                self.enabled = shouldEnable;
            },
            get enabled() {
                return self.enabled;
            },
            set position(canvasPosition: CanvasFPSPosition) {
                self.position = canvasPosition;
            },
            get position() {
                return self.position;
            },
            set offset(canvasOffset: number) {
                self.offset = canvasOffset;
            },
            get offset() {
                return self.offset;
            },
            set size(overlaySize: number) {
                self.size = overlaySize;
            },
            get size() {
                return self.size;
            },
            set backgroundColor(backgroundColor: string) {
                self.backgroundColor = backgroundColor;
            },
            get backgroundColor() {
                return self.backgroundColor;
            },
            set textColor(textColor: string) {
                self.textColor = textColor;
            },
            get textColor() {
                return self.textColor;
            },
        };
    }
}
