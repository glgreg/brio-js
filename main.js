import GLS, { Game, Sprite, SpriteSheet, GameObject, GameUtils } from "./dist/gls/index.js";

const screenWidth = window.innerWidth;
const screenHeight = window.innerHeight;
const BODY = document.body;
const test_container = document.querySelector("#test_container");

// game config
const game = new Game(640, 480, BODY);

game.background = "center center / cover no-repeat url('./images/forest_pixelart.png'), #bbb";
game.renderingType = "pixelated";
game.scale = 1;

// game.useFullScreen();
game.useUtilityLogs();
game.useKeyboard();
game.useGamepad();

game.preload(() => {
	const map = new Sprite({
		name: "map_zelda",
		src: "./images/zelda_map.png",
		pos: { x: 0, y: 0 },
		size: { x: 4352, y: 4096 },
		type: "img",
	});
	const spr_gato = new Sprite({
		name: "spr_gato",
		src: "./images/gato.png",
		pos: { x: 32, y: 32 },
		size: { x: 32, y: 32 },
		type: "img",
	});

	return [map, spr_gato];
});

game.load((loader) => {
	const map_zelda = loader.preloaded("map_zelda");
	const spr_gato = loader.preloaded("spr_gato");
	console.log(map_zelda);

	const obj_map = new GameObject("map", map_zelda, 0);
	const player = new GameObject("player", spr_gato, 1);
	// player.sprite.scale = 3;
	player.pos.x = game.width / 2 - player.size.x;
	player.pos.y = game.height / 2 - player.size.y * 1.5;

	return [obj_map, player];
});

let spd = 900;
let mspd = 900;
game.update((updater, dt) => {
	const map = updater.loaded("map");
	const player = updater.loaded("player");
	if (test_container) {
		showInfo([player, map], test_container);
	}

	if (game.keyboard.isDown("ArrowRight")) {
		map.pos.x -= spd * dt;
	}
	if (game.keyboard.isDown("ArrowLeft")) {
		map.pos.x += spd * dt;
	}
	if (game.keyboard.isDown("ArrowUp")) {
		map.pos.y += spd * dt;
	}
	if (game.keyboard.isDown("ArrowDown")) {
		map.pos.y -= spd * dt;
	}

	if (game.keyboard.isDown("Shift")) {
		spd = 1600;
	} else {
		spd = 900;
	}

	if (map.pos.x >= 0) {
		map.pos.x = 0;
	} else if (map.pos.x <= -(map.size.x * game.scale - game.width)) {
		map.pos.x = -(map.size.x * game.scale - game.width);
	}
	if (map.pos.y >= 0) {
		map.pos.y = 0;
	} else if (map.pos.y <= -(map.size.y * game.scale - game.height)) {
		map.pos.y = -(map.size.y * game.scale - game.height);
	}

	updater.animate(map);
	updater.animate(player);

	game.useShowBorders();
	game.useShowCollisions();
});

/**
 * @param {GameObject[]} objects
 * @param {Element} element
 */
function showInfo(objects, element) {
	/** @param {number} number */
	const handlePrecision = (number) => {
		return number.toFixed(0);
	};
	const template = objects.map((object, index) => {
		return `<span>Object name: ${object.name}</span><br>
		<span>pos x: ${handlePrecision(object.pos.x)}</span><br>
		<span>pos y: ${handlePrecision(object.pos.y)}</span><br>
		<span>size x: ${handlePrecision(object.size.x)}</span><br>
		<span>size y: ${handlePrecision(object.size.y)}</span><br>
		<hr>`;
	});

	element.innerHTML = template.reduce((prev, current) => {
		return (prev += current);
	});
}

// // game constants and variables
// const CLONE_SIZE = 5;
// let player_spd = 100;

// /**
//  * @typedef {import("./src/gls/Sprite.js").SpriteProps} SpriteProps
//  * @type {{[key: string]: SpriteProps}}
//  */
// const sprites = {
// 	samurai: {
// 		name: "spr_samurai",
// 		src: "./images/samurai/IDLE.png",
// 		pos: { x: 0, y: 0 },
// 		size: { x: 960, y: 96 },
// 		type: "img",
// 	},
// 	gato: {
// 		name: "spr_gato",
// 		src: "./images/gato.png",
// 		pos: { x: 0, y: 0 },
// 		size: { x: 44, y: 44 },
// 		type: "img",
// 	},
// 	twobe: {
// 		name: "spr_2b",
// 		src: "./images/2b.png",
// 		pos: { x: 0, y: 0 },
// 		size: { x: 88, y: 88 },
// 		type: "img",
// 	},
// 	bush3: {
// 		name: "spr_bush3",
// 		src: "./images/bush3.png",
// 		pos: { x: 0, y: 0 },
// 		size: { x: 82, y: 41 },
// 		type: "img",
// 	},
// 	bush14: {
// 		name: "spr_bush14",
// 		src: "./images/bush14.png",
// 		pos: { x: 0, y: 0 },
// 		size: { x: 45, y: 30 },
// 		type: "img",
// 	},
// };

// // game lifecycle
// game.preload(() => {
// 	const sprs = [
// 		new Sprite(sprites.samurai),
// 		new Sprite(sprites.gato),
// 		new Sprite(sprites.twobe),
// 		new Sprite(sprites.bush3),
// 		new Sprite(sprites.bush14),
// 	];
// 	const sprsheets = new SpriteSheet(sprs[0], 96, 96);
// 	sprsheets.setAnimation("idle", 1, 1, 1000);

// 	return [...sprs, sprsheets];
// });

// game.load((assets) => {
// 	const spr_samurai = assets.preloaded("spr_samurai");

// 	const spr_gato = assets.preloaded("spr_gato");
// 	const spr_2b = assets.preloaded("spr_2b");
// 	const spr_bush3 = assets.preloaded("spr_bush3");
// 	const spr_bush14 = assets.preloaded("spr_bush14");

// 	const samurai = new GameObject("samurai", spr_samurai, 1);
// 	const player = new GameObject("player", spr_gato, 1);
// 	const twobe = new GameObject("2b", spr_2b, 1);
// 	const bush3 = new GameObject("bush3", spr_bush3, 0);
// 	const bush14 = new GameObject("bush14", spr_bush14, 2);

// 	player.pos.x = game.width / 2 - 68;
// 	player.pos.y = game.height * 0.6;
// 	twobe.pos.x = game.width / 6;
// 	twobe.pos.y = game.width + 250;

// 	player.addCollisionMask("square", "solid", 0, 0, 34 * game.scale, 44 * game.scale);
// 	twobe.addCollisionMask("square", "solid", 0, 0, 88 * game.scale, 88 * game.scale);

// 	return [player, samurai, twobe, bush3, bush14];
// });

// game.update((updater, dt) => {
// 	game.useClearScreen();

// 	const samurai = updater.loaded("samurai");
// 	const player = updater.loaded("player");

// 	const twobe = updater.loaded("2b");
// 	const bushes3 = game.instantiate(updater.loaded("bush3"), CLONE_SIZE);
// 	const bushes14 = game.instantiate(updater.loaded("bush14"), CLONE_SIZE);
// 	player_mov(player, dt);

// 	updater.runOnce("destroy_unused_objects", () => {
// 		game.destroy(updater.loaded("2b"));
// 		game.destroy(updater.loaded("2b"));
// 	});

// 	updater.runOnce("bushes3_pos", () => {
// 		bushes3.forEach((bush, index) => {
// 			bush.pos.x = -120 + index * 80;
// 			bush.pos.y = screenHeight - bush.size.y * game.scale;
// 		});
// 		bushes14.forEach((bush, index) => {
// 			bush.pos.x = -30 + index * 80;
// 			bush.pos.y = screenHeight + 10 - bush.size.y * game.scale;
// 		});
// 	});

// 	updater.animateMany(bushes3);

// 	updater.animate(player);
// 	updater.animate(samurai);
// 	updater.runOnce("animate_samurai", () => {
// 		setInterval(() => {
// 			// samurai.pos.x -= 96;
// 		}, 100);
// 	});

// 	updater.animate(twobe);

// 	updater.animateMany(bushes14);

// 	player_spd = 400;
// 	if (game.colliding(player, twobe)) {
// 	}

// 	game.useShowBorders();
// 	game.useShowCollisions();
// });

// /**
//  *  @param {GameObject} player
//  *  @param {number} dt
//  */
// function player_mov(player, dt) {
// 	const up = game.keyboard.isDown("ArrowUp");
// 	const down = game.keyboard.isDown("ArrowDown");
// 	const left = game.keyboard.isDown("ArrowLeft");
// 	const right = game.keyboard.isDown("ArrowRight");

// 	if (up) player.pos.y -= player_spd * dt;
// 	if (down) player.pos.y += player_spd * dt;
// 	if (left) player.pos.x -= player_spd * dt;
// 	if (right) player.pos.x += player_spd * dt;
// }
