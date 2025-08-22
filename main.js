import B, {
	BrioObject,
	BrioAudio,
	BrioGame,
	BrioLogger,
	BrioCollision,
	BrioSprite,
	BrioUtils,
} from "./dist/index.js";

/** @typedef {(import("./src/GameTypes.js").Vector2)} Vector2 */
/** @typedef {import("./src/asset/GameSprite.js").GameSpriteProps} GameSpriteProps */

// global constants
const gameWidth = window.innerWidth;
const gameHeight = window.innerHeight;

// global game constants
const PLAYER_SPD = 100;

// game config
const game = new BrioGame(gameWidth, gameHeight, document.body);

game.scale = 4;
game.background = {
	color: "hsl(220,100%,20%)",
	image: "./images/forest_pixelart.png",
	position: { x: "center", y: "center" },
	repeat: "no-repeat",
	size: "cover",
	blendMode: "normal",
};
game.useLogs({ showStackCaller: true, showStackInGameClasses: false });

// keyboard
game.useKeyboard();
game.keyboard.customActions.set("Escape", () => {
	BrioLogger.out("log", game.keyboard.customActions);
	if (game.isRunning) {
		game.pause();
	} else {
		game.resume();
	}
});

game.keyboard.customActions.set("m", () => {
	if (game.background.blendMode === "normal") game.background = { blendMode: "difference" };
	else game.background = { blendMode: "normal" };
});

// preloading asyncronous assets
game.preload(() => {
	const spr_gato = new BrioSprite(sprites.gato);
	const spr_background = new BrioSprite(sprites.background);
	const aud_ost = new BrioAudio("aud_ost", "./audios/song.wav");
	const punch_1 = new BrioAudio("aud_punch_1", "./audios/punch.wav");
	const punch_2 = new BrioAudio("aud_punch_2", "./audios/punch_2.wav");

	return [spr_gato, aud_ost, punch_1, punch_2, spr_background];
});

// loading objects and object configurations
game.load((assets) => {
	const background = new BrioObject("obj_background", assets.getSprite("spr_background"), 1);
	const obj_gato = new BrioObject("obj_gato", assets.getSprite("spr_gato"), 1);
	const punch = assets.getAudio("aud_punch_1");
	const punch2 = assets.getAudio("aud_punch_2");

	BrioCollision.addSquare({
		object: obj_gato,
		colliderType: "solid",
		pos: { x: 0, y: 0 },
		size: 32,
	});
	BrioCollision.addRectangle({
		object: obj_gato,
		colliderType: "solid",
		pos: { x: 0, y: 0 },
		size: { x: 26, y: 32 },
	});

	game.instantiateMany(obj_gato, 1);

	obj_gato.pos.x = 30;
	obj_gato.pos.y = 80;

	return [obj_gato, background];
});

/** @type {BrioObject[]} */
const player_2 = [];

// update loop
game.update((updater, dt) => {
	const player = updater.getObject("obj_gato");
	const clone = updater.getObject("obj_gato-1");

	let player_pos = { x: 0, y: 0 };
	let clone_pos = { x: 0, y: 0 };

	if (game.keyboard.isDown("n")) {
		updater.runOnce("creating_clones", () => {
			player_2.push(game.instantiate(player));
		});
	}

	// player movement keys
	if (game.keyboard.isDown("w")) {
		clone_pos.y += -1;
	}
	if (game.keyboard.isDown("s")) {
		clone_pos.y += 1;
	}
	if (game.keyboard.isDown("a")) {
		clone_pos.x += -1;
	}
	if (game.keyboard.isDown("d")) {
		clone_pos.x += 1;
	}

	if (game.keyboard.isDown("ArrowUp")) {
		player_pos.y += -1;
	}
	if (game.keyboard.isDown("ArrowDown")) {
		player_pos.y += 1;
	}
	if (game.keyboard.isDown("ArrowLeft")) {
		player_pos.x += -1;
	}
	if (game.keyboard.isDown("ArrowRight")) {
		player_pos.x += 1;
	}

	if (BrioCollision.isColliding(game, player, clone)) {
		console.log("colliding");
		const overlapX =
			Math.min(
				player.pos.x + player.collision.size.x / 2,
				clone.pos.x + clone.collision.size.x / 2,
			) -
			Math.max(
				player.pos.x - player.collision.size.x / 2,
				clone.pos.x - clone.collision.size.x / 2,
			);

		const overlapY =
			Math.min(
				player.pos.y + player.collision.size.y / 2,
				clone.pos.y + clone.collision.size.y / 2,
			) -
			Math.max(
				player.pos.y - player.collision.size.y / 2,
				clone.pos.y - clone.collision.size.y / 2,
			);

		if (overlapX < overlapY) {
			if (player.pos.x < clone.pos.x) player.pos.x += -overlapX;
			else player.pos.x += overlapX;
		} else {
			if (player.pos.y < clone.pos.y) player.pos.y += -overlapY;
			else player.pos.y += overlapY;
		}
	}

	// player movement result (normalized)
	clone.pos.x += PLAYER_SPD * BrioUtils.normalize(clone_pos).x * dt;
	clone.pos.y += PLAYER_SPD * BrioUtils.normalize(clone_pos).y * dt;

	player.pos.x += PLAYER_SPD * BrioUtils.normalize(player_pos).x * dt;
	player.pos.y += PLAYER_SPD * BrioUtils.normalize(player_pos).y * dt;

	// animating
	updater.animateFromName("obj_background");
	updater.animate(clone);
	updater.animate(player);
	updater.animateMany(player_2);
	// sprite and object boundaries
	game.useShowBorders();
	game.useShowCollisions();
});

/** @type { { [spriteName: string]: GameSpriteProps } } */
const sprites = {
	gato: {
		name: "spr_gato",
		src: "./images/gato.png",
		pos: { x: 0, y: 0 },
		size: { x: 32, y: 32 },
		type: "img",
	},
	background: {
		name: "spr_background",
		src: "./images/forest_pixelart.png",
		pos: { x: -60, y: 0 },
		size: { x: 2810 / 8, y: 1770 / 8 },
		type: "img",
	},
};

/**
 * @param {BrioObject[]} objects
 * @param {HTMLElement} appendToElement
 */
function showInfo(objects, appendToElement) {
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

	appendToElement.innerHTML = template.reduce((prev, current) => {
		return (prev += current);
	});
}
