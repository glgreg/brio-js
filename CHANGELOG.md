# Changelog

All notable changes to BrioJS are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).
While the major version is `0`, minor releases may include breaking changes.

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
