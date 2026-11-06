import "./styles/base.css";
import "./styles/ide.css";
import { applyI18n, bindLangSwitch, getLang, onLangChange, pick, t } from "./i18n";
import { capySVG, logoMark } from "./mascot";
import { GAMES, findGame } from "./games";
import {
    type FileRecord,
    type ProjectRecord,
    deleteFiles,
    deleteProject,
    getProject,
    isTextPath,
    listFiles,
    listProjects,
    makeBlobFile,
    makeTextFile,
    mimeFor,
    newId,
    putFiles,
    putProject,
    replaceAllFiles,
} from "./ide/db";
import { readZip, writeZip } from "./ide/zip";
import { SNIPPETS } from "./ide/snippets";

type Monaco = typeof import("./ide/editor");

// ------------------------------------------------------------------ DOM
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const tree = $("tree");
const tabsEl = $("tabs");
const editorHost = $("editor-host");
const assetView = $("asset-view");
const frameHost = $("frame-host");
const frameEmpty = $("frame-empty");
const consoleEl = $("console");
const statusEl = $("save-status");
const runBtn = $<HTMLButtonElement>("run");
const stopBtn = $<HTMLButtonElement>("stop");
const autorun = $<HTMLInputElement>("autorun");
const toastEl = $("toast");

$("ide-brand").innerHTML = `${logoMark()}<span>BrioJS</span>`;
$("frame-capy").innerHTML = capySVG({ pose: "sleep" });
bindLangSwitch();
applyI18n();

// ------------------------------------------------------------------ State
interface OpenFile {
    record: FileRecord;
    model?: import("monaco-editor").editor.ITextModel;
    view?: import("monaco-editor").editor.ICodeEditorViewState | null;
}

let mon: Monaco | undefined;
let editor: import("monaco-editor").editor.IStandaloneCodeEditor | undefined;
let project: ProjectRecord | undefined;
const files = new Map<string, OpenFile>();
let tabs: string[] = [];
let active: string | undefined;
const collapsed = new Set<string>();
const emptyFolders = new Set<string>();
let runId = "";
let iframe: HTMLIFrameElement | undefined;
let swReady = false;

const pendingSaves = new Map<string, number>();
let saveTimer = 0;

try {
    autorun.checked = localStorage.getItem("brio.autorun") === "1";
} catch {
    /* ignore */
}
autorun.addEventListener("change", () => {
    try {
        localStorage.setItem("brio.autorun", autorun.checked ? "1" : "0");
    } catch {
        /* ignore */
    }
});

// ------------------------------------------------------------------ Utilities
function toast(text: string): void {
    toastEl.textContent = text;
    toastEl.classList.add("show");
    clearTimeout((toast as unknown as { timer: number }).timer);
    (toast as unknown as { timer: number }).timer = window.setTimeout(() => toastEl.classList.remove("show"), 2200);
}

function setStatus(kind: "saving" | "saved" | "idle"): void {
    statusEl.dataset.state = kind;
    statusEl.textContent = kind === "saving" ? t("ide.saving") : kind === "saved" ? t("ide.saved") : "";
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function relativeTime(ms: number): string {
    const diff = (Date.now() - ms) / 1000;
    if (diff < 60) return t("ide.justNow");
    if (diff < 3600) return t("ide.minutesAgo", { n: Math.round(diff / 60) });
    if (diff < 86400) return t("ide.hoursAgo", { n: Math.round(diff / 3600) });
    return t("ide.daysAgo", { n: Math.round(diff / 86400) });
}

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function normalizePath(path: string): string {
    return path
        .replace(/\\/g, "/")
        .split("/")
        .filter((p) => p && p !== ".")
        .join("/");
}

function fileIcon(path: string): string {
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    const map: Record<string, string> = {
        js: "js",
        mjs: "js",
        ts: "ts",
        json: "{}",
        html: "<>",
        css: "#",
        glsl: "◈",
        png: "▣",
        jpg: "▣",
        jpeg: "▣",
        webp: "▣",
        gif: "▣",
        svg: "▣",
        mp3: "♪",
        wav: "♪",
        ogg: "♪",
        glb: "◆",
        gltf: "◆",
        obj: "◆",
        bin: "▤",
        md: "¶",
    };
    return map[ext] ?? "•";
}

// Small dialogs (no native prompt/confirm: they block the page and look out of place)
const askModal = $<HTMLDialogElement>("ask-modal");
function ask(label: string, value = "", options: { text?: string; input?: boolean } = {}): Promise<string | null> {
    const input = $<HTMLInputElement>("ask-input");
    $("ask-label").textContent = label;
    $("ask-text").textContent = options.text ?? "";
    input.hidden = options.input === false;
    input.value = value;
    $("ask-cancel").textContent = getLang() === "pt" ? "Cancelar" : "Cancel";
    askModal.showModal();
    if (!input.hidden) {
        input.focus();
        const dot = value.lastIndexOf(".");
        const slash = value.lastIndexOf("/") + 1;
        input.setSelectionRange(slash, dot > slash ? dot : value.length);
    }
    return new Promise((resolve) => {
        const finish = (result: string | null) => {
            askModal.close();
            $("ask-form").removeEventListener("submit", onSubmit);
            $("ask-cancel").removeEventListener("click", onCancel);
            askModal.removeEventListener("cancel", onCancel);
            resolve(result);
        };
        const onSubmit = (e: Event) => {
            e.preventDefault();
            finish(input.hidden ? "ok" : input.value.trim());
        };
        const onCancel = (e: Event) => {
            e.preventDefault();
            finish(null);
        };
        $("ask-form").addEventListener("submit", onSubmit);
        $("ask-cancel").addEventListener("click", onCancel);
        askModal.addEventListener("cancel", onCancel);
    });
}
const confirmAsk = async (text: string) => (await ask(text, "", { input: false })) !== null;

// ------------------------------------------------------------------ Service worker
async function setupServiceWorker(): Promise<void> {
    if (!("serviceWorker" in navigator)) {
        logLine("warn", t("ide.swMissing"));
        return;
    }
    try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;
        swReady = true;
    } catch (error) {
        logLine("warn", `${t("ide.swMissing")} (${error})`);
    }
}

// ------------------------------------------------------------------ Templates
async function fetchManifest(id: string): Promise<{ group: string; files: { path: string }[] } | undefined> {
    // Demo games are listed in the catalog; everything else is a template
    const groups = findGame(id) ? ["games", "templates"] : ["templates", "games"];
    for (const group of groups) {
        try {
            const res = await fetch(`/${group}/${id}/project.json`);
            if (res.ok) return await res.json();
        } catch {
            /* try the next group */
        }
    }
    return undefined;
}

async function templateFiles(id: string, projectId: string): Promise<FileRecord[] | undefined> {
    const manifest = await fetchManifest(id);
    if (!manifest) return undefined;
    const base = `/${manifest.group}/${id}/`;
    return Promise.all(
        manifest.files.map(async ({ path }) => {
            const res = await fetch(base + path);
            if (!res.ok) throw new Error(`${path}: ${res.status}`);
            return isTextPath(path)
                ? makeTextFile(projectId, path, await res.text())
                : makeBlobFile(projectId, path, await res.blob());
        }),
    );
}

function templateName(id: string): string {
    const game = findGame(id);
    if (game) return game.title;
    if (id === "blank-2d") return t("ide.templateBlank2d");
    if (id === "blank-3d") return t("ide.templateBlank3d");
    if (id === "hello-brio") return "Hello Brio";
    return id;
}

async function createFromTemplate(id: string): Promise<ProjectRecord | undefined> {
    toast(t("ide.importing"));
    const projectId = newId();
    const records = await templateFiles(id, projectId);
    if (!records) return undefined;
    const record: ProjectRecord = {
        id: projectId,
        name: templateName(id),
        template: id,
        created: Date.now(),
        updated: Date.now(),
        tabs: ["main.js"],
        active: "main.js",
    };
    await putFiles(records);
    await putProject(record);
    return record;
}

// ------------------------------------------------------------------ Project lifecycle
async function openProject(record: ProjectRecord): Promise<void> {
    await flushSaves();
    stopGame();
    for (const f of files.values()) f.model?.dispose();
    files.clear();
    emptyFolders.clear();
    project = record;
    for (const file of await listFiles(record.id)) files.set(file.path, { record: file });
    tabs = (record.tabs ?? []).filter((p) => files.has(p));
    if (tabs.length === 0) tabs = files.has("main.js") ? ["main.js"] : [...files.keys()].slice(0, 1);
    active = record.active && files.has(record.active) ? record.active : tabs[0];
    $("project-name").textContent = record.name;
    document.title = `${record.name} · BrioJS Playground`;
    try {
        localStorage.setItem("brio.lastProject", record.id);
    } catch {
        /* ignore */
    }
    const url = new URL(location.href);
    url.searchParams.delete("template");
    url.searchParams.set("project", record.id);
    history.replaceState(null, "", url);
    renderTree();
    renderTabs();
    if (active) showFile(active);
    else showEmptyEditor();
    setStatus("idle");
}

function persistTabs(): void {
    if (!project) return;
    project.tabs = tabs;
    project.active = active;
    void putProject(project);
}

// ------------------------------------------------------------------ Saving
function scheduleSave(path: string): void {
    pendingSaves.set(path, Date.now());
    setStatus("saving");
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => void flushSaves(), 450);
}

async function flushSaves(): Promise<void> {
    clearTimeout(saveTimer);
    if (!project || pendingSaves.size === 0) return;
    const records: FileRecord[] = [];
    for (const path of pendingSaves.keys()) {
        const open = files.get(path);
        if (!open?.model) continue;
        open.record = makeTextFile(project.id, path, open.model.getValue());
        records.push(open.record);
    }
    pendingSaves.clear();
    await putFiles(records);
    project.updated = Date.now();
    await putProject(project);
    setStatus("saved");
    renderTabs();
}

// ------------------------------------------------------------------ Tree
interface TreeNode {
    name: string;
    path: string;
    folder: boolean;
    children: Map<string, TreeNode>;
}

function buildTree(): TreeNode {
    const root: TreeNode = { name: "", path: "", folder: true, children: new Map() };
    const ensureFolder = (path: string) => {
        let node = root;
        let acc = "";
        for (const part of path.split("/").filter(Boolean)) {
            acc = acc ? `${acc}/${part}` : part;
            let next = node.children.get(part);
            if (!next) {
                next = { name: part, path: acc, folder: true, children: new Map() };
                node.children.set(part, next);
            }
            node = next;
        }
        return node;
    };
    for (const folder of emptyFolders) ensureFolder(folder);
    for (const path of files.keys()) {
        const parts = path.split("/");
        const name = parts.pop()!;
        ensureFolder(parts.join("/")).children.set(name, { name, path, folder: false, children: new Map() });
    }
    return root;
}

function renderTree(): void {
    const root = buildTree();
    const rows: string[] = [];
    const walk = (node: TreeNode, depth: number) => {
        const entries = [...node.children.values()].sort((a, b) =>
            a.folder !== b.folder ? (a.folder ? -1 : 1) : a.name.localeCompare(b.name),
        );
        for (const child of entries) {
            const pad = `style="--depth:${depth}"`;
            if (child.folder) {
                const closed = collapsed.has(child.path);
                rows.push(
                    `<div class="tree-row folder${closed ? " closed" : ""}" role="treeitem" aria-expanded="${!closed}" tabindex="0" data-folder="${escapeHtml(child.path)}" ${pad}>
                      <span class="caret" aria-hidden="true"></span><span class="tree-name">${escapeHtml(child.name)}</span>
                      <button class="row-more" type="button" tabindex="-1" aria-label="…">⋯</button></div>`,
                );
                if (!closed) walk(child, depth + 1);
            } else {
                const dirty = pendingSaves.has(child.path);
                rows.push(
                    `<div class="tree-row file${child.path === active ? " active" : ""}" role="treeitem" tabindex="0" data-file="${escapeHtml(child.path)}" ${pad}>
                      <span class="ficon" data-ext="${escapeHtml(child.name.split(".").pop() ?? "")}">${fileIcon(child.name)}</span><span class="tree-name">${escapeHtml(child.name)}</span>${dirty ? '<span class="dirty"></span>' : ""}
                      <button class="row-more" type="button" tabindex="-1" aria-label="…">⋯</button></div>`,
                );
            }
        }
    };
    walk(root, 0);
    tree.innerHTML = rows.join("");
    let total = 0;
    for (const f of files.values()) total += f.record.size;
    $("files-foot").textContent = `${t("ide.files", { n: files.size })} · ${formatSize(total)}`;
}

tree.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const row = target.closest<HTMLElement>(".tree-row");
    if (!row) return;
    if (target.closest(".row-more")) {
        const rect = target.getBoundingClientRect();
        openContextMenu(row, rect.left, rect.bottom);
        return;
    }
    if (row.dataset.folder !== undefined) {
        const path = row.dataset.folder;
        if (collapsed.has(path)) collapsed.delete(path);
        else collapsed.add(path);
        renderTree();
    } else if (row.dataset.file) openFile(row.dataset.file);
});
tree.addEventListener("contextmenu", (event) => {
    const row = (event.target as HTMLElement).closest<HTMLElement>(".tree-row");
    if (!row) return;
    event.preventDefault();
    openContextMenu(row, event.clientX, event.clientY);
});
tree.addEventListener("keydown", (event) => {
    const row = (event.target as HTMLElement).closest<HTMLElement>(".tree-row");
    if (!row) return;
    if (event.key === "Enter") row.click();
    if (event.key === "F2") void renameEntry(row.dataset.file ?? row.dataset.folder ?? "", !!row.dataset.folder);
    if (event.key === "Delete") void deleteEntry(row.dataset.file ?? row.dataset.folder ?? "", !!row.dataset.folder);
});

const ctxMenu = $("ctx-menu");
function openContextMenu(row: HTMLElement, x: number, y: number): void {
    const isFolder = row.dataset.folder !== undefined;
    const path = (isFolder ? row.dataset.folder : row.dataset.file) ?? "";
    const items: [string, () => void][] = [];
    if (isFolder) {
        items.push([t("ide.newFile"), () => void newFile(path + "/")]);
    } else {
        items.push([t("ide.duplicate"), () => void duplicateFile(path)]);
    }
    items.push([t("ide.rename"), () => void renameEntry(path, isFolder)]);
    items.push([t("ide.delete"), () => void deleteEntry(path, isFolder)]);
    ctxMenu.innerHTML = items
        .map(([label], i) => `<button type="button" role="menuitem" data-i="${i}"${i === items.length - 1 ? ' class="danger"' : ""}>${escapeHtml(label)}</button>`)
        .join("");
    ctxMenu.hidden = false;
    const w = ctxMenu.offsetWidth;
    const h = ctxMenu.offsetHeight;
    ctxMenu.style.left = `${Math.min(x, innerWidth - w - 8)}px`;
    ctxMenu.style.top = `${Math.min(y, innerHeight - h - 8)}px`;
    ctxMenu.onclick = (e) => {
        const button = (e.target as HTMLElement).closest<HTMLElement>("button");
        if (!button) return;
        ctxMenu.hidden = true;
        items[Number(button.dataset.i)][1]();
    };
}
document.addEventListener("pointerdown", (e) => {
    if (!ctxMenu.hidden && !ctxMenu.contains(e.target as Node)) ctxMenu.hidden = true;
    const menu = $("more-menu");
    if (!menu.hidden && !menu.contains(e.target as Node) && !$("more").contains(e.target as Node)) menu.hidden = true;
});

// ------------------------------------------------------------------ File operations
async function newFile(prefix = ""): Promise<void> {
    if (!project) return;
    const name = await ask(t("ide.promptFile"), prefix || "new-file.js");
    if (!name) return;
    const path = normalizePath(name);
    if (!path || files.has(path)) {
        if (path) openFile(path);
        return;
    }
    const content = path.endsWith(".js")
        ? `import { BrioGame } from "@brio-js/core";\n\n`
        : path.endsWith(".glsl")
          ? "void surface(inout BrioSurface s) {\n    \n}\n"
          : "";
    const record = makeTextFile(project.id, path, content);
    await putFiles([record]);
    files.set(path, { record });
    emptyFolders.delete(path.split("/").slice(0, -1).join("/"));
    renderTree();
    openFile(path);
}

async function newFolder(): Promise<void> {
    const name = await ask(t("ide.promptFolder"), "assets");
    if (!name) return;
    emptyFolders.add(normalizePath(name));
    renderTree();
}

async function duplicateFile(path: string): Promise<void> {
    if (!project) return;
    const open = files.get(path);
    if (!open) return;
    const dot = path.lastIndexOf(".");
    let copy = dot > 0 ? `${path.slice(0, dot)}-copy${path.slice(dot)}` : `${path}-copy`;
    let n = 2;
    while (files.has(copy)) copy = dot > 0 ? `${path.slice(0, dot)}-copy${n++}${path.slice(dot)}` : `${path}-copy${n++}`;
    const source = open.record;
    const record = source.blob
        ? makeBlobFile(project.id, copy, source.blob)
        : makeTextFile(project.id, copy, open.model?.getValue() ?? source.text ?? "");
    await putFiles([record]);
    files.set(copy, { record });
    renderTree();
}

async function renameEntry(path: string, isFolder: boolean): Promise<void> {
    if (!project || !path) return;
    const target = await ask(t("ide.promptRename"), path);
    if (!target) return;
    const next = normalizePath(target);
    if (!next || next === path) return;
    await flushSaves();
    const moves: [string, string][] = [];
    if (isFolder) {
        for (const p of files.keys()) if (p.startsWith(path + "/")) moves.push([p, next + p.slice(path.length)]);
        if (emptyFolders.delete(path)) emptyFolders.add(next);
    } else if (!files.has(next)) moves.push([path, next]);
    const records: FileRecord[] = [];
    for (const [from, to] of moves) {
        const open = files.get(from)!;
        open.model?.dispose();
        const record = { ...open.record, path: to, updated: Date.now() };
        records.push(record);
        files.delete(from);
        files.set(to, { record });
        tabs = tabs.map((p) => (p === from ? to : p));
        if (active === from) active = to;
    }
    await putFiles(records);
    await deleteFiles(project.id, moves.map(([from]) => from));
    persistTabs();
    renderTree();
    renderTabs();
    if (active) showFile(active);
}

async function deleteEntry(path: string, isFolder: boolean): Promise<void> {
    if (!project || !path) return;
    if (!(await confirmAsk(t("ide.confirmDelete", { name: path })))) return;
    const doomed = isFolder ? [...files.keys()].filter((p) => p.startsWith(path + "/")) : [path];
    emptyFolders.delete(path);
    for (const p of doomed) {
        files.get(p)?.model?.dispose();
        files.delete(p);
        pendingSaves.delete(p);
        closeTab(p, false);
    }
    await deleteFiles(project.id, doomed);
    persistTabs();
    renderTree();
    renderTabs();
    if (active) showFile(active);
    else showEmptyEditor();
}

async function addBlobs(entries: { path: string; file: Blob }[]): Promise<void> {
    if (!project || entries.length === 0) return;
    const records: FileRecord[] = [];
    for (const { path, file } of entries) {
        const clean = normalizePath(path);
        if (!clean) continue;
        const record = isTextPath(clean)
            ? makeTextFile(project.id, clean, await file.text())
            : makeBlobFile(project.id, clean, file.type ? file : new Blob([file], { type: mimeFor(clean) }));
        files.get(clean)?.model?.dispose();
        files.set(clean, { record });
        records.push(record);
    }
    await putFiles(records);
    renderTree();
    if (records.length === 1) openFile(records[0].path);
    toast(`+ ${records.map((r) => r.path).join(", ")}`.slice(0, 120));
}

// ------------------------------------------------------------------ Tabs and editor
function renderTabs(): void {
    tabsEl.innerHTML = tabs
        .map((path) => {
            const name = path.split("/").pop()!;
            const dirty = pendingSaves.has(path);
            return `<div class="tab${path === active ? " active" : ""}" role="tab" aria-selected="${path === active}" data-path="${escapeHtml(path)}" title="${escapeHtml(path)}">
                <span class="ficon" data-ext="${escapeHtml(name.split(".").pop() ?? "")}">${fileIcon(name)}</span>
                <span>${escapeHtml(name)}</span>
                <button class="tab-x${dirty ? " dirty" : ""}" type="button" aria-label="Close">×</button></div>`;
        })
        .join("");
}

tabsEl.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const tab = target.closest<HTMLElement>(".tab");
    if (!tab) return;
    if (target.closest(".tab-x")) closeTab(tab.dataset.path!);
    else openFile(tab.dataset.path!);
});
tabsEl.addEventListener("auxclick", (event) => {
    const tab = (event.target as HTMLElement).closest<HTMLElement>(".tab");
    if (tab && event.button === 1) closeTab(tab.dataset.path!);
});

function closeTab(path: string, show = true): void {
    const index = tabs.indexOf(path);
    if (index < 0) return;
    tabs.splice(index, 1);
    if (active === path) active = tabs[Math.min(index, tabs.length - 1)];
    persistTabs();
    if (!show) return;
    renderTabs();
    renderTree();
    if (active) showFile(active);
    else showEmptyEditor();
}

function openFile(path: string): void {
    if (!files.has(path)) return;
    if (!tabs.includes(path)) tabs.push(path);
    showFile(path);
    persistTabs();
}

function showEmptyEditor(): void {
    active = undefined;
    editor?.setModel(null);
    assetView.hidden = false;
    editorHost.hidden = true;
    assetView.innerHTML = `<div class="asset-empty">${capySVG({ pose: "sleep" })}<p>${escapeHtml(t("ide.shortcuts"))}</p></div>`;
    renderTabs();
}

function showFile(path: string): void {
    const open = files.get(path);
    if (!open) return;
    if (active && active !== path && editor) {
        const current = files.get(active);
        if (current?.model && editor.getModel() === current.model) current.view = editor.saveViewState();
    }
    active = path;
    renderTabs();
    tree.querySelectorAll(".tree-row.file").forEach((row) =>
        row.classList.toggle("active", (row as HTMLElement).dataset.file === path),
    );
    const record = open.record;
    if (record.text !== undefined && mon && editor) {
        assetView.hidden = true;
        editorHost.hidden = false;
        if (!open.model || open.model.isDisposed()) {
            const uri = mon.uriFor(path);
            mon.monaco.editor.getModel(uri)?.dispose();
            open.model = mon.monaco.editor.createModel(record.text, mon.languageFor(path), uri);
            open.model.onDidChangeContent(() => {
                scheduleSave(path);
                renderTabs();
            });
        }
        editor.setModel(open.model);
        if (open.view) editor.restoreViewState(open.view);
        editor.focus();
    } else if (record.text !== undefined) {
        // Monaco still loading: show the text read-only for a moment
        assetView.hidden = false;
        editorHost.hidden = true;
        assetView.innerHTML = `<pre class="asset-text">${escapeHtml(record.text)}</pre>`;
    } else {
        showAsset(record);
    }
}

let assetUrl: string | undefined;
function showAsset(record: FileRecord): void {
    editor?.setModel(null);
    editorHost.hidden = true;
    assetView.hidden = false;
    if (assetUrl) URL.revokeObjectURL(assetUrl);
    assetUrl = record.blob ? URL.createObjectURL(record.blob) : undefined;
    const usePath = `./${record.path}`;
    let preview = `<p class="asset-note">${escapeHtml(t("ide.preview.other"))}</p>`;
    if (record.type.startsWith("image/") && assetUrl) {
        preview = `<div class="asset-image"><img src="${assetUrl}" alt="" id="asset-img"/></div><p class="asset-dims" id="asset-dims"></p>`;
    } else if (record.type.startsWith("audio/") && assetUrl) {
        preview = `<audio controls src="${assetUrl}"></audio>`;
    }
    assetView.innerHTML = `
      <div class="asset-card">
        <div class="asset-head"><span class="ficon big">${fileIcon(record.path)}</span><div><strong>${escapeHtml(record.path)}</strong><span>${escapeHtml(record.type)} · ${formatSize(record.size)}</span></div></div>
        ${preview}
        <div class="asset-use"><span>${escapeHtml(t("ide.usePath"))}</span><code>"${escapeHtml(usePath)}"</code><button class="text-btn" type="button" id="copy-path">${escapeHtml(t("ide.copyPath"))}</button></div>
      </div>`;
    const img = document.getElementById("asset-img") as HTMLImageElement | null;
    img?.addEventListener("load", () => {
        $("asset-dims").textContent = `${img.naturalWidth} × ${img.naturalHeight} px`;
    });
    document.getElementById("copy-path")?.addEventListener("click", () => {
        void navigator.clipboard?.writeText(`"${usePath}"`);
        toast(usePath);
    });
}

// ------------------------------------------------------------------ Running
function newRunId(): string {
    return Math.random().toString(36).slice(2, 9);
}

async function runGame(): Promise<void> {
    if (!project) return;
    await flushSaves();
    if (!swReady) await setupServiceWorker();
    if (!swReady) return;
    stopGame(false);
    clearConsole();
    runId = newRunId();
    const frame = document.createElement("iframe");
    frame.className = "game-frame";
    frame.title = project.name;
    frame.allow = "fullscreen; gamepad; autoplay";
    frame.src = `/sandbox/${encodeURIComponent(project.id)}/${runId}/index.html?lang=${getLang()}`;
    frameHost.appendChild(frame);
    iframe = frame;
    frameEmpty.hidden = true;
    frame.addEventListener("load", () => frame.contentWindow?.focus());
    stopBtn.disabled = false;
    runBtn.classList.add("running");
    $("run-dot").classList.add("on");
    logLine("system", t("ide.started"));
}

function stopGame(log = true): void {
    if (!iframe) return;
    iframe.remove();
    iframe = undefined;
    runId = "";
    frameEmpty.hidden = false;
    stopBtn.disabled = true;
    runBtn.classList.remove("running");
    $("run-dot").classList.remove("on");
    if (log) logLine("system", t("ide.stopped"));
}

runBtn.addEventListener("click", () => void runGame());
stopBtn.addEventListener("click", () => stopGame());
$("reload").addEventListener("click", () => void runGame());
$("popout").addEventListener("click", async () => {
    if (!project) return;
    await flushSaves();
    if (!swReady) await setupServiceWorker();
    window.open(`/sandbox/${encodeURIComponent(project.id)}/${newRunId()}/index.html?lang=${getLang()}`, "_blank");
});
$("fullscreen").addEventListener("click", () => {
    if (!iframe) void runGame().then(() => iframe?.requestFullscreen?.());
    else void iframe.requestFullscreen?.();
});

// ------------------------------------------------------------------ Console
let consoleCount = 0;
let errorCount = 0;
const LOCATION = /((?:[\w.-]+\/)*[\w.-]+\.(?:js|mjs|glsl|html|json)):(\d+)(?::(\d+))?/g;

function linkify(text: string): string {
    return escapeHtml(text).replace(LOCATION, (match, path: string, line: string, col: string) => {
        const clean = path.replace(/^\/+/, "");
        if (!files.has(clean)) return match;
        return `<a href="#" class="src-link" data-path="${clean}" data-line="${line}" data-col="${col ?? 1}">${match}</a>`;
    });
}

function logLine(level: string, text: string): void {
    const row = document.createElement("div");
    row.className = `log log-${level}`;
    const label = level === "uncaught" ? `<span class="log-tag">${escapeHtml(t("ide.uncaught"))}</span>` : "";
    row.innerHTML = `${label}<span class="log-text">${linkify(text)}</span>`;
    const stick = consoleEl.scrollTop + consoleEl.clientHeight >= consoleEl.scrollHeight - 30;
    consoleEl.appendChild(row);
    while (consoleEl.childElementCount > 400) consoleEl.firstElementChild?.remove();
    if (stick) consoleEl.scrollTop = consoleEl.scrollHeight;
    if (level !== "system") consoleCount++;
    if (level === "error" || level === "uncaught") errorCount++;
    const count = $("console-count");
    count.textContent = errorCount ? `${errorCount} ✕` : consoleCount ? String(consoleCount) : "";
    count.classList.toggle("err", errorCount > 0);
}

function clearConsole(): void {
    consoleEl.innerHTML = "";
    consoleCount = 0;
    errorCount = 0;
    $("console-count").textContent = "";
}
$("clear-console").addEventListener("click", clearConsole);

consoleEl.addEventListener("click", (event) => {
    const link = (event.target as HTMLElement).closest<HTMLElement>(".src-link");
    if (!link) return;
    event.preventDefault();
    openFile(link.dataset.path!);
    const line = Number(link.dataset.line);
    const column = Number(link.dataset.col) || 1;
    editor?.revealLineInCenter(line);
    editor?.setPosition({ lineNumber: line, column });
    editor?.focus();
});

window.addEventListener("message", (event) => {
    if (event.origin !== location.origin) return;
    const data = event.data as { source?: string; run?: string; level?: string; text?: string };
    if (data?.source !== "brio-sandbox" || data.run !== runId) return;
    if (data.level === "ready") return;
    logLine(data.level ?? "log", data.text ?? "");
});

// ------------------------------------------------------------------ Projects modal
const projectsModal = $<HTMLDialogElement>("projects-modal");
async function renderProjects(): Promise<void> {
    const all = await listProjects();
    $("project-list").innerHTML = all.length
        ? all
              .map(
                  (p) => `<div class="project-row${p.id === project?.id ? " current" : ""}" data-id="${p.id}">
                <button type="button" class="project-open"><strong>${escapeHtml(p.name)}</strong><span>${escapeHtml(t("ide.updated", { when: relativeTime(p.updated) }))}</span></button>
                <button type="button" class="icon-btn project-rename" data-i18n-attr="title:ide.rename" title="${escapeHtml(t("ide.rename"))}">✎</button>
                <button type="button" class="icon-btn project-delete" title="${escapeHtml(t("ide.delete"))}">🗑</button>
              </div>`,
              )
              .join("")
        : `<p class="muted">${escapeHtml(t("ide.noProjects"))}</p>`;
    const templates = [
        { id: "hello-brio", name: "Hello Brio", desc: pick({ en: "The 30-line example from the home page.", pt: "O exemplo de 30 linhas da página inicial." }), accent: "#f19a32", kind: "3D" },
        { id: "blank-2d", name: t("ide.templateBlank2d"), desc: t("ide.templateBlank2dDesc"), accent: "#8cc5bf", kind: "2D" },
        { id: "blank-3d", name: t("ide.templateBlank3d"), desc: t("ide.templateBlank3dDesc"), accent: "#7fa36a", kind: "3D" },
        ...GAMES.map((g) => ({ id: g.id, name: g.title, desc: pick(g.tagline), accent: g.accent, kind: g.kind })),
    ];
    $("template-list").innerHTML = templates
        .map(
            (tpl) => `<button type="button" class="template-card" data-template="${tpl.id}" style="--accent:${tpl.accent}">
            <span class="template-kind">${tpl.kind}</span><strong>${escapeHtml(tpl.name)}</strong><span>${escapeHtml(tpl.desc)}</span></button>`,
        )
        .join("");
}

$("project-button").addEventListener("click", async () => {
    await renderProjects();
    projectsModal.showModal();
});

$("project-list").addEventListener("click", async (event) => {
    const target = event.target as HTMLElement;
    const row = target.closest<HTMLElement>(".project-row");
    if (!row) return;
    const record = await getProject(row.dataset.id!);
    if (!record) return;
    if (target.closest(".project-delete")) {
        projectsModal.close();
        if (await confirmAsk(t("ide.confirmDeleteProject", { name: record.name }))) {
            await deleteProject(record.id);
            if (record.id === project?.id) {
                const rest = await listProjects();
                await openProject(rest[0] ?? (await createFromTemplate("hello-brio"))!);
            }
        }
        await renderProjects();
        projectsModal.showModal();
        return;
    }
    if (target.closest(".project-rename")) {
        projectsModal.close();
        const name = await ask(t("ide.promptProject"), record.name);
        if (name) {
            record.name = name;
            await putProject(record);
            if (record.id === project?.id) {
                project.name = name;
                $("project-name").textContent = name;
            }
        }
        await renderProjects();
        projectsModal.showModal();
        return;
    }
    projectsModal.close();
    await openProject(record);
});

$("template-list").addEventListener("click", async (event) => {
    const card = (event.target as HTMLElement).closest<HTMLElement>(".template-card");
    if (!card) return;
    projectsModal.close();
    const record = await createFromTemplate(card.dataset.template!);
    if (record) {
        await openProject(record);
        toast(t("ide.importDone"));
    }
});

// ------------------------------------------------------------------ More menu: export / import / reset
const moreMenu = $("more-menu");
$("more").addEventListener("click", () => (moreMenu.hidden = !moreMenu.hidden));
moreMenu.addEventListener("click", async (event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>("[data-action]")?.dataset.action;
    if (!action) return;
    moreMenu.hidden = true;
    if (action === "export") await exportZip();
    if (action === "import") $("zip-input").click();
    if (action === "reset") await resetProject();
});

async function exportZip(): Promise<void> {
    if (!project) return;
    await flushSaves();
    const encoder = new TextEncoder();
    const entries = await Promise.all(
        [...files.values()].map(async ({ record }) => ({
            path: record.path,
            data: record.blob ? new Uint8Array(await record.blob.arrayBuffer()) : encoder.encode(record.text ?? ""),
        })),
    );
    const blob = writeZip(entries);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${project.name.replace(/[^\w-]+/g, "-").toLowerCase() || "brio-project"}.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast(t("ide.exported"));
}

$<HTMLInputElement>("zip-input").addEventListener("change", async (event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
        let entries = await readZip(file);
        // Drop a single shared top folder (zips made from a folder)
        const tops = new Set(entries.map((e) => e.path.split("/")[0]));
        if (tops.size === 1 && entries.every((e) => e.path.includes("/"))) {
            entries = entries.map((e) => ({ ...e, path: e.path.split("/").slice(1).join("/") }));
        }
        const id = newId();
        const decoder = new TextDecoder();
        const records = entries
            .filter((e) => e.path && !e.path.startsWith("__MACOSX"))
            .map((e) =>
                isTextPath(e.path)
                    ? makeTextFile(id, e.path, decoder.decode(e.data))
                    : makeBlobFile(id, e.path, new Blob([e.data as BlobPart], { type: mimeFor(e.path) })),
            );
        const record: ProjectRecord = {
            id,
            name: file.name.replace(/\.zip$/i, ""),
            created: Date.now(),
            updated: Date.now(),
        };
        await putFiles(records);
        await putProject(record);
        await openProject(record);
    } catch (error) {
        logLine("error", String(error));
    }
});

async function resetProject(): Promise<void> {
    if (!project?.template) return;
    if (!(await confirmAsk(t("ide.confirmReset")))) return;
    const records = await templateFiles(project.template, project.id);
    if (!records) return;
    pendingSaves.clear();
    await replaceAllFiles(project.id, records);
    project.tabs = ["main.js"];
    project.active = "main.js";
    await openProject(project);
}

// ------------------------------------------------------------------ Snippets
const snippetsMenu = $("snippets-menu");
function renderSnippets(): void {
    snippetsMenu.innerHTML = SNIPPETS.map((s) => `<button type="button" role="menuitem" data-snippet="${s.id}">${escapeHtml(pick(s.label))}</button>`).join("");
}
renderSnippets();
onLangChange(renderSnippets);
$("snippets-btn").addEventListener("click", () => (snippetsMenu.hidden = !snippetsMenu.hidden));
snippetsMenu.addEventListener("click", (event) => {
    const id = (event.target as HTMLElement).closest<HTMLElement>("[data-snippet]")?.dataset.snippet;
    const snippet = SNIPPETS.find((s) => s.id === id);
    snippetsMenu.hidden = true;
    if (!snippet || !editor || !mon) return;
    const model = editor.getModel();
    if (!model) return;
    const position = editor.getPosition() ?? { lineNumber: model.getLineCount(), column: 1 };
    const line = position.lineNumber;
    const range = new mon.monaco.Range(line, 1, line, 1);
    editor.executeEdits("snippet", [{ range, text: snippet.code, forceMoveMarkers: true }]);
    editor.revealLineInCenter(line);
    editor.focus();
    toast(t("ide.snippetHint"));
});
document.addEventListener("pointerdown", (e) => {
    if (!snippetsMenu.hidden && !snippetsMenu.contains(e.target as Node) && !$("snippets-btn").contains(e.target as Node)) snippetsMenu.hidden = true;
});

// ------------------------------------------------------------------ Uploads and drag and drop
$("new-file").addEventListener("click", () => void newFile());
$("new-folder").addEventListener("click", () => void newFolder());
$("upload").addEventListener("click", () => $("file-input").click());
$<HTMLInputElement>("file-input").addEventListener("change", (event) => {
    const input = event.target as HTMLInputElement;
    const list = [...(input.files ?? [])].map((file) => ({ path: defaultAssetPath(file.name), file }));
    input.value = "";
    void addBlobs(list);
});

function defaultAssetPath(name: string): string {
    return isTextPath(name) && /\.(js|mjs|html|css|json|glsl)$/i.test(name) ? name : `assets/${name}`;
}

const overlay = $("drop-overlay");
let dragDepth = 0;
window.addEventListener("dragenter", (e) => {
    if (!e.dataTransfer?.types.includes("Files")) return;
    dragDepth++;
    overlay.hidden = false;
});
window.addEventListener("dragleave", () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) overlay.hidden = true;
});
window.addEventListener("dragover", (e) => {
    if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
});
window.addEventListener("drop", async (e) => {
    if (!e.dataTransfer?.types.includes("Files")) return;
    e.preventDefault();
    dragDepth = 0;
    overlay.hidden = true;
    const targetRow = (e.target as HTMLElement).closest?.<HTMLElement>(".tree-row");
    const folder = targetRow?.dataset.folder ?? (targetRow?.dataset.file ? targetRow.dataset.file.split("/").slice(0, -1).join("/") : undefined);
    const entries: { path: string; file: Blob }[] = [];
    const items = [...e.dataTransfer.items];
    const walk = async (entry: FileSystemEntry, prefix: string): Promise<void> => {
        if (entry.isFile) {
            const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
            entries.push({ path: prefix + file.name, file });
        } else if (entry.isDirectory) {
            const reader = (entry as FileSystemDirectoryEntry).createReader();
            const children = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
            for (const child of children) await walk(child, `${prefix}${entry.name}/`);
        }
    };
    const fsEntries = items.map((item) => item.webkitGetAsEntry?.()).filter(Boolean) as FileSystemEntry[];
    if (fsEntries.length) {
        for (const entry of fsEntries) {
            const base = folder !== undefined ? `${folder}/` : entry.isDirectory ? "" : "";
            await walk(entry, base);
        }
        if (folder === undefined) {
            for (const item of entries) if (!item.path.includes("/")) item.path = defaultAssetPath(item.path);
        }
    } else {
        for (const file of e.dataTransfer.files) entries.push({ path: folder !== undefined ? `${folder}/${file.name}` : defaultAssetPath(file.name), file });
    }
    await addBlobs(entries);
});

// ------------------------------------------------------------------ Resizable panels
const main = $("ide-main");
const sizes = { left: 230, right: 520, console: 200 };
try {
    Object.assign(sizes, JSON.parse(localStorage.getItem("brio.panels") ?? "{}"));
} catch {
    /* ignore */
}
function applySizes(): void {
    main.style.setProperty("--left", `${sizes.left}px`);
    main.style.setProperty("--right", `${sizes.right}px`);
    main.style.setProperty("--console", `${sizes.console}px`);
}
applySizes();
document.querySelectorAll<HTMLElement>(".gutter").forEach((gutter) => {
    gutter.addEventListener("pointerdown", (down) => {
        down.preventDefault();
        const kind = gutter.dataset.resize as "left" | "right" | "console";
        const start = { x: down.clientX, y: down.clientY, ...sizes };
        gutter.setPointerCapture(down.pointerId);
        document.body.classList.add("resizing", kind === "console" ? "resizing-v" : "resizing-h");
        const move = (e: PointerEvent) => {
            if (kind === "left") sizes.left = Math.max(150, Math.min(420, start.left + e.clientX - start.x));
            if (kind === "right") sizes.right = Math.max(280, Math.min(innerWidth - 420, start.right - (e.clientX - start.x)));
            if (kind === "console") sizes.console = Math.max(60, Math.min(innerHeight - 220, start.console - (e.clientY - start.y)));
            applySizes();
        };
        const up = () => {
            gutter.removeEventListener("pointermove", move);
            gutter.removeEventListener("pointerup", up);
            document.body.classList.remove("resizing", "resizing-v", "resizing-h");
            try {
                localStorage.setItem("brio.panels", JSON.stringify(sizes));
            } catch {
                /* ignore */
            }
        };
        gutter.addEventListener("pointermove", move);
        gutter.addEventListener("pointerup", up);
    });
});

// ------------------------------------------------------------------ Keyboard
window.addEventListener("keydown", (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === "Enter") {
        e.preventDefault();
        void runGame();
    } else if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void flushSaves().then(() => {
            if (autorun.checked) void runGame();
        });
    } else if (mod && e.key.toLowerCase() === "p" && !e.shiftKey) {
        e.preventDefault();
        (tree.querySelector(".tree-row.active") as HTMLElement | null)?.focus() ??
            (tree.querySelector(".tree-row") as HTMLElement | null)?.focus();
    }
});
window.addEventListener("beforeunload", () => void flushSaves());
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flushSaves();
});
onLangChange(() => {
    renderTree();
    if (active && !files.get(active)?.record.text) showFile(active);
    setStatus((statusEl.dataset.state as "saving" | "saved" | "idle") ?? "idle");
});

// ------------------------------------------------------------------ Boot
async function boot(): Promise<void> {
    logLine("system", t("ide.welcome"));
    const swPromise = setupServiceWorker();
    const monacoPromise = import("./ide/editor").then(async (m) => {
        await m.setupMonaco();
        mon = m;
        editor = m.createEditor(editorHost);
        editor.addCommand(m.monaco.KeyMod.CtrlCmd | m.monaco.KeyCode.Enter, () => void runGame());
        editor.addCommand(m.monaco.KeyMod.CtrlCmd | m.monaco.KeyCode.KeyS, () =>
            void flushSaves().then(() => {
                if (autorun.checked) void runGame();
            }),
        );
        $("editor-loading").remove();
    });

    const params = new URLSearchParams(location.search);
    const templateId = params.get("template");
    const projectId = params.get("project");
    let record: ProjectRecord | undefined;
    if (templateId) {
        // Reuse the latest copy of this template instead of piling up duplicates
        record = (await listProjects()).find((p) => p.template === templateId);
        record ??= await createFromTemplate(templateId);
    }
    if (!record && projectId) record = await getProject(projectId);
    if (!record) {
        let last: string | null = null;
        try {
            last = localStorage.getItem("brio.lastProject");
        } catch {
            /* ignore */
        }
        if (last) record = await getProject(last);
    }
    record ??= (await listProjects())[0];
    record ??= await createFromTemplate("hello-brio");
    await monacoPromise;
    if (record) await openProject(record);
    await swPromise;
    if (params.get("run") === "1" || templateId) void runGame();
}

boot().catch((error) => {
    console.error(error);
    logLine("error", String(error?.stack ?? error));
});
