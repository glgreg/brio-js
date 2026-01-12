import {
    BrioGame,
    BrioObject,
    BrioSprite,
    BrioAudio,
    BrioUtils,
    Vector2,
    BrioMath,
} from "../dist/index.js";
import { Enemy } from "./Enemy.js";
import { Player } from "./Player.js";
import { Projectile } from "./Projectile.js";

const GAME_WIDTH = 640;
const GAME_HEIGHT = 480;

const game_container = document.getElementById("game_container");
if (!game_container) throw new Error("Game container doesn't exist.");

const game = new BrioGame(GAME_WIDTH, GAME_HEIGHT, game_container);

game.debugging.console.enabled = true;
// game.debugging.console.showStackTrace = true;
// game.debugging.console.showInternalStackTrace = true;
// game.debugging.render.showCollisionBounds = true;
// game.debugging.render.showRenderBounds = true;
// game.debugging.render.grid.enabled = true;
game.debugging.render.grid.width = 32;
game.debugging.render.grid.height = 32;
// game.debugging.render.grid.showAxisRulers = true;
// game.debugging.render.fpsOverlay.enabled = true;
game.debugging.render.fpsOverlay.position = "right-top";
game.debugging.render.fpsOverlay.size = 32;
game.debugging.render.fpsOverlay.offset = 4;

game.background.color = "linear-gradient(to bottom, hsla(200, 100%, 60%, 1) 78%, #020319 22%)";
// game.background.image = "./assets/sprites/background.png";
game.background.repeat = "no-repeat";
game.background.size = "cover";
game.background.position = "center center";
game.background.rendering = "pixelated";

game.rendering.mode = "pixelated";

game.useKeyboard();

// -> PRELOAD STEP
game.preload(() => {
    const spr_player = new BrioSprite({
        name: "spr_player",
        src: "./assets/sprites/girl_front.png",
        position: { x: 0, y: 0 },
        size: { x: 64, y: 64 },
        type: "img",
    });
    const spr_projectile = new BrioSprite({
        name: "spr_projectile",
        src: "./assets/sprites/projectile.png",
        position: { x: 0, y: 0 },
        size: { x: 32, y: 32 },
        type: "img",
    });
    const spr_background = new BrioSprite({
        name: "spr_background",
        src: "./assets/sprites/background.png",
        position: { x: 0, y: 0 },
        size: { x: GAME_WIDTH, y: GAME_HEIGHT },
        type: "img",
    });
    const aud_projectile = new BrioAudio("aud_projectile", "./assets/audios/laser.wav");

    return [spr_player, spr_projectile, spr_background, aud_projectile];
});

// -> LOAD STEP
game.load((assets) => {
    const obj_player = new Player("obj_player", assets.getSprite("spr_player"), game);
    const obj_projectile = new Projectile(
        "obj_projectile",
        assets.getSprite("spr_projectile"),
        assets.getAudio("aud_projectile"),
    );
    const obj_background = new BrioObject("obj_background", assets.getSprite("spr_background"), 0);
    const obj_enemy = new Enemy("obj_enemy", assets.getSprite("spr_player"), 2);
    obj_projectile.transform.visibility = false;
    obj_enemy.transform.position.x = GAME_WIDTH / 2 - obj_enemy.transform.size.x / 2;

    return [obj_player, obj_enemy, obj_projectile, obj_background];
});

// -> UPDATE STEP
game.update((updater, dt) => {
    /** @type {Player} */
    const player = updater.getObject("obj_player");
    /** @type {Projectile} */
    const projectile = updater.getObject("obj_projectile");
    /** @type {Enemy} */
    const enemy = updater.getObject("obj_enemy");

    if (game.keyboard.isDown("ArrowLeft")) player.moveLeft(player.movSpeed * dt);
    if (game.keyboard.isDown("ArrowRight")) player.moveRight(player.movSpeed * dt);
    if (game.keyboard.isDown("z")) player.shoot(projectile, 500 * dt);
});

/**
 * @param {BrioGame} game
 * @param {BrioObject} object
 */
function spawnRandom(game, object) {
    const obj = game.instantiate(object);
    obj.transform.position.x = Math.round(Math.random() * GAME_WIDTH);
    obj.transform.position.y = Math.round(Math.random() * GAME_HEIGHT);
}
