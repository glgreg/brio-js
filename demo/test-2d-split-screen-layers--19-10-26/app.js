import {
    BrioGame,
    BrioObject2D,
    BrioObject3D,
    BrioSprite,
    BrioLayer,
    BrioViewport,
    BrioCamera2D,
    BrioCamera3D,
    BrioMesh,
    BrioMaterial,
    BrioCollision,
    BrioMath,
} from "../../dist/index.js";

const VIEW_W = 960;
const VIEW_H = 540;
const WORLD_W = 2400;
const WORLD_H = 1200;
const SHIP_SPEED = 260;
const BULLET_SPEED = 620;
const BULLET_LIFE = 1.6;
const FIRE_COOLDOWN = 0.12;
const STALE_PROBE_SIZE = 64;
/** Position tolerance (px) between the engine state and the shadow simulation (Float32 storage rounding). */
const INTEGRITY_TOLERANCE = 1;

// -------------------------------------------------------------
// DOM references
// -------------------------------------------------------------
const container = document.getElementById("canvas_container");
const fpsDisplay = document.getElementById("fps_display");
const backendDisplay = document.getElementById("backend_display");
const scoreInfo = document.getElementById("score_info");
const logOutput = document.getElementById("log_output");
const statPasses = document.getElementById("stat_passes");
const statObjects = document.getElementById("stat_objects");
const statStatic = document.getElementById("stat_static");
const statLayers = document.getElementById("stat_layers");
const statEcs = document.getElementById("stat_ecs");
const statBullets = document.getElementById("stat_bullets");
const statStale = document.getElementById("stat_stale");
const statViolations = document.getElementById("stat_violations");
const chkAutopilot = document.getElementById("chk_autopilot");
const chkStaleProbe = document.getElementById("chk_stale_probe");
const chkDebugBounds = document.getElementById("chk_debug_bounds");
const chkParallax = document.getElementById("chk_parallax");

function logEvent(message, type = "info") {
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement("div");
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${time}] ${message}`;
    logOutput.appendChild(entry);
    logOutput.scrollTop = logOutput.scrollHeight;
    const line = `[BrioSplit:${type.toUpperCase()}] ${message}`;
    if (type === "error") console.error(line);
    else if (type === "warn") console.warn(line);
    else console.log(line);
}

// -------------------------------------------------------------
// Procedural textures (no binary assets are shipped with this demo)
// -------------------------------------------------------------
function makeSprite(name, width, height, draw) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    draw(canvas.getContext("2d"), width, height);
    return new BrioSprite(name, canvas.toDataURL("image/png"));
}

function drawShip(color) {
    return (ctx, w, h) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(w, h / 2);
        ctx.lineTo(4, 4);
        ctx.lineTo(w * 0.3, h / 2);
        ctx.lineTo(4, h - 4);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#f8fafc";
        ctx.lineWidth = 2;
        ctx.stroke();
    };
}

function drawBullet(color) {
    return (ctx, w, h) => {
        const g = ctx.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2);
        g.addColorStop(0, "#ffffff");
        g.addColorStop(0.4, color);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
    };
}

const sprites = [
    makeSprite("spr_ship_p1", 48, 48, drawShip("#38bdf8")),
    makeSprite("spr_ship_p2", 48, 48, drawShip("#f59e0b")),
    makeSprite("spr_bullet_p1", 14, 14, drawBullet("#38bdf8")),
    makeSprite("spr_bullet_p2", 14, 14, drawBullet("#f59e0b")),
    makeSprite("spr_star", 4, 4, (ctx) => {
        ctx.fillStyle = "#e2e8f0";
        ctx.fillRect(0, 0, 4, 4);
    }),
    makeSprite("spr_mountain", 480, 220, (ctx, w, h) => {
        ctx.fillStyle = "#1e293b";
        ctx.beginPath();
        ctx.moveTo(0, h);
        ctx.lineTo(w * 0.2, h * 0.35);
        ctx.lineTo(w * 0.38, h * 0.7);
        ctx.lineTo(w * 0.6, h * 0.1);
        ctx.lineTo(w * 0.82, h * 0.6);
        ctx.lineTo(w, h * 0.3);
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();
    }),
    makeSprite("spr_tile", 64, 64, (ctx, w, h) => {
        ctx.fillStyle = "#14532d";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = 2;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        ctx.fillStyle = "#16a34a";
        ctx.fillRect(w / 2 - 6, h / 2 - 6, 12, 12);
    }),
    makeSprite("spr_hud_bar", VIEW_W, 28, (ctx, w, h) => {
        ctx.fillStyle = "rgba(2, 6, 23, 0.78)";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#94a3b8";
        ctx.font = "13px monospace";
        ctx.fillText("ui layer (screen space): drawn once over both viewports", 12, 18);
    }),
    makeSprite("spr_divider", VIEW_W, 4, (ctx, w, h) => {
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(0, 0, w, h);
    }),
];

// -------------------------------------------------------------
// Game setup
// -------------------------------------------------------------
const game = new BrioGame({
    width: VIEW_W,
    height: VIEW_H,
    container,
    dimension: "hybrid",
    maxEntities: 2048,
});
game.background.color = "#020617";
game.rendering.mode = "smooth";
game.debugging.console.enabled = true;
game.useKeyboard();

const skyLayer = new BrioLayer({
    name: "sky",
    order: -30,
    policy: "parallax",
    scrollFactor: { x: 0.15, y: 0.1 },
});
const terrainLayer = new BrioLayer({ name: "terrain", order: -20, policy: "static" });
const hudLayer = new BrioLayer({ name: "hud", order: 100, policy: "ui" });

const camP1 = new BrioCamera2D(
    "cam_p1",
    { x: 0, y: 0 },
    undefined,
    BrioViewport.fromPreset("split-horizontal-top"),
);
const camP2 = new BrioCamera2D(
    "cam_p2",
    { x: 0, y: 0 },
    undefined,
    BrioViewport.fromPreset("split-horizontal-bottom"),
);
const camRadar = new BrioCamera3D("cam_radar", {
    position: { x: 0, y: 2.2, z: 4.2 },
    target: { x: 0, y: 0, z: 0 },
    aspect: 1,
    viewport: BrioViewport.fromPreset("minimap-top-right"),
    clearColor: "#0b1220",
});

/** Bullet metadata: velocity, remaining life, and the shadow-simulated expected position. */
const bulletMeta = new Map();
/** Destroyed bullet references kept on purpose to exercise stale handles. */
const staleHandles = [];
const score = { p1: 0, p2: 0 };
const cooldown = { p1: 0, p2: 0 };
let staleWrites = 0;
let violations = 0;
let lastViolationLog = 0;
let checkpointTaken = false;

game.preload(() => [
    ...sprites,
    BrioMesh.createBox("mesh_core", 1.2, 1.2, 1.2),
    BrioMesh.createSphere("mesh_orb", 0.35, 12, 12),
    new BrioMaterial("mat_core", { color: "#38bdf8", shading: "lambert" }),
    new BrioMaterial("mat_orb", { color: "#f59e0b", shading: "lambert" }),
]);

game.load(() => {
    // Parallax sky: stars and a mountain range scrolling at a fraction of the camera speed
    const sky = [];
    for (let i = 0; i < 140; i++) {
        const star = new BrioObject2D(`obj_star_${i}`, "spr_star", 0);
        star.transform.position = {
            x: BrioMath.randomRange(0, WORLD_W * 0.5),
            y: BrioMath.randomRange(0, WORLD_H * 0.35),
        };
        skyLayer.addObject(star);
        sky.push(star);
    }
    for (let i = 0; i < 4; i++) {
        const mountain = new BrioObject2D(`obj_mountain_${i}`, "spr_mountain", 1);
        mountain.transform.position = { x: i * 420 - 60, y: 120 };
        skyLayer.addObject(mountain);
        sky.push(mountain);
    }

    // Static terrain: rasterized once into an offscreen cache per camera, reused while nothing moves
    const terrain = [];
    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 18; col++) {
            if ((row + col) % 3 === 0) continue;
            const tile = new BrioObject2D(`obj_tile_${row}_${col}`, "spr_tile", 0);
            tile.transform.position = { x: 120 + col * 120, y: 140 + row * 110 };
            terrainLayer.addObject(tile);
            terrain.push(tile);
        }
    }

    // Screen-space HUD: one bar on top and the split divider, drawn once over all viewports
    const hudBar = new BrioObject2D("obj_hud_bar", "spr_hud_bar", 0);
    hudBar.transform.position = { x: 0, y: VIEW_H - 28 };
    const divider = new BrioObject2D("obj_divider", "spr_divider", 1);
    divider.transform.position = { x: 0, y: VIEW_H / 2 - 2 };
    hudLayer.addObject(hudBar);
    hudLayer.addObject(divider);

    // Players and bullet prefabs on the default dynamic layer
    const p1 = new BrioObject2D("obj_p1", "spr_ship_p1", 5);
    p1.transform.position = { x: 400, y: 500 };
    p1.addCollisionMask("circle", "trigger", 8, 8, 32, 32);
    const p2 = new BrioObject2D("obj_p2", "spr_ship_p2", 5);
    p2.transform.position = { x: 1800, y: 700 };
    p2.transform.rotation = Math.PI;
    p2.addCollisionMask("circle", "trigger", 8, 8, 32, 32);

    const bulletP1 = new BrioObject2D("obj_bullet_p1", "spr_bullet_p1", 3);
    const bulletP2 = new BrioObject2D("obj_bullet_p2", "spr_bullet_p2", 3);
    for (const prefab of [bulletP1, bulletP2]) {
        prefab.transform.visibility = false;
        prefab.addCollisionMask("circle", "trigger", 0, 0, 14, 14);
    }

    for (const cam of [camP1, camP2]) cam.setBounds(0, 0, WORLD_W, WORLD_H);
    camP1.follow(p1, 0.12, { x: 120, y: 60 });
    camP2.follow(p2, 0.12, { x: 120, y: 60 });

    // 3D radar rendered by the Canvas2D software rasterizer in a picture-in-picture viewport
    const core = new BrioObject3D("obj_radar_core", "mesh_core", "mat_core");
    const orb = new BrioObject3D("obj_radar_orb", "mesh_orb", "mat_orb");
    orb.transform.position = { x: 1.3, y: 0.4, z: 0 };
    core.addChild(orb);

    return [
        skyLayer,
        terrainLayer,
        hudLayer,
        camP1,
        camP2,
        camRadar,
        ...sky,
        ...terrain,
        hudBar,
        divider,
        p1,
        p2,
        bulletP1,
        bulletP2,
        core,
    ];
});

// -------------------------------------------------------------
// Gameplay helpers
// -------------------------------------------------------------
function fire(owner, prefabName, angle) {
    const prefab = game.gameObjects.get(prefabName);
    const bullet = game.instantiate(prefab);
    bullet.transform.visibility = true;
    const cx = owner.transform.position.x + 24 - 7;
    const cy = owner.transform.position.y + 24 - 7;
    bullet.transform.position = { x: cx, y: cy };
    const vx = Math.cos(angle) * BULLET_SPEED;
    const vy = Math.sin(angle) * BULLET_SPEED;
    bulletMeta.set(bullet, { vx, vy, life: BULLET_LIFE, ex: cx, ey: cy, owner: owner.name });
}

function retire(bullet) {
    bulletMeta.delete(bullet);
    game.destroy(bullet);
    staleHandles.push(bullet);
    if (staleHandles.length > STALE_PROBE_SIZE) staleHandles.shift();
}

function steer(ship, dx, dy, dt) {
    if (dx === 0 && dy === 0) return;
    const len = Math.hypot(dx, dy);
    ship.transform.position.x = BrioMath.clamp(
        ship.transform.position.x + (dx / len) * SHIP_SPEED * dt,
        0,
        WORLD_W - 48,
    );
    ship.transform.position.y = BrioMath.clamp(
        ship.transform.position.y + (dy / len) * SHIP_SPEED * dt,
        0,
        WORLD_H - 48,
    );
    ship.transform.rotation = Math.atan2(dy, dx);
}

function autopilot(ship, phase, t) {
    return { dx: Math.cos(t * 0.6 + phase), dy: Math.sin(t * 0.9 + phase * 2) };
}

function burst() {
    const p1 = game.gameObjects.get("obj_p1");
    const p2 = game.gameObjects.get("obj_p2");
    for (let i = 0; i < 150; i++) {
        const a = (i / 150) * Math.PI * 2;
        fire(p1, "obj_bullet_p1", a);
        fire(p2, "obj_bullet_p2", a);
    }
    logEvent(
        `Burst spawned 300 bullets through instantiate() (ECS active: ${game.ecsWorld.activeCount}).`,
        "success",
    );
}

function reconcileAfterRestore() {
    // Objects spawned after the checkpoint were unregistered; destroyed ones came back to life
    for (const [bullet, meta] of [...bulletMeta]) {
        if (game.gameObjects.get(bullet.name) !== bullet) {
            bulletMeta.delete(bullet);
            continue;
        }
        // Restored bullets jump back to their checkpoint position: resync the shadow simulation
        meta.ex = bullet.transform.position.x;
        meta.ey = bullet.transform.position.y;
        meta.life = BULLET_LIFE;
    }
    for (const obj of game.gameObjects.values()) {
        if (!obj.name.startsWith("obj_bullet_p") || !obj.name.includes("-") || bulletMeta.has(obj))
            continue;
        bulletMeta.set(obj, {
            vx: 0,
            vy: 0,
            life: BULLET_LIFE,
            ex: obj.transform.position.x,
            ey: obj.transform.position.y,
            owner: obj.name.includes("p1") ? "obj_p1" : "obj_p2",
        });
    }
    for (let i = staleHandles.length - 1; i >= 0; i--) {
        if (game.gameObjects.get(staleHandles[i].name) === staleHandles[i])
            staleHandles.splice(i, 1);
    }
}

// -------------------------------------------------------------
// Update loop
// -------------------------------------------------------------
let elapsed = 0;
let fpsSmoothed = 60;

game.update((updater, dt) => {
    elapsed += dt;
    if (dt > 0) fpsSmoothed = BrioMath.lerp(fpsSmoothed, 1 / dt, 0.05);

    const p1 = updater.getObject("obj_p1");
    const p2 = updater.getObject("obj_p2");
    const kb = game.keyboard;
    cooldown.p1 -= dt;
    cooldown.p2 -= dt;

    let in1 = {
        dx: (kb.isDown("d") ? 1 : 0) - (kb.isDown("a") ? 1 : 0),
        dy: (kb.isDown("s") ? 1 : 0) - (kb.isDown("w") ? 1 : 0),
    };
    let in2 = {
        dx: (kb.isDown("ArrowRight") ? 1 : 0) - (kb.isDown("ArrowLeft") ? 1 : 0),
        dy: (kb.isDown("ArrowDown") ? 1 : 0) - (kb.isDown("ArrowUp") ? 1 : 0),
    };
    let fire1 = kb.isDown("f");
    let fire2 = kb.isDown("l");
    if (chkAutopilot.checked) {
        if (in1.dx === 0 && in1.dy === 0) in1 = autopilot(p1, 0, elapsed);
        if (in2.dx === 0 && in2.dy === 0) in2 = autopilot(p2, 2.1, elapsed);
        fire1 = fire2 = true;
    }
    steer(p1, in1.dx, in1.dy, dt);
    steer(p2, in2.dx, in2.dy, dt);
    if (fire1 && cooldown.p1 <= 0) {
        fire(p1, "obj_bullet_p1", p1.transform.rotation);
        cooldown.p1 = FIRE_COOLDOWN;
    }
    if (fire2 && cooldown.p2 <= 0) {
        fire(p2, "obj_bullet_p2", p2.transform.rotation);
        cooldown.p2 = FIRE_COOLDOWN;
    }

    // Stale-handle probe: write garbage through references to destroyed bullets
    if (chkStaleProbe.checked) {
        for (const stale of staleHandles) {
            stale.transform.position.x += 5000;
            stale.transform.position.y -= 5000;
            staleWrites++;
        }
    }

    // Integrate bullets, checking the engine state against the shadow simulation first
    for (const [bullet, meta] of [...bulletMeta]) {
        const px = bullet.transform.position.x;
        const py = bullet.transform.position.y;
        if (
            Math.abs(px - meta.ex) > INTEGRITY_TOLERANCE ||
            Math.abs(py - meta.ey) > INTEGRITY_TOLERANCE
        ) {
            violations++;
            meta.ex = px;
            meta.ey = py;
            if (elapsed - lastViolationLog > 1) {
                lastViolationLog = elapsed;
                logEvent(
                    `Integrity violation on ${bullet.name}: engine (${px.toFixed(1)}, ${py.toFixed(1)})`,
                    "error",
                );
            }
        }
        meta.ex += meta.vx * dt;
        meta.ey += meta.vy * dt;
        bullet.transform.position.x = px + meta.vx * dt;
        bullet.transform.position.y = py + meta.vy * dt;
        meta.life -= dt;

        const target = meta.owner === "obj_p1" ? p2 : p1;
        if (BrioCollision.isColliding(bullet, target)) {
            if (meta.owner === "obj_p1") score.p1++;
            else score.p2++;
            target.transform.opacity = 0.35;
            retire(bullet);
            continue;
        }
        const out =
            bullet.transform.position.x < -20 ||
            bullet.transform.position.x > WORLD_W + 20 ||
            bullet.transform.position.y < -20 ||
            bullet.transform.position.y > WORLD_H + 20;
        if (meta.life <= 0 || out) retire(bullet);
    }
    p1.transform.opacity = Math.min(1, p1.transform.opacity + dt * 2);
    p2.transform.opacity = Math.min(1, p2.transform.opacity + dt * 2);

    // 3D radar spin (child orb follows through BrioObject3D.addChild)
    const core = game.gameObjects3D.get("obj_radar_core");
    core.transform.rotation.y = BrioMath.wrap(core.transform.rotation.y + dt * 0.9, 0, Math.PI * 2);
    core.transform.rotation.x = 0.35;

    skyLayer.visible = chkParallax.checked;
    game.debugging.render.showRenderBounds = chkDebugBounds.checked;
    game.debugging.render.showCollisionBounds = chkDebugBounds.checked;
});

// -------------------------------------------------------------
// Telemetry
// -------------------------------------------------------------
setInterval(() => {
    const stats = game.renderStats;
    const world = game.ecsWorld;
    fpsDisplay.textContent = `FPS: ${fpsSmoothed.toFixed(0)}`;
    backendDisplay.textContent = `3D backend: ${game.renderBackend?.backendType ?? "--"}`;
    scoreInfo.textContent = `P1 ${score.p1} x ${score.p2} P2`;
    statPasses.textContent = `${stats.passes2D} / ${stats.passes3D}`;
    statObjects.textContent = `${stats.objectsDrawn} / ${stats.objectsCulled}`;
    statStatic.textContent = `${stats.staticRedraws} / ${stats.staticRedrawsTotal}`;
    statLayers.textContent = [...game.layers.values()]
        .sort((a, b) => a.order - b.order)
        .map((l) => `${l.name}:${l.policy}`)
        .join(" ");
    statEcs.textContent = `${world.activeCount} / ${world.pooledCount} / ${world.highWaterMark}`;
    statBullets.textContent = `${bulletMeta.size}`;
    statStale.textContent = `${staleWrites}`;
    statViolations.textContent = `${violations}`;
    statViolations.style.color = violations === 0 ? "var(--accent-green)" : "var(--accent-rose)";
}, 250);

// -------------------------------------------------------------
// Controls
// -------------------------------------------------------------
document.getElementById("btn_burst").addEventListener("click", burst);

document.getElementById("btn_toggle_split").addEventListener("click", () => {
    if (game.cameras2D.has("cam_p2")) {
        game.removeCamera(camP2);
        camP1.viewport = BrioViewport.fromPreset("fullscreen");
        hudLayer.getSortedObjects().find((o) => o.name === "obj_divider").transform.visibility =
            false;
        logEvent("Single camera: cam_p1 now renders full-screen.", "info");
    } else {
        camP1.viewport = BrioViewport.fromPreset("split-horizontal-top");
        game.addCamera(camP2);
        hudLayer.getSortedObjects().find((o) => o.name === "obj_divider").transform.visibility =
            true;
        logEvent("Split-screen: cam_p1 top, cam_p2 bottom.", "info");
    }
});

document.getElementById("btn_checkpoint").addEventListener("click", () => {
    game.createCheckPoint();
    checkpointTaken = true;
    logEvent(
        `Checkpoint created with ${game.gameObjects.size} 2D objects (${bulletMeta.size} bullets).`,
        "success",
    );
});

document.getElementById("btn_restore").addEventListener("click", () => {
    if (!checkpointTaken || !game.restoreCheckPoint()) {
        logEvent("No checkpoint to restore.", "warn");
        return;
    }
    reconcileAfterRestore();
    logEvent(
        `Checkpoint restored: ${game.gameObjects.size} 2D objects, ECS active ${game.ecsWorld.activeCount}.`,
        "success",
    );
});

// Exposed for automated browser checks
window.__brioSplitDemo = {
    game,
    readIntegrity: () => ({
        violations,
        staleWrites,
        liveBullets: bulletMeta.size,
        staleHeld: staleHandles.length,
    }),
    burst,
};

game.ready().then(() => {
    logEvent(
        `Scene loaded: ${game.gameObjects.size} 2D objects, ${game.layers.size} layers, ${game.cameras2D.size} 2D cameras, ${game.cameras3D.size} 3D camera.`,
        "success",
    );
    logEvent(`3D backend selected by BrioRenderer: ${game.renderBackend?.backendType}.`, "info");
});
