// BrioJS playground sandbox server.
// Serves /sandbox/<project>/<run>/<path> straight from the playground's IndexedDB, so a game written in the
// editor loads its modules, images, sounds and models with ordinary relative URLs, exactly like a static site.
// <run> changes on every Run, which gives the game a fresh module graph without clearing any cache.
// The schema must match src/ide/db.ts.
const DB_NAME = "brio-playground";
const DB_VERSION = 1;
const IMPORT_MAP = '<script type="importmap">{"imports":{"@brio-js/core":"/engine/brio.js"}}</script>';
const BRIDGE = '<script src="/sandbox-bridge.js"></script>';
const DEFAULT_HTML = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0;height:100%;overflow:hidden;background:#1e1913}#game{height:100%;display:grid;place-items:center}</style></head><body><div id="game"></div><script type="module" src="./main.js"></script></body></html>`;

const MIME = {
    js: "text/javascript",
    mjs: "text/javascript",
    json: "application/json",
    html: "text/html",
    htm: "text/html",
    css: "text/css",
    svg: "image/svg+xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
    glb: "model/gltf-binary",
    gltf: "model/gltf+json",
    bin: "application/octet-stream",
    glsl: "text/plain",
    txt: "text/plain",
    ttf: "font/ttf",
    woff: "font/woff",
    woff2: "font/woff2",
};

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

let dbPromise;
function openDB() {
    dbPromise ??= new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains("projects")) db.createObjectStore("projects", { keyPath: "id" });
            if (!db.objectStoreNames.contains("files")) {
                db.createObjectStore("files", { keyPath: ["project", "path"] }).createIndex("project", "project");
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
            dbPromise = undefined;
            reject(request.error);
        };
    });
    return dbPromise;
}

async function readFile(project, path) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const request = db.transaction("files").objectStore("files").get([project, path]);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function mimeOf(path) {
    const ext = path.split(".").pop().toLowerCase();
    return MIME[ext] || "application/octet-stream";
}

function injectHtml(html) {
    let head = BRIDGE;
    if (!/type=["']importmap["']/i.test(html)) head = IMPORT_MAP + head;
    if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + head);
    return head + html;
}

async function serve(project, path) {
    const clean = decodeURIComponent(path || "index.html").replace(/^\/+/, "");
    const target = clean === "" || clean.endsWith("/") ? clean + "index.html" : clean;
    let record;
    try {
        record = await readFile(project, target);
    } catch (error) {
        return new Response(`Playground storage unavailable: ${error}`, { status: 500 });
    }
    const headers = { "Cache-Control": "no-store" };
    if (!record) {
        if (target === "index.html") {
            return new Response(injectHtml(DEFAULT_HTML), {
                headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
            });
        }
        return new Response(`Not found in this project: ${target}`, {
            status: 404,
            headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" },
        });
    }
    const type = mimeOf(target);
    if (type === "text/html") {
        return new Response(injectHtml(record.text ?? (await record.blob.text())), {
            headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
        });
    }
    const body = record.text !== undefined ? record.text : record.blob;
    const textual = type.startsWith("text/") || type === "application/json" || type === "image/svg+xml";
    return new Response(body, {
        headers: { ...headers, "Content-Type": textual ? `${type}; charset=utf-8` : type },
    });
}

self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;
    const match = /^\/sandbox\/([^/]+)\/([^/]+)\/?(.*)$/.exec(url.pathname);
    if (!match) return;
    event.respondWith(serve(decodeURIComponent(match[1]), match[3]));
});
