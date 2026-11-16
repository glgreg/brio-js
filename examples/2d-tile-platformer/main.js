// Tile Platformer: a small 2D platformer built on a tile map.
// Shows: BrioTileMap imported from a Tiled JSON map and drawn in chunks from a BrioSpriteSheet tileset, colliders
// merged from solid tiles, tile queries (spikes), a following BrioCamera2D with world bounds, prefabs spawned with
// game.instantiate(), collision events, checkpoints that also bring back collected coins, an input map, BrioText on a
// "ui" layer, and useFullScreen("fit") with pixel-art rendering.
import {
    BrioGame,
    BrioLayer,
    BrioObject2D,
    BrioText,
    BrioSprite,
    BrioSpriteSheet,
    BrioTileMap,
    BrioCamera2D,
    BrioCollision,
    BrioInputMap,
} from "../../dist/index.js";
import { svgSprite } from "../shared/procedural-assets.js";

const WIDTH = 320;
const HEIGHT = 180;
const TILE = 16;
const GRAVITY = 900;
const RUN_SPEED = 110;
const JUMP_SPEED = 300;

// Tile ids: 1 grass, 2 dirt, 3 stone, 4 spikes (0 is empty). The tileset is one 64x16 image with 4 cells.
const TILESET = svgSprite(
    64,
    16,
    `<rect x="0" y="0" width="16" height="16" fill="#7c4a2d"/><rect x="0" y="0" width="16" height="5" fill="#4ade80"/>` +
        `<rect x="16" y="0" width="16" height="16" fill="#7c4a2d"/><rect x="19" y="6" width="3" height="3" fill="#5b341f"/>` +
        `<rect x="32" y="0" width="16" height="16" fill="#64748b"/><rect x="32" y="0" width="16" height="2" fill="#94a3b8"/>` +
        `<path d="M48 16 L52 6 L56 16 L60 6 L64 16 Z" fill="#e5e7eb"/>`,
);

// A level as Tiled would export it (File > Export As > JSON, "CSV" layer format)
const LEVEL_ROWS = [
    "............................................................",
    "............................................................",
    "............................................................",
    "....................................................3.......",
    "..........................333.......................3.......",
    "..................111...............................3.......",
    "..................................111..............13.......",
    "............111.........................111.......1.3.......",
    "......111...........................................3.......",
    "...................................................13.......",
    "1111..........1111111......11111....11......111111..3..11111",
    "222211111111112222222114411222221111221144442222221131112222",
];
const TILED_JSON = {
    orientation: "orthogonal",
    width: 60,
    height: LEVEL_ROWS.length,
    tilewidth: TILE,
    tileheight: TILE,
    infinite: false,
    tilesets: [{ firstgid: 1, name: "tiles", tilewidth: TILE, tileheight: TILE, tilecount: 4 }],
    layers: [
        {
            type: "tilelayer",
            name: "ground",
            width: 60,
            height: LEVEL_ROWS.length,
            data: LEVEL_ROWS.flatMap((row) =>
                row
                    .slice(0, 60)
                    .split("")
                    .map((c) => (c === "." ? 0 : Number(c))),
            ),
        },
    ],
};
const COINS = [
    [7, 7],
    [13, 6],
    [19, 4],
    [27, 3],
    [35, 5],
    [42, 6],
    [47, 9],
    [57, 9],
];

const game = new BrioGame({
    width: WIDTH,
    height: HEIGHT,
    container: document.getElementById("game"),
    fixedTimestep: 1 / 60,
    interpolate: true,
    seed: 7,
});
game.background.color = "linear-gradient(#1e3a8a, #38bdf8)";
game.rendering.mode = "pixelated";
game.useFullScreen("fit");
game.useKeyboard();
game.useGamepad();
game.input
    .bind("left", "ArrowLeft", "a", BrioInputMap.padButton("left"), BrioInputMap.padAxis(0, -1))
    .bind("right", "ArrowRight", "d", BrioInputMap.padButton("right"), BrioInputMap.padAxis(0, 1))
    .bind("jump", " ", "ArrowUp", "w", BrioInputMap.padButton("south"));

const tiles = new BrioSpriteSheet("sht_tiles", TILESET, TILE, TILE, 4, 1);

game.preload(() => [
    tiles,
    new BrioSprite(
        "spr_hero",
        svgSprite(
            12,
            14,
            `<rect x="1" y="3" width="10" height="11" rx="2" fill="#f97316"/><rect x="6" y="5" width="3" height="3" fill="#fff"/>`,
        ),
    ),
    new BrioSprite(
        "spr_coin",
        svgSprite(
            10,
            10,
            `<circle cx="5" cy="5" r="4" fill="#fde047" stroke="#ca8a04" stroke-width="1.5"/>`,
        ),
    ),
    new BrioSprite(
        "spr_flag",
        svgSprite(
            12,
            24,
            `<rect x="1" y="0" width="2" height="24" fill="#e5e7eb"/><path d="M3 1 L12 5 L3 9 Z" fill="#ef4444"/>`,
        ),
    ),
]);

const map = BrioTileMap.fromTiled(TILED_JSON, {
    name: "map_level",
    tileset: tiles,
    solidTileIds: [1, 2, 3],
});
const camera = new BrioCamera2D("cam_main");
const hud = new BrioText("txt_hud", "", {
    size: 10,
    color: "#ffffff",
    strokeColor: "#0f172a",
    strokeWidth: 3,
});
const player = new BrioObject2D("obj_hero", "spr_hero", 2);
const walls = map.createColliderObjects();
let velocityY = 0;
let grounded = false;
let score = 0;
let checkpointScore = 0;

game.load(() => {
    const ui = new BrioLayer({ name: "ui", order: 100, policy: "ui" });
    hud.transform.position = { x: 6, y: 4 };
    ui.addObject(hud);

    player.transform.size = { x: 12, y: 14 };
    player.transform.position = { x: 2 * TILE, y: 8 * TILE };
    BrioCollision.addRectangle({
        object: player,
        colliderType: "solid",
        pos: { x: 1, y: 2 },
        size: { x: 10, y: 12 },
    });
    player.onCollisionEnter(onTouch);

    const flag = new BrioObject2D("obj_flag", "spr_flag", 1);
    flag.tag = "flag";
    flag.transform.size = { x: 12, y: 24 };
    flag.transform.position = { x: 31 * TILE, y: 10 * TILE - 24 };
    BrioCollision.addRectangle({
        object: flag,
        colliderType: "trigger",
        pos: { x: 0, y: 0 },
        size: { x: 12, y: 24 },
    });

    camera.follow(player, 0.12, { x: 40, y: 30 });
    camera.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    return [map, camera, ui, hud, player, flag, ...walls];
});

// Coins are clones of one prefab: same sprite, tag and collider (the prefab itself is never registered)
const coinPrefab = new BrioObject2D("obj_coin", "spr_coin", 1);
coinPrefab.tag = "coin";
coinPrefab.transform.size = { x: 10, y: 10 };
BrioCollision.addRectangle({
    object: coinPrefab,
    colliderType: "trigger",
    pos: { x: 0, y: 0 },
    size: { x: 10, y: 10 },
});

game.ready().then(() => {
    for (const [col, row] of COINS) {
        const coin = game.instantiate(coinPrefab);
        coin.transform.position = { x: col * TILE + 3, y: row * TILE + 3 };
    }
    // The state right after the level is built: falling restores it until a flag is reached
    game.createCheckPoint();
});

function onTouch(other) {
    if (other.tag === "coin") {
        score++;
        game.destroy(other);
    } else if (other.tag === "flag" && other.transform.visibility) {
        // Coins collected so far stay collected after a fall; the ones after the flag come back
        checkpointScore = score;
        other.transform.visibility = false;
        game.createCheckPoint();
    }
}

function respawn() {
    // Restores positions, destroyed coins, the hidden flag sprite and game.random, then the plain JS state
    game.restoreCheckPoint();
    score = checkpointScore;
    velocityY = 0;
}

game.fixedUpdate((updater, dt) => {
    const t = player.transform;
    t.position.x += game.input.axis("left", "right") * RUN_SPEED * dt;
    for (const wall of walls) BrioCollision.resolveCollision(player, wall);

    velocityY = Math.min(velocityY + GRAVITY * dt, 500);
    t.position.y += velocityY * dt;
    grounded = false;
    for (const wall of walls) {
        const mtv = BrioCollision.resolveCollision(player, wall);
        if (mtv && mtv.y < 0) {
            grounded = true;
            velocityY = 0;
        } else if (mtv && mtv.y > 0) {
            velocityY = 0;
        }
    }

    // Spikes are not solid: they are detected by asking the map which tile is under the hero's feet
    const feet = map.getTileAtWorld(t.position.x + 6, t.position.y + 13);
    if (feet === 4 || t.position.y > map.heightInPixels) respawn();
});

game.update(() => {
    if (grounded && game.input.isPressed("jump")) {
        velocityY = -JUMP_SPEED;
        grounded = false;
    }
    const axis = game.input.axis("left", "right");
    if (axis !== 0 && axis < 0 !== player.transform.flip.x) {
        player.transform.flip = { x: axis < 0, y: false };
    }
    hud.text = `Coins ${score}/${COINS.length}`;
});

window.brioGame = game;
