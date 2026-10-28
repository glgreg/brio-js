# BrioJS Roadmap and Known Issues

This page tracks what is known to be broken or limited in the current release and what is planned next. The
detailed engineering checklist (in Portuguese) lives in [`TODO.md`](../TODO.md); architecture decisions are in
[`docs/adr/`](./adr/).

Last updated: 2026-10-28 (unreleased fixes after v0.1.0).

## Known issues

| Area | Issue | Workaround |
| --- | --- | --- |
| Input | Gamepad buttons tapped between two polls are missed (the Gamepad API has no button events). | Use `isDown()` for gamepad actions that must not be missed. |
| Physics | No collision or trigger events are dispatched, and there is no contact solver between two moving bodies. | Test overlaps with `BrioCollision.isColliding` in `update()` and call `BrioRigidBody.applyCollisionResponse()` after `resolveCollision()`. |
| Audio | Without Web Audio, the `HTMLAudioElement` fallback keeps playing while the game is paused. | Pause the `BrioAudio` instances yourself in that environment. |
| Save states | 2D `flip`, hierarchy, sprite, mesh, material and collision settings are not part of ECS snapshots. | Restore them in game code after `restoreCheckPoint()`. |
| Canvas2D 3D fallback | Triangles are depth-sorted by centroid (Painter's Algorithm, no z-buffer), so large triangles such as a 2-triangle ground plane can cover objects standing on them. | Subdivide large surfaces: `BrioMesh.createPlane(name, w, d, segments)`. GPU backends are not affected. |
| Canvas2D 3D fallback | No texture sampling: textured materials render with their base color. | Use the WebGL2 backend (the default where available). |
| Cameras | A `BrioCamera2D` registered directly in a `BrioScene` keeps using `Math.random()` for shakes. | Assign `camera.random = game.random` for reproducible shakes. |
| Scenes | `game.setScene()` for a scene with `preload()` / `load()` completes asynchronously. | `await game.ready()` before touching the scene content. |
| Packaging | ESM only: `require("@brio-js/core")` from CommonJS fails. | Use `import` (or `await import("@brio-js/core")` from CommonJS). |
| Bundle size | `BrioGame` statically imports the whole 3D stack, so a 2D-only game bundles about 144 kB minified (the full engine is about 162 kB). | None yet; see "Lazy 3D stack" below. |
| glTF | Skinned meshes render in their bind pose; animations are ignored. | Bake animations or use static meshes. |

## Planned for v0.2

- **WebGPU backend** with hand-written WGSL variants, `createRenderPipelineAsync` pipeline cache, and per-frequency
  bind groups, sharing a `GpuResourceCache` with WebGL2 (plan in
  [`RENDERING_STUDY_THREEJS.md`](./architecture/RENDERING_STUDY_THREEJS.md)).
- **Frustum culling per object** in the 3D passes (bounding spheres on `BrioMesh`).
- **Unified `game.renderStats`** (draw calls, triangles, programs, GPU memory) across backends.
- **WebGL context-loss recovery** tested in browsers, including texture re-upload.
- **Visual regression tests** (golden images per example) in a headless browser, run in CI.
- **Input**: per-frame buffered key transitions (fixes the short-tap issue), action mapping (`BrioInputMap`) with
  runtime rebinding, ready-made orbit / first-person camera controllers, and engine-level 3D picking.
- **UI layer**: text, buttons, panels, and bars on the `"ui"` layer with keyboard/gamepad focus.
- **`BrioTileMap` rendering** in chunks on a `"static"` layer, plus Tiled/LDtk import.
- **Lazy 3D stack**: load the 3D backends and model loaders on demand so 2D games ship a smaller bundle.
- **Point and spot lights** with range and decay.

## Later

- PBR materials (metallic-roughness), image-based lighting, shadow maps, tone mapping, and GPU sprite batching.
- glTF skinning and animation (`BrioAnimator3D`), tweens, and animation state machines.
- 3D physics: collision resolution, rigid bodies, character controller, raycasts.
- Positional audio (`PannerNode`) bound to `BrioCamera3D` / `BrioCamera2D`.
- Particles, dialogue boxes, scene transitions.
- Declarative scene documents (`BrioSceneDocument`) and the MCP server for agentic game authoring
  ([ADR-0006](./adr/0006-mcp-agentic-game-authoring.md)).
- Networking, PWA packaging, and WebXR.

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
