import { BrioGame as Game, GameState } from "./game/BrioGame";
import { BrioScene as Scene } from "./core/BrioScene";
import { BrioLayer as Layer } from "./core/BrioLayer";
import { BrioViewport as Viewport } from "./core/BrioViewport";
import { BrioTimer as Timer } from "./core/BrioTimer";
import { BrioMap as Map } from "./not-implemented/BrioMap";
import { BrioTileMap as TileMap } from "./assets/BrioTileMap";
import { BrioSprite as Sprite } from "./assets/BrioSprite";
import { BrioAtlas as Atlas } from "./assets/BrioAtlas";
import { BrioTexture as Texture, TextureRegistry } from "./assets/BrioTexture";
import { BrioSpriteSheet as SpriteSheet } from "./assets/BrioSpriteSheet";
import { BrioAnimation as Animation } from "./assets/BrioAnimation";
import { BrioMesh as Mesh } from "./assets/BrioMesh";
import { BrioMaterial as Material } from "./assets/BrioMaterial";
import { BrioObject as Object } from "./objects/BrioObject";
import { BrioObject2D as Object2D } from "./objects/BrioObject2D";
import { BrioObject3D as Object3D } from "./objects/BrioObject3D";
import { BrioTransform as Transform } from "./base/BrioTransform";
import { BrioTransform2D as Transform2D } from "./objects/BrioTransform2D";
import { BrioTransform3D as Transform3D } from "./objects/BrioTransform3D";
import { BrioKeyboard as Keyboard } from "./input/BrioKeyboard";
import { BrioMouse as Mouse } from "./input/BrioMouse";
import { BrioTouch as Touch } from "./input/BrioTouch";
import { BrioGamepad as Gamepad } from "./input/BrioGamepad";
import { BrioUtils as Utils } from "./tools/BrioUtils";
import { PlatformAdapter } from "./tools/PlatformAdapter";
import { BrioCamera as Camera } from "./not-implemented/BrioCamera";
import { BrioCamera2D as Camera2D } from "./cameras/BrioCamera2D";
import { BrioCamera3D as Camera3D } from "./cameras/BrioCamera3D";
import { BrioAudio as Audio } from "./assets/BrioAudio";
import { BrioCollision as Collision } from "./math/BrioCollision";
import { BrioRigidBody as RigidBody } from "./physics/BrioRigidBody";
import { SpatialHash2D } from "./physics/SpatialHash2D";
import { SpatialOctree3D } from "./physics/SpatialOctree3D";
import { ECSWorld } from "./ecs/ECSWorld";
import { ComponentStorage, ComponentMask, DirtyFlag } from "./ecs/ComponentStorage";
import { BrioSerializer as Serializer } from "./storage/BrioSerializer";
import { BrioStorage as Storage } from "./storage/BrioStorage";
import { BrioRenderer as Renderer, Canvas2DBackend } from "./rendering/BrioRenderer";
import { BrioConsole as Console } from "./debugging/BrioConsole";
import { BrioDebugger as Debugger } from "./debugging/BrioDebugger";
import {
    Vector2,
    BrioVec2,
    Vector3,
    BrioVec3,
    Quaternion,
    BrioQuat,
    Matrix4,
} from "./math/index";
import * as Math from "./math/BrioMath";

export type {
    AssetLoaderParam,
    LoaderCallbackFunction,
    CanvasRendering,
    BrioGameConfig,
    BrioGameDimension,
} from "./game/BrioGame";
export type { CanvasBackground } from "./game/BrioCanvasBackground";
export type { CanvasFPSPosition } from "./game/BrioSpriteRenderer";
export type { UpdaterObjectParam } from "./game/BrioUpdater";
export type { BrioAssets } from "./game/BrioAssetManager";
export type { SpriteType, SpriteProperties } from "./assets/BrioSprite";
export type { Atlas as AtlasData } from "./assets/BrioAtlas";
export type { MergedTileCollider } from "./assets/BrioTileMap";
export type { BrioMaterialOptions } from "./assets/BrioMaterial";
export type { StartingTime, IterationTypes, PlayTogetherConfig } from "./assets/BrioAudio";
export type {
    KeyActions,
    CollisionType,
    CollisionColliderType,
    CollisionShapeType,
} from "./objects/BrioObject";
export type {
    CollisionShape3DType,
    Collision3DType,
} from "./objects/BrioObject3D";
export type { Transform as TransformProps } from "./base/BrioTransform";
export type { Transform2D as Transform2DProps } from "./objects/BrioTransform2D";
export type { Transform3D as Transform3DProps } from "./objects/BrioTransform3D";
export type {
    RectangleCollisionType,
    SquareCollisionType,
    CircleCollisionType,
} from "./math/BrioCollision";
export type { BrioRigidBodyOptions } from "./physics/BrioRigidBody";
export type { CameraBounds2D } from "./cameras/BrioCamera2D";
export type { CameraProjection3D, BrioCamera3DOptions } from "./cameras/BrioCamera3D";
export type { LayerPolicy, BrioLayerOptions } from "./core/BrioLayer";
export type { ViewportRect } from "./core/BrioViewport";
export type { MouseButton } from "./input/BrioMouse";
export type { TouchPoint } from "./input/BrioTouch";
export type { GamepadButtonName } from "./input/BrioGamepad";
export type { HostPlatformType, PlatformCapabilities } from "./tools/PlatformAdapter";
export type {
    RenderBackendType,
    RenderBackend,
} from "./rendering/contracts/RenderBackend";
export type { Vec2, Vec2Bool, Vec3, Vec3Bool, Quat, Mat4 } from "./math/index";
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
    Scene as BrioScene,
    Layer as BrioLayer,
    Viewport as BrioViewport,
    Timer as BrioTimer,
    Map as BrioMap,
    TileMap as BrioTileMap,
    Sprite as BrioSprite,
    Atlas as BrioAtlas,
    Texture as BrioTexture,
    TextureRegistry,
    SpriteSheet as BrioSpriteSheet,
    Animation as BrioAnimation,
    Mesh as BrioMesh,
    Material as BrioMaterial,
    Object as BrioObject,
    Object2D as BrioObject2D,
    Object3D as BrioObject3D,
    Transform as BrioTransform,
    Transform2D as BrioTransform2D,
    Transform3D as BrioTransform3D,
    Utils as BrioUtils,
    PlatformAdapter,
    Keyboard as BrioKeyboard,
    Mouse as BrioMouse,
    Touch as BrioTouch,
    Gamepad as BrioGamepad,
    Camera as BrioCamera,
    Camera2D as BrioCamera2D,
    Camera3D as BrioCamera3D,
    Audio as BrioAudio,
    Collision as BrioCollision,
    RigidBody as BrioRigidBody,
    SpatialHash2D,
    SpatialOctree3D,
    ECSWorld,
    ComponentStorage,
    ComponentMask,
    DirtyFlag,
    Serializer as BrioSerializer,
    Storage as BrioStorage,
    Renderer as BrioRenderer,
    Canvas2DBackend,
    Console as BrioConsole,
    Debugger as BrioDebugger,
    BrioVec2,
    Vector2,
    BrioVec3,
    Vector3,
    BrioQuat,
    Quaternion,
    Matrix4,
    Math as BrioMath,
};

/**
 * Default namespace object bundling all core BrioJS classes and math utilities.
 * Individual named imports (`import { BrioGame, BrioObject2D } from "brio-js"`) are recommended for optimal tree-shaking.
 */
const Brio = {
    Game,
    GameState,
    Scene,
    Layer,
    Viewport,
    Timer,
    Map,
    TileMap,
    Sprite,
    Atlas,
    Texture,
    TextureRegistry,
    SpriteSheet,
    Animation,
    Mesh,
    Material,
    Object,
    Object2D,
    Object3D,
    Transform,
    Transform2D,
    Transform3D,
    Utils,
    PlatformAdapter,
    Keyboard,
    Mouse,
    Touch,
    Gamepad,
    Camera,
    Camera2D,
    Camera3D,
    Audio,
    Collision,
    RigidBody,
    SpatialHash2D,
    SpatialOctree3D,
    ECSWorld,
    ComponentStorage,
    ComponentMask,
    DirtyFlag,
    Serializer,
    Storage,
    Renderer,
    Canvas2DBackend,
    Console,
    Debugger,
    BrioVec2,
    Vector2,
    BrioVec3,
    Vector3,
    BrioQuat,
    Quaternion,
    Matrix4,
    Math,
};

export default Brio;
