import { Game } from "./Game";
import { GameScene } from "./GameScene";
import { GameMap } from "./GameMap";
import { GameSprite } from "./asset/GameSprite";
import { SpriteSheet } from "./SpriteSheet";
import { GameObject } from "./GameObject";
import { GameKeyboard } from "./input/GameKeyboard";
import { GameUtils } from "./GameUtils";
import { GameCamera } from "./GameCamera";
import { GameAudio } from "./asset/GameAudio";

export {
	Game,
	GameMap,
	GameScene,
	GameSprite,
	SpriteSheet,
	GameObject,
	GameUtils,
	GameKeyboard,
	GameCamera,
	GameAudio,
};

const GLS = {
	Game,
	GameMap,
	GameScene,
	GameSprite,
	SpriteSheet,
	GameObject,
	GameUtils,
	GameKeyboard,
	GameCamera,
	GameAudio,
};
export default GLS;
