# BrioJS

BrioJS is an educational and rapid-prototyping 2D and 3D web game engine that bridges the gap between visual block-based tools and professional game engines through a progressive, human-and-AI-friendly domain model.

## Core Lifecycle & World

**Game (`BrioGame`)**:
The central application entrypoint that manages the host container, dimension preset (`"2d"` or `"3d"`) or advanced configuration object, global subsystems, and scene orchestration.
_Avoid_: App, Engine, Context, Stage

**Scene (`BrioScene`)**:
An isolated, self-contained game stage (such as a main menu, playable level, or game-over screen) that owns its lifecycle phases (`preload`, `load`, `update`), active objects, layers, and cameras.
_Avoid_: Level, Screen, Room, World

**Object2D (`BrioObject2D`)**:
A concrete 2D interactive entity within a scene that possesses a 2D spatial transform and optional 2D visual, physical, or behavioral capabilities.
_Avoid_: BrioObject (as an ambiguous alias), Actor2D, Node2D, Sprite (when referring to the entity itself)

**Object3D (`BrioObject3D`)**:
A concrete 3D interactive entity within a scene that possesses a 3D spatial transform and optional mesh, material, lighting, or 3D physical capabilities.
_Avoid_: BrioObject (as an ambiguous alias), Actor3D, Node3D, Model (when referring to the entity itself)

**Prefab**:
A configured object template used to spawn and recycle multiple identical object instances at runtime without manual state reconstruction.
_Avoid_: Prototype, Clone Source, Blueprint

**Transform2D (`BrioTransform2D`)**:
The spatial state of a 2D object, encompassing 2D position, base size, render size, scale, scalar rotation, skew, pivot, flip, visibility, opacity, layer, and local-to-world parent-child hierarchy.
_Avoid_: Coordinates, Bounds, Placement

**Transform3D (`BrioTransform3D`)**:
The spatial state of a 3D object, encompassing 3D position, scale, quaternion/Euler rotation, visibility, opacity, and local-to-world parent-child hierarchy.
_Avoid_: Coordinates3D, Placement3D

**Snapshot**:
A high-speed binary capture of a scene's complete entity and component state at a specific moment in time, used for instant checkpoints, scene restarts, or translation to persistent storage.
_Avoid_: Cache, Dump, StringifiedState

## Rendering, Cameras & Composition

**Layer (`BrioLayer`)**:
A discrete rendering plane with a defined update policy (`static`, `parallax`, `dynamic`, or `ui`) and ordering index, used to isolate redraw costs and stack gameplay graphics, dialogue boxes, and HUD overlays.
_Avoid_: Z-Index, Depth, Priority

**Viewport**:
A normalized rectangular region of the screen assigned to a camera, enabling full-screen views, minimaps, or local multiplayer split-screen layouts.
_Avoid_: ScreenSplit, Window, SubCanvas

**Camera2D (`BrioCamera2D`)**:
An orthographic 2D observer that defines which portion of a 2D scene is visible within a target viewport, supporting target following, deadzones, zoom, rotation, boundary confinement, and screen shake.
_Avoid_: View2D, Eye2D

**Camera3D (`BrioCamera3D`)**:
A perspective or orthographic 3D observer that projects a 3D scene onto a target viewport using field-of-view, near/far clipping planes, and spatial orientation.
_Avoid_: View3D, Eye3D

## Visual Assets (2D & 3D)

**Texture (`BrioTexture`)**:
A raw, decoded visual image resource loaded from a single source URI and shared across any number of 2D sprites or 3D materials without memory duplication.
_Avoid_: Image, Bitmap, RawSprite

**Atlas (`BrioAtlas`)**:
A mapping of named, arbitrary rectangular sub-regions over a single texture, acting as a factory for individual sprites or animation sequences.
_Avoid_: SpriteAtlas, BrioSpriteAtlas, TextureMap, Pack

**SpriteSheet (`BrioSpriteSheet`)**:
A specialized atlas organized as a uniform grid of rows and columns of equal-sized cells over a texture, acting as a factory for sprites and frame animations.
_Avoid_: TileSet (when used for character animations), Strip

**Sprite (`BrioSprite`)**:
A 2D visual unit ready to be attached to a `BrioObject2D`, referencing either a full texture or a specific region within an atlas or spritesheet.
_Avoid_: Graphic, ImageElement, Frame

**Animation (`BrioAnimation`)**:
A time-based sequence of sprite frames or property transitions applied to an object over elapsed scene time.
_Avoid_: Render, Draw, Loop

**TileMap (`BrioTileMap`)**:
A grid-based 2D spatial map composed of reusable visual cells from an atlas or spritesheet and automatically merged static collision boundaries.
_Avoid_: BackgroundSprite, GridMap

**Mesh (`BrioMesh`)**:
A 3D geometric surface composed of vertices, normals, UV coordinates, and indices ready to be rendered on a `BrioObject3D`.
_Avoid_: Geometry, Shape3D

**Material (`BrioMaterial`)**:
The surface appearance definition of a 3D mesh, specifying color, textures, shading mode, and opacity.
_Avoid_: Skin, ShaderConfig

## Physics & Collision

**Collider**:
A spatial volume (2D rectangle, square, circle, or 3D box, sphere) attached to an object for intersection testing and physical resolution.
_Avoid_: Mask, Hitbox, BoundingBox

**Solid**:
A collider mode that enforces physical obstruction by calculating the minimum translation vector and resolving penetration between colliding objects.
_Avoid_: Blocker, HardCollider, Wall

**Trigger**:
A collider mode that detects spatial overlap and dispatches collision events without obstructing physical movement.
_Avoid_: Intangible, Sensor, Ghost, PassThrough

**RigidBody (`BrioRigidBody`)**:
An optional physical simulation profile attached to an object that governs velocity, acceleration, gravity, mass, friction, and restitution.
_Avoid_: PhysicsBody, Mover
