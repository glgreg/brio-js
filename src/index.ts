import { BrioGame as Game } from "./game/BrioGame";
import { BrioScene as Scene } from "./not-implemented/BrioScene";
import { BrioMap as Map } from "./not-implemented/BrioMap";
import { BrioSprite as Sprite } from "./assets/BrioSprite";
import { BrioSpriteSheet as SpriteSheet } from "./assets/BrioSpriteSheet";
import { BrioObject as Object } from "./objects/BrioObject";
import { BrioKeyboard as Keyboard } from "./input/BrioKeyboard";
import { BrioUtils as Utils } from "./tools/BrioUtils";
import { BrioCamera as Camera } from "./not-implemented/BrioCamera";
import { BrioAudio as Audio } from "./assets/BrioAudio";
import { BrioCollision as Collision } from "./math/BrioCollision";
import { BrioConsole as Logger } from "./debugging/BrioConsole";
import { Vector2 } from "./math/index";
import * as Math from "./math/BrioMath";

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
    Vector2,
    Math as BrioMath,
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
    Vector2,
    Math,
};

export default Brio;
