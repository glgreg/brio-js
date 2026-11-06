// Araucária Run: a low-poly endless runner through a Paraná forest at sunset.
// Shows: glTF models (KayKit Forest Nature Pack) sharing one material, a procedural capybara and araucárias built
// from primitives, a directional shadow that follows the camera, linear fog, AgX tone mapping, a sky dome and a
// ground written as BrioShaders, object pools recycled as the world scrolls, and BrioStorage for the best score.
import {
    BrioGame,
    BrioAudio,
    BrioAudioMixer,
    BrioCamera3D,
    BrioInputMap,
    BrioLight,
    BrioMaterial,
    BrioMesh,
    BrioModel,
    BrioObject3D,
    BrioShader,
    BrioStorage,
} from "@brio-js/core";
import { capybaraAssets, createCapybara, animateRun } from "./capybara.js";
import { araucariaAssets, createAraucaria } from "./araucaria.js";
import * as ui from "./ui.js";

const LANE = 2.2;
const SEGMENT = 24; // ground tile length
const SEGMENTS = 7;
const VIEW = 95; // spawn obstacles this far ahead
const SUN_DIR = { x: 0.55, y: -0.42, z: 0.72 };
// ?demo=1 runs by itself (attract mode)
const DEMO = new URLSearchParams(location.search).has("demo");

const game = new BrioGame({
    width: innerWidth,
    height: innerHeight,
    container: document.getElementById("game"),
    dimension: "3d",
    renderBackend: "webgl2",
    maxEntities: 3000,
});
game.useFullScreen("resize");
game.useKeyboard();
game.useGamepad();
game.input
    .bind("left", "ArrowLeft", "a", "A", BrioInputMap.padButton("left"), BrioInputMap.padAxis(0, -1))
    .bind("right", "ArrowRight", "d", "D", BrioInputMap.padButton("right"), BrioInputMap.padAxis(0, 1))
    .bind("jump", "ArrowUp", "w", "W", " ", BrioInputMap.padButton("south"))
    .bind("roll", "ArrowDown", "s", "S", BrioInputMap.padButton("east"))
    .bind("start", "Enter", " ", BrioInputMap.padButton("start"));

// ------------------------------------------------------------------ Assets
const MODELS = {
    tree1: "Tree_1_B",
    tree2: "Tree_2_C",
    tree3: "Tree_3_B",
    pine: "Tree_4_B",
    bare: "Tree_Bare_1_B",
    bush1: "Bush_1_D",
    bush2: "Bush_2_C",
    bush3: "Bush_4_C",
    rock: "Rock_1_E",
    pebble: "Rock_2_C",
    boulder: "Rock_1_J",
    grass1: "Grass_2_B",
    grass2: "Grass_1_C",
};
const models = Object.fromEntries(
    Object.entries(MODELS).map(([key, file]) => [key, new BrioModel(`m_${key}`, `./assets/models/${file}_Color1.gltf`)]),
);

const sounds = {
    coin: new BrioAudio("aud_coin", "./assets/sounds/coin.wav", { volume: 0.35 }),
    jump: new BrioAudio("aud_jump", "./assets/sounds/jump.wav", { volume: 0.4 }),
    hurt: new BrioAudio("aud_hurt", "./assets/sounds/hurt.wav", { volume: 0.7 }),
    combo: new BrioAudio("aud_combo", "./assets/sounds/power_up.wav", { volume: 0.4 }),
    tap: new BrioAudio("aud_tap", "./assets/sounds/tap.wav", { volume: 0.4 }),
    music: new BrioAudio("aud_music", "./assets/sounds/music.mp3", { bus: "bgm", volume: 0.4 }),
};

game.preload(() => [
    ...Object.values(models),
    ...capybaraAssets(),
    ...araucariaAssets(),
    ...Object.values(sounds),
    BrioMesh.createPlane("mesh_ground", 70, SEGMENT, 8, 4),
    BrioMesh.createSphere("mesh_dome", 1, 24),
    BrioMesh.createSphere("mesh_puff", 1, 6),
    BrioMesh.createCylinder("mesh_log", 1, 1, 1, 9),
    new BrioShader("shd_sky", { url: new URL("./sky.glsl", import.meta.url).href }),
    new BrioShader("shd_ground", { url: new URL("./ground.glsl", import.meta.url).href }),
    new BrioMaterial("mat_sky", {
        shading: "unlit",
        doubleSided: true,
        shader: "shd_sky",
        parameters: { uTop: "#6a5fb8", uHorizon: "#ffbf86", uSunColor: "#fff3d1", uSunDir: [-SUN_DIR.x, -SUN_DIR.y, -SUN_DIR.z] },
    }),
    new BrioMaterial("mat_ground", {
        shading: "lambert",
        shader: "shd_ground",
        parameters: { uGrass: "#86a95a", uGrassDark: "#5e8548", uDirt: "#c99a63", uDirtDark: "#a87a4c" },
    }),
    new BrioMaterial("mat_log", { shading: "flat", color: "#7a4d2e" }),
    new BrioMaterial("mat_log_end", { shading: "flat", color: "#d8b07a" }),
    new BrioMaterial("mat_puff", { shading: "lambert", color: "#e9cfa6", opacity: 0.75 }),
    new BrioMaterial("mat_spark", { shading: "unlit", color: "#ffd27a", emissive: "#ffb347", emissiveIntensity: 1.5 }),
]);

// ------------------------------------------------------------------ Scene
const camera = new BrioCamera3D("cam", {
    fov: 0.95,
    near: 0.1,
    far: 140,
    position: { x: 0, y: 3.4, z: 7 },
    target: { x: 0, y: 1, z: -6 },
    clearColor: "#f9bd8c",
    toneMapping: "agx",
    exposure: 1.25,
    fog: { mode: "linear", color: "#f9bd8c", near: 34, far: 125 },
});
const sun = new BrioLight("sun", "directional", {
    color: "#ffd9a8",
    intensity: 2.7,
    direction: SUN_DIR,
    castShadow: true,
    shadow: { size: 16, distance: 50, resolution: 2048, strength: 0.7, normalBias: 0.05 },
});
const skyLight = new BrioLight("sky", "hemisphere", { color: "#ffd3b5", groundColor: "#4a5a3a", intensity: 0.85 });

const dome = new BrioObject3D("dome", "mesh_dome", "mat_sky");
dome.transform.scale = { x: 62, y: 62, z: 62 };
dome.castShadow = false;
dome.receiveShadow = false;

const capy = createCapybara({ name: "player" });
capy.root.transform.rotation.y = Math.PI / 2; // face -Z (down the trail)
capy.root.transform.scale = { x: 0.62, y: 0.62, z: 0.62 };

/** One shared material for every KayKit model, so their common texture is uploaded to the GPU once. */
let forestMaterial = "";
function forestObject(name, key) {
    const model = models[key];
    return new BrioObject3D(name, model.primaryMesh.name, forestMaterial || model.primaryMaterial.name);
}

const segments = [];
const decor = []; // { object, segment, side, kind }
const obstacles = []; // pooled: { object, kind, lane, z, active }
const yuzus = [];
const puffs = [];

game.load(() => {
    forestMaterial = models.tree1.primaryMaterial.name;
    const objects = [];
    for (let s = 0; s < SEGMENTS; s++) {
        const ground = new BrioObject3D(`ground_${s}`, "mesh_ground", "mat_ground");
        ground.castShadow = false;
        segments.push(ground);
        objects.push(ground);
        // Decorations of this segment, re-scattered every time it moves ahead
        const kinds = ["tree1", "tree2", "tree3", "pine", "pine", "bare", "bush1", "bush2", "bush3", "pebble", "boulder", "grass1", "grass2", "grass1", "araucaria", "araucaria"];
        kinds.forEach((kind, k) => {
            const object = kind === "araucaria" ? createAraucaria(5 + (k % 3), (s * 7 + k) * 0.13 % 1) : forestObject(`decor_${s}_${k}`, kind);
            if (kind.startsWith("grass")) object.castShadow = false;
            decor.push({ object, segment: s, kind, side: k % 2 ? 1 : -1 });
            objects.push(object);
        });
    }
    for (let i = 0; i < 14; i++) obstacles.push(makeObstacle("rock", i));
    for (let i = 0; i < 10; i++) obstacles.push(makeObstacle("log", i));
    for (let i = 0; i < 8; i++) obstacles.push(makeObstacle("gate", i));
    for (const o of obstacles) objects.push(o.object);
    for (let i = 0; i < 50; i++) {
        const y = new BrioObject3D(`yuzu_${i}`);
        const fruit = new BrioObject3D(`yuzu_${i}_fruit`, "capy_mesh_sphere", "capy_mat_yuzu");
        fruit.transform.scale = { x: 0.28, y: 0.26, z: 0.28 };
        const leaf = new BrioObject3D(`yuzu_${i}_leaf`, "capy_mesh_box", "capy_mat_leaf");
        leaf.transform.position = { x: 0.08, y: 0.28, z: 0 };
        leaf.transform.scale = { x: 0.22, y: 0.04, z: 0.12 };
        leaf.transform.rotation.z = 0.4;
        y.addChild(fruit);
        y.addChild(leaf);
        y.transform.position.y = -50;
        yuzus.push({ object: y, active: false, z: 0, x: 0, h: 0, pop: 0 });
        objects.push(y);
    }
    for (let i = 0; i < 24; i++) {
        const p = new BrioObject3D(`puff_${i}`, "mesh_puff", "mat_puff");
        p.castShadow = false;
        p.transform.position.y = -50;
        puffs.push({ object: p, life: 0, vx: 0, vy: 0, vz: 0, spark: false });
        objects.push(p);
    }
    return [camera, sun, skyLight, dome, capy.root, ...objects];
});

function makeObstacle(kind, i) {
    let object;
    if (kind === "rock") {
        object = forestObject(`rock_${i}`, "rock");
        object.transform.scale = { x: 1.25, y: 1.0, z: 1.1 };
    } else if (kind === "log") {
        object = new BrioObject3D(`log_${i}`);
        const log = new BrioObject3D(`log_${i}_body`, "mesh_log", "mat_log");
        log.transform.rotation.z = Math.PI / 2;
        log.transform.scale = { x: 0.3, y: 1.9, z: 0.3 };
        log.transform.position.y = 0.3;
        object.addChild(log);
        for (const side of [-1, 1]) {
            const end = new BrioObject3D(`log_${i}_end${side}`, "mesh_log", "mat_log_end");
            end.transform.rotation.z = Math.PI / 2;
            end.transform.scale = { x: 0.27, y: 0.02, z: 0.27 };
            end.transform.position = { x: side * 0.95, y: 0.3, z: 0 };
            object.addChild(end);
        }
    } else {
        // A low branch between two posts: roll under it
        object = new BrioObject3D(`gate_${i}`);
        for (const side of [-1, 1]) {
            const post = new BrioObject3D(`gate_${i}_post${side}`, "arau_mesh_trunk", "arau_mat_bark");
            post.transform.position = { x: side * 0.95, y: 0.85, z: 0 };
            post.transform.scale = { x: 0.12, y: 1.7, z: 0.12 };
            object.addChild(post);
        }
        const bar = new BrioObject3D(`gate_${i}_bar`, "mesh_log", "mat_log");
        bar.transform.rotation.z = Math.PI / 2;
        bar.transform.scale = { x: 0.16, y: 2.2, z: 0.16 };
        bar.transform.position.y = 1.35;
        object.addChild(bar);
        // A few leaves hanging from the branch
        for (let k = -1; k <= 1; k++) {
            const leaf = new BrioObject3D(`gate_${i}_leaf${k}`, "capy_mesh_sphere", "arau_mat_needles_light");
            leaf.transform.position = { x: k * 0.62, y: 1.5, z: 0 };
            leaf.transform.scale = { x: 0.32, y: 0.2, z: 0.26 };
            object.addChild(leaf);
        }
    }
    object.transform.position.y = -50;
    return { object, kind, lane: 0, z: 0, active: false };
}

// ------------------------------------------------------------------ State
const BEST_KEY = "araucaria-run.best";
const player = { lane: 0, x: 0, y: 0, vy: 0, z: 0, roll: 0, speed: 10, phase: 0, alive: true, crashT: 0 };
let state = "title";
let score = 0;
let fruit = 0;
let combo = 0;
let comboT = 0;
let nextRowZ = -30;
let distance = 0;
let shake = 0;
let best = Number(BrioStorage.local.get(BEST_KEY) ?? 0);

function reset() {
    Object.assign(player, { lane: 0, x: 0, y: 0, vy: 0, z: 0, roll: 0, speed: 10, phase: 0, alive: true, crashT: 0 });
    score = 0;
    fruit = 0;
    combo = 0;
    distance = 0;
    // About five seconds of open trail before the first obstacle, to settle into the run
    nextRowZ = -55;
    for (const o of obstacles) hide(o);
    for (const y of yuzus) hideYuzu(y);
    segments.forEach((g, s) => placeSegment(s, -s * SEGMENT + SEGMENT));
    capy.root.transform.rotation.x = 0;
    capy.root.transform.rotation.z = 0;
    capy.body.transform.scale = { x: 1, y: 1, z: 1 };
}

function placeSegment(s, z) {
    const ground = segments[s];
    ground.transform.position = { x: 0, y: 0, z };
    for (const d of decor) {
        if (d.segment !== s) continue;
        const t = d.object.transform;
        const big = d.kind === "boulder" || d.kind === "araucaria" || d.kind.startsWith("tree") || d.kind === "pine" || d.kind === "bare";
        const minX = d.kind.startsWith("grass") || d.kind === "pebble" ? 4.2 : big ? 6.5 : 5;
        const x = d.side * game.random.float(minX, minX + (big ? 14 : 6));
        t.position = { x, y: 0, z: z + game.random.float(-SEGMENT / 2, SEGMENT / 2) };
        t.rotation.y = game.random.float(0, Math.PI * 2);
        const s2 = d.kind === "araucaria" ? game.random.float(0.85, 1.25) : big ? game.random.float(0.8, 1.35) : game.random.float(0.7, 1.3);
        t.scale = { x: s2, y: s2, z: s2 };
    }
}

function hide(o) {
    o.active = false;
    o.object.transform.position.y = -50;
}

function hideYuzu(y) {
    y.active = false;
    y.object.transform.position.y = -50;
}

function spawn(kind, lane, z) {
    const o = obstacles.find((p) => !p.active && p.kind === kind);
    if (!o) return;
    o.active = true;
    o.lane = lane;
    o.z = z;
    o.object.transform.position = { x: lane * LANE, y: 0, z };
    o.object.transform.rotation.y = kind === "rock" ? game.random.float(0, 6.28) : 0;
}

function spawnYuzu(lane, z, h = 0.75) {
    const y = yuzus.find((p) => !p.active);
    if (!y) return;
    Object.assign(y, { active: true, x: lane * LANE, z, h, pop: 0 });
    y.object.transform.scale = { x: 1, y: 1, z: 1 };
}

/** Spawns one row of obstacles, always leaving a way through. */
function spawnRow(z) {
    const level = Math.min(1, distance / 1400);
    const lanes = [-1, 0, 1];
    const r = game.random.float(0, 1);
    if (r < 0.28) {
        // One rock, fruit in another lane
        const rock = lanes[Math.floor(game.random.float(0, 3))];
        spawn("rock", rock, z);
        const free = lanes.filter((l) => l !== rock)[Math.floor(game.random.float(0, 2))];
        for (let k = 0; k < 4; k++) spawnYuzu(free, z + 3 - k * 1.6);
    } else if (r < 0.5) {
        // Two rocks: switch to the open lane
        const open = lanes[Math.floor(game.random.float(0, 3))];
        for (const l of lanes) if (l !== open) spawn("rock", l, z);
        spawnYuzu(open, z + 1.5);
        spawnYuzu(open, z);
    } else if (r < 0.7) {
        // A log across every lane: jump, with an arc of fruit over one of them
        for (const l of lanes) spawn("log", l, z);
        const arc = lanes[Math.floor(game.random.float(0, 3))];
        for (let k = -2; k <= 2; k++) spawnYuzu(arc, z + k * 1.1, 0.9 + (1 - (k * k) / 4) * 1.3);
    } else if (r < 0.88) {
        // Low branches: roll under them (or take the rock-free lane if any)
        const rock = level > 0.35 ? lanes[Math.floor(game.random.float(0, 3))] : 2;
        for (const l of lanes) {
            if (l === rock) spawn("rock", l, z);
            else spawn("gate", l, z);
        }
        for (const l of lanes) if (l !== rock) spawnYuzu(l, z, 0.4);
    } else {
        // A breather: a line of fruit zig-zagging across the lanes
        const zig = [-1, 0, 1, 1, 0, -1];
        for (let k = 0; k < 6; k++) spawnYuzu(zig[k], z + 4 - k * 1.6);
    }
}

// ------------------------------------------------------------------ Touch: swipes
let swipe = null;
let swipeAction = "";
window.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") return;
    swipe = { x: e.clientX, y: e.clientY, used: false };
});
window.addEventListener("pointermove", (e) => {
    if (!swipe || swipe.used) return;
    const dx = e.clientX - swipe.x;
    const dy = e.clientY - swipe.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
    swipe.used = true;
    swipeAction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy < 0 ? "jump" : "roll";
});
window.addEventListener("pointerup", () => {
    if (swipe && !swipe.used) swipeAction = "tap";
    swipe = null;
});

// ------------------------------------------------------------------ Frame
game.update((_updater, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const input = game.input;
    const action = swipeAction;
    swipeAction = "";

    if (state !== "play") {
        // Title and game over: Capibrio waits on the trail
        animateRun(capy, game.time * 2, 0.15);
        updateCamera(dt, true);
        updatePuffs(dt);
        if (state === "over") player.crashT += dt;
        if ((input.isPressed("start") || input.isPressed("jump") || action === "tap" || ui.consumeStart() || DEMO) && (state === "title" || player.crashT > (DEMO ? 2.5 : 0.8))) {
            start();
        }
        return;
    }

    const auto = DEMO ? autopilot() : "";
    // Lanes, jump, roll
    if (auto === "left") moveLane(-1);
    if (auto === "right") moveLane(1);
    if (input.isPressed("left") || action === "left") moveLane(-1);
    if (input.isPressed("right") || action === "right") moveLane(1);
    const grounded = player.y <= 0.001;
    if ((input.isPressed("jump") || action === "jump" || action === "tap" || auto === "jump") && grounded) {
        player.vy = 7.6;
        player.roll = 0;
        sounds.jump.play();
        dust(4);
    }
    if ((input.isPressed("roll") || action === "roll" || auto === "roll") && player.roll <= 0) {
        player.roll = 0.75;
        if (!grounded) player.vy = Math.min(player.vy, -9);
    }
    player.roll = Math.max(0, player.roll - dt);
    player.vy -= 24 * dt;
    player.y = Math.max(0, player.y + player.vy * dt);
    if (player.y === 0 && player.vy < 0) {
        if (player.vy < -6) dust(5);
        player.vy = 0;
    }
    player.x += (player.lane * LANE - player.x) * Math.min(1, dt * 14);

    // Speed ramps up over the run
    player.speed = Math.min(25, 10 + distance * 0.0085);
    const step = player.speed * dt;
    player.z -= step;
    distance += step;
    score = Math.floor(distance) + fruit * 10;
    comboT = Math.max(0, comboT - dt);
    if (comboT === 0) combo = 0;

    // Capybara pose
    player.phase += step * 1.6;
    const t = capy.root.transform;
    t.position = { x: player.x, y: player.y, z: player.z };
    const tilt = (player.lane * LANE - player.x) * -0.12;
    t.rotation.x = tilt;
    if (player.roll > 0) {
        capy.body.transform.scale = { x: 1.08, y: 0.62, z: 1.04 };
        animateRun(capy, player.phase * 1.5, 0.5);
    } else if (!grounded) {
        capy.body.transform.scale = { x: 0.95, y: 1.08, z: 0.95 };
        for (const leg of capy.legs) leg.transform.rotation.z = 0.6;
    } else {
        capy.body.transform.scale = { x: 1, y: 1, z: 1 };
        animateRun(capy, player.phase, 1);
    }
    if (grounded && Math.floor(player.phase / Math.PI) % 2 === 0 && game.random.float(0, 1) < dt * 10) dust(1);

    // World recycling
    for (let s = 0; s < SEGMENTS; s++) {
        const g = segments[s];
        if (g.transform.position.z - SEGMENT / 2 > player.z + 12) placeSegment(s, g.transform.position.z - SEGMENTS * SEGMENT);
    }
    while (nextRowZ > player.z - VIEW) {
        spawnRow(nextRowZ);
        nextRowZ -= Math.max(10.5, 17 - distance * 0.004) + game.random.float(0, 4);
    }

    // Obstacles and collisions
    const height = player.roll > 0 ? 0.55 : 1.05;
    for (const o of obstacles) {
        if (!o.active) continue;
        if (o.z > player.z + 10) {
            hide(o);
            continue;
        }
        if (Math.abs(o.z - player.z) > 0.65 || Math.abs(o.lane * LANE - player.x) > 1.05) continue;
        const hit =
            (o.kind === "rock" && player.y < 1.15) ||
            (o.kind === "log" && player.y < 0.55) ||
            (o.kind === "gate" && player.y + height > 1.2);
        if (hit) {
            crash();
            return;
        }
    }

    // Fruit
    for (const y of yuzus) {
        if (!y.active) continue;
        const tr = y.object.transform;
        if (y.pop > 0) {
            y.pop += dt;
            tr.position.y = y.h + y.pop * 3;
            const s = Math.max(0, 1 + y.pop * 2 - y.pop * y.pop * 18);
            tr.scale = { x: s, y: s, z: s };
            if (y.pop > 0.35) hideYuzu(y);
            continue;
        }
        if (y.z > player.z + 8) {
            hideYuzu(y);
            continue;
        }
        tr.position = { x: y.x, y: y.h + Math.sin(game.time * 4 + y.z) * 0.08, z: y.z };
        tr.rotation.y = game.time * 3 + y.z;
        if (Math.abs(y.z - player.z) < 0.8 && Math.abs(y.x - player.x) < 0.9 && Math.abs(y.h - (player.y + 0.6)) < 1.0) {
            y.pop = 0.001;
            fruit++;
            combo++;
            comboT = 1.2;
            sounds.coin.play();
            sparks(y.x, y.h, y.z);
            if (combo > 0 && combo % 10 === 0) {
                sounds.combo.play();
                ui.combo(combo);
            }
        }
    }

    updatePuffs(dt);
    updateCamera(dt, false);
    ui.hud(score, fruit, best);
});

/** Attract mode: look a little ahead in each lane and pick the move a player would make. */
function autopilot() {
    const ahead = (lane, kind) => obstacles.some((o) => o.active && o.lane === lane && (!kind || o.kind === kind) && o.z < player.z && o.z > player.z - 7);
    const danger = (lane) => obstacles.some((o) => o.active && o.lane === lane && o.kind === "rock" && o.z < player.z + 1 && o.z > player.z - 9);
    if (danger(player.lane)) {
        for (const lane of [player.lane - 1, player.lane + 1]) if (lane >= -1 && lane <= 1 && !danger(lane)) return lane < player.lane ? "left" : "right";
    }
    const near = (kind) => obstacles.some((o) => o.active && o.lane === player.lane && o.kind === kind && o.z < player.z && o.z > player.z - player.speed * 0.32);
    if (near("log")) return "jump";
    if (ahead(player.lane, "gate") && near("gate")) return "roll";
    return "";
}

function moveLane(dir) {
    const next = Math.max(-1, Math.min(1, player.lane + dir));
    if (next === player.lane) return;
    player.lane = next;
    sounds.tap.play();
}

function crash() {
    state = "over";
    player.crashT = 0;
    shake = 0.6;
    sounds.hurt.play();
    sounds.music.stop();
    capy.root.transform.rotation.z = 0.9;
    capy.root.transform.rotation.x = 0.4;
    dust(10);
    const record = score > best;
    if (record) {
        best = score;
        BrioStorage.local.set(BEST_KEY, best);
    }
    ui.over(score, fruit, best, record);
}

function start() {
    reset();
    state = "play";
    ui.play();
    sounds.music.stop();
    sounds.music.playLoop();
}

function dust(n) {
    for (let k = 0; k < n; k++) {
        const p = puffs.find((q) => q.life <= 0);
        if (!p) return;
        p.life = 0.6;
        p.spark = false;
        p.object.material = "mat_puff";
        p.vx = game.random.float(-1, 1);
        p.vy = game.random.float(0.6, 1.6);
        p.vz = game.random.float(0.5, 2);
        p.object.transform.position = { x: player.x + game.random.float(-0.3, 0.3), y: 0.1, z: player.z + 0.4 };
    }
}

function sparks(x, y, z) {
    for (let k = 0; k < 5; k++) {
        const p = puffs.find((q) => q.life <= 0);
        if (!p) return;
        p.life = 0.45;
        p.spark = true;
        p.object.material = "mat_spark";
        const a = game.random.float(0, Math.PI * 2);
        p.vx = Math.cos(a) * 2.2;
        p.vy = game.random.float(1, 3);
        p.vz = Math.sin(a) * 2.2;
        p.object.transform.position = { x, y, z };
    }
}

function updatePuffs(dt) {
    for (const p of puffs) {
        if (p.life <= 0) continue;
        p.life -= dt;
        const tr = p.object.transform;
        tr.position.x += p.vx * dt;
        tr.position.y += p.vy * dt;
        tr.position.z += p.vz * dt;
        const s = p.life <= 0 ? 0 : p.spark ? p.life * 0.18 : (0.6 - p.life) * 0.4 + 0.05;
        tr.scale = { x: s, y: s, z: s };
        if (p.life <= 0) tr.position.y = -50;
    }
}

function updateCamera(dt, idle) {
    shake = Math.max(0, shake - dt);
    const jx = shake > 0 ? game.random.float(-shake, shake) * 0.4 : 0;
    const speedK = (player.speed - 10) / 15;
    const back = idle ? 6.2 + Math.sin(game.time * 0.3) * 0.4 : 7.2 + speedK * 1.2;
    const height = idle ? 2.6 : 4.1 + player.y * 0.25;
    camera.position = { x: player.x * 0.55 + jx + (idle ? Math.sin(game.time * 0.25) * 2.5 : 0), y: height, z: player.z + back };
    camera.target = { x: player.x * 0.75, y: 0.9 + player.y * 0.35, z: player.z - 7 };
    camera.fov = 0.95 + (idle ? 0 : speedK * 0.18);
    dome.transform.position = { x: camera.position.x, y: 0, z: camera.position.z };
}

game.ready().then(() => {
    reset();
    ui.title(best);
    if (game.renderBackend?.backendType !== "webgl2") ui.noWebGL();
});

// ?mute=1 silences the game (used by the live previews of the gallery)
if (new URLSearchParams(location.search).has("mute")) BrioAudioMixer.mute("master", true);

window.brioGame = game;
