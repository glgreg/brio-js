import { BrioGame as Game, GameState } from "./game/BrioGame";
import { BrioScene as Scene } from "./not-implemented/BrioScene";
import { BrioMap as Map } from "./not-implemented/BrioMap";
import { BrioSprite as Sprite } from "./assets/BrioSprite";
import { BrioAtlas as Atlas } from "./assets/BrioAtlas";
import { BrioObject as Object } from "./objects/BrioObject";
import { BrioTransform as Transform } from "./base/BrioTransform";
import { BrioKeyboard as Keyboard } from "./input/BrioKeyboard";
import { BrioUtils as Utils } from "./tools/BrioUtils";
import { BrioCamera as Camera } from "./not-implemented/BrioCamera";
import { BrioAudio as Audio } from "./assets/BrioAudio";
import { BrioCollision as Collision } from "./math/BrioCollision";
import { BrioConsole as Console } from "./debugging/BrioConsole";
import { BrioDebugger as Debugger } from "./debugging/BrioDebugger";
import { Vector2, BrioVec2 } from "./math/index";
import * as Math from "./math/BrioMath";

export type {
    AssetLoaderParam,
    LoaderCallbackFunction,
    CanvasRendering,
} from "./game/BrioGame";
export type { CanvasBackground } from "./game/BrioCanvasBackground";
export type { CanvasFPSPosition } from "./game/BrioSpriteRenderer";
export type { UpdaterObjectParam } from "./game/BrioUpdater";
export type { BrioAssets } from "./game/BrioAssetManager";
export type { SpriteType, SpriteProperties } from "./assets/BrioSprite";
export type { Atlas as AtlasData } from "./assets/BrioAtlas";
export type { StartingTime, IterationTypes, PlayTogetherConfig } from "./assets/BrioAudio";
export type {
    KeyActions,
    CollisionType,
    CollisionColliderType,
    CollisionShapeType,
} from "./objects/BrioObject";
export type { Transform as TransformProps } from "./base/BrioTransform";
export type {
    RectangleCollisionType,
    SquareCollisionType,
    CircleCollisionType,
} from "./math/BrioCollision";
export type { Vec2, Vec2Bool } from "./math/index";
export type {
    DebugConsoleProperties,
    DebugGridProperties,
    DebugFPSOverlayProperties,
    DebugRenderProperties,
} from "./debugging/BrioDebugger";
export type {
    AnyCSSString,
    CSSPosition,
    CSSLength,
    CSSVec2Length,
    CSSBackgroundPosition,
    CSSBackgroundSize,
    CSSBackgroundBlendMode,
    CSSBackgroundRepeat,
    CSSBackgroundRendering,
    CSSColor,
    KeyboardKey,
} from "./tools/base_types";

export {
    Game as BrioGame,
    GameState,
    Map as BrioMap,
    Scene as BrioScene,
    Sprite as BrioSprite,
    Atlas as BrioAtlas,
    Object as BrioObject,
    Transform as BrioTransform,
    Utils as BrioUtils,
    Keyboard as BrioKeyboard,
    Camera as BrioCamera,
    Audio as BrioAudio,
    Collision as BrioCollision,
    Console as BrioConsole,
    Debugger as BrioDebugger,
    BrioVec2,
    Vector2,
    Math as BrioMath,
};

/**
 * Default namespace object bundling all core BrioJS classes and math utilities.
 * Individual named imports (`import { BrioGame, BrioObject } from "brio-js"`) are recommended for optimal tree-shaking.
 */
const Brio = {
    Game,
    GameState,
    Map,
    Scene,
    Sprite,
    Atlas,
    Object,
    Transform,
    Utils,
    Keyboard,
    Camera,
    Audio,
    Collision,
    Console,
    Debugger,
    BrioVec2,
    Vector2,
    Math,
};

export default Brio;

