// Prism Stack: a one-button stacking game in glowing glass.
// Shows: metallic-roughness ("standard") materials with neon edges written as a BrioShader, a background shader
// whose colors drift with the height of the tower, two orbiting point lights, a shadow-casting key light that
// follows the camera, AgX tone mapping, materials recolored at runtime, and pooled debris with simple physics.
import {
    BrioGame,
    BrioAudio,
    BrioAudioMixer,
    BrioCamera3D,
    BrioInputMap,
    BrioLight,
    BrioMaterial,
    BrioMesh,
    BrioObject3D,
    BrioShader,
    BrioStorage,
} from "@brio-js/core";
import * as ui from "./ui.js";

const H = 0.34; // slab height
const START = 3.2; // starting slab size
const RANGE = 4.6; // how far the moving slab slides
const PERFECT = 0.09; // tolerance for a perfect drop
const POOL = 46; // slabs kept in the scene (older ones are recycled from the bottom)
const BEST_KEY = "prism-stack.best";
// ?demo=1 stacks by itself (attract mode)
const DEMO = new URLSearchParams(location.search).has("demo");

const game = new BrioGame({
    width: innerWidth,
    height: innerHeight,
    container: document.getElementById("game"),
    dimension: "3d",
    renderBackend: "webgl2",
});
game.useFullScreen("resize");
game.useKeyboard();
game.useMouse();
game.useTouch();
game.useGamepad();
game.input
    .bind("drop", " ", "Enter", BrioInputMap.mouseButton("left"), BrioInputMap.anyTouch(), BrioInputMap.padButton("south"))
    .bind("restart", "r", "R");

// ------------------------------------------------------------------ Assets
const slabMaterials = [];
for (let i = 0; i < POOL; i++) {
    slabMaterials.push(
        new BrioMaterial(`mat_slab_${i}`, {
            shading: "standard",
            color: "#ffffff",
            roughness: 0.22,
            metalness: 0.1,
            shader: "shd_slab",
            parameters: { uCenter: [0, 0, 0], uHalf: [1, 1, 1], uEdge: [1, 1, 1], uPulse: 0 },
        }),
    );
}
const debrisMaterials = Array.from(
    { length: 12 },
    (_, i) =>
        new BrioMaterial(`mat_debris_${i}`, {
            shading: "standard",
            color: "#ffffff",
            roughness: 0.3,
            emissive: "#ffffff",
            emissiveIntensity: 0.15,
        }),
);
const notes = Array.from({ length: 12 }, (_, i) => new BrioAudio(`aud_note${i}`, `./assets/sounds/note${i}.wav`, { volume: 0.55 }));
const sounds = {
    place: new BrioAudio("aud_place", "./assets/sounds/place.wav", { volume: 0.7 }),
    chop: new BrioAudio("aud_chop", "./assets/sounds/chop.wav", { volume: 0.45 }),
    fail: new BrioAudio("aud_fail", "./assets/sounds/fail.wav", { volume: 0.6 }),
    pad: new BrioAudio("aud_pad", "./assets/sounds/pad.mp3", { bus: "bgm", volume: 0.55 }),
};

game.preload(() => [
    BrioMesh.createBox("mesh_box"),
    BrioMesh.createSphere("mesh_sky", 1, 24),
    BrioMesh.createCylinder("mesh_base", 1, 1.25, 1, 6),
    new BrioShader("shd_slab", { url: new URL("./slab.glsl", import.meta.url).href }),
    new BrioShader("shd_space", { url: new URL("./space.glsl", import.meta.url).href }),
    new BrioMaterial("mat_space", {
        shading: "unlit",
        doubleSided: true,
        shader: "shd_space",
        parameters: { uLow: "#120a2a", uHigh: "#2b1258", uAurora: "#3de0c8" },
    }),
    new BrioMaterial("mat_base", { shading: "standard", color: "#14102a", roughness: 0.25, metalness: 0.7, emissive: "#3a2a99", emissiveIntensity: 0.05 }),
    new BrioMaterial("mat_ring", { shading: "unlit", color: "#ffffff", emissive: "#ffffff", emissiveIntensity: 2, opacity: 0.9 }),
    ...slabMaterials,
    ...debrisMaterials,
    ...notes,
    ...Object.values(sounds),
]);

// ------------------------------------------------------------------ Scene
const camera = new BrioCamera3D("cam", {
    fov: 0.62,
    near: 0.5,
    far: 220,
    position: { x: 12, y: 11, z: 12 },
    target: { x: 0, y: 0, z: 0 },
    toneMapping: "neutral",
    exposure: 1.0,
});
const key = new BrioLight("key", "directional", {
    color: "#ffffff",
    intensity: 1.1,
    direction: { x: -0.4, y: -1, z: -0.25 },
    castShadow: true,
    shadow: { size: 8, distance: 40, resolution: 2048, strength: 0.55 },
});
const fill = new BrioLight("fill", "hemisphere", { color: "#7d6bff", groundColor: "#12081f", intensity: 0.3 });
const neonA = new BrioLight("neonA", "point", { color: "#ff4fa3", intensity: 22, range: 9, position: { x: 4, y: 2, z: 0 } });
const neonB = new BrioLight("neonB", "point", { color: "#3de0ff", intensity: 22, range: 9, position: { x: -4, y: 2, z: 0 } });

const sky = new BrioObject3D("sky", "mesh_sky", "mat_space");
sky.transform.scale = { x: 120, y: 120, z: 120 };
sky.castShadow = false;
sky.receiveShadow = false;
const base = new BrioObject3D("base", "mesh_base", "mat_base");
base.transform.position.y = -1.6;
base.transform.scale = { x: 2.1, y: 3.2, z: 2.1 };

const slabs = []; // { object, material, x, z, w, d, y }
const debris = [];
const rings = [];

game.load(() => {
    const objects = [];
    for (let i = 0; i < POOL; i++) {
        const object = new BrioObject3D(`slab_${i}`, "mesh_box", `mat_slab_${i}`);
        object.transform.position.y = -100;
        slabs.push({ object, material: slabMaterials[i], x: 0, z: 0, w: START, d: START, y: -100, level: -1 });
        objects.push(object);
    }
    for (let i = 0; i < debrisMaterials.length; i++) {
        const object = new BrioObject3D(`debris_${i}`, "mesh_box", `mat_debris_${i}`);
        object.transform.position.y = -100;
        debris.push({ object, material: debrisMaterials[i], vx: 0, vy: 0, vz: 0, spin: 0, life: 0 });
        objects.push(object);
    }
    for (let i = 0; i < 4; i++) {
        const object = new BrioObject3D(`ring_${i}`, "mesh_box", "mat_ring");
        object.castShadow = false;
        object.transform.position.y = -100;
        rings.push(object);
        objects.push(object);
    }
    return [camera, key, fill, neonA, neonB, sky, base, ...objects];
});

// ------------------------------------------------------------------ Colors
function hsl(h, s, l) {
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [f(0), f(8), f(4)];
}
/** Shader parameters are linear light; CSS-style colors are sRGB. */
const linear = (rgb) => rgb.map((v) => Math.pow(Math.max(0, v), 2.2));
const hex = (rgb) => `#${rgb.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0")).join("")}`;
let hueBase = 200;
const hueOf = (level) => (hueBase + level * 9) % 360;

// ------------------------------------------------------------------ State
let state = "title";
let level = 0; // slabs placed on top of the base
let current; // the moving slab
let axis = "x";
let dir = 1;
let speed = 3.2;
let combo = 0;
let ringT = 0;
let camY = 0;
let overT = 0;
let best = Number(BrioStorage.local.get(BEST_KEY) ?? 0);
const top = { x: 0, z: 0, w: START, d: START };

function slabFor(lvl) {
    return slabs[lvl % POOL];
}

function placeSlab(slab, lvl, x, z, w, d) {
    Object.assign(slab, { x, z, w, d, y: lvl * H + H / 2, level: lvl });
    const color = hsl(hueOf(lvl), 0.85, 0.5);
    slab.material.color = hex(color);
    slab.material.parameters.uEdge = linear(hsl(hueOf(lvl) + 30, 1, 0.6));
    updateSlab(slab);
}

function updateSlab(slab) {
    const t = slab.object.transform;
    t.position = { x: slab.x, y: slab.y, z: slab.z };
    t.scale = { x: slab.w, y: H, z: slab.d };
    const c = slab.material.parameters.uCenter;
    c[0] = slab.x;
    c[1] = slab.y;
    c[2] = slab.z;
    const h = slab.material.parameters.uHalf;
    h[0] = slab.w / 2;
    h[1] = H / 2;
    h[2] = slab.d / 2;
}

function reset() {
    hueBase = Math.floor(game.random.float(0, 360));
    level = 0;
    combo = 0;
    speed = 3.2;
    Object.assign(top, { x: 0, z: 0, w: START, d: START });
    for (const s of slabs) {
        s.y = -100;
        s.level = -1;
        s.object.transform.position.y = -100;
    }
    for (const d of debris) {
        d.life = 0;
        d.object.transform.position.y = -100;
    }
    ringT = 0;
    for (const r of rings) r.transform.position.y = -100;
    // The first slab rests on the base
    placeSlab(slabFor(0), 0, 0, 0, START, START);
    level = 1;
    spawnMoving();
}

function spawnMoving() {
    axis = level % 2 ? "x" : "z";
    dir = 1;
    current = slabFor(level);
    const start = -RANGE;
    placeSlab(current, level, axis === "x" ? start : top.x, axis === "z" ? start : top.z, top.w, top.d);
}

function drop() {
    const prev = axis === "x" ? top.x : top.z;
    const pos = axis === "x" ? current.x : current.z;
    const size = axis === "x" ? top.w : top.d;
    let delta = pos - prev;
    if (Math.abs(delta) <= PERFECT) {
        // Perfect: snap into place and play the next note of the scale
        delta = 0;
        if (axis === "x") current.x = top.x;
        else current.z = top.z;
        notes[Math.min(combo, notes.length - 1)].play();
        combo++;
        ringT = 0.001;
        if (combo >= 4) {
            // A streak grows the slab back a little
            const grow = 0.14;
            if (axis === "x") current.w = Math.min(START, current.w + grow);
            else current.d = Math.min(START, current.d + grow);
        }
        ui.perfect(combo);
    } else {
        combo = 0;
        const overlap = size - Math.abs(delta);
        if (overlap <= 0) {
            // Missed completely: the slab falls
            fall(current.x, current.y, current.z, current.w, current.d, current.material.color);
            current.object.transform.position.y = -100;
            current.y = -100;
            gameOver();
            return;
        }
        // Cut the part hanging over the edge and let it fall
        const sign = Math.sign(delta);
        if (axis === "x") {
            const cutW = Math.abs(delta);
            current.w = overlap;
            current.x = top.x + delta / 2;
            fall(current.x + sign * (overlap / 2 + cutW / 2), current.y, current.z, cutW, current.d, current.material.color);
        } else {
            const cutD = Math.abs(delta);
            current.d = overlap;
            current.z = top.z + delta / 2;
            fall(current.x, current.y, current.z + sign * (overlap / 2 + cutD / 2), current.w, cutD, current.material.color);
        }
        sounds.chop.play();
    }
    sounds.place.play();
    updateSlab(current);
    Object.assign(top, { x: current.x, z: current.z, w: current.w, d: current.d });
    level++;
    speed = Math.min(9, 3.2 + level * 0.09);
    ui.score(level - 1);
    if ((level - 1) % 10 === 0) ui.milestone(level - 1);
    spawnMoving();
}

function fall(x, y, z, w, d, color) {
    const piece = debris.find((p) => p.life <= 0) ?? debris[0];
    piece.life = 3;
    piece.vx = 0;
    piece.vy = 0;
    piece.vz = 0;
    piece.spin = (game.random.float(0, 1) < 0.5 ? -1 : 1) * game.random.float(1, 2.5);
    piece.material.color = color;
    piece.material.emissive = color;
    const t = piece.object.transform;
    t.position = { x, y, z };
    t.scale = { x: w, y: H, z: d };
    t.rotation = { x: 0, y: 0, z: 0 };
    piece.axis = axis;
}

function gameOver() {
    state = "over";
    overT = 0;
    sounds.fail.play();
    const score = level - 1;
    const record = score > best;
    if (record) {
        best = score;
        BrioStorage.local.set(BEST_KEY, best);
    }
    ui.over(score, best, record);
}

function start() {
    reset();
    state = "play";
    ui.play(best);
    ui.score(0);
    sounds.pad.stop();
    sounds.pad.playLoop();
}

// ------------------------------------------------------------------ Frame
game.update((_updater, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const input = game.input;
    let pressed = input.isPressed("drop") || ui.consumeTap();
    if (DEMO) {
        // Attract mode: drop close to the slab below, missing a little now and then
        if (state !== "play") pressed = state === "title" || overT > 3;
        else {
            const delta = (axis === "x" ? current.x - top.x : current.z - top.z) + Math.sin(level * 12.9898) * 0.25;
            pressed = Math.abs(delta) < 0.06;
        }
    }

    if (state === "title") {
        if (pressed) start();
    } else if (state === "over") {
        overT += dt;
        if ((pressed || input.isPressed("restart")) && overT > 0.6) start();
    } else {
        // Slide the current slab back and forth
        const p = axis === "x" ? "x" : "z";
        current[p] += dir * speed * dt;
        if (current[p] > RANGE) {
            current[p] = RANGE;
            dir = -1;
        } else if (current[p] < -RANGE) {
            current[p] = -RANGE;
            dir = 1;
        }
        updateSlab(current);
        if (pressed) drop();
        else if (input.isPressed("restart")) start();
    }

    // Debris tumbles away
    for (const piece of debris) {
        if (piece.life <= 0) continue;
        piece.life -= dt;
        piece.vy -= 18 * dt;
        const t = piece.object.transform;
        t.position.y += piece.vy * dt;
        if (piece.axis === "x") t.rotation.z += piece.spin * dt;
        else t.rotation.x += piece.spin * dt;
        if (piece.life <= 0) t.position.y = -100;
    }

    // Perfect ring: four glowing bars that expand around the top slab
    if (ringT > 0) {
        ringT += dt;
        const k = ringT / 0.45;
        const grow = 1 + k * 0.5;
        const w = top.w * grow + 0.1;
        const d = top.d * grow + 0.1;
        const y = (level - 1) * H + 0.02;
        const thick = 0.07 * (1 - k);
        const bars = [
            [top.x, top.z + d / 2, w, thick],
            [top.x, top.z - d / 2, w, thick],
            [top.x + w / 2, top.z, thick, d],
            [top.x - w / 2, top.z, thick, d],
        ];
        bars.forEach(([x, z, sx, sz], i) => {
            rings[i].transform.position = { x, y, z };
            rings[i].transform.scale = { x: sx, y: 0.03, z: sz };
        });
        if (k >= 1) {
            ringT = 0;
            for (const r of rings) r.transform.position.y = -100;
        }
    }

    // Pulse the edges of the newest slabs after a perfect drop
    for (const s of slabs) {
        if (s.level < 0) continue;
        const age = level - 1 - s.level;
        s.material.parameters.uPulse = combo > 0 && age >= 0 && age < combo ? Math.max(0, 0.6 - age * 0.12) * (0.6 + 0.4 * Math.sin(game.time * 8)) : 0;
    }

    // Camera rises with the tower; at game over it pulls back to show the whole thing
    const height = Math.max(0, level - 1) * H;
    const targetY = state === "over" ? height * 0.5 : height;
    camY += (targetY - camY) * Math.min(1, dt * 3);
    const zoom = state === "over" ? Math.max(1, height / 5) : state === "title" ? 1.15 : 1;
    const orbit = state === "title" ? game.time * 0.25 : 0.785;
    const dist = 15 * zoom;
    camera.position = { x: Math.sin(orbit) * dist, y: camY + 10 * zoom, z: Math.cos(orbit) * dist };
    camera.target = { x: 0, y: camY - 0.6, z: 0 };
    sky.transform.position = { x: camera.position.x, y: camera.position.y, z: camera.position.z };

    // Neon lights circle the top of the tower
    const a = game.time * 0.8;
    neonA.position = { x: Math.cos(a) * 4.5, y: camY + 1.2, z: Math.sin(a) * 4.5 };
    neonB.position = { x: Math.cos(a + Math.PI) * 4.5, y: camY + 0.4, z: Math.sin(a + Math.PI) * 4.5 };

    // The sky shifts color as you climb
    const hue = hueOf(level);
    const mat = game.loadedMaterials.get("mat_space");
    if (mat) {
        mat.parameters.uLow = linear(hsl(hue + 200, 0.7, 0.1));
        mat.parameters.uHigh = linear(hsl(hue + 240, 0.65, 0.3));
        mat.parameters.uAurora = linear(hsl(hue + 140, 0.95, 0.6));
    }
});

game.ready().then(() => {
    reset();
    ui.title(best);
    if (game.renderBackend?.backendType !== "webgl2") ui.noWebGL();
});

// ?mute=1 silences the game (used by the live previews of the gallery)
if (new URLSearchParams(location.search).has("mute")) BrioAudioMixer.mute("master", true);

window.brioGame = game;
