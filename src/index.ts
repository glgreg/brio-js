import { BrioGame as Game, GameState, DEFAULT_LAYER_NAME } from "./game/BrioGame";
import { BrioScene as Scene } from "./core/BrioScene";
import { BrioLayer as Layer } from "./core/BrioLayer";
import { BrioViewport as Viewport } from "./core/BrioViewport";
import { BrioTimer as Timer } from "./core/BrioTimer";
import { BrioTileMap as TileMap, TILE_MAP_LIMITS } from "./assets/BrioTileMap";
import { BrioSprite as Sprite } from "./assets/BrioSprite";
import { BrioAtlas as Atlas } from "./assets/BrioAtlas";
import { BrioTexture as Texture, TextureRegistry } from "./assets/BrioTexture";
import { BrioSpriteSheet as SpriteSheet } from "./assets/BrioSpriteSheet";
import { BrioAnimation as Animation } from "./assets/BrioAnimation";
import { BrioMesh as Mesh } from "./assets/BrioMesh";
import { BrioMaterial as Material } from "./assets/BrioMaterial";
import { BrioShader as Shader } from "./assets/BrioShader";
import { BrioModel as Model } from "./assets/BrioModel";
import { OBJLoader } from "./assets/loaders/OBJLoader";
import { GLBLoader } from "./assets/loaders/GLBLoader";
import { GLTFLoader } from "./assets/loaders/GLTFLoader";
import { BrioObject2D as Object2D } from "./objects/BrioObject2D";
import { BrioObject3D as Object3D } from "./objects/BrioObject3D";
import { BrioText as Text } from "./objects/BrioText";
import { BrioTransform2D as Transform2D } from "./objects/BrioTransform2D";
import { BrioTransform3D as Transform3D } from "./objects/BrioTransform3D";
import { BrioKeyboard as Keyboard } from "./input/BrioKeyboard";
import { BrioMouse as Mouse, MOUSE_BUTTON_NAMES } from "./input/BrioMouse";
import { BrioTouch as Touch } from "./input/BrioTouch";
import { BrioGamepad as Gamepad, GAMEPAD_BUTTON_NAMES } from "./input/BrioGamepad";
import { BrioInputMap as InputMap } from "./input/BrioInputMap";
import { BrioUtils as Utils } from "./tools/BrioUtils";
import { PlatformAdapter } from "./tools/PlatformAdapter";
import { BrioCamera2D as Camera2D } from "./cameras/BrioCamera2D";
import { BrioCamera3D as Camera3D } from "./cameras/BrioCamera3D";
import { BrioAudio as Audio } from "./assets/BrioAudio";
import { BrioAudioMixer as AudioMixer } from "./audio/BrioAudioMixer";
import { BrioLight as Light } from "./objects/BrioLight";
import { BrioRandom as Random } from "./math/BrioRandom";
import {
    configureModelLoaderLimits,
    getModelLoaderLimits,
    ModelLimitError,
} from "./assets/loaders/limits";
import { BrioCollision as Collision } from "./math/BrioCollision";
import { BrioRigidBody as RigidBody } from "./physics/BrioRigidBody";
import { SpatialHash2D } from "./physics/SpatialHash2D";
import { SpatialOctree3D } from "./physics/SpatialOctree3D";
import { ECSWorld } from "./ecs/ECSWorld";
import {
    ComponentStorage,
    ComponentMask,
    DirtyFlag,
    StorageLayoutFlag,
} from "./ecs/ComponentStorage";
import { BrioSerializer as Serializer } from "./storage/BrioSerializer";
import { BrioStorage as Storage } from "./storage/BrioStorage";
import { BrioRenderer as Renderer } from "./rendering/BrioRenderer";
import { Canvas2DBackend } from "./rendering/Canvas2DBackend";
import { WebGL2Backend } from "./rendering/WebGL2Backend";
import { BrioConsole as Console } from "./debugging/BrioConsole";
import { BrioDebugger as Debugger } from "./debugging/BrioDebugger";
import { Vector2, BrioVec2, Vector3, BrioVec3, Quaternion, BrioQuat, Matrix4 } from "./math/index";
import * as Math from "./math/BrioMath";

export type {
    AssetLoaderParam,
    LoaderCallbackFunction,
    CanvasRendering,
    BrioGameConfig,
    BrioGameDimension,
    PreloadAsset,
    FullScreenMode,
    LoadProgress,
} from "./game/BrioGame";
export type { ComponentStorageLayout } from "./ecs/ComponentStorage";
export type { ViewportPreset } from "./core/BrioViewport";
export type { CompositorStats } from "./rendering/BrioCompositor";
export type { RenderBackendFactory } from "./rendering/BrioRenderer";
export type { CanvasBackground } from "./game/BrioCanvasBackground";
export type { CanvasFPSPosition } from "./game/BrioSpriteRenderer";
export type { UpdaterObjectParam } from "./game/BrioUpdater";
export type { BrioAssets } from "./game/BrioAssetManager";
export type { SpriteType, SpriteProperties, SpriteSourceRect } from "./assets/BrioSprite";
export type { Atlas as AtlasData } from "./assets/BrioAtlas";
export type {
    MergedTileCollider,
    TileCoord,
    FlatTileGrid,
    TiledImportOptions,
} from "./assets/BrioTileMap";
export type { BrioMaterialOptions, ShaderParameterValue } from "./assets/BrioMaterial";
export type { BrioShaderOptions } from "./assets/BrioShader";
export type { BrioShadowOptions } from "./objects/BrioLight";
export type { BrioModelOptions, ModelFormat, ModelBoundingBox } from "./assets/BrioModel";
export type { ParsedModelData, OBJLoaderOptions } from "./assets/loaders/OBJLoader";
export type {
    StartingTime,
    IterationTypes,
    PlayTogetherConfig,
    BrioAudioOptions,
} from "./assets/BrioAudio";
export type { AudioBusName } from "./audio/BrioAudioMixer";
export type { BrioLightType, BrioLightOptions } from "./objects/BrioLight";
export type { LightingEnvironment } from "./rendering/lighting";
export type { BrioRandomSeed } from "./math/BrioRandom";
export type { RandomSource } from "./math/BrioMath";
export type { ModelLoaderLimits } from "./assets/loaders/limits";
export type { SceneContent, BrioSceneState } from "./core/BrioScene";
export type {
    KeyActions,
    CollisionType,
    CollisionColliderType,
    CollisionShapeType,
} from "./objects/BrioObject2D";
export type { CollisionShape3DType, Collision3DType } from "./objects/BrioObject3D";
export type { BrioObject2DState } from "./objects/BrioObject2D";
export type { BrioObject3DState } from "./objects/BrioObject3D";
export type { BrioTextOptions, TextAlign, TextDrawContext } from "./objects/BrioText";
export type { CollisionListener, CollisionPhase } from "./physics/BrioCollisionEvents";
export type {
    InputBinding,
    InputBindingLike,
    KeyboardBinding,
    MouseBinding,
    GamepadButtonBinding,
    GamepadAxisBinding,
    TouchBinding,
    InputDevice,
    InputMapControllers,
    InputMapJSON,
    InputMapLoadOptions,
    InputMapLoadReport,
    InputCaptureOptions,
} from "./input/BrioInputMap";
export type { InputLogicalSize } from "./input/InputSpace";
export type { SnapshotInfo } from "./storage/BrioSerializer";
// Types referenced by the public API (so the generated reference can link them); they are covered by the
// public surface review planned before 1.0 (docs/ROADMAP.md)
export type { AsyncDatabaseStorage, SyncStorageAdapter } from "./storage/BrioStorage";
export type { BrioAnimationOptions } from "./assets/BrioAnimation";
export type { BrioRegistry } from "./core/BrioRegistry";
export type { BrioTimerHandle } from "./core/BrioTimer";
export type { BrioUpdater } from "./game/BrioUpdater";
export type { CollisionListeners } from "./physics/BrioCollisionEvents";
export type { CompositorSource } from "./rendering/BrioCompositor";
export type { GLTFBinaryBuffers } from "./assets/loaders/GLBLoader";
export type { MaterialShadingMode } from "./assets/BrioMaterial";
export type { PendingTexture } from "./assets/loaders/OBJLoader";
export type { SpriteSheetCellRect } from "./assets/BrioSpriteSheet";
export type { Transform2D as Transform2DProps } from "./objects/BrioTransform2D";
export type { Transform3D as Transform3DProps } from "./objects/BrioTransform3D";
export type {
    RectangleCollisionType,
    SquareCollisionType,
    CircleCollisionType,
} from "./math/BrioCollision";
export type { BrioRigidBodyOptions } from "./physics/BrioRigidBody";
export type { CameraBounds2D, CameraScreenSpace2D } from "./cameras/BrioCamera2D";
export type {
    CameraProjection3D,
    BrioCamera3DOptions,
    BrioRay3D,
    ToneMappingMode,
    BrioFog,
} from "./cameras/BrioCamera3D";
export type { LayerPolicy, BrioLayerOptions } from "./core/BrioLayer";
export type { ViewportRect } from "./core/BrioViewport";
export type { MouseButton } from "./input/BrioMouse";
export type { TouchPoint } from "./input/BrioTouch";
export type { GamepadButtonName } from "./input/BrioGamepad";
export type { HostPlatformType, PlatformCapabilities } from "./tools/PlatformAdapter";
export type {
    RenderBackendType,
    RenderBackend,
    RenderPassParameters,
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
    CSSColorFunction,
    CSSNamedColor,
    CSSGradient,
    KeyboardKey,
    KeyboardNamedKey,
    KeyboardLetterKey,
    KeyboardSymbolKey,
} from "./tools/base_types";

export {
    Game as BrioGame,
    GameState,
    DEFAULT_LAYER_NAME,
    Scene as BrioScene,
    Layer as BrioLayer,
    Viewport as BrioViewport,
    Timer as BrioTimer,
    TileMap as BrioTileMap,
    TILE_MAP_LIMITS,
    Sprite as BrioSprite,
    Atlas as BrioAtlas,
    Texture as BrioTexture,
    TextureRegistry,
    SpriteSheet as BrioSpriteSheet,
    Animation as BrioAnimation,
    Mesh as BrioMesh,
    Material as BrioMaterial,
    Shader as BrioShader,
    Model as BrioModel,
    OBJLoader,
    GLBLoader,
    GLTFLoader,
    Object2D as BrioObject2D,
    Object3D as BrioObject3D,
    Text as BrioText,
    Transform2D as BrioTransform2D,
    Transform3D as BrioTransform3D,
    Utils as BrioUtils,
    PlatformAdapter,
    Keyboard as BrioKeyboard,
    Mouse as BrioMouse,
    Touch as BrioTouch,
    Gamepad as BrioGamepad,
    GAMEPAD_BUTTON_NAMES,
    MOUSE_BUTTON_NAMES,
    InputMap as BrioInputMap,
    Camera2D as BrioCamera2D,
    Camera3D as BrioCamera3D,
    Audio as BrioAudio,
    AudioMixer as BrioAudioMixer,
    Light as BrioLight,
    Random as BrioRandom,
    configureModelLoaderLimits,
    getModelLoaderLimits,
    ModelLimitError,
    Collision as BrioCollision,
    RigidBody as BrioRigidBody,
    SpatialHash2D,
    SpatialOctree3D,
    ECSWorld,
    ComponentStorage,
    ComponentMask,
    DirtyFlag,
    StorageLayoutFlag,
    Serializer as BrioSerializer,
    Storage as BrioStorage,
    Renderer as BrioRenderer,
    Canvas2DBackend,
    WebGL2Backend,
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
 * Individual named imports (`import { BrioGame, BrioObject2D } from "@brio-js/core"`) are recommended for optimal
 * tree-shaking.
 */
const Brio = {
    Game,
    GameState,
    Scene,
    Layer,
    Viewport,
    Timer,
    TileMap,
    Sprite,
    Atlas,
    Texture,
    TextureRegistry,
    SpriteSheet,
    Animation,
    Mesh,
    Material,
    Shader,
    Model,
    OBJLoader,
    GLBLoader,
    GLTFLoader,
    Object2D,
    Object3D,
    Text,
    Transform2D,
    Transform3D,
    Utils,
    PlatformAdapter,
    Keyboard,
    Mouse,
    Touch,
    Gamepad,
    InputMap,
    Camera2D,
    Camera3D,
    Audio,
    AudioMixer,
    Light,
    Random,
    Collision,
    RigidBody,
    SpatialHash2D,
    SpatialOctree3D,
    ECSWorld,
    ComponentStorage,
    ComponentMask,
    DirtyFlag,
    StorageLayoutFlag,
    Serializer,
    Storage,
    Renderer,
    Canvas2DBackend,
    WebGL2Backend,
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
