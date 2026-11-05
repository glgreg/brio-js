# BrioJS Roadmap and Known Issues

This page tracks what is known to be broken or limited in the current release and what is planned next. The
current work is [`docs/plans/TCC_FINAL_SPRINT.md`](./plans/TCC_FINAL_SPRINT.md). The design reference and post-TCC
backlog is [`docs/plans/ENGINE_COMPLETION_PLAN.md`](./plans/ENGINE_COMPLETION_PLAN.md), with its evidence in
[`ENGINE_COMPLETION_STUDY.md`](./architecture/ENGINE_COMPLETION_STUDY.md). The older
engineering checklist (in Portuguese) lives in [`TODO.md`](../TODO.md); architecture decisions are in
[`docs/adr/`](./adr/).

Last updated: 2026-11-04 (v0.2.0).

## Known issues

| Area                 | Issue                                                                                                                                                                                                                                | Workaround                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Input                | Gamepad buttons pressed and released between two polls are missed (the Gamepad API has no button events); polls latch edges until the end of the frame.                                                                              | Use `isDown()` for gamepad actions that must not be missed.                                                |
| Input                | A touch shorter than one frame is lost by `BrioInputMap` touch bindings, and there are no on-screen virtual buttons yet.                                                                                                             | Read `game.touch` directly for taps.                                                                       |
| Physics              | Collision events report contacts but do not separate solid objects, and there is no contact solver between two moving bodies or for 3D.                                                                                              | Call `BrioCollision.resolveCollision()` (and `BrioRigidBody.applyCollisionResponse()`) in `fixedUpdate()`. |
| Audio                | Without Web Audio, the `HTMLAudioElement` fallback keeps playing while the game is paused.                                                                                                                                           | Pause the `BrioAudio` instances yourself in that environment.                                              |
| Save states          | Persisted snapshots (`createSnapshot()` bytes, `BrioSerializer`) hold ECS data only; sprite, flip, hierarchy, colliders and text are restored by in-memory checkpoints, not from stored bytes.                                       | Store that state yourself next to the snapshot, or rebuild the scene and restore the snapshot onto it.     |
| Canvas2D 3D fallback | Triangles are depth-sorted by centroid (Painter's Algorithm, no z-buffer), so large triangles such as a 2-triangle ground plane can cover objects standing on them.                                                                  | Subdivide large surfaces: `BrioMesh.createPlane(name, w, d, segments)`. GPU backends are not affected.     |
| Canvas2D 3D fallback | No texture sampling: textured materials render with their base color.                                                                                                                                                                | Use the WebGL2 backend (the default where available).                                                      |
| Tile maps            | Flipped, rotated and animated tiles, isometric/hexagonal maps, infinite maps, compressed Tiled data and `.tmx` files are not supported; only the first tileset's `firstgid` is applied.                                              | Export orthogonal maps as JSON with CSV layers and a single tileset.                                       |
| Text                 | `BrioText` uses the fonts the page provides; a web font that has not loaded yet is measured with the fallback font.                                                                                                                  | Await `document.fonts.load()` before `game.load()`.                                                        |
| Scenes               | `game.setScene()` for a scene with `preload()` / `load()` completes asynchronously.                                                                                                                                                  | `await game.ready()` before touching the scene content.                                                    |
| Packaging            | ESM only: `require("@brio-js/core")` from CommonJS fails.                                                                                                                                                                            | Use `import` (or `await import("@brio-js/core")` from CommonJS).                                           |
| Bundle size          | The 3D backends and model loaders are split out, but `BrioGame` still references the 3D object, camera and math classes, so a 2D-only game bundles about 164 kB minified (48 kB gzip; the backends and loaders add 29 kB on demand). | None yet; see "Before 1.0".                                                                                |
| glTF                 | Skinned meshes render in their bind pose; animations are ignored.                                                                                                                                                                    | Bake animations or use static meshes.                                                                      |

## Before 1.0

- **Public API surface review (open).** Everything exported from `src/index.ts` becomes a SemVer contract at 1.0.
  Today the package root also exports engine internals that games rarely need: `ECSWorld`, `ComponentStorage`,
  `ComponentMask`, `DirtyFlag`, `StorageLayoutFlag`, `Canvas2DBackend`, `WebGL2Backend`, the model loaders
  (`GLBLoader`, `GLTFLoader`, `OBJLoader`), `TextureRegistry`, `BrioUtils`, `PlatformAdapter`, the CSS helper types
  and the debug overlay types (`CanvasFPSPosition`). Before 1.0 each one is either kept as public API, marked
  `@experimental`, or moved to a subpath export (for example `@brio-js/core/internals`). The same review decides
  whether `BrioGame` gets typed asset and object names (generics) and whether 2D games can drop the remaining 3D
  classes from their bundle (a `@brio-js/core/3d` subpath or an injected 3D module).
- **Persisted save games**: a save format that stores the state checkpoints keep in memory (sprites, hierarchy,
  colliders, text) next to the ECS snapshot, with the same compatibility contract as snapshot format v3.
- **Visual regression for every example in Firefox and WebKit in CI** (they run opt-in today).

## Planned for v0.3

- **WebGPU backend** with hand-written WGSL variants, `createRenderPipelineAsync` pipeline cache, and per-frequency
  bind groups, sharing a `GpuResourceCache` with WebGL2 (plan in
  [`RENDERING_STUDY_THREEJS.md`](./architecture/RENDERING_STUDY_THREEJS.md)).
- **UI widgets** on the `"ui"` layer (buttons, panels, bars) with keyboard/gamepad focus, built on `BrioText`.
- **Ready-made camera controllers** (orbit, first-person with Pointer Lock) and engine-level 3D picking.
- **Point and spot lights** with range and decay.
- **Unified render stats** across backends (draw calls, triangles, programs, GPU memory).
- **Particles** (2D first) and **tweens** (`BrioTween`).

## Later

- PBR materials (metallic-roughness), image-based lighting, shadow maps, tone mapping, and GPU sprite batching.
- glTF skinning and animation (`BrioAnimator3D`), tweens, and animation state machines.
- 3D physics: collision resolution, rigid bodies, character controller, raycasts.
- Positional audio (`PannerNode`) bound to `BrioCamera3D` / `BrioCamera2D`.
- Particles, dialogue boxes, scene transitions.
- Declarative scene documents (`BrioSceneDocument`) and the MCP server for agentic game authoring
  ([ADR-0006](./adr/0006-mcp-agentic-game-authoring.md)).
- Networking, PWA packaging, and WebXR.

## Done in v0.2.0

- Engine-drawn text (`BrioText`), collision events, tile map rendering with Tiled import, `BrioInputMap`, Pointer
  Lock, high-DPI rendering, `resize()` and `useFullScreen("fit")`, load progress, asset unloading and scene removal
  with reference counting, per-object 3D frustum culling, generic `instantiate()`, complete checkpoints, snapshot
  format v3, on-demand 3D backends and model loaders, and a Playwright end-to-end suite (Chromium in CI, Firefox and
  WebKit opt-in) that also covers WebGL context loss.

## Recently fixed (v0.1.0)

- The renderer cascade now tries the next backend when one fails to initialize, instead of jumping to Canvas2D.
- `BrioMesh.createSphere` produced clockwise triangles, so spheres rendered inside-out under backface culling.
- The Canvas2D rasterizer now clips triangles against the near plane (vertices behind the camera no longer project
  mirrored across the screen).
- `BrioCamera2D.follow` smoothing no longer depends on the frame rate.
- Meshes and materials of different models no longer collide in the shared registries (names are namespaced as
  `"<model>/<name>"`).
- Child parts created by `BrioModel.instantiate` are registered in the ECS and covered by checkpoints.
- Model loaders reject hostile files (oversized buffers or images, out-of-bounds accessors, cyclic node graphs).
