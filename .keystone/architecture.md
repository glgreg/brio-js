# Architecture

## 1. System Overview

BrioJS is a single-package library with two strictly separated layers:

- **Public surface (ergonomics and teaching)**: concrete object-oriented classes (`BrioGame`, `BrioScene`,
  `BrioObject2D`, `BrioObject3D`, `BrioCamera2D`, `BrioCamera3D`, `BrioLight`, assets) plus pure, tree-shakeable
  utility functions (`vec2`, `vec3`, `mat4`, `quat`, `BrioMath`, `BrioCollision`).
- **Internal core (performance)**: a data-oriented ECS (`ECSWorld`, `ComponentStorage`) that stores state as
  Structure of Arrays in contiguous `TypedArray`s. Public objects are thin handles over ECS slots.

Everything runs on the main thread today. Web Workers with `OffscreenCanvas` (ADR 0003) are part of the target
architecture, not of the current implementation. `docs/architecture/TARGET_ARCHITECTURE.md` describes the target;
`README.md` (Status) and `docs/ROADMAP.md` describe what exists now.

## 2. Technology Stack

- **Language**: TypeScript with `strict: true`, compiled by `tsc` to ESNext ES modules (`dist/`), `.js` extensions
  added by `ts-add-js-extension`. ESM only, `sideEffects: false`.
- **Runtime dependencies**: none.
- **Rendering**: backend cascade through `RenderBackend` contracts; implemented: WebGL2 (UBO for lights) and a Canvas2D
  rasterizer with a software 3D projector. WebGPU is planned for v0.2 and plugs in through `registerBackend()`.
- **Audio**: Web Audio (`BrioAudioMixer` with master/bgm/sfx buses, unlock on first gesture), `HTMLAudioElement`
  fallback.
- **Persistence**: `BrioSerializer` (binary ECS snapshots in `ArrayBuffer`, optional JSON translation) and
  `BrioStorage` (memory, sessionStorage, localStorage, IndexedDB).
- **Tooling**: Vitest 5 + jsdom 30 (Node 22+), TypeDoc, Prettier (4 spaces, width 100). CI on GitHub Actions
  (Node 22 and 24: typecheck, tests, build, package content check).

## 3. Structure and Patterns

- **Directory layout** (`src/`, single entry `src/index.ts`):
  - `ecs/`: `ECSWorld`, `ComponentStorage` (SoA buffers, pooling, generational handles).
  - `game/`: `BrioGame` (entry point, loop, presets), `BrioUpdater`, `BrioAssetManager`, legacy sprite renderer.
  - `core/`: `BrioScene`, `BrioLayer`, `BrioViewport`, `BrioRegistry`, `BrioTimer`.
  - `objects/`: `BrioObject2D/3D`, `BrioTransform2D/3D`, `BrioLight` (facades over the ECS).
  - `cameras/`: `BrioCamera2D`, `BrioCamera3D` (`screenToRay`, `ndcToRay`, follow, shake).
  - `rendering/`: `BrioRenderer` (backend cascade), `BrioCompositor`, `WebGL2Backend`, `contracts/RenderBackend.ts`,
    lighting and color helpers.
  - `assets/`: textures, sprites, atlases, meshes, materials, models, audio, tile maps; `assets/loaders/` (GLB, glTF,
    OBJ, `ModelLoaderLimits`).
  - `audio/`, `input/` (keyboard, mouse, touch, gamepad), `physics/` (`BrioRigidBody`, `SpatialHash2D`,
    `SpatialOctree3D`), `math/`, `storage/`, `debugging/`, `tools/` (shared types, platform adapter).
  - `tests/` mirrors `src/`; `examples/` holds runnable 2D and 3D projects with procedural assets.
- **Design patterns**:
  - `BrioGame` is the single entry point and accepts the presets `"2d"`, `"3d"`, `"hybrid"` or a `BrioGameConfig`. The
    `"2d"` preset allocates no 3D transform buffer and rejects `BrioObject3D`.
  - 2D and 3D are separate concrete classes (ADR 0004) so 2D games do not pay for 3D memory.
  - Objects hold an `(entityId, entityGeneration)` handle; getters, setters and the atomic vectors (`BrioVec2`,
    `BrioVec3`, `BrioQuat`) read and write the ECS `TypedArray`s directly with dirty flags (ADR 0002).
    `destroyEntity`/`clear` bump the generation and `destroy()` unbinds the transform, so stale handles never write
    into recycled slots; snapshot restores rebind handles with `bindECS(storage, id, adopt = true)`.
  - `instantiate()`/`destroy()` recycle entities in O(1); sprite sheets and atlases share decoded images through `TextureRegistry` (`BrioSprite` still loads its own `Image`).
  - Lifecycle: `preload()` (async assets), `load()` (initial content), `update()` per frame, `fixedUpdate()` at
    `fixedTimestep` with optional interpolation; `game.step(dt)` advances manually; `game.random` is a seeded
    `BrioRandom` (xoshiro128**) saved in checkpoints.
- **Data flow per frame**: input poll -> fixed steps (simulation, physics) -> `update()` -> `BrioCompositor` composes
  the game content, then the active scene: 2D passes per `BrioCamera2D` viewport -> 3D passes per `BrioCamera3D` ->
  `ui` layers. Layers are `static` (offscreen cache per camera), `parallax`, `dynamic` (culled) or `ui`
  (screen space). Hot loops iterate dense arrays (`BrioRegistry`) with module-level comparators.

## 4. Integration Points

- **Browser APIs**: WebGL2, Canvas2D, Web Audio, Gamepad, Pointer/Touch, Web Storage, IndexedDB.
- **Asset formats**: glTF 2.0 / GLB, OBJ/MTL, PNG/JPEG/GIF/WebP; loaded asset names are namespaced as
  `"<model>/<name>"`; loaders enforce `ModelLoaderLimits` against malformed or hostile files.
- **Distribution**: npm (`@brio-js/core`, `files` whitelist: `dist`, README, LICENSE, GLOSSARY, CHANGELOG) and CDNs
  such as jsDelivr.
- **Planned**: MCP server for agentic game authoring (ADR 0006, `docs/architecture/MCP_GAME_AUTHORING.md`).

## 5. Constraints

- Zero runtime dependencies (ADR 0001).
- No allocation in the game loop: no `Array.from`, unconditional `.sort()`, `JSON.stringify` or per-frame closures.
- Tree-shaking: modular exports without import side effects. Known gap: `BrioGame` statically imports the 3D stack.
- Strict ubiquitous language from `GLOSSARY.md`: one name per concept, aliases only for configuration presets.
- Tests require Node 22+; the published package declares `node >= 18` for tooling consumers.

## 6. Stone Index

Generated by `keystone stone create` and `keystone stone doctor --fix`. Do not edit between the markers.

<!-- keystone:index:start -->
| Stone | Type | Location | Summary |
| --- | --- | --- | --- |
| `assets` | module | [src/assets](../src/assets/.stone.assets.md) | Asset definitions and GLB/glTF/OBJ loaders with namespaced names and ModelLoaderLimits. |
| `audio` | module | [src/audio](../src/audio/.stone.audio.md) | Web Audio mixer with master/bgm/sfx buses, gesture unlock and HTMLAudioElement fallback. |
| `cameras` | module | [src/cameras](../src/cameras/.stone.cameras.md) | BrioCamera2D (follow, deadzone, bounds, shake, culling, compositor-exact screen/world conversion) and BrioCamera3D (lazy matrices, six-plane sphere culling, screen-to-ray picking). |
| `scenes` | module | [src/core](../src/core/.stone.scenes.md) | BrioScene lifecycle and checkpoints, BrioLayer planes, BrioViewport regions, dense BrioRegistry collections and BrioTimer tasks. |
| `ecs` | module | [src/ecs](../src/ecs/.stone.ecs.md) | Data-oriented ECS: SoA TypedArray storage, O(1) entity pooling and generational handles. |
| `game` | module | [src/game](../src/game/.stone.game.md) | BrioGame entry point: presets, main loop with fixed step and interpolation, scenes and checkpoints. |
| `input` | module | [src/input](../src/input/.stone.input.md) | Event-driven keyboard, mouse and touch state with latched per-frame edges, plus a polled gamepad; listeners attach idempotently and held input is released on focus loss. |
| `math` | module | [src/math](../src/math/.stone.math.md) | Pure, tree-shakeable math: vec2/vec3/mat4/quat, BrioMath, BrioCollision and seeded BrioRandom. |
| `objects` | module | [src/objects](../src/objects/.stone.objects.md) | OOP facades (BrioObject2D/3D, transforms, BrioLight) that read and write ECS slots through handles. |
| `physics` | module | [src/physics](../src/physics/.stone.physics.md) | Opt-in rigid-body integration and restitution response (BrioRigidBody) plus uniform-grid broad phase (SpatialHash2D, SpatialOctree3D); no contact solver. |
| `rendering` | module | [src/rendering](../src/rendering/.stone.rendering.md) | Backend cascade (WebGL2, Canvas2D) behind RenderBackend contracts and the per-frame BrioCompositor. |
| `storage` | module | [src/storage](../src/storage/.stone.storage.md) | Versioned binary ECS snapshots (BrioSerializer) and fixed persistence adapters (BrioStorage: memory, Web Storage, IndexedDB). |
<!-- keystone:index:end -->
