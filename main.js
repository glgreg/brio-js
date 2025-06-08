import GLS, { Game, Sprite, GameObject, GameUtils } from "./dist/gls/index.js";

const screenWidth = window.innerWidth;
const screenHeight = window.innerHeight;
const BODY = document.body;
const GU = GameUtils;

const game = new Game(screenWidth, screenHeight, BODY);
game.background = "center center / cover no-repeat url('./images/forest_pixelart.png'), #bbb";
game.renderingType = "pixelated";
game.scale = 3;

game.useFullScreen();
game.useUtilityLogs();

game.preload(() => {
	const sprites = [
		new Sprite(
			"spr_gato",
			"./images/gato.png",
			game.width / 2 - 68,
			game.height / 2 - 56 * 2,
			68,
			56,
		),
		new Sprite("spr_2b", "./images/2b.png", 0, 0, 128, 128),
		new Sprite("spr_bush1", "./images/bush3.png", 0, 0, 82, 41),
		new Sprite("spr_bush2", "./images/bush14.png", 0, 0, 45, 30),
	];

	const audios = ["audio1", "audio2"];

	return [...sprites, ...audios];
});

game.load((assets) => {
	const { logSprites, preloaded } = assets;

	const spr_gato = preloaded("spr_gato");
	const twobe = preloaded("spr_2b");
	const bush1 = preloaded("spr_bush1");
	const bush2 = preloaded("spr_bush2");

	const player = new GameObject("player", spr_gato);
	GU.addProperty(player, "health", 100);

	const bushes = [
		new GameObject("bush1", bush1),
		new GameObject("bush2", bush1),
		new GameObject("bush3", bush1),
		new GameObject("bush4", bush1),
		new GameObject("bush5", bush1),
		new GameObject("bush6", bush2),
		new GameObject("bush7", bush2),
		new GameObject("bush8", bush2),
		new GameObject("bush9", bush2),
		new GameObject("bush10", bush2),
	];
	for (let i = 0; i < bushes.length; i++) {
		bushes[i].pos.x += 50 * i - 80;
		bushes[i].pos.y += game.height - bushes[i].sprite.height * game.scale;
	}

	player.setActions({
		onKeyDown: {
			a: () => {
				GU.timedAnimation(() => {
					player.pos.x -= 5;
				}, 48);
			},
			d: () => {
				GU.timedAnimation(() => {
					player.pos.x += 5;
				}, 48);
			},
			w: () => {
				GU.timedAnimation(() => {
					player.pos.y -= 5;
				}, 48);
			},
			s: () => {
				GU.timedAnimation(() => {
					player.pos.y += 5;
				}, 48);
			},
		},
	});

	return [player, ...bushes];
});

let status = true;
game.update((updater) => {
	const { logGameObjects, loaded, animate, animateInstance } = updater;

	const player = loaded("player");

	/** @type {GameObject[]} */
	const player2 = player.instantiate();

	const bushes = [
		loaded("bush1"),
		loaded("bush2"),
		loaded("bush3"),
		loaded("bush4"),
		loaded("bush5"),
		loaded("bush6"),
		loaded("bush7"),
		loaded("bush8"),
		loaded("bush9"),
		loaded("bush10"),
	];

	if (status) {
		console.log(player.health);
		status = false;
	}

	game.useClearScreen();

	for (let i = 0; i < 5; i++) {
		animate(`bush${i + 1}`);
	}

	animate("player");

	animateInstance(player2);

	for (let i = 0; i < 5; i++) {
		animate(`bush${i + 6}`);
	}
});
