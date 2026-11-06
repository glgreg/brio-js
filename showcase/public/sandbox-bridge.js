// Injected into every playground run (before the game's modules): forwards console output, uncaught errors and
// unhandled rejections to the playground, which shows them in its console with links back to the source.
(function () {
    if (window.parent === window) return;
    const run = location.pathname.split("/")[3];
    const prefix = location.origin + location.pathname.split("/").slice(0, 4).join("/") + "/";

    function short(text) {
        return String(text).split(prefix).join("");
    }

    function format(value, depth) {
        if (value instanceof Error) return short(value.stack || `${value.name}: ${value.message}`);
        if (typeof value === "string") return short(value);
        if (typeof value === "function") return `ƒ ${value.name || "anonymous"}()`;
        if (value === undefined) return "undefined";
        if (value === null || typeof value !== "object") return String(value);
        if (depth > 2) return Array.isArray(value) ? "[…]" : "{…}";
        try {
            if (Array.isArray(value)) {
                const items = value.slice(0, 20).map((v) => format(v, depth + 1));
                return `[${items.join(", ")}${value.length > 20 ? ", …" : ""}]`;
            }
            const name = value.constructor && value.constructor.name !== "Object" ? value.constructor.name + " " : "";
            const keys = Object.keys(value).slice(0, 12);
            const body = keys.map((k) => `${k}: ${format(value[k], depth + 1)}`).join(", ");
            return `${name}{${body}${Object.keys(value).length > 12 ? ", …" : ""}}`;
        } catch {
            return String(value);
        }
    }

    function post(level, args) {
        try {
            const text = Array.prototype.map.call(args, (a) => format(a, 0)).join(" ");
            window.parent.postMessage({ source: "brio-sandbox", run, level, text }, location.origin);
        } catch {
            // the playground went away; nothing to report to
        }
    }

    for (const level of ["log", "info", "warn", "error", "debug"]) {
        const original = console[level].bind(console);
        console[level] = function () {
            post(level, arguments);
            original.apply(null, arguments);
        };
    }
    window.addEventListener("error", (event) => {
        const where = event.filename ? ` (${short(event.filename)}:${event.lineno}:${event.colno})` : "";
        post("uncaught", [event.error ? event.error : `${event.message}${where}`]);
    });
    // A module that fails to load (404, MIME) fires "error" on its <script>, not on window
    window.addEventListener(
        "error",
        (event) => {
            const el = event.target;
            if (el && el.tagName === "SCRIPT") post("uncaught", [`Could not load ${short(el.src || "inline module")}`]);
        },
        true,
    );
    window.addEventListener("unhandledrejection", (event) => post("uncaught", [event.reason]));
    window.addEventListener("load", () => {
        window.parent.postMessage({ source: "brio-sandbox", run, level: "ready", text: "" }, location.origin);
    });
    // Keep keyboard focus on the game when it is clicked
    window.addEventListener("pointerdown", () => window.focus());
})();
