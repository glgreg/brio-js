# Changelog

All notable changes to BrioJS are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).
While the major version is `0`, minor releases may include breaking changes.

## [Unreleased]

### Added

- `BrioSprite.sourceRect`; `BrioSpriteSheet.createSprite(name, cellIndex)` and `createCellSprites()`; named regions
  on `BrioAtlas` (`defineRegion`, `getRegion`, `hasRegion`, `regionNames`, `createSprite(region)`).
- `Matrix4.perspectiveZO` / `orthographicZO` (`[0, 1]` depth for WebGPU-style backends).
- `BrioRigidBody.applyCollisionResponse(separation)`, which applies `restitution`.
- Optional `RandomSource` argument on `BrioMath.randomRange` / `randomInt` (accepts `game.random`).
- Input controllers: `endFrame()`, `releaseAll()`, `attach()`, `isAttached`; `CameraScreenSpace2D` for
  `BrioCamera2D.worldToScreen` / `screenToWorld`.
- `BrioAudioMixer.resume()` and `isSuspended`; `AsyncDatabaseStorage.isPersistent()` and `persistent`.
- `BrioScene` `layout` constructor argument and `useLayout()`; `game.addScene()` narrows scenes to the game preset.

### Fixed

- glTF/GLB: each `bufferView` reads the buffer it names (multiple and `data:` buffers); a missing buffer throws
  `ModelLimitError` instead of reading buffer 0.
- OBJ: `usemtl` binds materials to meshes; `BrioMesh.fromOBJ` shares the `OBJLoader` parser and its limits, computes
  flat normals without `vn` and uses 32-bit indices for large meshes.
- `BrioSpriteSheet.createSprite()` draws one cell instead of the whole sheet.
- `BrioCamera2D.worldToScreen` / `screenToWorld` and `BrioMouse.getWorldPosition` account for rotation, zoom, shake,
  `game.scale` and viewport offset; `BrioCamera3D.isSphereInFrustum` tests all six planes.
- Keyboard and mouse taps shorter than one frame report `isPressed` / `isUp`; `BrioKeyboard.globalIsUp()` works;
  calling `useKeyboard()` / `useMouse()` / `useTouch()` twice no longer stacks listeners; window blur releases input.
- `game.pause()` suspends Web Audio and `resume()` resumes it; `game.end()` stops audio, disposes the 3D backend and
  clears meshes, materials and models.
- The game loop no longer allocates per frame for interpolation or keyboard state.
- Circle-rectangle `computeMTV` is exact; spatial grids no longer drop pairs of objects that share a name.
- Snapshots are fully validated before the world is cleared; `toJSON` reports the input version.
- Bound 3D `opacity` / `layer` read the ECS buffer and 3D matrices refresh after direct buffer writes; visibility is
  stored in the ECS and restored by checkpoints.
- Scenes rebind 3D parts on restore, unbind them on destroy, and release the previous object when a name is reused.
- Documentation (ADRs 0001-0005, rendering study, glossary, JSDoc) now matches the implementation.

### Changed

- `BrioStorage.local` / `session` store keys as `"brio:<key>"` and `clear()` removes only those keys; old unprefixed
  keys are still read and migrated on write.
- `Vector2.clamp` / `Vector3.clamp` throw when `min > max`.
- `OBJLoader.parse` returns `meshMaterials` and `warnings`; meshes split by `usemtl` are named `"<group>_<material>"`
  and duplicate names get a `_<n>` suffix.
- `GLTFLoader.parse(text, binBuffers)` maps `binBuffers[i]` to `json.buffers[i]`.
- Malformed snapshots throw `Error` before any change instead of `RangeError` after clearing the world.

## [0.1.0] - 2026-10-27

First public release.

### Added

- **Engine core**: `BrioGame` lifecycle (`preload` -> `load` -> `update`), `"2d"`, `"3d"`, and `"hybrid"` presets, a
  Structure-of-Arrays ECS with generational handles and O(1) pooling, and binary snapshots for checkpoints and
  restarts.
- **Scenes**: `BrioScene` with its own `preload()` / `load()` / `restart()`, run on first activation and covered by
  `game.createCheckPoint()`, `restoreCheckPoint()`, and `restart()`.
- **Fixed timestep**: `game.fixedUpdate()` with `fixedTimestep`, `maxFixedSteps`, optional render interpolation
  (`interpolate`, `interpolationAlpha`), and `game.step(dt)` for manual stepping.
- **Determinism**: `BrioRandom` (xoshiro128**) exposed as `game.random`, seeded with the `seed` option and saved in
  checkpoints.
- **2D rendering**: `BrioLayer` compositor (`static` cache, `parallax`, `dynamic` with culling, `ui`), multiple
  `BrioCamera2D` viewports (split-screen, picture-in-picture), sprites, atlases, sprite sheets, and animations.
- **3D rendering**: `WebGL2Backend` (GPU-resident meshes, sRGB textures with mipmaps, per-material programs,
  transparency sorting) with a Canvas2D software rasterizer as fallback; the backend cascade tries the next backend
  when one fails to initialize, and `BrioRenderer.registerBackend()` accepts custom backends.
- **Lights**: `BrioLight` (`directional`, `ambient`, `hemisphere`) per game or scene, uploaded through a uniform
  buffer on WebGL2 and approximated by luminance on Canvas2D.
- **Meshes and models**: procedural `createBox`, `createPlane` (subdividable), `createSphere`, `createCylinder`
  (cones and frustums); GLB, glTF, and OBJ/MTL loaders with textures, alpha modes, node transforms, model-namespaced
  names, and resource limits against hostile files (`configureModelLoaderLimits()`).
- **Cameras**: `BrioCamera3D` (perspective/orthographic) with `screenToRay()` / `ndcToRay()` for picking;
  `BrioCamera2D` with framerate-independent follow, deadzone, bounds, zoom, and shake.
- **Audio**: `BrioAudio` over the Web Audio API with `BrioAudioMixer` buses (master, bgm, sfx), automatic unlock on
  the first user gesture, voice limits, and an `HTMLAudioElement` fallback.
- **Input**: keyboard, mouse (screen and world position, buttons, wheel), touch (multi-touch), and gamepad (deadzone, vibration) controllers.
- **Physics**: 2D collision with minimum translation vector resolution, `BrioRigidBody`, `SpatialHash2D`, and
  `SpatialOctree3D` broad phases.
- **Storage**: `BrioStorage` (memory, session, local, IndexedDB) and `BrioSerializer` binary snapshots.
- **Examples**: a complete 2D game and a 3D scene in `examples/`, with procedural assets only.

### Known issues

See [`docs/ROADMAP.md`](./docs/ROADMAP.md#known-issues).

[0.1.0]: https://github.com/glgreg/brio-js/releases/tag/v0.1.0
