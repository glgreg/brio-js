import { BrioGame as Game } from "./BrioGame";
import { BrioScene as Scene } from "./BrioScene";
import { BrioMap as Map } from "./BrioMap";
import { BrioSprite as Sprite } from "./asset/BrioSprite";
import { BrioSpriteSheet as SpriteSheet } from "./asset/BrioSpriteSheet";
import { BrioObject as Object } from "./BrioObject";
import { BrioKeyboard as Keyboard } from "./input/BrioKeyboard";
import { BrioUtils as Utils } from "./BrioUtils";
import { BrioCamera as Camera } from "./BrioCamera";
import { BrioAudio as Audio } from "./asset/BrioAudio";
import { GameCollision as Collision } from "./BrioCollision";
import { BrioLogger as Logger } from "./logging/BrioLogger";

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
