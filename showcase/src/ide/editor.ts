// Monaco setup for the playground: a warm theme, JavaScript IntelliSense with the full BrioJS declarations
// (served by the engine build as /engine/types.json) and one model per project file.
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
import TsWorker from "monaco-editor/language/typescript/ts.worker?worker";
import JsonWorker from "monaco-editor/language/json/json.worker?worker";
import CssWorker from "monaco-editor/language/css/css.worker?worker";
import HtmlWorker from "monaco-editor/language/html/html.worker?worker";

(self as unknown as { MonacoEnvironment: monaco.Environment }).MonacoEnvironment = {
    getWorker(_id: string, label: string) {
        if (label === "typescript" || label === "javascript") return new TsWorker();
        if (label === "json") return new JsonWorker();
        if (label === "css") return new CssWorker();
        if (label === "html") return new HtmlWorker();
        return new EditorWorker();
    },
};

export { monaco };

let typesLoaded = false;

export async function setupMonaco(): Promise<void> {
    monaco.editor.defineTheme("brio-night", {
        base: "vs-dark",
        inherit: true,
        rules: [
            { token: "comment", foreground: "8c7b67", fontStyle: "italic" },
            { token: "keyword", foreground: "f19a32" },
            { token: "string", foreground: "a7d18e" },
            { token: "number", foreground: "f08fa5" },
            { token: "type", foreground: "8cc5bf" },
            { token: "type.identifier", foreground: "8cc5bf" },
            { token: "identifier", foreground: "efe4d2" },
            { token: "delimiter", foreground: "c2b29b" },
            { token: "tag", foreground: "f19a32" },
            { token: "attribute.name", foreground: "f3d27a" },
            { token: "attribute.value", foreground: "a7d18e" },
        ],
        colors: {
            "editor.background": "#16120e",
            "editor.foreground": "#efe4d2",
            "editorLineNumber.foreground": "#5d4f40",
            "editorLineNumber.activeForeground": "#f19a32",
            "editor.lineHighlightBackground": "#211b15",
            "editor.selectionBackground": "#5a3e2266",
            "editor.inactiveSelectionBackground": "#5a3e2233",
            "editorCursor.foreground": "#f19a32",
            "editorIndentGuide.background1": "#2a221b",
            "editorIndentGuide.activeBackground1": "#4a3d30",
            "editorWidget.background": "#1e1913",
            "editorWidget.border": "#3a3026",
            "editorSuggestWidget.background": "#1e1913",
            "editorSuggestWidget.border": "#3a3026",
            "editorSuggestWidget.selectedBackground": "#3a2d20",
            "editorHoverWidget.background": "#1e1913",
            "editorHoverWidget.border": "#3a3026",
            "scrollbarSlider.background": "#3a302688",
            "scrollbarSlider.hoverBackground": "#4a3d30aa",
            "minimap.background": "#16120e",
        },
    });

    const ts = monaco.typescript;
    const options = {
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        allowJs: true,
        checkJs: false,
        allowNonTsExtensions: true,
        lib: ["esnext", "dom", "dom.iterable"],
    };
    ts.javascriptDefaults.setCompilerOptions(options);
    ts.typescriptDefaults.setCompilerOptions(options);
    // Syntax errors are shown; type errors are not, so a beginner's JavaScript is never covered in red
    ts.javascriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: false });
    ts.javascriptDefaults.setEagerModelSync(true);

    if (!typesLoaded) {
        typesLoaded = true;
        try {
            const types: Record<string, string> = await (await fetch("/engine/types.json")).json();
            for (const [path, source] of Object.entries(types)) {
                const uri = `file:///node_modules/@brio-js/core/${path}`;
                ts.javascriptDefaults.addExtraLib(source, uri);
                ts.typescriptDefaults.addExtraLib(source, uri);
            }
            const pkg = JSON.stringify({ name: "@brio-js/core", types: "index.d.ts" });
            ts.javascriptDefaults.addExtraLib(pkg, "file:///node_modules/@brio-js/core/package.json");
        } catch (error) {
            console.warn("[playground] BrioJS types unavailable", error);
        }
    }
}

export function languageFor(path: string): string {
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    switch (ext) {
        case "js":
        case "mjs":
            return "javascript";
        case "ts":
            return "typescript";
        case "json":
        case "gltf":
        case "tmj":
        case "tsj":
            return "json";
        case "html":
        case "htm":
            return "html";
        case "css":
            return "css";
        case "glsl":
        case "vert":
        case "frag":
            return "cpp";
        case "md":
            return "markdown";
        case "svg":
            return "xml";
        default:
            return "plaintext";
    }
}

export function uriFor(path: string): monaco.Uri {
    return monaco.Uri.parse(`file:///project/${path.split("/").map(encodeURIComponent).join("/")}`);
}

export function createEditor(host: HTMLElement): monaco.editor.IStandaloneCodeEditor {
    return monaco.editor.create(host, {
        theme: "brio-night",
        automaticLayout: true,
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: 14,
        lineHeight: 22,
        fontLigatures: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        tabSize: 4,
        insertSpaces: true,
        renderLineHighlight: "all",
        roundedSelection: true,
        smoothScrolling: true,
        cursorBlinking: "smooth",
        cursorSmoothCaretAnimation: "on",
        padding: { top: 14, bottom: 14 },
        bracketPairColorization: { enabled: true },
        guides: { bracketPairs: "active", indentation: true },
        stickyScroll: { enabled: false },
        fixedOverflowWidgets: true,
        model: null,
    });
}
