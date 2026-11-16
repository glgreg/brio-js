// Zero-dependency static file server for the end-to-end tests: serves the repository root (examples and the
// built `dist/`) with explicit MIME types and caching disabled. Usage: `node e2e/serve.mjs [port]`.
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 4173);

const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".ico": "image/x-icon",
    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
    ".gltf": "model/gltf+json",
    ".glb": "model/gltf-binary",
    ".bin": "application/octet-stream",
    ".wasm": "application/wasm",
    ".txt": "text/plain; charset=utf-8",
};

const NO_CACHE = { "Cache-Control": "no-store, must-revalidate", Pragma: "no-cache", Expires: "0" };

/** Resolves a request path inside ROOT (directories map to their `index.html`), or `undefined` when outside. */
async function resolveFile(urlPath) {
    let path;
    try {
        path = normalize(join(ROOT, decodeURIComponent(urlPath)));
    } catch {
        return undefined;
    }
    if (path !== ROOT && !path.startsWith(ROOT + sep)) return undefined;
    try {
        const info = await stat(path);
        if (info.isDirectory()) {
            const index = join(path, "index.html");
            return (await stat(index)).isFile() ? index : undefined;
        }
        return info.isFile() ? path : undefined;
    } catch {
        return undefined;
    }
}

const server = createServer(async (req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405, { Allow: "GET, HEAD", ...NO_CACHE });
        res.end();
        return;
    }
    const { pathname } = new URL(req.url ?? "/", "http://localhost");

    // Directory URLs without a trailing slash would break the pages' relative imports
    if (!pathname.endsWith("/") && !extname(pathname)) {
        const dir = await resolveFile(pathname + "/");
        if (dir) {
            res.writeHead(301, { Location: pathname + "/", ...NO_CACHE });
            res.end();
            return;
        }
    }

    const file = await resolveFile(pathname);
    if (!file) {
        // Browsers request a favicon on their own; answering it keeps "404" console errors out of the tests
        res.writeHead(pathname === "/favicon.ico" ? 204 : 404, NO_CACHE);
        res.end();
        return;
    }

    const type = MIME_TYPES[extname(file).toLowerCase()] ?? "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, ...NO_CACHE });
    if (req.method === "HEAD") {
        res.end();
        return;
    }
    createReadStream(file)
        .on("error", () => res.destroy())
        .pipe(res);
});

server.listen(PORT, "127.0.0.1", () => {
    console.log(`Serving ${ROOT} at http://127.0.0.1:${PORT}/`);
});

for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => server.close(() => process.exit(0)));
