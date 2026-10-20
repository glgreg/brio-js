import { BrioGame, BrioCamera3D, BrioModel, BrioMath } from "../../dist/index.js";

const VIEW_W = 960;
const VIEW_H = 540;
const MODEL_URL = "../../assets/3d/glb/harry_potter_-_malfoy_draconia_3d_model__dl.glb";
/** Frame-time samples kept for the average / max telemetry. */
const FRAME_SAMPLES = 60;
/** `?backend=canvas2d` forces the software rasterizer, for side-by-side comparison with WebGL2. */
const REQUESTED_BACKEND = new URLSearchParams(location.search).get("backend") ?? "auto";

/** Flat per-part tints (palette mode), and the fallback for textured mode on the Canvas2D backend. */
const PART_PALETTE = {
    Clothes: "#475569",
    Face: "#fcd9b6",
    Hair: "#f1e7c4",
};
const PART_CHECKBOX = {
    Clothes: "chk_part_clothes",
    Face: "chk_part_face",
    Hair: "chk_part_hair",
};

const VIEWS = {
    full: { target: { x: 0, y: 0.8, z: 0 }, distance: 2.6, height: 1.1, name: "Full Body" },
    face: { target: { x: 0, y: 1.47, z: 0 }, distance: 0.75, height: 1.52, name: "Face Close-up" },
};

// -------------------------------------------------------------
// DOM references
// -------------------------------------------------------------
const container = document.getElementById("canvas_container");
const fpsDisplay = document.getElementById("fps_display");
const backendDisplay = document.getElementById("backend_display");
const loadStatus = document.getElementById("load_status");
const camInfo = document.getElementById("cam_info");
const statAssets = document.getElementById("stat_assets");
const statTris = document.getElementById("stat_tris");
const statLoad = document.getElementById("stat_load");
const statFrame = document.getElementById("stat_frame");
const statPasses = document.getElementById("stat_passes");
const statBbox = document.getElementById("stat_bbox");
const statDraws = document.getElementById("stat_draws");
const backendLink = document.getElementById("backend_link");
const logOutput = document.getElementById("log_output");
const chkOrbit = document.getElementById("chk_orbit");

function logEvent(message, type = "info") {
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement("div");
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${time}] ${message}`;
    logOutput.appendChild(entry);
    logOutput.scrollTop = logOutput.scrollHeight;
    console.log(`[BrioGLB:${type.toUpperCase()}] ${message}`);
}

// -------------------------------------------------------------
// Game setup
// -------------------------------------------------------------
const game = new BrioGame({
    width: VIEW_W,
    height: VIEW_H,
    container,
    dimension: "3d",
    maxEntities: 64,
    renderBackend: REQUESTED_BACKEND,
});
game.background.color = "#030712";
game.rendering.mode = "smooth";
game.debugging.console.enabled = true;

const camera = new BrioCamera3D("cam_main", {
    fov: BrioMath.degToRad(40),
    near: 0.05,
    far: 100,
    position: { x: 0, y: VIEWS.full.height, z: VIEWS.full.distance },
    target: VIEWS.full.target,
    clearColor: "#0b1220",
});

const malfoyModel = new BrioModel("mod_malfoy", MODEL_URL);
let root = null;
let shadingMode = "textured";
/** Material state decoded from the GLB (color + baseColorTexture), restored by textured mode. */
const originalMaterials = new Map();
let activeView = VIEWS.full;
let orbitAngle = 0;
let loadMs = 0;
let checkpointTaken = false;
const frameTimes = [];

const loadStart = performance.now();
game.preload(() => [malfoyModel]);

game.load((assets) => {
    loadMs = performance.now() - loadStart;
    root = assets.instantiateModel("mod_malfoy", "obj_malfoy");
    return [camera, root];
});

// -------------------------------------------------------------
// Shading, visibility, and camera helpers
// -------------------------------------------------------------
function isSoftwareBackend() {
    return game.renderBackend?.backendType === "canvas2d";
}

function applyShading(mode) {
    shadingMode = mode;
    // The Canvas2D rasterizer does not sample textures: textured mode shows the palette there
    const textured = mode === "textured" && !isSoftwareBackend();
    for (const mat of game.loadedMaterials.values()) {
        const original = originalMaterials.get(mat.name);
        mat.wireframe = mode === "wire";
        mat.shading = mode === "wire" ? "unlit" : "lambert";
        mat.texture = textured ? original?.texture : undefined;
        mat.color = textured
            ? (original?.color ?? "#ffffff")
            : mode === "clay"
              ? "#cbd5e1"
              : mode === "wire"
                ? "#38bdf8"
                : (PART_PALETTE[mat.name] ?? "#ffffff");
    }
    logEvent(`Shading mode: ${mode}.`, "info");
    if (mode === "textured" && !textured) {
        logEvent("Canvas2D backend does not sample textures; showing the palette instead.", "warn");
    }
}

function visibleTriangles() {
    let total = 0;
    for (const part of root.children) {
        if (!part.transform.visibility) continue;
        total += game.loadedMeshes.get(part.mesh)?.triangleCount ?? 0;
    }
    return total;
}

function setView(view) {
    activeView = view;
    logEvent(`Camera view: ${view.name}.`, "info");
}

function updateCamera(dt) {
    if (chkOrbit.checked) orbitAngle += dt * 0.6;
    const { target, distance, height } = activeView;
    camera.position = {
        x: target.x + Math.sin(orbitAngle) * distance,
        y: height,
        z: target.z + Math.cos(orbitAngle) * distance,
    };
    camera.target = target;
}

function partOf(name) {
    return root.children.find((child) => child.material === name);
}

// -------------------------------------------------------------
// Update loop
// -------------------------------------------------------------
let lastFrame = performance.now();
let fpsSmoothed = 0;

game.update((updater, dt) => {
    const now = performance.now();
    const frameMs = now - lastFrame;
    lastFrame = now;
    if (frameMs > 0)
        fpsSmoothed =
            fpsSmoothed === 0 ? 1000 / frameMs : BrioMath.lerp(fpsSmoothed, 1000 / frameMs, 0.1);

    updateCamera(dt);
});

// Measures only the compositor work (the 3D pass), independent of rAF throttling
const originalRenderFrame = game.renderFrame.bind(game);
game.renderFrame = () => {
    const t0 = performance.now();
    originalRenderFrame();
    frameTimes.push(performance.now() - t0);
    if (frameTimes.length > FRAME_SAMPLES) frameTimes.shift();
};

function refreshTelemetry() {
    if (!root) return;
    const avg = frameTimes.reduce((a, b) => a + b, 0) / Math.max(1, frameTimes.length);
    const max = frameTimes.reduce((a, b) => Math.max(a, b), 0);
    fpsDisplay.textContent = `FPS: ${fpsSmoothed.toFixed(1)}`;
    statFrame.textContent = `${avg.toFixed(1)} ms / ${max.toFixed(1)} ms`;
    const drawn = game.renderBackend?.trianglesRendered ?? 0;
    statTris.textContent = `${drawn.toLocaleString()} drawn / ${visibleTriangles().toLocaleString()}`;
    statDraws.textContent = `${game.renderBackend?.drawCalls ?? "n/a"}`;
    statPasses.textContent = `${game.renderStats.passes3D} / ${game.ecsWorld.activeCount}`;
    const p = camera.position;
    camInfo.textContent = `${activeView.name} (${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`;
}
setInterval(refreshTelemetry, 250);

game.ready().then(() => {
    if (!root || root.children.length === 0) {
        loadStatus.textContent = "Model failed to load (see console).";
        logEvent("Model has no parts. Check that the GLB exists under assets/3d/glb/.", "error");
        return;
    }
    const box = malfoyModel.boundingBox;
    const backendType = game.renderBackend?.backendType ?? "none";
    backendDisplay.textContent = `3D backend: ${backendType}`;
    backendLink.href = isSoftwareBackend() ? "?backend=auto" : "?backend=canvas2d";
    backendLink.textContent = isSoftwareBackend() ? "Switch to WebGL2" : "Switch to Canvas2D";
    for (const mat of game.loadedMaterials.values()) {
        originalMaterials.set(mat.name, { color: mat.color, texture: mat.texture });
    }
    statAssets.textContent = `${game.loadedMeshes.size} / ${game.loadedMaterials.size}`;
    statLoad.textContent = `${loadMs.toFixed(0)} ms`;
    statBbox.textContent = `${box.size.x.toFixed(2)} x ${box.size.y.toFixed(2)} x ${box.size.z.toFixed(2)}`;
    loadStatus.textContent = `Loaded ${root.children.length} parts.`;
    applyShading("textured");
    logEvent(
        `GLB loaded in ${loadMs.toFixed(0)} ms: ${root.children.map((c) => `${c.mesh} -> ${c.material}`).join(", ")}.`,
        "success",
    );
    const textured = [...originalMaterials.values()].filter((m) => m.texture).length;
    logEvent(
        `${textured} of ${originalMaterials.size} materials decoded a baseColorTexture.`,
        "info",
    );
    logEvent(`Rendering with the '${backendType}' backend.`, "info");
});

// -------------------------------------------------------------
// Controls
// -------------------------------------------------------------
document.getElementById("btn_view_full").addEventListener("click", () => setView(VIEWS.full));
document.getElementById("btn_view_face").addEventListener("click", () => setView(VIEWS.face));
document
    .getElementById("btn_mode_textured")
    .addEventListener("click", () => applyShading("textured"));
document
    .getElementById("btn_mode_palette")
    .addEventListener("click", () => applyShading("palette"));
document.getElementById("btn_mode_wire").addEventListener("click", () => applyShading("wire"));
document.getElementById("btn_mode_clay").addEventListener("click", () => applyShading("clay"));

for (const [partName, checkboxId] of Object.entries(PART_CHECKBOX)) {
    document.getElementById(checkboxId).addEventListener("change", (event) => {
        const part = partOf(partName);
        if (!part) return;
        part.transform.visibility = event.target.checked;
        logEvent(`Part ${partName} ${event.target.checked ? "shown" : "hidden"}.`, "info");
    });
}

document.getElementById("btn_checkpoint").addEventListener("click", () => {
    game.createCheckPoint();
    checkpointTaken = true;
    logEvent(
        `Checkpoint created (root rotation.y = ${root.transform.rotation.y.toFixed(2)}).`,
        "success",
    );
});

document.getElementById("btn_scramble").addEventListener("click", () => {
    root.transform.rotation = { x: 0, y: root.transform.rotation.y + Math.PI * 0.75, z: 0.35 };
    root.transform.scale = { x: 1.4, y: 0.6, z: 1.4 };
    root.transform.position = { x: 0.4, y: 0.2, z: 0 };
    logEvent("Root transform scrambled (rotated, squashed, and moved).", "warn");
});

document.getElementById("btn_restore").addEventListener("click", () => {
    if (!checkpointTaken) {
        logEvent("No checkpoint yet.", "warn");
        return;
    }
    game.restoreCheckPoint();
    const t = root.transform;
    logEvent(
        `Checkpoint restored: position (${t.position.x.toFixed(2)}, ${t.position.y.toFixed(2)}), scale.y ${t.scale.y.toFixed(2)}.`,
        "success",
    );
});

/** Automation hook for browser-driven checks. */
window.__brioGlbDemo = {
    game,
    camera,
    get root() {
        return root;
    },
    applyShading,
    setView: (key) => setView(VIEWS[key]),
    /** Places the orbit camera at `degrees` around the model (0 = in front, on +Z). */
    setOrbit: (degrees) => {
        orbitAngle = BrioMath.degToRad(degrees);
        updateCamera(0);
    },
    readTelemetry: () => ({
        parts: root
            ? root.children.map((c) => ({
                  mesh: c.mesh,
                  material: c.material,
                  visible: c.transform.visibility,
              }))
            : [],
        triangles: root ? visibleTriangles() : 0,
        trianglesDrawn: game.renderBackend?.trianglesRendered ?? 0,
        drawCalls: game.renderBackend?.drawCalls,
        backend: game.renderBackend?.backendType,
        texturedMaterials: [...game.loadedMaterials.values()].filter((m) => m.texture).length,
        loadMs,
        frameMsAvg: frameTimes.reduce((a, b) => a + b, 0) / Math.max(1, frameTimes.length),
        frameMsMax: frameTimes.reduce((a, b) => Math.max(a, b), 0),
        passes3D: game.renderStats.passes3D,
        ecsActive: game.ecsWorld.activeCount,
        shadingMode,
    }),
};
