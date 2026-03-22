import { BrioAtlas } from "../dist/assets/BrioAtlas.js";
import {
    BrioGame,
    BrioObject,
    BrioSprite,
    BrioAudio,
    BrioUtils,
    Vector2,
    BrioMath,
    BrioSpriteAtlas,
    BrioCollision,
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
game.debugging.render.grid.enabled = true;
game.debugging.render.grid.width = 32;
game.debugging.render.grid.height = 32;
game.debugging.render.grid.showAxisRulers = true;
game.debugging.render.fpsOverlay.enabled = true;
game.debugging.render.fpsOverlay.position = "right-top";
game.debugging.render.fpsOverlay.size = 32;
game.debugging.render.fpsOverlay.offset = 4;

game.background.color = "linear-gradient(to bottom, hsla(200, 100%, 60%, 1) 78%, #020319 22%)";
// game.background.image = "./assets/sprites/background.png";
game.background.repeat = "no-repeat";
game.background.size = "cover";
game.background.position = "center center";
game.background.rendering = "pixelated";
game.debugging.render.fpsOverlay.enabled = false;

game.rendering.mode = "pixelated";
game.debugging.render.showRenderBounds = true;
game.debugging.render.showCollisionBounds = true;

game.useKeyboard();

// -> PRELOAD STEP
game.preload(() => {
    const spr_player = new BrioSprite(
        "spr_player",
        "https://www.clipartmax.com/png/full/136-1361415_adventure-boy-featured-game-art-2d-game-character-png.png",
    );
    const spr_projectile = new BrioSprite(
        "spr_projectile",
        "https://w0.peakpx.com/wallpaper/35/274/HD-wallpaper-bullet-bill-cartoon-bullet-white-neon-lights-super-mario-creative-super-mario-characters-super-mario-bros-bullet-bill-super-mario.jpg",
    );
    const spr_background = new BrioSprite(
        "spr_background",
        "https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/7a23bab1-ebef-4321-baea-df64bfdd3aa4/da0pcrd-a07b6870-35dd-4841-9eb5-8e36cea3699b.png/v1/fit/w_714,h_399,q_70,strp/basic_sprite_background_by_321kye_da0pcrd-375w-2x.jpg?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7ImhlaWdodCI6Ijw9Mzk5IiwicGF0aCI6Ii9mLzdhMjNiYWIxLWViZWYtNDMyMS1iYWVhLWRmNjRiZmRkM2FhNC9kYTBwY3JkLWEwN2I2ODcwLTM1ZGQtNDg0MS05ZWI1LThlMzZjZWEzNjk5Yi5wbmciLCJ3aWR0aCI6Ijw9NzE0In1dXSwiYXVkIjpbInVybjpzZXJ2aWNlOmltYWdlLm9wZXJhdGlvbnMiXX0.yuldnBJvYpUpGEgmj8nuW3-KA2Kw5KdfDerA371fu-A",
    );
    const aud_projectile = new BrioAudio("aud_projectile", "./assets/audios/laser.wav");

    return [spr_player, spr_projectile, spr_background, aud_projectile];
});

// -> LOAD STEP
game.load((assets) => {
    const atlas = new BrioAtlas("test", 4096, 4096);
    const bitmap = atlas.mount();
    bitmap.then((v) => {
        console.log(v);
    });

    const obj_player = new Player("obj_player", assets.getSprite("spr_player").name, game);
    const obj_projectile = new Projectile(
        "obj_projectile",
        "spr_projectile",
        assets.getAudio("aud_projectile"),
    );
    obj_projectile.transform.size.x = 64;
    obj_projectile.transform.size.y = 64;
    const obj_enemy = new Enemy("obj_enemy", assets.getSprite("spr_player").name, 2);

    obj_player.transform.size.x = obj_enemy.transform.size.x = 64;
    obj_player.transform.size.y = obj_enemy.transform.size.y = 64;

    const obj_background = new BrioObject(
        "obj_background",
        assets.getSprite("spr_background").name,
        0,
    );
    obj_projectile.transform.visibility = false;
    obj_enemy.transform.position.x = GAME_WIDTH / 2 - obj_enemy.transform.size.x / 2;
    obj_background.transform.size.x = GAME_WIDTH;
    obj_background.transform.size.y = GAME_HEIGHT;
    BrioCollision.addRectangle({
        colliderType: "solid",
        object: obj_enemy,
        pos: { x: 6, y: 0 },
        size: { x: 50, y: 64 },
    });
    // BrioCollision.addRectangle({
    //     colliderType: "solid",
    //     object: obj_player,
    //     pos: { x: 20, y: 4 },
    //     size: { x: 24, y: 56 },
    // });
    BrioCollision.addSquare({
        colliderType: "solid",
        object: obj_projectile,
        pos: { x: 0, y: 0 },
        size: 64,
    });

    return [obj_player, obj_enemy, obj_projectile, obj_background];
});

/** @type {Projectile[]} */
const enemy_pool = [];
/** @type {Projectile[]} */
const projectile_pool = [];

// -> UPDATE STEP
game.update((updater, dt) => {
    /** @type {Player} */
    const player = updater.getObject("obj_player");
    /** @type {Projectile} */
    const projectile = updater.getObject("obj_projectile");
    /** @type {Enemy} */
    const enemy = updater.getObject("obj_enemy");

    if (projectile_pool.length > 0) {
        for (let i = 1; i < projectile_pool.length; ++i) {
            const proj = projectile_pool[i];
            if (game.isColliding(enemy, proj)) {
                console.log("tiro acertou");
                game.destroy(proj);
                break;
            }
        }
    }

    // moveRandom(game, enemy, enemy_pool, 1000 * dt);

    if (game.keyboard.isDown("ArrowLeft")) player.moveLeft(player.movSpeed * dt);
    if (game.keyboard.isDown("ArrowRight")) player.moveRight(player.movSpeed * dt);
    if (game.keyboard.isUp("z")) player.shoot(projectile, 500 * dt, projectile_pool);
});

/**
 * @param {BrioGame} game
 * @param {BrioObject} object
 * @param {BrioObject[]} pool
 */
function spawnRandom(game, object, pool) {
    const obj = game.instantiate(object);
    obj.transform.position.x = Math.round(Math.random() * GAME_WIDTH);
    obj.transform.position.y = Math.round(Math.random() * GAME_HEIGHT);
    pool.push(obj);
}

/**
 * @param {BrioGame} game
 * @param {BrioObject} object
 * @param {BrioObject[]} pool
 * @param {number} mmf
 */
function moveRandom(game, object, pool, mmf) {
    if (pool.length <= 500) spawnRandom(game, object, pool);

    const randomSelected = Math.floor(Math.random() * pool.length + 1);
    const randomMov = Math.round(Math.random() * mmf);
    const randomStateMov = Math.round(Math.random() * 3);
    const currentObj = pool[randomSelected];

    if (!currentObj) return;

    const randomAnimTime = Math.round(Math.random() * 2000);
    /**
     * @param {BrioObject} obj
     * @param {() => void} callbackFn
     */
    const move = (obj, callbackFn) => {
        const op = obj.transform.position;
        const gw = game.width;
        const gh = game.height;

        if (op.x >= gw || op.x <= 0 || op.y >= gh || op.y <= 0) randomMov * -1;

        BrioUtils.timedAnimation(() => {
            callbackFn();
        }, randomAnimTime);
    };

    switch (randomStateMov) {
        case 0:
            move(currentObj, () => {
                currentObj.transform.position.x += randomMov;
            });
            break;
        case 1:
            move(currentObj, () => {
                currentObj.transform.position.x -= randomMov;
            });
            break;
        case 2:
            move(currentObj, () => {
                currentObj.transform.position.y += randomMov;
            });
            break;
        case 3:
            move(currentObj, () => {
                currentObj.transform.position.y -= randomMov;
            });
            break;
        default:
            return;
    }
}