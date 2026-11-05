# Changelog

All notable changes to BrioJS are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).
While the major version is `0`, minor releases may include breaking changes.

## [Unreleased]

### Added

- Directional shadows on WebGL2: `castShadow` and `shadow` (`size`, `distance`, `resolution`, `bias`, `normalBias`,
  `strength`) on `BrioLight`, `castShadow` / `receiveShadow` on `BrioObject3D`. One shadow map per pass, centered on
  the camera target, snapped to texels and filtered with hardware PCF plus a 3x3 kernel;
  `RenderBackend.renderMesh3D()` takes optional shadow flags (`SHADOW_CAST`, `SHADOW_RECEIVE`).

- `"point"` and `"spot"` `BrioLight`s with `position`, `range`, `decay`, `angle` and `penumbra` (up to 8 per pass,
  `KHR_lights_punctual` attenuation), on WebGL2 and on the Canvas2D fallback.
- `shading: "standard"` on `BrioMaterial`: metallic-roughness shading with GGX highlights, Fresnel and reflections
  of the hemisphere sky (`roughness`, `metalness`); `emissive` and `emissiveIntensity` on every material.
- `BrioCamera3D` `toneMapping` (`"none"`, `"reinhard"`, `"aces"`, `"agx"`, `"neutral"`), `exposure` and distance `fog`
  (`"linear"`, `"exponential"`, `"exponential2"`), applied per camera pass; `RenderBackend.setPassParameters?()`.
- A shader program that fails to compile or link is logged once and its draws are skipped, instead of throwing
  inside the frame (D-07).
- `tests/rendering/ShaderSources.test.ts` compiles every WebGL2 program variant offline with `glslangValidator`
  when it is installed.

- `scene.onFixedUpdate()`: scene simulation at the game's fixed rate (`1 / 60` when the game has no
  `fixedUpdate()`), smoothed by `interpolate` like game objects.
- `game.onError()` and an error boundary in the frame loop: an exception in `update()`, `fixedUpdate()`, a scene
  or a collision listener stops the game with a message on the canvas and in the console, instead of freezing it
  silently.
- `pauseWhenHidden` option and `game.pauseWhenHidden` (default `true`): the game pauses, audio included, while its
  page is hidden and resumes when it is visible.
- `transform.getWorldPosition(out)` on `BrioTransform2D`, allocation-free.
- `e2e/heap.spec.ts`: an allocation budget for the game loop, and `e2e/tools/profile-allocations.mjs` to find
  allocation sites.

### Changed

- 2D hierarchy is rendered (D-01): a child is drawn inside its ancestors' frames (position, rotation and skew around
  the pivot, scale). `worldPosition` follows the same math, so it now rotates around the parent's pivot; camera
  follow, culling, collision tests and collision events use world positions.
- `transform.opacity` of a `BrioObject3D` takes effect and multiplies down the hierarchy (D-06);
  `RenderBackend.renderMesh3D()` takes an optional `opacity`.
- `LightingEnvironment.key` (a string built every pass) is replaced by a numeric `version`, and the environment is
  only rebuilt when a light changes (D-04).
- Render interpolation covers rotation and scale (2D angle, 3D quaternion along the shortest arc), not only
  position (D-19).
- The canvas claims touch gestures (`touch-action: none`), so dragging on a game no longer scrolls or zooms the page.
- The Canvas2D fallback lights triangles with world-space normals (rotated objects used to keep their lighting).

### Fixed

- 2D culling stays on with a rotated camera, any `game.scale` and parallax layers (D-12).
- Assigning the current sprite again no longer redraws `"static"` layers (D-14).
- A `BrioCamera3D` without objects clears its viewport to its clear color.
- `BrioCamera3D.viewProjectionMatrix` is cached; `BrioTransform3D` rotation sync, the WebGL2 draw sort and the
  collision event sweep no longer allocate per frame.

## [0.2.0] - 2026-11-04

Preview release for simple 2D and 3D games: engine-drawn text, collision events, tile maps, action-based input,
high-DPI rendering, complete checkpoints, and 3D backends and model loaders loaded on demand.

### Breaking changes

- `transform.depth` replaces `transform.layer` (drawing order inside a `BrioLayer`) on `BrioTransform2D` /
  `BrioTransform3D`, and the third constructor argument of `BrioObject2D` / fourth of `BrioObject3D` is named
  `depth`. Rename `.transform.layer` to `.transform.depth`.
- `KeyboardKey` and `CSSColor` are strict unions: arbitrary strings no longer type-check. `KeyboardKey` covers the UI
  Events named keys (including `" "` and `F1`-`F24`), ASCII letters, digits and symbols (cast layout-specific keys
  such as `"ç"` with `as KeyboardKey`); `CSSColor` covers hex, color functions, the 148 named colors, `transparent`
  and `currentcolor`. Gradients moved to `CSSGradient`, accepted by `game.background.color`.
- `BrioRenderer.createBackend()` returns a `Promise<RenderBackend>`, and backend factories passed to
  `registerBackend()` may be asynchronous (`RenderBackendFactory`).
- `Canvas2DBackend` lives in `rendering/Canvas2DBackend` (still exported from the package root).
- `game.ready()` rejects with the `Error` of the lifecycle stage that failed (it used to resolve); the error is also
  available as `game.lifecycleError`. Asset load failures reject with `Error` objects instead of strings.
- `game.instantiate()` is generic: it accepts `BrioObject3D` prefabs and returns the prefab's concrete type.
- The `"ui"` layers of every composition source are drawn after all world passes, so a game-level HUD stays above the
  active scene (before, scene content covered it).
- New canvases render at `devicePixelRatio` (capped at 2) by default; pass `pixelRatio: 1` for the 0.1 behavior.
  `game.width` / `game.height`, cameras and input keep using logical pixels.
- Snapshots are written in format version 3 (see "Added"); versions 1 and 2 are still read.

### Added

- **Text**: `BrioText` (a `BrioObject2D`) draws text with font, size, weight, style, color, alignment, line height,
  wrapping (`maxWidth`), outline and drop shadow; its `transform.size` is measured from the text, so culling,
  pivots and colliders follow it. Works in world space and on `"ui"` layers, and is covered by checkpoints.
- **Collision events**: `onCollisionEnter` / `onCollisionStay` / `onCollisionExit` on `BrioObject2D` and
  `BrioObject3D`, dispatched once per frame after `update()` with a sort-and-sweep broad phase; listeners receive
  `(other, self)`, may destroy objects, and are inherited by clones made with `game.instantiate()`. New `tag`
  property on 2D and 3D objects to group them.
- **Tile maps**: `BrioTileMap` renders through a `BrioSpriteSheet` `tileset` in cached 16x16-tile chunks (only
  visible chunks are drawn, an edited tile re-rasterizes only its chunk), with `position`, `visible`, `opacity`,
  `fill()`, `worldToTile()` / `getTileAtWorld()`, `BrioTileMap.fromTiled()` (Tiled JSON, orthogonal, CSV data,
  `TILE_MAP_LIMITS`) and `fromCSV()`. `BrioLayer.addTileMap()`, `game.addTileMap()` and `scene.addTileMap()`; maps
  returned by `load()` join the `"default"` layer. `BrioSpriteSheet` is a `PreloadAsset` and
  `assets.getSpriteSheet()` / `game.loadedSpriteSheets` expose it.
- **Input map**: `game.input` (`BrioInputMap`) binds actions to keys, mouse buttons, gamepad buttons and axes, and
  touch, with `isDown` / `isPressed` / `isUp` / `value` / `axis`, runtime `rebind()`, `toJSON()` / `load()` for
  saved settings and `captureNext()` for rebinding screens.
- **Mouse**: Pointer Lock (`requestPointerLock()`, `exitPointerLock()`, `isPointerLocked`, raw movement deltas);
  mouse and touch positions are mapped to logical game pixels (`logicalSize`), whatever the canvas CSS size.
- **Gamepad**: edges latch across several `poll()` calls per frame; `endFrame()`, `isConnected()`, `getAxis()`,
  `getButtonValue()`, `GAMEPAD_BUTTON_NAMES` (and `MOUSE_BUTTON_NAMES`).
- **Screen**: `pixelRatio` / `maxPixelRatio` options and `game.pixelRatio`; `game.resize(width, height)`;
  `game.useFullScreen("resize" | "fit")` (`"fit"` keeps the logical size and scales the canvas to the window,
  letterboxed, rendering at the displayed resolution); `game.canvas`.
- **Assets**: `game.onLoadProgress()` reports every finished asset of a game or scene `preload()`;
  `game.unloadAsset()` frees images, audio buffers and GPU copies (`RenderBackend.releaseMesh` /
  `releaseTexture`, implemented by WebGL2); `game.removeScene()` destroys an inactive scene and unloads the assets
  only it requested (reference counting by owner).
- **3D**: per-object frustum culling with mesh bounding spheres; `renderStats.objects3DDrawn`,
  `objects3DCulled` and `tileChunksDrawn`.
- **Checkpoints**: `createCheckPoint()` / `restoreCheckPoint()` / `restart()` (game and scenes) now also restore
  sprite, flip, hierarchy, tag and collider of 2D objects, `BrioText` content, mesh, material, collider and child parts
  of 3D objects, and tile map tiles (`captureState()` / `restoreState()` on objects, `captureTiles()` /
  `restoreTiles()` on maps).
- **Snapshot format v3**: the header records the stride of every component section, so snapshots stay readable
  when a later version appends fields (missing fields read as `0`). `BrioSerializer.FORMAT_VERSION` and
  `BrioSerializer.inspect()` report the version, layout, counts and strides of a snapshot without restoring it.
- `BrioSprite.sourceRect`; `BrioSpriteSheet.createSprite(name, cellIndex)` and `createCellSprites()`; named regions
  on `BrioAtlas` (`defineRegion`, `getRegion`, `hasRegion`, `regionNames`, `createSprite(region)`).

- `BrioSprite.sourceRect`; `BrioSpriteSheet.createSprite(name, cellIndex)` and `createCellSprites()`; named regions
  on `BrioAtlas` (`defineRegion`, `getRegion`, `hasRegion`, `regionNames`, `createSprite(region)`).
- `Matrix4.perspectiveZO` / `orthographicZO` (`[0, 1]` depth for WebGPU-style backends).
- `BrioRigidBody.applyCollisionResponse(separation)`, which applies `restitution`.
- Optional `RandomSource` argument on `BrioMath.randomRange` / `randomInt` (accepts `game.random`).
- Input controllers: `endFrame()`, `releaseAll()`, `attach()`, `isAttached`; `CameraScreenSpace2D` for
  `BrioCamera2D.worldToScreen` / `screenToWorld`.
- `BrioAudioMixer.resume()` and `isSuspended`; `AsyncDatabaseStorage.isPersistent()` and `persistent`.
- `BrioScene` `layout` constructor argument and `useLayout()`; `game.addScene()` narrows scenes to the game preset.
- `THIRD_PARTY_NOTICES.md` in the npm package, with the three.js and Godot notices; ADR 0007 records the policy for
  adapting third-party code.

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
- `game.useFullScreen()` no longer stacks window listeners when called again, and `game.end()` removes them.
- `BrioCollision.isColliding` no longer allocates for rectangle pairs.
- `BrioCamera2D`s registered in a `BrioScene` use `game.random` for shakes (they used `Math.random()`), so a fixed
  `seed` reproduces them.
- Releasing a letter key also releases its other case (pressing `w`, then Shift, then releasing no longer leaves
  `w` held).

### Changed

- The WebGL2 and Canvas2D backends and the GLB / glTF / OBJ loaders are loaded on demand with `import()`, so bundlers
  split them out: a 2D game no longer bundles them (`BrioGame` still references the 3D object classes; see
  `docs/ROADMAP.md`).
- `game.preload()` accepts an empty asset list.
- `BrioObject3D.clone(source, name?)` deep-clones child parts and renames them after the new name.
- `BrioStorage.local` / `session` store keys as `"brio:<key>"` and `clear()` removes only those keys; old unprefixed
  keys are still read and migrated on write.
- `Vector2.clamp` / `Vector3.clamp` throw when `min > max`.
- `OBJLoader.parse` returns `meshMaterials` and `warnings`; meshes split by `usemtl` are named `"<group>_<material>"`
  and duplicate names get a `_<n>` suffix.
- `GLTFLoader.parse(text, binBuffers)` maps `binBuffers[i]` to `json.buffers[i]`.
- Malformed snapshots throw `Error` before any change instead of `RangeError` after clearing the world.
- `TODO.md` and the architecture documents are in English; added `CONTRIBUTING.md`, issue and pull request templates,
  a release workflow (npm provenance) and a Playwright end-to-end suite in CI.

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
- **Determinism**: `BrioRandom` (xoshiro128\*\*) exposed as `game.random`, seeded with the `seed` option and saved in
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

[Unreleased]: https://github.com/glgreg/brio-js/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/glgreg/brio-js/releases/tag/v0.2.0
[0.1.0]: https://github.com/glgreg/brio-js/releases/tag/v0.1.0
