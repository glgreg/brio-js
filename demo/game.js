import { BrioGame, BrioObject, BrioSprite, BrioAudio, BrioUtils } from "../dist/index.js";
import { die } from "../node_modules/die-statement/index.js";
import { Enemy } from "./Enemy.js";
import { Player } from "./Player.js";
import { Projectile } from "./Projectile.js";

const GAME_WIDTH = 640;
const GAME_HEIGHT = 480;

const game_container = document.getElementById("game_container") || die();

const game = new BrioGame(GAME_WIDTH, GAME_HEIGHT, game_container);

game.useKeyboard();
game.useLogs({ showStackCaller: false, showStackInGameClasses: false });
game.rendering.mode = "pixelated";

// resolver não estar aceitando cores fixas
game.background.color = "linear-gradient(to bottom, hsla(200, 100%, 60%, 1) 76%, #020319 34%)";
// game.background.image = "./assets/sprites/background.png";
game.background.repeat = "no-repeat";
game.background.size = "cover";
game.background.position = "center center";
game.background.rendering = "pixelated";

// -> PRELOAD STEP
game.preload(() => {
	const spr_player = new BrioSprite({
		name: "spr_player",
		src: "./assets/sprites/girl_front.png",
		pos: { x: 0, y: 0 },
		size: { x: 64, y: 64 },
		type: "img",
	});
	const spr_projectile = new BrioSprite({
		name: "spr_projectile",
		src: "./assets/sprites/projectile.png",
		pos: { x: 0, y: 0 },
		size: { x: 32, y: 32 },
		type: "img",
	});
	const spr_background = new BrioSprite({
		name: "spr_background",
		src: "./assets/sprites/background.png",
		pos: { x: 0, y: 0 },
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
	const obj_background = new BrioObject("obj_background", assets.getSprite("spr_background"), 1);
	const obj_enemy = new Enemy("obj_enemy", assets.getSprite("spr_player"), 1);

	return [obj_player, obj_projectile, obj_background, obj_enemy];
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
	if (game.keyboard.isUp("z")) player.shoot(projectile, 500 * dt);

	updater.animate("obj_background");
	updater.animateInstancesOf("obj_projectile");
	updater.animate("obj_player");
	updater.animateInstancesOf("obj_enemy");
});

/**
 * @param {BrioGame} game
 * @param {Enemy} enemy
 * @param {number} genTime
 * @param {number} speed
 */
function spawnEnemy(game, enemy, genTime, speed) {
	if (Math.random() < 0.97) return;

	const newEnemy = game.instantiate(enemy);
	newEnemy.pos.x = Math.random() * GAME_WIDTH;

	BrioUtils.timedAnimation(() => {
		newEnemy.pos.y += speed;
	}, 10_000);
}
