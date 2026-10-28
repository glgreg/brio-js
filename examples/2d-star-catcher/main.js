// Star Catcher: a complete 2D BrioJS game. Catch the falling stars, dodge the rocks.
// Shows: scenes (title / play) with preload-load-restart, layers (static + dynamic), BrioCamera2D shake,
// fixedUpdate with render interpolation, seeded randomness, Web Audio buses, and local save data.
import {
    BrioGame,
    BrioScene,
    BrioLayer,
    BrioObject2D,
    BrioSprite,
    BrioAudio,
    BrioAudioMixer,
    BrioCamera2D,
    BrioCollision,
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
const hud = document.getElementById("hud");

const game = new BrioGame({
    width: WIDTH,
    height: HEIGHT,
    container,
    dimension: "2d",
    fixedTimestep: 1 / 60,
    interpolate: true,
});
game.background.color = "linear-gradient(#0b1026, #1d2457)";
game.useKeyboard();

// -> ASSETS (procedural: no files to download)
game.preload(() => [
    new BrioSprite(
        "spr_player",
        svgSprite(64, 32, `<path d="M4 28 L32 4 L60 28 Z" fill="#7dd3fc" stroke="#e0f2fe" stroke-width="3"/>`),
    ),
    new BrioSprite(
        "spr_star",
        svgSprite(
            28,
            28,
            `<path d="M14 1 L17.5 10 L27 10.5 L19.5 16.5 L22 26 L14 20.5 L6 26 L8.5 16.5 L1 10.5 L10.5 10 Z" fill="#fde047"/>`,
        ),
    ),
    new BrioSprite("spr_rock", svgSprite(36, 36, `<circle cx="18" cy="18" r="16" fill="#78716c" stroke="#a8a29e" stroke-width="3"/>`)),
    new BrioSprite("spr_dot", svgSprite(3, 3, `<rect width="3" height="3" fill="#cbd5e1"/>`)),
    new BrioSprite(
        "spr_title",
        svgSprite(
            360,
            90,
            `<text x="180" y="62" font-family="sans-serif" font-size="48" font-weight="700" text-anchor="middle" fill="#fde047">Star Catcher</text>`,
        ),
    ),
    new BrioAudio("aud_catch", synthWav({ duration: 0.15, frequency: (t) => 660 + t * 2400 })),
    new BrioAudio("aud_hit", synthWav({ duration: 0.3, frequency: () => 90, wave: "noise", volume: 0.5 })),
    new BrioAudio("aud_music", synthWav({ duration: 2, frequency: (t) => [220, 277, 330, 277][Math.floor(t * 2) % 4], volume: 0.12 }), {
        bus: "bgm",
    }),
]);

// Background stars on a "static" layer: rasterized once and cached by the compositor
game.load(() => {
    const sky = new BrioLayer({ name: "sky", order: -10, policy: "static" });
    const dots = [];
    for (let i = 0; i < 60; i++) {
        const dot = new BrioObject2D(`obj_dot_${i}`, "spr_dot", 0);
        dot.transform.position = { x: game.random.float(0, WIDTH), y: game.random.float(0, HEIGHT) };
        sky.addObject(dot);
        dots.push(dot);
    }
    return [sky, ...dots];
});

// -> TITLE SCENE
const title = new BrioScene("title").load(() => {
    const logo = new BrioObject2D("obj_title", "spr_title");
    logo.transform.size = { x: 360, y: 90 };
    logo.transform.position = { x: (WIDTH - 360) / 2, y: HEIGHT / 3 };
    return [logo];
});

// -> PLAY SCENE
const camera = new BrioCamera2D("cam_play");
camera.random = game.random; // reproducible shakes with a fixed seed

const play = new BrioScene("play").load(() => {
    const player = new BrioObject2D("obj_player", "spr_player", 2);
    player.transform.size = { x: 64, y: 32 };
    player.transform.position = { x: (WIDTH - 64) / 2, y: HEIGHT - 64 };
    BrioCollision.addRectangle({ object: player, colliderType: "trigger", pos: { x: 8, y: 8 }, size: { x: 48, y: 24 } });

    const falling = [];
    for (let i = 0; i < STAR_COUNT + ROCK_COUNT; i++) {
        const isStar = i < STAR_COUNT;
        const obj = new BrioObject2D(isStar ? `obj_star_${i}` : `obj_rock_${i}`, isStar ? "spr_star" : "spr_rock", 1);
        const size = isStar ? 28 : 36;
        obj.transform.size = { x: size, y: size };
        obj.transform.position = { x: 0, y: -100 - i * 90 };
        BrioCollision.addRectangle({ object: obj, colliderType: "trigger", pos: { x: 4, y: 4 }, size: { x: size - 8, y: size - 8 } });
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

// Simulation at a fixed 60 Hz: identical behavior on 30, 60, or 144 Hz screens
game.fixedUpdate((updater, dt) => {
    if (game.activeScene !== play || gameOver) return;
    const player = play.objects2D.get("obj_player");
    const keys = game.keyboard;

    let dir = 0;
    if (keys.isDown("ArrowLeft") || keys.isDown("a")) dir -= 1;
    if (keys.isDown("ArrowRight") || keys.isDown("d")) dir += 1;
    const x = player.transform.position.x + dir * PLAYER_SPEED * dt;
    player.transform.position.x = Math.min(WIDTH - player.transform.size.x, Math.max(0, x));

    for (const obj of play.objects2D.values()) {
        if (obj === player) continue;
        obj.transform.position.y += (speeds.get(obj) ?? 200) * dt;
        if (BrioCollision.isColliding(player, obj)) {
            if (obj.sprite === "spr_star") {
                score++;
                updater.getAudio("aud_catch").play();
            } else {
                lives--;
                camera.shake(10, 0.35);
                updater.getAudio("aud_hit").play();
                if (lives <= 0) endRun();
            }
            respawn(obj);
        } else if (obj.transform.position.y > HEIGHT) {
            respawn(obj);
        }
    }
});

function endRun() {
    gameOver = true;
    if (score > best) {
        best = score;
        BrioStorage.local.set(BEST_SCORE_KEY, best);
    }
}

// Per-frame logic: edge-triggered input and the HUD
game.update((updater) => {
    const keys = game.keyboard;
    if (keys.isPressed("m")) BrioAudioMixer.mute("master", !BrioAudioMixer.isMuted("master"));

    if (game.activeScene === title) {
        if (keys.isPressed(" ") || keys.isPressed("Enter")) {
            updater.getAudio("aud_music").playLoop();
            // The first activation runs the scene's load(); start the run once it is active
            game.setScene("play");
            game.ready().then(startRun);
        }
        hud.textContent = `Best: ${best}  |  Space to play  |  M to mute`;
        return;
    }

    if (gameOver) {
        hud.textContent = `Game over! Score ${score}  |  Best ${best}  |  R to retry, Esc for title`;
        if (keys.isPressed("r")) startRun();
        if (keys.isPressed("Escape")) game.setScene("title");
        return;
    }
    hud.textContent = `Score ${score}  |  Lives ${"*".repeat(lives)}  |  Best ${best}`;
});

window.brioGame = game;
