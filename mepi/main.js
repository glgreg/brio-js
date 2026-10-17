import { BrioGame, BrioSprite, BrioAudio, BrioCollision, BrioUtils } from "../dist/index.js";

import { Player } from "./entities/Player.js";
import { Platform } from "./entities/Platform.js";
import { Enemy } from "./entities/Enemy.js";
import { Collectible } from "./entities/Collectible.js";
import { Hazard } from "./entities/Hazard.js";
import { Goal } from "./entities/Goal.js";
import { Decoration } from "./entities/Decoration.js";
import { LEVELS } from "./entities/LevelData.js";

// Native Pixel Resolution (16:9 Retro Ratio)
const GAME_WIDTH = 640;
const GAME_HEIGHT = 360;

const gameContainer = document.getElementById("game_container");
if (!gameContainer) {
    throw new Error("Target #game_container element was not found in the DOM.");
}

// Instantiate BrioGame
const game = new BrioGame(GAME_WIDTH, GAME_HEIGHT, gameContainer);
game.rendering.mode = "pixelated";
game.useKeyboard();

// Audio References
/** @type {BrioAudio | null} */
let audJump = null;
/** @type {BrioAudio | null} */
let audCoin = null;
/** @type {BrioAudio | null} */
let audPowerup = null;
/** @type {BrioAudio | null} */
let audHurt = null;
/** @type {BrioAudio | null} */
let audExplosion = null;
/** @type {BrioAudio | null} */
let audTap = null;
/** @type {BrioAudio | null} */
let audMusic = null;

// Game State Tracking
let currentLevelIndex = 0;
let gameState = "START";
let musicStarted = false;
let isMuted = false;

/** @type {Player | null} */
let player = null;
/** @type {Platform[]} */
let currentPlatforms = [];
/** @type {Enemy[]} */
let currentEnemies = [];
/** @type {Collectible[]} */
let currentCollectibles = [];
/** @type {Hazard[]} */
let currentHazards = [];
/** @type {Decoration[]} */
let currentDecorations = [];
/** @type {Goal | null} */
let currentGoal = null;

// UI Elements
const hudScore = document.getElementById("hud_score");
const hudCoins = document.getElementById("hud_coins");
const hudHearts = document.getElementById("hud_hearts");
const hudLevel = document.getElementById("hud_level");
const modalOverlay = document.getElementById("modal_overlay");
const modalTitle = document.getElementById("modal_title");
const modalMessage = document.getElementById("modal_message");
const modalButton = document.getElementById("modal_button");
const muteButton = document.getElementById("btn_mute");

// 1. PRELOAD STEP
game.preload(() => {
    const assets = [];

    // Player Knight Sprites (Idle, 16-Frame Run, Roll/Jump, Hit, Death)
    for (let i = 0; i < 4; i++) {
        assets.push(
            new BrioSprite(`spr_knight_idle_${i}`, `./assets/sprites/sliced/knight_idle_${i}.png`),
        );
    }
    for (let i = 0; i < 16; i++) {
        assets.push(
            new BrioSprite(`spr_knight_run_${i}`, `./assets/sprites/sliced/knight_run_${i}.png`),
        );
    }
    for (let i = 0; i < 4; i++) {
        assets.push(
            new BrioSprite(`spr_knight_roll_${i}`, `./assets/sprites/sliced/knight_roll_${i}.png`),
        );
    }
    for (let i = 0; i < 2; i++) {
        assets.push(
            new BrioSprite(`spr_knight_hit_${i}`, `./assets/sprites/sliced/knight_hit_${i}.png`),
        );
    }
    for (let i = 0; i < 8; i++) {
        assets.push(
            new BrioSprite(
                `spr_knight_death_${i}`,
                `./assets/sprites/sliced/knight_death_${i}.png`,
            ),
        );
    }

    // Slime Enemies
    for (let i = 0; i < 4; i++) {
        assets.push(
            new BrioSprite(
                `spr_slime_green_idle_${i}`,
                `./assets/sprites/sliced/slime_green_idle_${i}.png`,
            ),
        );
        assets.push(
            new BrioSprite(
                `spr_slime_green_hit_${i}`,
                `./assets/sprites/sliced/slime_green_hit_${i}.png`,
            ),
        );
        assets.push(
            new BrioSprite(
                `spr_slime_purple_idle_${i}`,
                `./assets/sprites/sliced/slime_purple_idle_${i}.png`,
            ),
        );
        assets.push(
            new BrioSprite(
                `spr_slime_purple_hit_${i}`,
                `./assets/sprites/sliced/slime_purple_hit_${i}.png`,
            ),
        );
    }

    // Coins
    for (let i = 0; i < 12; i++) {
        assets.push(new BrioSprite(`spr_coin_${i}`, `./assets/sprites/sliced/coin_${i}.png`));
    }

    // Fruits
    const fruits = [
        "apple",
        "banana",
        "cherry",
        "strawberry",
        "orange",
        "pineapple",
        "melon",
        "kiwi",
    ];
    for (const f of fruits) {
        assets.push(new BrioSprite(`spr_fruit_${f}`, `./assets/sprites/sliced/fruit_${f}.png`));
    }

    // Solid Ground Blocks (Lush Grass Tops & Castle Stone)
    assets.push(
        new BrioSprite(
            "spr_ground_grass_224x64",
            "./assets/sprites/sliced/ground_grass_224x64.png",
        ),
    );
    assets.push(
        new BrioSprite(
            "spr_ground_grass_160x64",
            "./assets/sprites/sliced/ground_grass_160x64.png",
        ),
    );
    assets.push(
        new BrioSprite(
            "spr_ground_grass_128x64",
            "./assets/sprites/sliced/ground_grass_128x64.png",
        ),
    );

    assets.push(
        new BrioSprite(
            "spr_ground_stone_144x64",
            "./assets/sprites/sliced/ground_stone_144x64.png",
        ),
    );
    assets.push(
        new BrioSprite(
            "spr_ground_stone_256x48",
            "./assets/sprites/sliced/ground_stone_256x48.png",
        ),
    );
    assets.push(
        new BrioSprite(
            "spr_ground_stone_128x128",
            "./assets/sprites/sliced/ground_stone_128x128.png",
        ),
    );
    assets.push(
        new BrioSprite(
            "spr_ground_stone_112x64",
            "./assets/sprites/sliced/ground_stone_112x64.png",
        ),
    );

    // Floating Stepping Platforms
    assets.push(new BrioSprite("spr_plat_grass_64", "./assets/sprites/sliced/plat_grass_64.png"));
    assets.push(new BrioSprite("spr_plat_grass_80", "./assets/sprites/sliced/plat_grass_80.png"));
    assets.push(new BrioSprite("spr_plat_sand_64", "./assets/sprites/sliced/plat_sand_64.png"));
    assets.push(new BrioSprite("spr_plat_ice_64", "./assets/sprites/sliced/plat_ice_64.png"));
    assets.push(new BrioSprite("spr_plat_stone_64", "./assets/sprites/sliced/plat_stone_64.png"));
    assets.push(new BrioSprite("spr_plat_stone_80", "./assets/sprites/sliced/plat_stone_80.png"));

    // Grass & Nature Decorations
    assets.push(
        new BrioSprite("spr_decor_grass_tuft", "./assets/sprites/sliced/decor_grass_tuft.png"),
    );
    assets.push(new BrioSprite("spr_decor_flowers", "./assets/sprites/sliced/decor_flowers.png"));
    assets.push(new BrioSprite("spr_decor_bush", "./assets/sprites/sliced/decor_bush.png"));
    assets.push(new BrioSprite("spr_decor_mushroom", "./assets/sprites/sliced/decor_mushroom.png"));

    // Hazards & Goal
    assets.push(new BrioSprite("spr_tile_spikes", "./assets/sprites/sliced/tile_spikes.png"));
    assets.push(new BrioSprite("spr_tile_flag", "./assets/sprites/sliced/tile_flag.png"));
    assets.push(new BrioSprite("spr_tile_sign", "./assets/sprites/sliced/tile_sign.png"));
    assets.push(new BrioSprite("spr_goal_gate", "./assets/sprites/sliced/goal_gate.png"));

    // Audios
    assets.push(new BrioAudio("aud_jump", "./assets/sounds/jump.wav"));
    assets.push(new BrioAudio("aud_coin", "./assets/sounds/coin.wav"));
    assets.push(new BrioAudio("aud_powerup", "./assets/sounds/power_up.wav"));
    assets.push(new BrioAudio("aud_hurt", "./assets/sounds/hurt.wav"));
    assets.push(new BrioAudio("aud_explosion", "./assets/sounds/explosion.wav"));
    assets.push(new BrioAudio("aud_tap", "./assets/sounds/tap.wav"));
    assets.push(new BrioAudio("aud_music", "./assets/music/time_for_adventure.mp3"));

    return assets;
});

// 2. LOAD STEP
game.load((loader) => {
    audJump = loader.getAudio("aud_jump");
    audCoin = loader.getAudio("aud_coin");
    audPowerup = loader.getAudio("aud_powerup");
    audHurt = loader.getAudio("aud_hurt");
    audExplosion = loader.getAudio("aud_explosion");
    audTap = loader.getAudio("aud_tap");
    audMusic = loader.getAudio("aud_music");

    // Initialize Player at 40, 260
    player = new Player("obj_player", 40, 260);
    player.jumpAudio = audJump;
    player.hurtAudio = audHurt;
    player.stompAudio = audExplosion;

    // Load first level
    const levelObjects = buildLevel(0);

    return [player, ...levelObjects];
});

/**
 * Builds and returns all objects for a given level index.
 * @param {number} levelIndex
 * @returns {import("../dist/objects/BrioObject.js").BrioObject[]}
 */
function buildLevel(levelIndex) {
    const data = LEVELS[levelIndex];
    if (!data) return [];

    game.background.color = data.background;

    // Reposition player
    if (player) {
        player.spawnPoint = { ...data.playerStart };
        player.respawn();
    }

    currentPlatforms = [];
    currentEnemies = [];
    currentCollectibles = [];
    currentHazards = [];
    currentDecorations = [];
    currentGoal = null;

    const objects = [];

    // Ground & Platforms
    data.platforms.forEach((p, idx) => {
        const plat = new Platform(
            `plat_${levelIndex}_${idx}`,
            p.sprite,
            p.x,
            p.y,
            p.width,
            p.height,
            p.isMoving ?? false,
            p.moveRange ?? 80,
            p.moveSpeed ?? 40,
            p.moveAxis ?? "x",
        );
        currentPlatforms.push(plat);
        objects.push(plat);
    });

    // Scenery & Grass Decorations (Layer 2)
    if (data.decorations) {
        data.decorations.forEach((d, idx) => {
            const decor = new Decoration(
                `decor_${levelIndex}_${idx}`,
                d.sprite,
                d.x,
                d.y,
                d.width,
                d.height,
                2,
            );
            currentDecorations.push(decor);
            objects.push(decor);
        });
    }

    // Enemies
    data.enemies.forEach((e, idx) => {
        const enemy = new Enemy(`enemy_${levelIndex}_${idx}`, e.type, e.x, e.y, e.patrolRange);
        currentEnemies.push(enemy);
        objects.push(enemy);
    });

    // Collectibles
    data.collectibles.forEach((c, idx) => {
        const item = new Collectible(
            `collectible_${levelIndex}_${idx}`,
            c.type,
            c.x,
            c.y,
            c.fruitName ?? "apple",
        );
        currentCollectibles.push(item);
        objects.push(item);
    });

    // Hazards
    data.hazards.forEach((h, idx) => {
        const hazard = new Hazard(
            `hazard_${levelIndex}_${idx}`,
            h.sprite,
            h.x,
            h.y,
            h.width,
            h.height,
        );
        currentHazards.push(hazard);
        objects.push(hazard);
    });

    // Goal
    if (data.goal) {
        currentGoal = new Goal(
            `goal_${levelIndex}`,
            data.goal.sprite,
            data.goal.x,
            data.goal.y,
            data.goal.width,
            data.goal.height,
        );
        objects.push(currentGoal);
    }

    updateHUD();
    return objects;
}

/**
 * Cleanly unloads current level objects and loads next level.
 * @param {number} levelIndex
 */
function loadLevel(levelIndex) {
    currentPlatforms.forEach((p) => game.removeObject(p));
    currentDecorations.forEach((d) => game.removeObject(d));
    currentEnemies.forEach((e) => game.removeObject(e));
    currentCollectibles.forEach((c) => game.removeObject(c));
    currentHazards.forEach((h) => game.removeObject(h));
    if (currentGoal) game.removeObject(currentGoal);

    const newObjects = buildLevel(levelIndex);
    newObjects.forEach((obj) => {
        game.gameObjects.set(obj.name, obj);
    });

    currentLevelIndex = levelIndex;
    gameState = "PLAYING";
    hideModal();
}

// 3. UPDATE STEP
game.update((updater, dt) => {
    if (!player) return;

    // Handle Music autostart on first keypress
    if (
        !musicStarted &&
        (game.keyboard.isDown("ArrowRight") ||
            game.keyboard.isDown("ArrowLeft") ||
            game.keyboard.isDown(" "))
    ) {
        musicStarted = true;
        if (audMusic && !isMuted) {
            audMusic.playLoop();
        }
    }

    // Toggle pause with P key
    if (game.keyboard.isUp("p") || game.keyboard.isUp("P")) {
        togglePause();
    }

    // Quick restart with R key
    if (game.keyboard.isUp("r") || game.keyboard.isUp("R")) {
        restartGame();
    }

    if (gameState !== "PLAYING") {
        return;
    }

    // Update Moving Platforms
    currentPlatforms.forEach((platform) => {
        platform.update(dt);
    });

    // Update Enemies
    currentEnemies.forEach((enemy) => {
        enemy.update(dt);
    });

    // Update Collectibles
    currentCollectibles.forEach((item) => {
        item.update(dt);
    });

    // Update Player
    player.update(
        game.keyboard,
        dt,
        currentPlatforms,
        currentEnemies,
        currentCollectibles,
        currentHazards,
        currentGoal,
        GAME_HEIGHT,
        () => handleLevelVictory(),
    );

    // Check Game Over
    if (player.isDead && player.lives <= 0) {
        handleGameOver();
    }

    // Update HUD display
    updateHUD();
});

function handleLevelVictory() {
    if (gameState !== "PLAYING") return;

    if (currentGoal) {
        currentGoal.trigger(audTap);
    }
    if (audPowerup) audPowerup.play();

    if (currentLevelIndex < LEVELS.length - 1) {
        gameState = "LEVEL_CLEAR";
        showModal(
            `Level ${currentLevelIndex + 1} Cleared!`,
            `Excellent work, Brave Knight! You collected ${player?.coins ?? 0} coins with score ${player?.score ?? 0}. Prepare for the next challenge!`,
            "Next Level",
            () => {
                loadLevel(currentLevelIndex + 1);
            },
        );
    } else {
        gameState = "VICTORY";
        showModal(
            "Kingdom Saved! Victory!",
            `You conquered all stages, retrieved the Golden Gate and saved the realm!\nFinal Score: ${player?.score ?? 0} | Coins: ${player?.coins ?? 0}`,
            "Play Again",
            () => {
                restartGame();
            },
        );
    }
}

function handleGameOver() {
    gameState = "GAME_OVER";
    showModal(
        "Game Over",
        `Your journey came to an end in stage ${currentLevelIndex + 1}.\nFinal Score: ${player?.score ?? 0} | Coins: ${player?.coins ?? 0}`,
        "Try Again",
        () => {
            restartGame();
        },
    );
}

function restartGame() {
    currentLevelIndex = 0;
    if (player) {
        player.score = 0;
        player.coins = 0;
        player.lives = 3;
    }
    loadLevel(0);
}

function togglePause() {
    if (gameState === "PLAYING") {
        gameState = "PAUSED";
        showModal(
            "Game Paused",
            "Press Resume or press [P] / [Esc] to continue your quest.",
            "Resume",
            () => {
                gameState = "PLAYING";
                hideModal();
            },
        );
    } else if (gameState === "PAUSED") {
        gameState = "PLAYING";
        hideModal();
    }
}

function updateHUD() {
    if (!player) return;

    if (hudScore) hudScore.textContent = String(player.score).padStart(6, "0");
    if (hudCoins) hudCoins.textContent = String(player.coins).padStart(2, "0");
    if (hudLevel)
        hudLevel.textContent = LEVELS[currentLevelIndex]?.title ?? `Level ${currentLevelIndex + 1}`;

    if (hudHearts) {
        let heartsStr = "";
        for (let i = 0; i < player.lives; i++) {
            heartsStr += "[<3] ";
        }
        hudHearts.textContent = heartsStr.trim() || "[RIP]";
    }
}

/**
 * @param {string} title
 * @param {string} message
 * @param {string} buttonText
 * @param {() => void} onConfirm
 */
function showModal(title, message, buttonText, onConfirm) {
    if (!modalOverlay || !modalTitle || !modalMessage || !modalButton) return;

    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modalButton.textContent = buttonText;
    modalButton.onclick = () => {
        if (audTap) audTap.play();
        onConfirm();
    };

    modalOverlay.classList.remove("hidden");
}

function hideModal() {
    if (modalOverlay) {
        modalOverlay.classList.add("hidden");
    }
}

// Sound Mute Toggle Button
if (muteButton) {
    muteButton.addEventListener("click", () => {
        isMuted = !isMuted;
        muteButton.textContent = isMuted ? "Sound: OFF" : "Sound: ON";
        if (audMusic) {
            if (isMuted) {
                audMusic.pause();
            } else if (musicStarted) {
                audMusic.playLoop();
            }
        }
    });
}

// Initial prompt to start
window.addEventListener("DOMContentLoaded", () => {
    showModal(
        "Knight's Adventure",
        "Control the Brave Knight through the perilous realm!\n\n- Move: [A] [D] or [Arrow Keys]\n- Jump / Stomp: [W], [Up], [Space] or [Z]\n- Pause: [P] | Restart: [R]",
        "Start Adventure",
        () => {
            gameState = "PLAYING";
            hideModal();
            musicStarted = true;
            if (audMusic && !isMuted) {
                audMusic.playLoop();
            }
        },
    );
});
