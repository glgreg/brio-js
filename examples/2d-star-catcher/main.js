// Star Catcher: a complete 2D BrioJS game. Catch the falling stars, dodge the rocks.
// Shows: scenes (title / play) with preload-load-restart, layers (static + dynamic + ui), BrioText, BrioCamera2D
// shake, fixedUpdate with render interpolation, collision events, an input map (keyboard + gamepad), seeded
// randomness, Web Audio buses, and local save data.
import {
    BrioGame,
    BrioScene,
    BrioLayer,
    BrioObject2D,
    BrioText,
    BrioSprite,
    BrioAudio,
    BrioAudioMixer,
    BrioCamera2D,
    BrioCollision,
    BrioInputMap,
    BrioStorage,
} from "../../dist/index.js";
import { svgSprite, synthWav } from "../shared/procedural-assets.js";

const WIDTH = 480;
const HEIGHT = 640;
const PLAYER_SPEED = 320;
const STAR_COUNT = 5;
const ROCK_COUNT = 4;
const BEST_SCORE_KEY = "brio-example-star-catcher-best";

const container = document.getElementById("game");
// ?seed=123 replays the exact same run (stars, rocks and shakes come from game.random)
const seedParam = new URLSearchParams(location.search).get("seed");

const game = new BrioGame({
    width: WIDTH,
    height: HEIGHT,
    container,
    dimension: "2d",
    fixedTimestep: 1 / 60,
    interpolate: true,
    seed: seedParam !== null ? Number(seedParam) : undefined,
});
game.background.color = "linear-gradient(#0b1026, #1d2457)";
game.useKeyboard();
game.useGamepad();

// Gameplay reads actions, not keys: players can use the arrows, WASD or a gamepad
game.input
    .bind("left", "ArrowLeft", "a", BrioInputMap.padButton("left"), BrioInputMap.padAxis(0, -1))
    .bind("right", "ArrowRight", "d", BrioInputMap.padButton("right"), BrioInputMap.padAxis(0, 1))
    .bind("start", " ", "Enter", BrioInputMap.padButton("start"), BrioInputMap.padButton("south"))
    .bind("retry", "r", BrioInputMap.padButton("south"))
    .bind("back", "Escape", BrioInputMap.padButton("select"))
    .bind("mute", "m");

// -> ASSETS (procedural: no files to download)
game.preload(() => [
    new BrioSprite(
        "spr_player",
        svgSprite(
            64,
            32,
            `<path d="M4 28 L32 4 L60 28 Z" fill="#7dd3fc" stroke="#e0f2fe" stroke-width="3"/>`,
        ),
    ),
    new BrioSprite(
        "spr_star",
        svgSprite(
            28,
            28,
            `<path d="M14 1 L17.5 10 L27 10.5 L19.5 16.5 L22 26 L14 20.5 L6 26 L8.5 16.5 L1 10.5 L10.5 10 Z" fill="#fde047"/>`,
        ),
    ),
    new BrioSprite(
        "spr_rock",
        svgSprite(
            36,
            36,
            `<circle cx="18" cy="18" r="16" fill="#78716c" stroke="#a8a29e" stroke-width="3"/>`,
        ),
    ),
    new BrioSprite("spr_dot", svgSprite(3, 3, `<rect width="3" height="3" fill="#cbd5e1"/>`)),
    new BrioAudio("aud_catch", synthWav({ duration: 0.15, frequency: (t) => 660 + t * 2400 })),
    new BrioAudio(
        "aud_hit",
        synthWav({ duration: 0.3, frequency: () => 90, wave: "noise", volume: 0.5 }),
    ),
    new BrioAudio(
        "aud_music",
        synthWav({
            duration: 2,
            frequency: (t) => [220, 277, 330, 277][Math.floor(t * 2) % 4],
            volume: 0.12,
        }),
        {
            bus: "bgm",
        },
    ),
]);

// Background stars on a "static" layer (rasterized once and cached) and the HUD text on a "ui" layer
const hud = new BrioText("txt_hud", "", {
    size: 18,
    color: "#e2e8f0",
    strokeColor: "#0b1026",
    strokeWidth: 4,
});
game.load(() => {
    const sky = new BrioLayer({ name: "sky", order: -10, policy: "static" });
    const ui = new BrioLayer({ name: "ui", order: 100, policy: "ui" });
    const dots = [];
    for (let i = 0; i < 60; i++) {
        const dot = new BrioObject2D(`obj_dot_${i}`, "spr_dot", 0);
        dot.transform.position = {
            x: game.random.float(0, WIDTH),
            y: game.random.float(0, HEIGHT),
        };
        sky.addObject(dot);
        dots.push(dot);
    }
    hud.transform.position = { x: 12, y: 10 };
    ui.addObject(hud);
    return [sky, ui, hud, ...dots];
});

// -> TITLE SCENE
const title = new BrioScene("title").load(() => {
    const logo = new BrioText("txt_title", "Star Catcher", {
        size: 52,
        weight: "bold",
        color: "#fde047",
        shadowColor: "rgba(0, 0, 0, 0.6)",
        shadowBlur: 8,
    });
    logo.transform.position = { x: (WIDTH - logo.transform.size.x) / 2, y: HEIGHT / 3 };
    const hint = new BrioText(
        "txt_hint",
        "Press Space, Enter or Start to play\nArrows / WASD / gamepad to move",
        {
            size: 18,
            color: "#cbd5e1",
            align: "center",
        },
    );
    hint.transform.position = { x: (WIDTH - hint.transform.size.x) / 2, y: HEIGHT / 3 + 90 };
    return [logo, hint];
});

// -> PLAY SCENE
const camera = new BrioCamera2D("cam_play");
camera.random = game.random; // reproducible shakes with a fixed seed

const play = new BrioScene("play").load(() => {
    const player = new BrioObject2D("obj_player", "spr_player", 2);
    player.transform.size = { x: 64, y: 32 };
    player.transform.position = { x: (WIDTH - 64) / 2, y: HEIGHT - 64 };
    BrioCollision.addRectangle({
        object: player,
        colliderType: "trigger",
        pos: { x: 8, y: 8 },
        size: { x: 48, y: 24 },
    });
    // Collision events replace a manual overlap test against every falling object
    player.onCollisionEnter(onPlayerTouch);

    const falling = [];
    for (let i = 0; i < STAR_COUNT + ROCK_COUNT; i++) {
        const isStar = i < STAR_COUNT;
        const obj = new BrioObject2D(
            isStar ? `obj_star_${i}` : `obj_rock_${i}`,
            isStar ? "spr_star" : "spr_rock",
            1,
        );
        obj.tag = isStar ? "star" : "rock";
        const size = isStar ? 28 : 36;
        obj.transform.size = { x: size, y: size };
        obj.transform.position = { x: 0, y: -100 - i * 90 };
        BrioCollision.addRectangle({
            object: obj,
            colliderType: "trigger",
            pos: { x: 4, y: 4 },
            size: { x: size - 8, y: size - 8 },
        });
        falling.push(obj);
    }
    return [camera, player, ...falling];
});

game.addScene(title).addScene(play);

// -> GAME STATE (plain JS values; ECS state is restored by scene.restart())
const speeds = new Map();
let score = 0;
let lives = 3;
let best = Number(BrioStorage.local.get(BEST_SCORE_KEY) ?? 0);
let gameOver = false;

function respawn(obj) {
    obj.transform.position.x = game.random.float(0, WIDTH - obj.transform.size.x);
    obj.transform.position.y = -obj.transform.size.y - game.random.float(0, 300);
    speeds.set(obj, game.random.float(140, 260) + score * 4);
}

function startRun() {
    play.restart();
    score = 0;
    lives = 3;
    gameOver = false;
    for (const obj of play.objects2D.values()) if (obj.name !== "obj_player") respawn(obj);
}

// Called once when the player starts touching a star or a rock (after the frame's update)
function onPlayerTouch(other) {
    if (gameOver) return;
    if (other.tag === "star") {
        score++;
        catchSound.play();
    } else {
        lives--;
        camera.shake(10, 0.35);
        hitSound.play();
        if (lives <= 0) endRun();
    }
    respawn(other);
}

// Simulation at a fixed 60 Hz: identical behavior on 30, 60, or 144 Hz screens
game.fixedUpdate((updater, dt) => {
    if (game.activeScene !== play || gameOver) return;
    const player = play.objects2D.get("obj_player");

    // -1..1, analog on a gamepad stick
    const dir = game.input.axis("left", "right");
    const x = player.transform.position.x + dir * PLAYER_SPEED * dt;
    player.transform.position.x = Math.min(WIDTH - player.transform.size.x, Math.max(0, x));

    for (const obj of play.objects2D.values()) {
        if (obj === player) continue;
        obj.transform.position.y += (speeds.get(obj) ?? 200) * dt;
        if (obj.transform.position.y > HEIGHT) respawn(obj);
    }
});

function endRun() {
    gameOver = true;
    if (score > best) {
        best = score;
        BrioStorage.local.set(BEST_SCORE_KEY, best);
    }
}

// Per-frame logic: edge-triggered actions and the HUD (setting the same text again costs nothing)
let catchSound;
let hitSound;
game.update((updater) => {
    catchSound ??= updater.getAudio("aud_catch");
    hitSound ??= updater.getAudio("aud_hit");
    const input = game.input;
    if (input.isPressed("mute")) BrioAudioMixer.mute("master", !BrioAudioMixer.isMuted("master"));

    if (game.activeScene === title) {
        if (input.isPressed("start")) {
            updater.getAudio("aud_music").playLoop();
            // The first activation runs the scene's load(); start the run once it is active
            game.setScene("play");
            game.ready().then(startRun);
        }
        hud.text = `Best: ${best}   M to mute`;
        return;
    }

    if (gameOver) {
        hud.text = `Game over! Score ${score}   Best ${best}\nR to retry, Esc for title`;
        if (input.isPressed("retry")) startRun();
        if (input.isPressed("back")) game.setScene("title");
        return;
    }
    hud.text = `Score ${score}   Lives ${"*".repeat(lives)}   Best ${best}`;
});

window.brioGame = game;
