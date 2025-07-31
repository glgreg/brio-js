import { Game, GameSprite, GameAudio, GameObject, GameUtils } from "./dist/gls/index.js";
import { GameLogger } from "./dist/gls/logging/GameLogger.js";

/** @typedef {(import("./src/gls/GameTypes.js").Vector2)} Vector2 */
/** @typedef {import("./src/gls/asset/GameSprite.js").GameSpriteProps} GameSpriteProps */

// global constants
const gameWidth = window.innerWidth;
const gameHeight = window.innerHeight;
const gs = GameUtils;

// global game constants
const PLAYER_SPD = 100;

const game = new Game(200, 200, document.body);

game.useLogs();

// GameLogger.;

// // logs
// game.useLogs();

// // configuration
// game.scale = 4;

// // keyboard
// game.useKeyboard();
// game.keyboard.customActions.set("Escape", () => {
// 	console.log(game.keyboard.customActions);
// 	if (game.isRunning) {
// 		game.pause();
// 	} else {
// 		game.resume();
// 	}
// });

// // preloading asyncronous assets
// game.preload(() => {
// 	const spr_gato = new GameSprite(sprites.gato);
// 	const spr_background = new GameSprite(sprites.background);
// 	const aud_ost = new GameAudio("aud_ost", "./audios/song.wav");
// 	const punch_1 = new GameAudio("aud_punch_1", "./audios/punch.wav");
// 	const punch_2 = new GameAudio("aud_punch_2", "./audios/punch_2.wav");

// 	return [spr_gato, spr_background, aud_ost, punch_1, punch_2];
// });

// // loading objects and object configurations
// game.load((assets) => {
// 	const obj_gato = new GameObject("obj_gato", assets.getSprite("spr_gato"), 1);
// 	const gato2 = new GameObject("obj_gato_clone", assets.getSprite("spr_gato"), 1);
// 	const obj_background = new GameObject("obj_background", assets.getSprite("spr_background"), 1);
// 	const punch_1 = assets.getAudio("aud_punch_1");
// 	const punch_2 = assets.getAudio("aud_punch_2");

// 	// GameAudio.playInSequence([punch_1, punch_2, punch_1, punch_2]);

// 	obj_gato.pos.x = 30;
// 	obj_gato.pos.y = 80;

// 	obj_gato.addCollisionMask("img", "solid", 0, 0, 26, 32);

// 	return [obj_gato, obj_background, gato2];
// });

// // update loop
// game.update((updater, dt) => {
// 	const player = updater.getObject("obj_gato");
// 	let player_pos = { x: 0, y: 0 };

// 	if (game.keyboard.isDown("ArrowUp")) {
// 		player_pos.y += -1;
// 	}
// 	if (game.keyboard.isDown("ArrowDown")) {
// 		player_pos.y += 1;
// 	}
// 	if (game.keyboard.isDown("ArrowLeft")) {
// 		player_pos.x += -1;
// 	}
// 	if (game.keyboard.isDown("ArrowRight")) {
// 		player_pos.x += 1;
// 	}

// 	if (game.keyboard.isDown(" ")) {
// 		console.log(player.instanceId);
// 	}

// 	player.pos.x += PLAYER_SPD * gs.normalize(player_pos).x * dt;
// 	player.pos.y += PLAYER_SPD * gs.normalize(player_pos).y * dt;

// 	// animating
// 	updater.animateFromName("obj_background");
// 	updater.animate(player);
// 	updater.animateFromName("obj_gato_clone");
// 	game.useShowBorders();
// 	game.useShowCollisions();
// });

// /** @type { { [spriteName: string]: GameSpriteProps } } */
// const sprites = {
// 	gato: {
// 		name: "spr_gato",
// 		src: "./images/gato.png",
// 		pos: { x: 0, y: 0 },
// 		size: { x: 32, y: 32 },
// 		type: "img",
// 	},
// 	background: {
// 		name: "spr_background",
// 		src: "./images/forest_pixelart.png",
// 		pos: { x: -60, y: 0 },
// 		size: { x: 2810 / 8, y: 1770 / 8 },
// 		type: "img",
// 	},
// };

// /**
//  * @param {GameObject[]} objects
//  * @param {Element} appendToElement
//  */
// function showInfo(objects, appendToElement) {
// 	/** @param {number} number */
// 	const handlePrecision = (number) => {
// 		return number.toFixed(0);
// 	};
// 	const template = objects.map((object, index) => {
// 		return `<span>Object name: ${object.name}</span><br>
// 		<span>pos x: ${handlePrecision(object.pos.x)}</span><br>
// 		<span>pos y: ${handlePrecision(object.pos.y)}</span><br>
// 		<span>size x: ${handlePrecision(object.size.x)}</span><br>
// 		<span>size y: ${handlePrecision(object.size.y)}</span><br>
// 		<hr>`;
// 	});

// 	appendToElement.innerHTML = template.reduce((prev, current) => {
// 		return (prev += current);
// 	});
// }
