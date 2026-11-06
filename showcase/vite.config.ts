import { defineConfig } from "vite";
import { resolve } from "node:path";

// Three pages: the landing page, the game player and the playground IDE (Monaco loads only there).
// The engine itself is built separately into public/engine/ (scripts/build-engine.mjs) and imported at runtime
// through an import map, so the games and the sandbox run exactly what the landing page runs.
export default defineConfig({
    appType: "mpa",
    build: {
        target: "es2022",
        rollupOptions: {
            input: {
                index: resolve(__dirname, "index.html"),
                play: resolve(__dirname, "play.html"),
                playground: resolve(__dirname, "playground.html"),
                credits: resolve(__dirname, "credits.html"),
            },
            // The engine is served from /engine/brio.js; pages import it by URL, never bundle it
            external: ["/engine/brio.js"],
        },
    },
    worker: { format: "es" },
    server: { port: 5173 },
});
