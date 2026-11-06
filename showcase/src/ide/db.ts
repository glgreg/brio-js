// Playground storage: projects and their files live in IndexedDB, in this browser only.
// The sandbox Service Worker (public/sw.js) reads the same "files" store to serve a running game, so the schema
// here and there must match: DB "brio-playground" v1, stores "projects" (keyPath id) and "files"
// (keyPath [project, path], index "project").

export interface ProjectRecord {
    id: string;
    name: string;
    /** Template or game the project started from (for "reset"). */
    template?: string;
    created: number;
    updated: number;
    /** Open editor tabs and the active one, restored on the next visit. */
    tabs?: string[];
    active?: string;
}

export interface FileRecord {
    project: string;
    path: string;
    /** Text content for editable files. */
    text?: string;
    /** Binary content (images, audio, models). */
    blob?: Blob;
    type: string;
    size: number;
    updated: number;
}

const DB_NAME = "brio-playground";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | undefined;

export function openDB(): Promise<IDBDatabase> {
    dbPromise ??= new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains("projects")) db.createObjectStore("projects", { keyPath: "id" });
            if (!db.objectStoreNames.contains("files")) {
                const files = db.createObjectStore("files", { keyPath: ["project", "path"] });
                files.createIndex("project", "project");
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error("IndexedDB is blocked by another tab"));
    });
    return dbPromise;
}

function done<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function finished(tx: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error("transaction aborted"));
    });
}

export async function listProjects(): Promise<ProjectRecord[]> {
    const db = await openDB();
    const all = await done(db.transaction("projects").objectStore("projects").getAll());
    return (all as ProjectRecord[]).sort((a, b) => b.updated - a.updated);
}

export async function getProject(id: string): Promise<ProjectRecord | undefined> {
    const db = await openDB();
    return (await done(db.transaction("projects").objectStore("projects").get(id))) as ProjectRecord | undefined;
}

export async function putProject(project: ProjectRecord): Promise<void> {
    const db = await openDB();
    const tx = db.transaction("projects", "readwrite");
    tx.objectStore("projects").put(project);
    await finished(tx);
}

export async function touchProject(id: string): Promise<void> {
    const project = await getProject(id);
    if (!project) return;
    project.updated = Date.now();
    await putProject(project);
}

export async function deleteProject(id: string): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(["projects", "files"], "readwrite");
    tx.objectStore("projects").delete(id);
    const index = tx.objectStore("files").index("project");
    const keys = await done(index.getAllKeys(IDBKeyRange.only(id)));
    for (const key of keys) tx.objectStore("files").delete(key);
    await finished(tx);
}

export async function listFiles(project: string): Promise<FileRecord[]> {
    const db = await openDB();
    const index = db.transaction("files").objectStore("files").index("project");
    const files = (await done(index.getAll(IDBKeyRange.only(project)))) as FileRecord[];
    return files.sort((a, b) => a.path.localeCompare(b.path));
}

export async function getFile(project: string, path: string): Promise<FileRecord | undefined> {
    const db = await openDB();
    return (await done(db.transaction("files").objectStore("files").get([project, path]))) as
        | FileRecord
        | undefined;
}

export async function putFiles(records: FileRecord[]): Promise<void> {
    if (records.length === 0) return;
    const db = await openDB();
    const tx = db.transaction("files", "readwrite");
    const store = tx.objectStore("files");
    for (const record of records) store.put(record);
    await finished(tx);
}

export async function deleteFiles(project: string, paths: string[]): Promise<void> {
    const db = await openDB();
    const tx = db.transaction("files", "readwrite");
    for (const path of paths) tx.objectStore("files").delete([project, path]);
    await finished(tx);
}

export async function replaceAllFiles(project: string, records: FileRecord[]): Promise<void> {
    const db = await openDB();
    const tx = db.transaction("files", "readwrite");
    const store = tx.objectStore("files");
    const keys = await done(store.index("project").getAllKeys(IDBKeyRange.only(project)));
    for (const key of keys) store.delete(key);
    for (const record of records) store.put(record);
    await finished(tx);
}

// ---- File kinds ----

const TEXT_EXT = new Set([
    "js",
    "mjs",
    "ts",
    "json",
    "html",
    "htm",
    "css",
    "glsl",
    "vert",
    "frag",
    "txt",
    "md",
    "csv",
    "svg",
    "gltf",
    "obj",
    "mtl",
    "tmj",
    "tsj",
]);

const MIME: Record<string, string> = {
    js: "text/javascript",
    mjs: "text/javascript",
    ts: "text/javascript",
    json: "application/json",
    html: "text/html",
    htm: "text/html",
    css: "text/css",
    glsl: "text/plain",
    vert: "text/plain",
    frag: "text/plain",
    txt: "text/plain",
    md: "text/markdown",
    csv: "text/csv",
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
    obj: "text/plain",
    mtl: "text/plain",
    tmj: "application/json",
    tsj: "application/json",
    ttf: "font/ttf",
    otf: "font/otf",
    woff: "font/woff",
    woff2: "font/woff2",
};

export function extension(path: string): string {
    const name = path.split("/").pop() ?? "";
    const dot = name.lastIndexOf(".");
    return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function isTextPath(path: string): boolean {
    return TEXT_EXT.has(extension(path));
}

export function mimeFor(path: string): string {
    return MIME[extension(path)] ?? "application/octet-stream";
}

export function makeTextFile(project: string, path: string, text: string): FileRecord {
    return { project, path, text, type: mimeFor(path), size: new Blob([text]).size, updated: Date.now() };
}

export function makeBlobFile(project: string, path: string, blob: Blob): FileRecord {
    return {
        project,
        path,
        blob,
        type: blob.type || mimeFor(path),
        size: blob.size,
        updated: Date.now(),
    };
}

export function newId(): string {
    return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}
