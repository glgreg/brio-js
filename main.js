import GLS, { Game, Sprite, GameObject, GameUtils } from "./dist/gls/index.js";

const screenWidth = window.innerWidth;
const screenHeight = window.innerHeight;
const BODY = document.body;

// game config
const game = new Game(screenWidth, screenHeight, BODY);

game.background = "center center / cover no-repeat url('./images/forest_pixelart.png'), #bbb";
game.renderingType = "pixelated";
game.scale = 3;

game.useFullScreen();
game.useUtilityLogs();
game.useKeyboard();
game.useGamepad();

// game constants and variables
const CLONE_SIZE = 5;
let player_spd = 400;

// game lifecycle
game.preload(() => {
	const sprites = [
		new Sprite("spr_gato", "./images/gato.png", 0, 0, 44, 44),
		new Sprite("spr_2b", "./images/2b.png", 0, 0, 88, 88),
		new Sprite("spr_bush3", "./images/bush3.png", 0, 0, 82, 41),
		new Sprite("spr_bush14", "./images/bush14.png", 0, 0, 45, 30),
	];

	return sprites;
});

game.load((assets) => {
	const spr_gato = assets.preloaded("spr_gato");
	const spr_2b = assets.preloaded("spr_2b");
	const spr_bush3 = assets.preloaded("spr_bush3");
	const spr_bush14 = assets.preloaded("spr_bush14");

	const player = new GameObject("player", spr_gato, 1);
	const twobe = new GameObject("2b", spr_2b, 1);
	const bush3 = new GameObject("bush3", spr_bush3, 0);
	const bush14 = new GameObject("bush14", spr_bush14, 2);

	player.pos.x = game.width / 2 - 68;
	player.pos.y = game.height * 0.6;
	twobe.pos.x = game.width / 6;
	twobe.pos.y = game.width + 250;

	player.addCollisionMask("square", "solid", 0, 0, 34 * game.scale, 44 * game.scale);
	twobe.addCollisionMask("square", "solid", 0, 0, 88 * game.scale, 88 * game.scale);

	return [player, twobe, bush3, bush14];
});

game.update((updater, dt) => {
	game.useClearScreen();

	const player = updater.loaded("player");

	const twobe = updater.loaded("2b");
	const bushes3 = game.instantiate(updater.loaded("bush3"), CLONE_SIZE);
	const bushes14 = game.instantiate(updater.loaded("bush14"), CLONE_SIZE);
	player_mov(player, dt);

	updater.runOnce("destroy_unused_objects", () => {
		game.destroy(updater.loaded("2b"));
		game.destroy(updater.loaded("2b"));
	});

	updater.runOnce("bushes3_pos", () => {
		bushes3.forEach((bush, index) => {
			bush.pos.x = -120 + index * 80;
			bush.pos.y = screenHeight - bush.size.h * game.scale;
		});
		bushes14.forEach((bush, index) => {
			bush.pos.x = -30 + index * 80;
			bush.pos.y = screenHeight + 10 - bush.size.h * game.scale;
		});
	});

	updater.animateMany(bushes3);

	updater.animate(player);

	updater.animate(twobe);
	updater.animateMany(bushes14);

	player_spd = 400;
	if (game.colliding(player, twobe)) {
	}

	game.useShowBorders();
	game.useShowCollisions();
});

/**
 *  @param {GameObject} player
 *  @param {number} dt
 */
function player_mov(player, dt) {
	const up = game.keyboard.isDown("ArrowUp");
	const down = game.keyboard.isDown("ArrowDown");
	const left = game.keyboard.isDown("ArrowLeft");
	const right = game.keyboard.isDown("ArrowRight");

	if (up) player.pos.y -= player_spd * dt;
	if (down) player.pos.y += player_spd * dt;
	if (left) player.pos.x -= player_spd * dt;
	if (right) player.pos.x += player_spd * dt;
}
