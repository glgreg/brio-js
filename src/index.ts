import { Game } from "./Game";
import { GameScene as Scene } from "./GameScene";
import { GameMap as Map } from "./GameMap";
import { GameSprite as Sprite } from "./asset/GameSprite";
import { SpriteSheet } from "./GameSpriteSheet";
import { GameObject as Object } from "./GameObject";
import { GameKeyboard as Keyboard } from "./input/GameKeyboard";
import { GameUtils as Utils } from "./GameUtils";
import { GameCamera as Camera } from "./GameCamera";
import { GameAudio as Audio } from "./asset/GameAudio";
import { GameCollision as Collision } from "./GameCollision";
import { GameLogger as Logger } from "./logging/GameLogger";

export {
	Game as BrioGame,
	Map as BrioMap,
	Scene as BrioScene,
	Sprite as BrioSprite,
	SpriteSheet,
	Object as BrioObject,
	Utils as BrioUtils,
	Keyboard as BrioKeyboard,
	Camera as BrioCamera,
	Audio as BrioAudio,
	Collision as BrioCollision,
	Logger as BrioLogger,
};

const Brio = {
	Game,
	Map,
	Scene,
	Sprite,
	SpriteSheet,
	Object,
	Utils,
	Keyboard,
	Camera,
	Audio,
	Collision,
	Logger,
};

export default Brio;
