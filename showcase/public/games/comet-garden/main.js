// Comet Garden: a gravity golf puzzle printed like a risograph poster.
// Pull back on the comet and let go: planets bend its path, rocks stop it, and reaching the flower makes it bloom.
// Shows: a flat 2D look built from one BrioShader (no textures at all), an orthographic BrioCamera3D that fits a
// fixed design size to any window, pointer input mapped to world space, a trajectory preview that runs the same
// physics ahead of time, pooled objects and BrioStorage for progress.
import { BrioGame, BrioAudio, BrioAudioMixer, BrioCamera3D, BrioMaterial, BrioMesh, BrioObject3D, BrioShader, BrioStorage } from "@brio-js/core";
import { LEVELS } from "./levels.js";
import { t } from "./strings.js";
import * as ui from "./ui.js";

const W = 960;
const H = 540;
const G = 2.6e6; // gravity strength
const COMET_R = 9;
const MAX_PULL = 170;
const LAUNCH = 3.1;
const PROGRESS_KEY = "comet-garden.progress";

// Inks (sRGB hex), passed to the shader as linear colors
const INK = {
    pink: "#ff48b0",
    blue: "#0078bf",
    yellow: "#ffe800",
    green: "#00a95c",
    orange: "#ff6c2f",
    purple: "#765ba7",
    teal: "#00838a",
};
const PAIRS = [
    ["blue", "pink"],
    ["green", "blue"],
    ["orange", "blue"],
    ["teal", "pink"],
    ["pink", "yellow"],
];
const lin = (hex) => [1, 3, 5].map((i) => Math.pow(parseInt(hex.slice(i, i + 2), 16) / 255, 2.2));

const game = new BrioGame({
    width: innerWidth,
    height: innerHeight,
    container: document.getElementById("game"),
    dimension: "3d",
    renderBackend: "webgl2",
});
game.useFullScreen("resize");
game.useKeyboard();
game.input.bind("reset", "r", "R").bind("next", "Enter", " ", "n", "N").bind("prev", "p", "P");

// ------------------------------------------------------------------ Materials
const materials = [];
function riso(name, kind, ink = "blue", ink2 = "pink", seed = 0) {
    const m = new BrioMaterial(name, {
        shading: "unlit",
        alphaCutoff: 0.5,
        doubleSided: true,
        shader: "shd_riso",
        parameters: { uKind: kind, uInk: lin(INK[ink]), uInk2: lin(INK[ink2]), uSeed: seed, uOpen: 0 },
    });
    materials.push(m);
    return m;
}
riso("mat_paper", 0, "yellow", "blue");
riso("mat_comet", 2, "yellow", "pink");
riso("mat_flower", 3, "pink", "yellow");
riso("mat_star", 4, "yellow", "blue");
riso("mat_dot", 5, "blue", "blue");
riso("mat_trail", 8, "pink", "pink");
riso("mat_debris", 5, "orange", "orange");
riso("mat_rock", 6, "blue", "purple", 0.3);
for (let i = 0; i < 6; i++) riso(`mat_planet_${i}`, 1, "blue", "pink", i * 0.37);
for (let i = 0; i < 6; i++) riso(`mat_ring_${i}`, 7, "blue", "blue");

const sounds = {
    launch: new BrioAudio("aud_launch", "./assets/sounds/launch.wav", { volume: 0.6 }),
    crash: new BrioAudio("aud_crash", "./assets/sounds/crash.wav", { volume: 0.7 }),
    bloom: new BrioAudio("aud_bloom", "./assets/sounds/bloom.wav", { volume: 0.7 }),
    stars: Array.from({ length: 6 }, (_, i) => new BrioAudio(`aud_star${i}`, `./assets/sounds/star${i}.wav`, { volume: 0.6 })),
    music: new BrioAudio("aud_music", "./assets/sounds/amb.mp3", { bus: "bgm", volume: 0.6 }),
};

const QUAD = "mesh_quad";
function quadMesh() {
    const positions = new Float32Array([-0.5, 0.5, 0, 0.5, 0.5, 0, 0.5, -0.5, 0, -0.5, -0.5, 0]);
    const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
    const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
    return new BrioMesh(QUAD, positions, normals, uvs, new Uint16Array([0, 3, 2, 0, 2, 1]));
}

game.preload(() => [
    quadMesh(),
    new BrioShader("shd_riso", { url: new URL("./riso.glsl", import.meta.url).href }),
    ...materials,
    sounds.launch,
    sounds.crash,
    sounds.bloom,
    sounds.music,
    ...sounds.stars,
]);

// ------------------------------------------------------------------ Objects (pooled)
const camera = new BrioCamera3D("cam", {
    projection: "orthographic",
    orthoSize: H / 2,
    position: { x: 0, y: 0, z: 100 },
    near: 1,
    far: 300,
    clearColor: "#f2e9d6",
});
function quad(name, material, size, z) {
    const o = new BrioObject3D(name, QUAD, material);
    o.transform.scale = { x: size, y: size, z: 1 };
    o.transform.position = { x: 0, y: -5000, z };
    o.castShadow = false;
    o.receiveShadow = false;
    return o;
}
const paper = quad("paper", "mat_paper", 1, 0);
const comet = quad("comet", "mat_comet", COMET_R * 3, 6);
const flower = quad("flower", "mat_flower", 84, 3);
const planets = Array.from({ length: 6 }, (_, i) => ({ object: quad(`planet_${i}`, `mat_planet_${i}`, 1, 2), ring: quad(`ring_${i}`, `mat_ring_${i}`, 1, 1) }));
const rocks = Array.from({ length: 6 }, (_, i) => quad(`rock_${i}`, "mat_rock", 1, 2.5));
const stars = Array.from({ length: 3 }, (_, i) => quad(`star_${i}`, "mat_star", 34, 4));
const dots = Array.from({ length: 32 }, (_, i) => quad(`dot_${i}`, "mat_dot", 6, 5));
const trail = Array.from({ length: 16 }, (_, i) => quad(`trail_${i}`, "mat_trail", 1, 5.5));
const debris = Array.from({ length: 14 }, (_, i) => ({ object: quad(`debris_${i}`, "mat_debris", 7, 5.6), vx: 0, vy: 0, life: 0 }));

game.load(() => [
    camera,
    paper,
    comet,
    flower,
    ...planets.flatMap((p) => [p.object, p.ring]),
    ...rocks,
    ...stars,
    ...dots,
    ...trail,
    ...debris.map((d) => d.object),
]);

// ------------------------------------------------------------------ State
let levelIndex = 0;
let level;
let bodies = []; // { x, y, r, mass, object, ring }
let rockList = [];
let starList = [];
let state = "aim"; // aim | fly | crash | won | done
let shots = 0;
let collected = 0;
let cx = 0;
let cy = 0;
let vx = 0;
let vy = 0;
let pulling = false;
let pullX = 0;
let pullY = 0;
let stateT = 0;
let bloom = 0;
const history = [];
let progress = { reached: 0, best: {} };
try {
    progress = { ...progress, ...JSON.parse(BrioStorage.local.get(PROGRESS_KEY) ?? "{}") };
} catch {
    // corrupt or blocked storage: start fresh
}

function loadLevel(index) {
    levelIndex = (index + LEVELS.length) % LEVELS.length;
    level = LEVELS[levelIndex];
    shots = 0;
    collected = 0;
    bloom = 0;
    bodies = [];
    const list = [...level.planets];
    if (level.orbit) for (const p of level.orbit.planets) list.push({ ...p, x: 0, y: 0 });
    planets.forEach((slot, i) => {
        const p = list[i];
        if (!p) {
            slot.object.transform.position.y = -5000;
            slot.ring.transform.position.y = -5000;
            return;
        }
        const [ink, ink2] = p.ink === "dark" ? ["purple", "blue"] : PAIRS[(i + levelIndex) % PAIRS.length];
        const mat = game.loadedMaterials.get(`mat_planet_${i}`);
        mat.parameters.uInk = lin(INK[ink]);
        mat.parameters.uInk2 = lin(INK[ink2]);
        const ringMat = game.loadedMaterials.get(`mat_ring_${i}`);
        ringMat.parameters.uInk = lin(INK[ink]);
        const reach = Math.sqrt(G * p.mass / 140);
        slot.object.transform.scale = { x: p.r * 2, y: p.r * 2, z: 1 };
        slot.ring.transform.scale = { x: reach * 2, y: reach * 2, z: 1 };
        bodies.push({ ...p, object: slot.object, ring: slot.ring, orbitIndex: i - level.planets.length });
    });
    rockList = (level.rocks ?? []).map((r, i) => {
        const o = rocks[i];
        o.transform.position = { x: r.x, y: r.y, z: 2.5 };
        o.transform.scale = { x: r.r * 2, y: r.r * 2, z: 1 };
        o.transform.rotation.z = i * 1.7;
        return { ...r };
    });
    for (let i = rockList.length; i < rocks.length; i++) rocks[i].transform.position.y = -5000;
    starList = level.stars.map((s, i) => ({ ...s, taken: false, object: stars[i], pop: 0 }));
    collected = 0;
    flower.transform.position = { x: level.goal.x, y: level.goal.y, z: 3 };
    resetComet();
    positionBodies(0);
    ui.level(levelIndex, LEVELS.length, level.hint ? t(level.hint) : "");
    ui.counts(shots, collected);
}

function resetComet() {
    state = "aim";
    cx = level.start.x;
    cy = level.start.y;
    vx = 0;
    vy = 0;
    history.length = 0;
    // Stars stay collected between shots of the same level
    ui.counts(shots, collected);
}

function positionBodies(time) {
    for (const b of bodies) {
        if (b.orbitIndex >= 0 && level.orbit) {
            const o = level.orbit;
            const a = time * o.speed + (b.orbitIndex / o.planets.length) * Math.PI * 2;
            b.x = o.x + Math.cos(a) * o.radius;
            b.y = o.y + Math.sin(a) * o.radius;
        }
        b.object.transform.position = { x: b.x, y: b.y, z: 2 };
        b.ring.transform.position = { x: b.x, y: b.y, z: 1 };
    }
}

// ------------------------------------------------------------------ Physics (shared by the preview)
/** Advances a point by `dt`; returns "rock", "planet", "out" or "" */
function step(state, dt, time) {
    for (const b of bodies) {
        let bx = b.x;
        let by = b.y;
        if (b.orbitIndex >= 0 && level.orbit) {
            const o = level.orbit;
            const a = time * o.speed + (b.orbitIndex / o.planets.length) * Math.PI * 2;
            bx = o.x + Math.cos(a) * o.radius;
            by = o.y + Math.sin(a) * o.radius;
        }
        const dx = bx - state.x;
        const dy = by - state.y;
        const d2 = dx * dx + dy * dy;
        const d = Math.sqrt(d2);
        if (d < b.r + COMET_R * 0.8) return "planet";
        const acc = (G * b.mass) / Math.max(d2, b.r * b.r);
        state.vx += (dx / d) * acc * dt;
        state.vy += (dy / d) * acc * dt;
    }
    state.x += state.vx * dt;
    state.y += state.vy * dt;
    for (const r of rockList) {
        if (Math.hypot(r.x - state.x, r.y - state.y) < r.r * 0.85 + COMET_R) return "rock";
    }
    if (Math.abs(state.x) > W * 0.75 || Math.abs(state.y) > H * 0.8) return "out";
    return "";
}

// ------------------------------------------------------------------ Pointer input in world space
function toWorld(clientX, clientY) {
    const rect = game.canvas.getBoundingClientRect();
    const ortho = camera.orthoSize;
    const aspect = rect.width / rect.height;
    return {
        x: ((clientX - rect.left) / rect.width - 0.5) * 2 * ortho * aspect,
        y: (0.5 - (clientY - rect.top) / rect.height) * 2 * ortho,
    };
}
window.addEventListener("pointerdown", (e) => {
    if (e.target.closest?.("button, a, .card")) return;
    if (!musicStarted) {
        musicStarted = true;
        sounds.music.playLoop();
    }
    if (state !== "aim") return;
    const p = toWorld(e.clientX, e.clientY);
    pulling = true;
    pullX = p.x;
    pullY = p.y;
    updatePull(p);
});
window.addEventListener("pointermove", (e) => {
    if (pulling) updatePull(toWorld(e.clientX, e.clientY));
});
window.addEventListener("pointerup", () => {
    if (!pulling) return;
    pulling = false;
    const len = Math.hypot(pullX, pullY);
    hideDots();
    if (len < 12 || state !== "aim") return;
    vx = pullX * LAUNCH;
    vy = pullY * LAUNCH;
    state = "fly";
    shots++;
    ui.counts(shots, collected);
    sounds.launch.play();
    flightTime = game.time;
});
let flightTime = 0;
let musicStarted = false;
let pullTarget = { x: 0, y: 0 };
function updatePull(p) {
    // Pull back like a slingshot: the comet flies opposite to the drag
    let dx = cx - p.x;
    let dy = cy - p.y;
    const len = Math.hypot(dx, dy);
    if (len > MAX_PULL) {
        dx *= MAX_PULL / len;
        dy *= MAX_PULL / len;
    }
    pullX = dx;
    pullY = dy;
    pullTarget = p;
}

function hideDots() {
    for (const d of dots) d.transform.position.y = -5000;
}

function drawPreview() {
    const sim = { x: cx, y: cy, vx: pullX * LAUNCH, vy: pullY * LAUNCH };
    let k = 0;
    const strength = Math.hypot(pullX, pullY) / MAX_PULL;
    // One dot every ~26 units of path, so slow and fast shots both show where they curve
    let travelled = 0;
    let lx = sim.x;
    let ly = sim.y;
    for (let i = 0; i < 600 && k < dots.length; i++) {
        const hit = step(sim, 1 / 120, game.time + i / 120);
        if (hit) break;
        travelled += Math.hypot(sim.x - lx, sim.y - ly);
        lx = sim.x;
        ly = sim.y;
        if (travelled >= 26) {
            travelled = 0;
            const d = dots[k++];
            d.transform.position = { x: sim.x, y: sim.y, z: 5 };
            const s = 7 * (1 - k / dots.length) * (0.5 + strength * 0.5) + 2;
            d.transform.scale = { x: s, y: s, z: 1 };
        }
    }
    for (; k < dots.length; k++) dots[k].transform.position.y = -5000;
}

// ------------------------------------------------------------------ Frame
game.update((_u, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const input = game.input;

    // Fit the 960 x 540 design to the window
    const aspect = game.width / game.height;
    camera.orthoSize = Math.max(H / 2, W / 2 / aspect) + 18;
    paper.transform.position = { x: 0, y: 0, z: 0 };
    paper.transform.scale = { x: camera.orthoSize * 2 * aspect + 4, y: camera.orthoSize * 2 + 4, z: 1 };

    positionBodies(game.time);

    if (input.isPressed("reset") && (state === "aim" || state === "fly")) {
        resetComet();
    }
    if (state === "won" || state === "done") {
        stateT += dt;
        bloom = Math.min(1, bloom + dt * 1.5);
        if ((input.isPressed("next") || ui.consumeNext()) && stateT > 0.4) {
            ui.hideCard();
            loadLevel(state === "done" ? 0 : levelIndex + 1);
        }
    } else {
        if (input.isPressed("next") && state === "aim" && levelIndex < progress.reached) loadLevel(levelIndex + 1);
        if (input.isPressed("prev") && state === "aim") loadLevel(levelIndex - 1);
    }
    {
        const stepLevel = ui.consumeLevelStep();
        if (stepLevel && state === "aim" && (stepLevel < 0 || levelIndex < progress.reached)) loadLevel(levelIndex + stepLevel);
    }

    if (state === "fly") {
        const sim = { x: cx, y: cy, vx, vy };
        let hit = "";
        for (let i = 0; i < 4 && !hit; i++) hit = step(sim, dt / 4, game.time);
        cx = sim.x;
        cy = sim.y;
        vx = sim.vx;
        vy = sim.vy;
        history.unshift(cx, cy);
        if (history.length > trail.length * 2) history.length = trail.length * 2;
        // Stars
        for (const s of starList) {
            if (!s.taken && Math.hypot(s.x - cx, s.y - cy) < 22) {
                s.taken = true;
                sounds.stars[Math.min(collected, sounds.stars.length - 1)].play();
                collected++;
                ui.counts(shots, collected);
                burst(s.x, s.y, 6);
            }
        }
        // Goal
        if (Math.hypot(level.goal.x - cx, level.goal.y - cy) < 50) win();
        else if (hit) crash(hit);
        else if (game.time - flightTime > 12) crash("out");
    } else if (state === "crash") {
        stateT += dt;
        if (stateT > 0.9) resetComet();
    }

    // Draw comet, trail, stars, flower
    const visible = state === "aim" || state === "fly";
    comet.transform.position = visible ? { x: cx, y: cy, z: 6 } : { x: 0, y: -5000, z: 6 };
    const wobble = state === "aim" ? 1 + Math.sin(game.time * 5) * 0.06 : 1;
    comet.transform.scale = { x: COMET_R * 3 * wobble, y: COMET_R * 3 * wobble, z: 1 };
    for (let i = 0; i < trail.length; i++) {
        const o = trail[i];
        if (state === "fly" && history.length > i * 2 + 2) {
            o.transform.position = { x: history[i * 2], y: history[i * 2 + 1], z: 5.5 - i * 0.01 };
            const s = COMET_R * 1.8 * (1 - i / trail.length);
            o.transform.scale = { x: s, y: s, z: 1 };
        } else o.transform.position.y = -5000;
    }
    for (const s of starList) {
        if (s.taken) s.pop = Math.min(1, s.pop + dt * 4);
        const scale = s.taken ? 34 * (1 + s.pop) * (1 - s.pop) : 34 + Math.sin(game.time * 3 + s.x) * 3;
        s.object.transform.position = scale > 0.5 ? { x: s.x, y: s.y, z: 4 } : { x: 0, y: -5000, z: 4 };
        s.object.transform.scale = { x: scale, y: scale, z: 1 };
        s.object.transform.rotation.z = Math.sin(game.time * 2 + s.y) * 0.2;
    }
    const flowerMat = game.loadedMaterials.get("mat_flower");
    if (flowerMat) flowerMat.parameters.uOpen = state === "won" || state === "done" ? bloom : 0.15 + Math.sin(game.time * 2) * 0.08;
    const fs = 84 * (1 + bloom * 0.8);
    flower.transform.scale = { x: fs, y: fs, z: 1 };
    for (const d of debris) {
        if (d.life <= 0) continue;
        d.life -= dt;
        const tr = d.object.transform;
        tr.position.x += d.vx * dt;
        tr.position.y += d.vy * dt;
        d.vx *= 0.96;
        d.vy *= 0.96;
        const s = 8 * Math.max(0, d.life / 0.7);
        tr.scale = { x: s, y: s, z: 1 };
        if (d.life <= 0) tr.position.y = -5000;
    }
    if (pulling && state === "aim") drawPreview();
});

function burst(x, y, n, mat = "mat_debris") {
    for (let k = 0; k < n; k++) {
        const d = debris.find((q) => q.life <= 0);
        if (!d) return;
        const a = (k / n) * Math.PI * 2 + Math.random();
        const speed = 80 + Math.random() * 120;
        d.vx = Math.cos(a) * speed;
        d.vy = Math.sin(a) * speed;
        d.life = 0.7;
        d.object.material = mat;
        d.object.transform.position = { x, y, z: 5.6 };
    }
}

function crash() {
    state = "crash";
    stateT = 0;
    sounds.crash.play();
    burst(cx, cy, 10, "mat_trail");
    history.length = 0;
}

function win() {
    state = levelIndex === LEVELS.length - 1 ? "done" : "won";
    stateT = 0;
    bloom = 0;
    sounds.bloom.play();
    burst(level.goal.x, level.goal.y, 12, "mat_trail");
    const key = String(levelIndex);
    const previous = progress.best[key];
    if (!previous || collected > previous.stars || (collected === previous.stars && shots < previous.shots)) {
        progress.best[key] = { stars: collected, shots };
    }
    progress.reached = Math.max(progress.reached, Math.min(LEVELS.length - 1, levelIndex + 1));
    BrioStorage.local.set(PROGRESS_KEY, JSON.stringify(progress));
    const totalStars = Object.values(progress.best).reduce((n, b) => n + b.stars, 0);
    ui.won(state === "done", shots, collected, totalStars, LEVELS.length * 3);
}

game.ready().then(() => {
    const demo = new URLSearchParams(location.search).has("demo");
    loadLevel(demo ? 2 : Math.min(progress.reached, LEVELS.length - 1));
    if (demo) {
        // Attract mode / poster: show an aimed shot with its predicted path
        pulling = true;
        pullX = 150;
        pullY = -40;
    }
    if (game.renderBackend?.backendType !== "webgl2") ui.noWebGL();
});

// ?mute=1 silences the game (used by the live previews of the gallery)
if (new URLSearchParams(location.search).has("mute")) BrioAudioMixer.mute("master", true);

window.brioGame = game;
