// Lumen Vigil: a pixel-art arena survivor rendered entirely by the BrioJS WebGL2 backend.
// Shows: 2D sprites as lit GPU quads (orthographic BrioCamera3D), sprite-sheet animation in a BrioShader,
// a procedural floor shader, up to 8 moving point lights, object pooling for hundreds of monsters, a uniform grid
// for collisions, the input map (keyboard, gamepad, touch) and Web Audio buses.
import {
    BrioGame,
    BrioAudio,
    BrioCamera3D,
    BrioLight,
    BrioMaterial,
    BrioShader,
    BrioInputMap,
} from "@brio-js/core";
import { QUAD, quadMesh, spriteShader, pixelTexture, cell, spriteMaterial, sprite } from "./sprites.js";
import { MONSTERS, WAVES, BOSS_TIMES, EFFECTS, SPELLS, PASSIVES } from "./data.js";
import { t } from "./strings.js";
import * as ui from "./ui.js";

// ------------------------------------------------------------------ Settings
const NIGHT = 240; // seconds until dawn
const VIEW_H = 330; // art pixels visible vertically
const ARENA = 1150; // the knight stays inside this half-size
const MAX_ENEMIES = 340;
const MAX_SHARDS = 260;
const MAX_FX = 110;
const MAX_SHOTS = 40;
// ?t=150 starts the night 150 seconds in (handy for demos)
const START_TIME = Math.max(0, Math.min(NIGHT - 5, Number(new URLSearchParams(location.search).get("t")) || 0));

const game = new BrioGame({
    width: innerWidth,
    height: innerHeight,
    container: document.getElementById("game"),
    dimension: "3d",
    renderBackend: "webgl2",
    maxEntities: 1200,
    seed: Date.now() % 100000,
});
game.useFullScreen("resize");
game.useKeyboard();
game.useGamepad();
game.input
    .bind("left", "ArrowLeft", "a", "A", BrioInputMap.padAxis(0, -1, 0.25))
    .bind("right", "ArrowRight", "d", "D", BrioInputMap.padAxis(0, 1, 0.25))
    .bind("up", "ArrowUp", "w", "W", BrioInputMap.padAxis(1, -1, 0.25))
    .bind("down", "ArrowDown", "s", "S", BrioInputMap.padAxis(1, 1, 0.25))
    .bind("pause", "p", "P", "Escape", BrioInputMap.padButton("start"))
    .bind("pick1", "1")
    .bind("pick2", "2")
    .bind("pick3", "3")
    .bind("restart", "r", "R", BrioInputMap.padButton("south"));

// ------------------------------------------------------------------ Assets
// Textures are decoded before preload so the first frame already has them
const [knightTex, monsterTex, coinTex, holyA, holyB] = await Promise.all([
    pixelTexture("./assets/knight.png"),
    pixelTexture("./assets/monsters.png"),
    pixelTexture("./assets/coin.png"),
    pixelTexture("./assets/vendor/holy-a.png").catch(() => undefined),
    pixelTexture("./assets/vendor/holy-b.png").catch(() => undefined),
]);
const sheets = { a: holyA, b: holyB };

const knightFrame = cell(knightTex, 32, 32, 0, 0);
const materials = [
    spriteMaterial("mat_knight", knightTex, knightFrame),
    spriteMaterial("mat_knight_hit", knightTex, knightFrame, { flash: 0.6 }),
];
MONSTERS.forEach((m, i) => {
    const frame = cell(monsterTex, 32, 32, i, 0);
    materials.push(spriteMaterial(`mat_mon_${i}`, monsterTex, frame));
    materials.push(spriteMaterial(`mat_mon_${i}_hit`, monsterTex, frame, { flash: 0.5 }));
});
for (let f = 0; f < 12; f++) {
    materials.push(spriteMaterial(`mat_shard_${f}`, coinTex, cell(coinTex, 16, 16, f, 0), { lit: false, glow: 0.6, tint: [0.75, 0.95, 1.2, 1] }));
}
for (const [name, fx] of Object.entries(EFFECTS)) {
    const sheet = sheets[fx.sheet];
    for (let f = 0; f < fx.frames; f++) {
        materials.push(
            sheet
                ? spriteMaterial(`fx_${name}_${f}`, sheet, cell(sheet, 64, 64, f, fx.row), { lit: false, alphaCutoff: 0.08, glow: 0.3 })
                : // Fallback when the effect sheets are not deployed: soft glowing squares
                  new BrioMaterial(`fx_${name}_${f}`, { shading: "unlit", color: "#bfe6ff", opacity: 0.35 * (1 - f / fx.frames) }),
        );
    }
}
materials.push(
    new BrioMaterial("mat_floor", {
        shading: "lambert",
        shader: "shd_floor",
        parameters: { uPixel: 2, uDawn: 0 },
    }),
);
const floorMaterial = materials[materials.length - 1];

const sounds = {
    coin: new BrioAudio("aud_coin", "./assets/sounds/coin.wav", { volume: 0.25 }),
    hit: new BrioAudio("aud_hit", "./assets/sounds/tap.wav", { volume: 0.35 }),
    hurt: new BrioAudio("aud_hurt", "./assets/sounds/hurt.wav", { volume: 0.6 }),
    boom: new BrioAudio("aud_boom", "./assets/sounds/explosion.wav", { volume: 0.4 }),
    level: new BrioAudio("aud_level", "./assets/sounds/power_up.wav", { volume: 0.55 }),
    cast: new BrioAudio("aud_cast", "./assets/sounds/jump.wav", { volume: 0.18 }),
    music: new BrioAudio("aud_music", "./assets/sounds/music.mp3", { bus: "bgm", volume: 0.45 }),
};

game.preload(() => [
    quadMesh(),
    spriteShader(),
    new BrioShader("shd_floor", { url: new URL("./floor.glsl", import.meta.url).href }),
    ...materials,
    ...Object.values(sounds),
]);

// ------------------------------------------------------------------ Scene
const camera = new BrioCamera3D("cam", {
    projection: "orthographic",
    orthoSize: VIEW_H / 2,
    position: { x: 0, y: 0, z: 300 },
    target: { x: 0, y: 0, z: 0 },
    near: 1,
    far: 600,
    clearColor: "#05080b",
});
const sky = new BrioLight("sky", "hemisphere", { color: "#5d6f9e", groundColor: "#1b1714", intensity: 0.5 });
const moon = new BrioLight("moon", "directional", { color: "#9fb4e8", intensity: 0.22, direction: { x: 0.3, y: -0.4, z: -1 } });
const lantern = new BrioLight("lantern", "point", { color: "#ffc477", intensity: 110, range: 190, decay: 1, position: { x: 0, y: 0, z: 45 } });
const haloLight = new BrioLight("halo_light", "point", { color: "#6fd8ff", intensity: 0, range: 130, decay: 1, position: { x: 0, y: 0, z: 30 } });
// Short flashes for strikes and bursts
const flashes = Array.from({ length: 5 }, (_, i) =>
    new BrioLight(`flash_${i}`, "point", { color: "#ffffff", intensity: 0, range: 150, decay: 1, position: { x: 0, y: 0, z: 35 } }),
);
const flashLife = new Float32Array(flashes.length);
const flashPower = new Float32Array(flashes.length);

const knight = sprite("knight", "mat_knight", 64, 64, 3);
const floor = sprite("floor", "mat_floor", 3200, 3200, 0);
floor.receiveShadow = false;

// Pools: every monster, shard, effect and projectile exists from the start and is recycled
const enemyObjects = [];
const shardObjects = [];
const fxObjects = [];
const shotObjects = [];
const HIDDEN = 100000;
for (let i = 0; i < MAX_ENEMIES; i++) enemyObjects.push(sprite(`enemy_${i}`, "mat_mon_0", 32, 32, -50));
for (let i = 0; i < MAX_SHARDS; i++) shardObjects.push(sprite(`shard_${i}`, "mat_shard_0", 12, 12, -50));
for (let i = 0; i < MAX_FX; i++) fxObjects.push(sprite(`fx_${i}`, "fx_bloom_0", 64, 64, -50));
for (let i = 0; i < MAX_SHOTS; i++) shotObjects.push(sprite(`shot_${i}`, "fx_crescent_0", 34, 34, -50));
for (const list of [enemyObjects, shardObjects, fxObjects, shotObjects]) {
    for (const o of list) o.transform.position = { x: HIDDEN, y: HIDDEN, z: -50 };
}

game.load(() => [
    camera,
    sky,
    moon,
    lantern,
    haloLight,
    ...flashes,
    floor,
    knight,
    ...enemyObjects,
    ...shardObjects,
    ...fxObjects,
    ...shotObjects,
]);

// ------------------------------------------------------------------ State (data-oriented: typed arrays)
const ex = new Float32Array(MAX_ENEMIES);
const ey = new Float32Array(MAX_ENEMIES);
const ehp = new Float32Array(MAX_ENEMIES);
const etype = new Uint8Array(MAX_ENEMIES);
const ealive = new Uint8Array(MAX_ENEMIES);
const eflash = new Float32Array(MAX_ENEMIES);
const eorbitCd = new Float32Array(MAX_ENEMIES);
const ewardCd = new Float32Array(MAX_ENEMIES);
const ekx = new Float32Array(MAX_ENEMIES); // knockback velocity
const eky = new Float32Array(MAX_ENEMIES);
const ephase = new Float32Array(MAX_ENEMIES);
const freeEnemies = [];

const sx = new Float32Array(MAX_SHARDS);
const sy = new Float32Array(MAX_SHARDS);
const svalue = new Uint8Array(MAX_SHARDS);
const salive = new Uint8Array(MAX_SHARDS);
const spull = new Uint8Array(MAX_SHARDS);

const fx = Array.from({ length: MAX_FX }, () => ({ alive: false, name: "", t: 0, fps: 20, loop: false, x: 0, y: 0, size: 64, follow: false, frames: 1 }));
const shots = Array.from({ length: MAX_SHOTS }, () => ({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, pierce: 0, damage: 0, hit: new Set() }));
const wards = [];

const player = { x: 0, y: 0, hp: 100, maxHp: 100, speed: 92, magnet: 46, xp: 0, need: 6, level: 1, invuln: 0, facing: 1, anim: 0, hurtT: 0, kills: 0 };
const owned = {}; // spell or passive id -> level
const timers = { smite: 0.8, sun: 2.5, crescent: 0.5, ward: 3, spawn: 0, boss: 0 };
let state = "title"; // title | play | choose | paused | over | dawn
let time = 0;
let shardFrame = 0;
let shake = 0;
let haloAngle = 0;
let alive = 0;
let soundBudget = 0;

function resetRun() {
    for (let i = 0; i < MAX_ENEMIES; i++) killEnemy(i, false);
    for (let i = 0; i < MAX_SHARDS; i++) hideShard(i);
    for (let i = 0; i < MAX_FX; i++) hideFx(i);
    for (let i = 0; i < MAX_SHOTS; i++) hideShot(i);
    wards.length = 0;
    freeEnemies.length = 0;
    for (let i = MAX_ENEMIES - 1; i >= 0; i--) freeEnemies.push(i);
    Object.assign(player, { x: 0, y: 0, hp: 100, maxHp: 100, speed: 92, magnet: 46, xp: 0, need: 6, level: 1, invuln: 0, kills: 0 });
    for (const k of Object.keys(owned)) delete owned[k];
    owned.halo = 1;
    Object.assign(timers, { smite: 0.8, sun: 2.5, crescent: 0.5, ward: 3, spawn: 0, boss: 0 });
    time = START_TIME;
    timers.boss = START_TIME > 0 ? START_TIME - 1 : 0;
    alive = 0;
    // Starting later in the night (?t=) comes with the blessings a player would have earned by then
    for (let n = Math.floor(START_TIME / 22); n > 0; n--) {
        const picks = upgradePool();
        if (!picks.length) break;
        const pick = picks[Math.floor(game.random.float(0, picks.length))];
        owned[pick.id] = (owned[pick.id] ?? 0) + 1;
        player.level++;
    }
    player.speed = 92 * Math.pow(1.18, owned.swift ?? 0);
    player.maxHp = player.hp = 100 + 25 * (owned.vigor ?? 0);
    player.magnet = 46 * Math.pow(1.7, owned.lure ?? 0);
    player.need = Math.round(6 + player.level * 4.5 + player.level * player.level * 0.35);
    ui.updateSpells(owned);
}

// ------------------------------------------------------------------ Uniform grid for collisions
const CELL = 40;
const GRID = 80; // cells per side, centered on the knight
const head = new Int32Array(GRID * GRID);
const next = new Int32Array(MAX_ENEMIES);
let gridX0 = 0;
let gridY0 = 0;

function buildGrid() {
    head.fill(-1);
    gridX0 = player.x - (GRID * CELL) / 2;
    gridY0 = player.y - (GRID * CELL) / 2;
    for (let i = 0; i < MAX_ENEMIES; i++) {
        if (!ealive[i]) continue;
        const cx = Math.floor((ex[i] - gridX0) / CELL);
        const cy = Math.floor((ey[i] - gridY0) / CELL);
        if (cx < 0 || cy < 0 || cx >= GRID || cy >= GRID) {
            next[i] = -1;
            continue;
        }
        const c = cy * GRID + cx;
        next[i] = head[c];
        head[c] = i;
    }
}

/** Calls fn(i, dist2) for every live monster within `radius` of (x, y). */
function query(x, y, radius, fn) {
    const r2 = radius * radius;
    const x0 = Math.max(0, Math.floor((x - radius - gridX0) / CELL));
    const x1 = Math.min(GRID - 1, Math.floor((x + radius - gridX0) / CELL));
    const y0 = Math.max(0, Math.floor((y - radius - gridY0) / CELL));
    const y1 = Math.min(GRID - 1, Math.floor((y + radius - gridY0) / CELL));
    for (let cy = y0; cy <= y1; cy++) {
        for (let cx = x0; cx <= x1; cx++) {
            for (let i = head[cy * GRID + cx]; i !== -1; i = next[i]) {
                const dx = ex[i] - x;
                const dy = ey[i] - y;
                const d2 = dx * dx + dy * dy;
                const size = 12 * MONSTERS[etype[i]].scale;
                if (d2 <= r2 + size * size) fn(i, d2);
            }
        }
    }
}

// ------------------------------------------------------------------ Monsters
function spawnEnemy(type) {
    const i = freeEnemies.pop();
    if (i === undefined) return;
    const m = MONSTERS[type];
    const angle = game.random.float(0, Math.PI * 2);
    const aspect = game.width / game.height;
    const radius = Math.hypot((VIEW_H / 2) * aspect, VIEW_H / 2) + 30 * m.scale;
    ex[i] = player.x + Math.cos(angle) * radius;
    ey[i] = player.y + Math.sin(angle) * radius;
    // Monsters get tougher as the night goes on
    ehp[i] = m.hp * (1 + time / 210);
    etype[i] = type;
    ealive[i] = 1;
    eflash[i] = 0;
    eorbitCd[i] = 0;
    ewardCd[i] = 0;
    ekx[i] = 0;
    eky[i] = 0;
    ephase[i] = game.random.float(0, 6.28);
    const o = enemyObjects[i];
    o.material = `mat_mon_${type}`;
    o.transform.scale = { x: 32 * m.scale, y: 32 * m.scale, z: 1 };
    alive++;
}

function killEnemy(i, reward = true) {
    if (!ealive[i] && reward) return;
    if (ealive[i]) {
        alive--;
        freeEnemies.push(i);
    }
    ealive[i] = 0;
    const o = enemyObjects[i];
    o.transform.position = { x: HIDDEN, y: HIDDEN, z: -50 };
    if (!reward) return;
    const m = MONSTERS[etype[i]];
    player.kills++;
    playFx("bloom", ex[i], ey[i], 44 * m.scale, 34);
    dropShards(ex[i], ey[i], m.xp);
    if (m.boss) {
        shake = 10;
        sounds.boom.play();
        for (let k = 0; k < 6; k++) playFx("gold", ex[i] + game.random.float(-40, 40), ey[i] + game.random.float(-40, 40), 90, 18);
    }
}

function damageEnemy(i, amount, kx = 0, ky = 0) {
    if (!ealive[i]) return;
    ehp[i] -= amount;
    eflash[i] = 0.07;
    const resist = MONSTERS[etype[i]].boss ? 0.15 : 1;
    ekx[i] += kx * resist;
    eky[i] += ky * resist;
    if (soundBudget > 0) {
        sounds.hit.play();
        soundBudget--;
    }
    if (ehp[i] <= 0) killEnemy(i);
}

// ------------------------------------------------------------------ Light shards (XP)
function dropShards(x, y, value) {
    let left = value;
    while (left > 0) {
        const v = left >= 5 ? 5 : 1;
        left -= v;
        const i = salive.indexOf(0);
        if (i < 0) return;
        salive[i] = 1;
        spull[i] = 0;
        svalue[i] = v;
        sx[i] = x + game.random.float(-10, 10);
        sy[i] = y + game.random.float(-10, 10);
        const s = v === 5 ? 18 : 12;
        shardObjects[i].transform.scale = { x: s, y: s, z: 1 };
    }
}

function hideShard(i) {
    salive[i] = 0;
    shardObjects[i].transform.position = { x: HIDDEN, y: HIDDEN, z: -50 };
}

// ------------------------------------------------------------------ Effects and projectiles
function playFx(name, x, y, size, fps = 20, loop = false, follow = false) {
    const i = fx.findIndex((f) => !f.alive);
    if (i < 0) return -1;
    const f = fx[i];
    Object.assign(f, { alive: true, name, t: 0, fps, loop, x, y, size, follow, frames: loop ? (EFFECTS[name].loopFrames ?? EFFECTS[name].frames) : EFFECTS[name].frames });
    fxObjects[i].transform.scale = { x: size, y: size, z: 1 };
    fxObjects[i].material = `fx_${name}_0`;
    return i;
}

function hideFx(i) {
    fx[i].alive = false;
    fxObjects[i].transform.position = { x: HIDDEN, y: HIDDEN, z: -50 };
}

function hideShot(i) {
    shots[i].alive = false;
    shotObjects[i].transform.position = { x: HIDDEN, y: HIDDEN, z: -50 };
}

function flash(x, y, color, power, life = 0.25) {
    let best = 0;
    for (let i = 1; i < flashes.length; i++) if (flashLife[i] < flashLife[best]) best = i;
    flashes[best].color = color;
    flashes[best].position = { x, y, z: 35 };
    flashLife[best] = life;
    flashPower[best] = power;
}

// ------------------------------------------------------------------ Spells
const cooldown = (base) => base * Math.pow(0.88, owned.zeal ?? 0);

function nearestEnemy(x, y, maxDist) {
    let best = -1;
    let bestD = maxDist * maxDist;
    query(x, y, maxDist, (i, d2) => {
        if (d2 < bestD) {
            bestD = d2;
            best = i;
        }
    });
    return best;
}

function castSpells(dt) {
    // Halo: orbs circle the knight
    const halo = owned.halo ?? 0;
    haloLight.intensity = halo ? 26 : 0;
    haloLight.position = { x: player.x, y: player.y, z: 30 };
    if (halo) {
        haloAngle += dt * (2.4 + halo * 0.25);
        const count = 1 + halo;
        const radius = 44 + halo * 5;
        const damage = 7 + halo * 3;
        for (let k = 0; k < count; k++) {
            const a = haloAngle + (k / count) * Math.PI * 2;
            const ox = player.x + Math.cos(a) * radius;
            const oy = player.y + Math.sin(a) * radius;
            haloOrbs[k] = haloOrbs[k] ?? -1;
            if (haloOrbs[k] < 0 || !fx[haloOrbs[k]].alive || fx[haloOrbs[k]].name !== "halo") haloOrbs[k] = playFx("halo", ox, oy, 30, 14, true);
            const f = fx[haloOrbs[k]];
            if (f) {
                f.x = ox;
                f.y = oy;
            }
            query(ox, oy, 14, (i) => {
                if (eorbitCd[i] > 0) return;
                eorbitCd[i] = 0.4;
                const dx = ex[i] - player.x;
                const dy = ey[i] - player.y;
                const len = Math.hypot(dx, dy) || 1;
                damageEnemy(i, damage, (dx / len) * 120, (dy / len) * 120);
            });
        }
        for (let k = count; k < haloOrbs.length; k++) {
            if (haloOrbs[k] >= 0) hideFx(haloOrbs[k]);
            haloOrbs[k] = -1;
        }
    }

    // Smite: stars fall on random nearby monsters
    const smite = owned.smite ?? 0;
    if (smite && (timers.smite -= dt) <= 0) {
        timers.smite = cooldown(1.7 - smite * 0.18);
        const candidates = [];
        query(player.x, player.y, 190, (i) => candidates.push(i));
        for (let n = 0; n < Math.min(smite, candidates.length); n++) {
            const i = candidates[Math.floor(game.random.float(0, candidates.length))];
            const x = ex[i];
            const y = ey[i];
            const radius = 26 + smite * 4;
            playFx("star", x, y, 70 + smite * 6, 32);
            flash(x, y, "#9fe8ff", 70);
            query(x, y, radius, (j) => damageEnemy(j, 18 + smite * 8));
        }
        if (candidates.length) sounds.cast.play();
    }

    // Sunburst: a ring of fire around the knight
    const sun = owned.sun ?? 0;
    if (sun && (timers.sun -= dt) <= 0) {
        timers.sun = cooldown(4.4 - sun * 0.4);
        const radius = 70 + sun * 12;
        playFx("sun", player.x, player.y, radius * 2.3, 20, false, true);
        flash(player.x, player.y, "#ffb35c", 130, 0.4);
        shake = Math.max(shake, 3);
        query(player.x, player.y, radius, (i) => {
            const dx = ex[i] - player.x;
            const dy = ey[i] - player.y;
            const len = Math.hypot(dx, dy) || 1;
            damageEnemy(i, 14 + sun * 7, (dx / len) * 260, (dy / len) * 260);
        });
        sounds.boom.play();
    }

    // Crescent: piercing moons toward the closest monster
    const crescent = owned.crescent ?? 0;
    if (crescent && (timers.crescent -= dt) <= 0) {
        timers.crescent = cooldown(1.05 - crescent * 0.1);
        const target = nearestEnemy(player.x, player.y, 260);
        if (target >= 0) {
            const base = Math.atan2(ey[target] - player.y, ex[target] - player.x);
            const count = Math.ceil(crescent / 2);
            for (let n = 0; n < count; n++) {
                const s = shots.findIndex((p) => !p.alive);
                if (s < 0) break;
                const a = base + (n - (count - 1) / 2) * 0.22;
                Object.assign(shots[s], { alive: true, x: player.x, y: player.y, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230, life: 1.4, pierce: 2 + crescent, damage: 11 + crescent * 4 });
                shots[s].hit.clear();
            }
            sounds.cast.play();
        }
    }

    // Verdant ward: a field of thorns where monsters gather
    const ward = owned.ward ?? 0;
    if (ward && (timers.ward -= dt) <= 0) {
        timers.ward = cooldown(5.5 - ward * 0.4);
        const target = nearestEnemy(player.x + game.random.float(-60, 60), player.y + game.random.float(-60, 60), 220);
        if (target >= 0) {
            const radius = 46 + ward * 8;
            const id = playFx("ward", ex[target], ey[target], radius * 2.2, 10, true);
            wards.push({ x: ex[target], y: ey[target], radius, life: 3 + ward * 0.3, damage: 5 + ward * 3, fx: id });
        }
    }
    for (let w = wards.length - 1; w >= 0; w--) {
        const ward = wards[w];
        ward.life -= dt;
        if (ward.life <= 0) {
            if (ward.fx >= 0) hideFx(ward.fx);
            wards.splice(w, 1);
            continue;
        }
        query(ward.x, ward.y, ward.radius, (i) => {
            if (ewardCd[i] > 0) return;
            ewardCd[i] = 0.45;
            damageEnemy(i, ward.damage);
        });
    }

    // Sigil: a slowing seal (handled in the movement loop)
    const sigil = owned.sigil ?? 0;
    if (sigil) {
        if (sigilFx < 0 || !fx[sigilFx].alive || fx[sigilFx].name !== "sigil") sigilFx = playFx("sigil", player.x, player.y, 1, 12, true, true);
        fx[sigilFx].size = (62 + sigil * 10) * 2.2;
    }
}
const haloOrbs = [];
let sigilFx = -1;

// ------------------------------------------------------------------ Level ups
function upgradePool() {
    const pool = [];
    for (const [id, spell] of Object.entries(SPELLS)) {
        const level = owned[id] ?? 0;
        const spellsOwned = Object.keys(SPELLS).filter((s) => owned[s]).length;
        if (level < spell.max && (level > 0 || spellsOwned < 5)) pool.push({ id, kind: "spell", level, effect: spell.effect, weight: level ? 3 : 2 });
    }
    for (const [id, passive] of Object.entries(PASSIVES)) {
        const level = owned[id] ?? 0;
        if (level < passive.max) pool.push({ id, kind: "passive", level, effect: passive.effect, weight: 1 });
    }
    return pool;
}

function offerUpgrades() {
    const pool = upgradePool();
    const picks = [];
    while (picks.length < 3 && pool.length) {
        const total = pool.reduce((n, p) => n + p.weight, 0);
        let r = game.random.float(0, total);
        const index = pool.findIndex((p) => (r -= p.weight) <= 0);
        picks.push(pool.splice(Math.max(0, index), 1)[0]);
    }
    if (picks.length === 0) return false;
    state = "choose";
    sounds.level.play();
    ui.showChoices(picks, holyA && holyB ? { a: holyA.src, b: holyB.src } : undefined, applyUpgrade);
    return true;
}

function applyUpgrade(pick) {
    owned[pick.id] = (owned[pick.id] ?? 0) + 1;
    if (pick.id === "swift") player.speed *= 1.18;
    if (pick.id === "vigor") {
        player.maxHp += 25;
        player.hp = player.maxHp;
    }
    if (pick.id === "lure") player.magnet *= 1.7;
    ui.hideChoices();
    ui.updateSpells(owned);
    playFx("gold", player.x, player.y, 110, 18, false, true);
    state = "play";
}

// ------------------------------------------------------------------ Frame
const knightFrames = { idle: [0, 4], run: [2, 16], hurt: [6, 4], dead: [7, 4] };

game.update((_updater, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const input = game.input;
    soundBudget = 3;

    // Keep about VIEW_H art pixels on screen, whatever the window size
    camera.orthoSize = VIEW_H / 2;

    if (state === "title") {
        if (ui.consumeStart() || input.isPressed("restart")) startRun();
        animateKnight(dt, false);
        updateCamera(dt);
        return;
    }
    if (state === "over" || state === "dawn") {
        if (input.isPressed("restart") || ui.consumeStart()) startRun();
        animateKnight(dt, false);
        updateFx(dt);
        updateCamera(dt);
        return;
    }
    if (state === "choose") {
        for (let k = 0; k < 3; k++) if (input.isPressed(`pick${k + 1}`)) ui.pickChoice(k);
        return;
    }
    if (input.isPressed("pause")) {
        state = state === "paused" ? "play" : "paused";
        ui.showPause(state === "paused");
        return;
    }
    if (state === "paused") return;

    time += dt;
    updateNight();

    // Knight movement
    let mx = input.axis("left", "right");
    let my = input.axis("down", "up");
    const touch = ui.touchVector();
    if (touch) {
        mx = touch.x;
        my = touch.y;
    }
    const len = Math.hypot(mx, my);
    if (len > 1) {
        mx /= len;
        my /= len;
    }
    player.x = Math.max(-ARENA, Math.min(ARENA, player.x + mx * player.speed * dt));
    player.y = Math.max(-ARENA, Math.min(ARENA, player.y + my * player.speed * dt));
    if (mx !== 0) player.facing = mx > 0 ? 1 : -1;
    player.invuln = Math.max(0, player.invuln - dt);
    player.hp = Math.min(player.maxHp, player.hp + dt * 0.6);
    animateKnight(dt, len > 0.1);

    spawnMonsters(dt);
    buildGrid();
    moveMonsters(dt);
    castSpells(dt);
    updateShots(dt);
    updateShards(dt);
    updateFx(dt);
    updateCamera(dt);
    ui.updateHud({ hp: player.hp, maxHp: player.maxHp, xp: player.xp, need: player.need, level: player.level, left: Math.max(0, NIGHT - time), kills: player.kills });

    if (player.hp <= 0) endRun(false);
    else if (time >= NIGHT) endRun(true);
});

function startRun() {
    resetRun();
    state = "play";
    ui.hideScreens();
    sounds.music.stop();
    sounds.music.playLoop();
}

function endRun(won) {
    state = won ? "dawn" : "over";
    if (won) {
        for (let i = 0; i < MAX_ENEMIES; i++) if (ealive[i]) killEnemy(i, false), playFx("bloom", ex[i], ey[i], 40, 30);
        sounds.level.play();
    } else {
        sounds.hurt.play();
        sounds.music.stop();
    }
    const minutes = Math.floor(time / 60);
    const seconds = String(Math.floor(time % 60)).padStart(2, "0");
    ui.showEnd(won, { kills: player.kills, level: player.level, time: `${minutes}:${seconds}` });
}

function updateNight() {
    const k = time / NIGHT;
    const dawn = Math.max(0, Math.min(1, (k - 0.72) / 0.28));
    floorMaterial.set("uDawn", dawn * dawn);
    sky.intensity = 0.5 + dawn * 0.9;
    moon.intensity = 0.22 + dawn * 0.6;
    lantern.intensity = 110 * (1 - dawn * 0.6) * (0.95 + Math.sin(time * 9) * 0.03 + Math.sin(time * 23) * 0.02);
    camera.clearColor = dawn > 0 ? mixColor("#05080b", "#5b3a3a", dawn) : "#05080b";
}

function mixColor(a, b, k) {
    const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
    const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
    return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * k)).join(",")})`;
}

function spawnMonsters(dt) {
    const minute = Math.min(WAVES.length - 1, Math.floor(time / 60));
    const wave = WAVES[minute];
    const rate = 1 + time * 0.034; // monsters per second
    timers.spawn -= dt;
    while (timers.spawn <= 0) {
        timers.spawn += 1 / rate;
        if (alive >= MAX_ENEMIES - 20) break;
        spawnEnemy(wave[Math.floor(game.random.float(0, wave.length))]);
    }
    for (const at of BOSS_TIMES) {
        if (time >= at && timers.boss < at) {
            timers.boss = at;
            spawnEnemy(9);
            ui.banner(t("boss"));
            shake = 6;
        }
    }
}

function moveMonsters(dt) {
    const sigil = owned.sigil ?? 0;
    const sigilR2 = sigil ? (62 + sigil * 10) ** 2 : 0;
    const slow = 1 - (0.25 + sigil * 0.08);
    for (let i = 0; i < MAX_ENEMIES; i++) {
        if (!ealive[i]) continue;
        const m = MONSTERS[etype[i]];
        let dx = player.x - ex[i];
        let dy = player.y - ey[i];
        const d2 = dx * dx + dy * dy;
        const d = Math.sqrt(d2) || 1;
        let speed = m.speed;
        if (sigil && d2 < sigilR2) speed *= slow;
        dx /= d;
        dy /= d;
        if (m.wobble) {
            const w = Math.sin(time * 6 + ephase[i]) * 0.6;
            const wx = -dy * w;
            dy = dy + dx * w;
            dx = dx + wx;
        }
        ex[i] += (dx * speed + ekx[i]) * dt;
        ey[i] += (dy * speed + eky[i]) * dt;
        ekx[i] *= 1 - Math.min(1, dt * 8);
        eky[i] *= 1 - Math.min(1, dt * 8);
        eflash[i] = Math.max(0, eflash[i] - dt);
        eorbitCd[i] = Math.max(0, eorbitCd[i] - dt);
        ewardCd[i] = Math.max(0, ewardCd[i] - dt);

        // Push apart from neighbors so the horde spreads instead of stacking
        const size = 11 * m.scale;
        query(ex[i], ey[i], size, (j, dd) => {
            if (j === i || dd < 0.01) return;
            const r = size + 11 * MONSTERS[etype[j]].scale;
            if (dd >= r * r) return;
            const dist = Math.sqrt(dd);
            const push = ((r - dist) / dist) * 0.25;
            ex[i] += (ex[i] - ex[j]) * push;
            ey[i] += (ey[i] - ey[j]) * push;
        });

        // Touching the knight hurts
        if (d < size + 10 && player.invuln <= 0) {
            player.hp -= m.damage;
            player.invuln = 0.6;
            player.hurtT = 0.3;
            shake = Math.max(shake, 4);
            sounds.hurt.play();
            ui.hurt();
        }

        // Despawn monsters left far behind
        if (d > 900 && !m.boss) {
            killEnemy(i, false);
            continue;
        }
        const o = enemyObjects[i];
        const bob = Math.abs(Math.sin(time * 9 + ephase[i]));
        const p = o.transform.position;
        p.x = Math.round(ex[i]);
        p.y = Math.round(ey[i] + bob * 2);
        // Lower monsters are drawn in front of higher ones
        p.z = 2 - ey[i] * 0.0005;
        const s = 32 * m.scale;
        o.transform.scale.x = (dx < 0 ? -1 : 1) * s * (1 + bob * 0.06);
        o.transform.scale.y = s * (1 - bob * 0.06);
        const hit = eflash[i] > 0;
        const material = hit ? `mat_mon_${etype[i]}_hit` : `mat_mon_${etype[i]}`;
        if (o.material !== material) o.material = material;
    }
}

function updateShots(dt) {
    for (let s = 0; s < MAX_SHOTS; s++) {
        const shot = shots[s];
        const o = shotObjects[s];
        if (!shot.alive) continue;
        shot.life -= dt;
        shot.x += shot.vx * dt;
        shot.y += shot.vy * dt;
        if (shot.life <= 0 || shot.pierce <= 0) {
            hideShot(s);
            continue;
        }
        query(shot.x, shot.y, 12, (i) => {
            if (shot.pierce <= 0 || shot.hit.has(i)) return;
            shot.hit.add(i);
            shot.pierce--;
            damageEnemy(i, shot.damage, shot.vx * 0.4, shot.vy * 0.4);
        });
        o.transform.position = { x: shot.x, y: shot.y, z: 4 };
        o.transform.rotation.z = Math.atan2(shot.vy, shot.vx);
        const frame = Math.floor(game.time * 16) % EFFECTS.crescent.frames;
        o.material = `fx_crescent_${frame}`;
    }
}

function updateShards(dt) {
    shardFrame = Math.floor(game.time * 12) % 12;
    const magnet2 = player.magnet * player.magnet;
    for (let i = 0; i < MAX_SHARDS; i++) {
        if (!salive[i]) continue;
        const dx = player.x - sx[i];
        const dy = player.y - sy[i];
        const d2 = dx * dx + dy * dy;
        if (d2 < magnet2) spull[i] = 1;
        if (spull[i]) {
            const d = Math.sqrt(d2) || 1;
            const speed = 140 + (1 - Math.min(1, d / 200)) * 200;
            sx[i] += (dx / d) * speed * dt;
            sy[i] += (dy / d) * speed * dt;
            if (d < 10) {
                hideShard(i);
                player.xp += svalue[i];
                sounds.coin.play();
                if (player.xp >= player.need) {
                    player.xp -= player.need;
                    player.level++;
                    player.need = Math.round(6 + player.level * 4.5 + player.level * player.level * 0.35);
                    player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.15);
                    if (offerUpgrades()) return;
                }
                continue;
            }
        }
        const o = shardObjects[i];
        o.transform.position = { x: sx[i], y: sy[i] + Math.sin(game.time * 4 + i) * 1.5, z: 1 };
        o.material = `mat_shard_${(shardFrame + i) % 12}`;
    }
}

function updateFx(dt) {
    for (let i = 0; i < MAX_FX; i++) {
        const f = fx[i];
        if (!f.alive) continue;
        f.t += dt;
        let frame = Math.floor(f.t * f.fps);
        if (frame >= f.frames) {
            if (!f.loop) {
                hideFx(i);
                continue;
            }
            frame %= f.frames;
        }
        if (f.follow) {
            f.x = player.x;
            f.y = player.y;
        }
        const o = fxObjects[i];
        o.transform.position = { x: f.x, y: f.y, z: 5 + i * 0.001 };
        o.transform.scale = { x: f.size, y: f.size, z: 1 };
        o.material = `fx_${f.name}_${frame}`;
    }
    for (let i = 0; i < flashes.length; i++) {
        flashLife[i] = Math.max(0, flashLife[i] - dt);
        flashes[i].intensity = flashLife[i] > 0 ? flashPower[i] * (flashLife[i] / 0.3) : 0;
    }
}

function animateKnight(dt, moving) {
    player.anim += dt;
    player.hurtT = Math.max(0, player.hurtT - dt);
    let [row, count] = moving ? knightFrames.run : knightFrames.idle;
    let fps = moving ? 16 : 7;
    if (state === "over") [row, count, fps] = [...knightFrames.dead, 6];
    let frame = Math.floor(player.anim * fps);
    frame = state === "over" ? Math.min(frame, count - 1) : frame % count;
    const col = frame % 8;
    const r = row + Math.floor(frame / 8);
    // Both knight materials share one frame array, changed in place (no allocation per frame)
    cell(knightTex, 32, 32, col, r, knightFrame);
    const blink = player.invuln > 0 && Math.floor(player.invuln * 20) % 2 === 0;
    knight.material = player.hurtT > 0 || blink ? "mat_knight_hit" : "mat_knight";
    knight.transform.position = { x: Math.round(player.x), y: Math.round(player.y + 10), z: 3 - player.y * 0.0005 };
    knight.transform.scale.x = player.facing * 64;
    lantern.position = { x: player.x + player.facing * 8, y: player.y + 14, z: 45 };
}

function updateCamera(dt) {
    shake = Math.max(0, shake - dt * 20);
    const jx = shake > 0 ? game.random.float(-shake, shake) : 0;
    const jy = shake > 0 ? game.random.float(-shake, shake) : 0;
    const cx = Math.round(player.x + jx);
    const cy = Math.round(player.y + jy);
    camera.position = { x: cx, y: cy, z: 300 };
    camera.target = { x: cx, y: cy, z: 0 };
}

game.ready().then(() => {
    if (holyA && holyB) ui.setSheets({ a: holyA.src, b: holyB.src });
    resetRun();
    ui.showTitle(!holyA);
    if (game.renderBackend?.backendType !== "webgl2") ui.noWebGL();
});

window.brioGame = game;
