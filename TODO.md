# BrioJS - Engineering Checklist

This file consolidates every feature, bug fix, architectural refactor and performance improvement mapped during the project's technical audit.

`docs/ROADMAP.md` is the user-facing summary; this file is the detailed engineering checklist.

> Legend: `[ ]` Pending | `[x]` Done

---

## 1. History: Completed (Legacy)

- [x] Add grid logic to the render and debugging render
- [x] Fix pivot logic in rendering
- [x] Fix rotation logic when self increasing (`+=` operator): changed from deg to rad
- [x] Change logs for a better use: logs should be shown with no file traces, with only the user traces, or with user and Brio class traces
- [x] Change `BrioLogger` name to `BrioConsole`
- [x] Refactor the Sprite cloning to use a `SpriteRegistry` approach

---

## 2. Critical Bug Fixes

### 2.1. Lifecycle, Loop and Destruction

- [x] Fix the initial `deltaTime` calculation on the first frame of `BrioGame.update` (initialize `#deltaTimePreviousTime` with the initial `requestAnimationFrame` timestamp to avoid an abrupt jump on the first tick)
- [x] Fix destructive bug in `BrioGame.destroy` that wrongly deletes the `BrioSprite` key from `#assets.sprites` when destroying an object
- [x] Fix the `BrioGame.outbound` logic (line 691 uses `this.#width` for `auxHeight` and multiplies `0 * auxWidth * screenThreshold`)
- [x] Fix `BrioObject.clone` (the `if (object.collision)` block never runs because `object` was just instantiated without copying `gameObject.collision`)
- [x] Fix the incorrect assignment `newObject.instanceId = targetObject.clonesInstantiatedValue` in `BrioGame.instantiate` (it must reference the registered prefab/template)
- [x] Remove the `animate`, `animateFromName`, `animateMany` and `animateInstancesOf` methods from `BrioUpdater`, which cause double rendering in the game loop

### 2.2. Transform, Scale and 2D Rendering

- [x] Fix the propagation of `BrioGame.scale` to the renderer (currently passed as a primitive value in the `BrioSpriteRenderer` constructor, ignoring later changes to `game.scale`)
- [x] Fix `BrioSpriteRenderer.renderObject` to use `transform.renderSize` (or apply `transform.scale`) instead of always drawing with the raw `transform.size`
- [x] Fix individual vector setters in `BrioTransform` (`position.x`, `scale.x`, `size.x`, `pivot.x`, `skew.x`) using reactive atomic classes (`BrioVec2` / `BrioVec3`)
- [x] Fix the `skew` calculation in `BrioSpriteRenderer` (respect `transform.pivot` instead of fixing `size / 2`, standardize the unit to radians and use `Math.tan` in the shear matrix)
- [x] Fix clearing artifacts (`clearObject`) on rotated/scaled objects and motion artifacts in Chromium-based browsers (per-layer/per-frame clearing and optional sub-pixel alignment for pixel art)
- [x] Avoid redundant reconfiguration of `ctx.imageSmoothingEnabled` and `ctx.imageSmoothingQuality` for every object drawn in the same frame

### 2.3. Math, Collision, Audio and Console

- [x] Fix `vec2.normalize(out, v)` in `./src/math/vec2.ts` (it currently computes the magnitude by reading `out` instead of the input vector `v`)
- [x] Fix `vec2.distanceTo(a, b)` in `./src/math/vec2.ts` (return the scalar Euclidean distance as a `number` via `Math.hypot` without overwriting the source vector, creating a separate function if a difference vector is needed)
- [x] Fix the asymmetry in the circle-rectangle test in `BrioCollision.isColliding` (it currently fails when `one` is `"circle"` and `two` is `"rectangle"` or `"square"`)
- [x] Unify the `collision.pos` coordinate convention for circles between `BrioCollision.isColliding` and `BrioSpriteRenderer.renderCollisions`
- [x] Remove the duplicated and incomplete `BrioGame.isColliding` method in favor of the unified `BrioCollision` subsystem
- [x] Initialize `#storedErrors` and `#storedExceptions` in `BrioConsole.ts` and fix the statement `if (isFound) true;` on line 121 to `if (isFound) return;`
- [x] Fix the `EventListener` leak in `BrioAudio.playMany` when used with `delay` (the anonymous function created in `addEventListener("ended", ...)` is never removed)
- [x] Remove the hardcoded external URL and fix the asynchronous chaining of `decode()` + `createImageBitmap()` in `BrioAtlas.mount()`

---

## 3. Architectural Refactors and Performance

### 3.1. Strict Ubiquitous Language and Public API Modularization

- [x] Apply the Strict Ubiquitous Language rule across the codebase: remove semantic aliases (`BrioSpriteAtlas`, `BrioLogger`, `"intangible"`) and keep only the canonical terms documented in `./GLOSSARY.md` (`BrioAtlas`, `BrioConsole`, `"trigger"`)
- [x] Split into concrete classes `BrioObject2D` and `BrioObject3D` (as well as `BrioTransform2D` / `BrioTransform3D` and `BrioCamera2D` / `BrioCamera3D`)
- [x] Refactor `BrioGame` so it is no longer a God Object, acting as a central entry point that accepts the `"2d"` and `"3d"` presets or a full `BrioGameConfig` object
- [x] Ensure every utility function (`vec2`, `vec3`, `mat4`, `quat`, `BrioMath`, `BrioCollision`) is exported independently for full _tree-shaking_ support (`"sideEffects": false` in `package.json`)

### 3.2. ECS Backend (Structure of Arrays) + OOP Facade and Object Pooling

- [x] Implement `ECSWorld` and `ComponentStorage` based on contiguous `TypedArrays` (`Float32Array`, `Uint32Array`, `Uint8Array`)
- [x] Turn `BrioObject2D` and `BrioObject3D` into lightweight OOP facades (entity handles) whose getters/setters read and write directly into the ECS slots via `entityId`
- [x] Implement **native, transparent object pooling** in `ECSWorld` for `instantiate(prefab)` and `destroy(object)` in $O(1)$ time, eliminating the static `BrioObject.instanceOfObject` flag and the `-[0-9]+` suffix restriction
- [x] Eliminate the per-frame array allocation and sort (`Array.from(this.#assets.objects.values()).sort(...)`) in favor of render lists pre-sorted by `BrioLayer`, re-sorted only when a layer is marked _dirty_
- [x] Eliminate the creation of closures and object literals in frequently read getters (`BrioDebugger.console`, `BrioDebugger.render`, `BrioDebugger.#grid`)
- [x] Eliminate the creation of closures in `BrioCamera.pos` and `BrioCamera.size` while implementing `BrioCamera2D` / `BrioCamera3D`

### 3.3. Multi-Canvas, Layer Compositor (`BrioLayer`), Multi-Viewport and Workers (`OffscreenCanvas`)

- [x] Implement a `BrioLayer` system supporting $N$ configurable layers as `static` (redraws only when _dirty_), `parallax` (automatic scroll factor), `dynamic` (redraws every frame) and `ui` (ordered stacking in screen space for _Persona_-style dialogue boxes + overlaid HUD)
- [x] Implement support for multiple `BrioViewport`s per scene to allow local split-screen multiplayer (_split-screen_ for 2 to 4 players, _Gears of War_ style) and minimaps (_picture-in-picture_)
- [ ] Implement a `RenderWorker` with `OffscreenCanvas` (`transferControlToOffscreen()`) to move the rasterization cost off the main thread
- [ ] Implement a `PhysicsWorker` to process the broad phase and collision resolution off the main thread
- [ ] Implement ECS memory transport with an automatic 3-level fallback: `SharedArrayBuffer` (zero-copy) -> `Transferable ArrayBuffer` (double-buffering) -> main thread (single-thread fallback) _(reopened on 2026-10-19: only the `useSharedMemory` flag exists in `ComponentStorage`; there is no transport to Workers)_

---

## 4. Multi-Backend Graphics Pipeline (Zero-Dependency 2D & 3D)

- [x] Define a formal `RenderBackend` interface guaranteeing deterministic visual parity across all graphics engines
- [x] Implement an automatic backend selector following the priority cascade: `WebGPU -> WebGL2 -> WebGL1 -> Canvas2D`
- [ ] Implement `WebGPURenderer` (2D sprite batching pipeline and 3D mesh and basic lighting pipeline) _(today the cascade falls to `webgl2` because only implemented backends are selected; see `docs/architecture/RENDERING_STUDY_THREEJS.md` section 1 and item 8.1)_
- [ ] Implement `WebGL2Renderer` (instanced drawing via VAOs and Uniform Buffer Objects for 2D and 3D) _(partial as of 2026-10-20: `WebGL2Backend` covers 3D meshes with VAOs and textures; instancing, UBOs and the 2D pipeline are missing)_
- [ ] Implement `WebGL1Renderer` (dynamic quad/mesh batching for legacy GPUs)
- [x] Refactor `Canvas2DRenderer` (support for `OffscreenCanvasRenderingContext2D`, multi-layer caching and a lightweight **software 3D projector/rasterizer** with the _Painter's Algorithm_ as a fallback for 3D scenes on machines without WebGL)

---

## 5. Implementation and Polish of the Domain Modules

### 5.1. Scenes and Transforms (`BrioScene`, `BrioTransform2D`, `BrioTransform3D`)

- [x] Implement a complete `BrioScene` with its own lifecycle (`step`, `pause`, `resume`, `createCheckpoint`, `restoreCheckpoint`, `destroy`); content registered directly on `BrioGame` acts as the default scene and the active `BrioScene` is composited after it _(revised on 2026-10-19: previously the active scene was never rendered)_
- [x] Unify `BrioScene.preload/load/restart` with the `BrioGame` lifecycle _(2026-10-27: `setScene` runs `preload`/`load` on first activation; `game.createCheckPoint`/`restoreCheckPoint`/`restart` cover the active scene, including created/removed objects)_
- [x] Implement reactive `baseSize`, `renderSize`, `visibility`, `opacity` and `layer` in `BrioTransform2D`
- [x] Implement a parent-child hierarchy (`parent` / `children`) with automatic computation of `localTransform` and `worldTransform` (via `Mat3` matrices in 2D and `Mat4` in 3D)

### 5.2. 2D and 3D Visual Assets (`BrioTexture`, `BrioAtlas`, `BrioSpriteSheet`, `BrioSprite`, `BrioAnimation`, `BrioMesh`, `BrioMaterial`)

- [x] Implement `BrioTexture` and `TextureRegistry` (Flyweight pattern with `ImageBitmap` / GPU textures to avoid memory duplication per URI)
- [x] Implement `BrioAtlas` (mapping of arbitrary named sub-regions and a `BrioSprite` factory)
- [x] Implement `BrioSpriteSheet` as a factory of `BrioSprite` and `BrioAnimation` from uniform grids (rows x columns / cell width x height)
- [x] Implement `BrioAnimation` / `BrioAnimator` to control sprite animations (frame rate, loop, ping-pong, animation-end callbacks)
- [x] Implement `BrioMesh` (3D primitives Box, Sphere, Plane, Cylinder and a lightweight parser for `.obj` / `.gltf`) and `BrioMaterial` / `BrioLight` _(2026-10-27: `createCylinder` and `BrioLight` implemented; see 9.1 and 9.6)_

### 5.3. Cameras and Maps (`BrioCamera2D`, `BrioCamera3D`, `BrioTileMap`)

- [x] Implement `BrioCamera2D` decoupled from `BrioMap` (support for `follow` with `lerp` and `deadzone`, `zoom`, `rotation`, `setBounds`, `shake`, `screenToWorld`, `worldToScreen` and 2D _frustum culling_)
- [x] Implement `BrioCamera3D` (`perspective` and `orthographic` projection, `fov`, `near`, `far`, `lookAt`, `screenToRay` and 3D _frustum culling_) _(2026-10-27: `screenToRay` implemented; see 9.5)_
- [x] Implement `BrioTileMap` (support for 2D matrices and automatic merging of adjacent colliders)
- [x] Implement chunked `BrioTileMap` rendering on a `"static"` layer and Tiled/LDtk JSON import _(reopened on 2026-10-19: there was no rendering method or importer)_ _(done in v0.2: chunked rendering on any layer policy and Tiled JSON/CSV import; LDtk is not supported)_

### 5.4. Physics and Collisions (`BrioCollision`, `BrioRigidBody`, Broad Phase)

- [x] Implement automatic physical resolution via the _Minimum Translation Vector_ (MTV) for `"solid"` colliders and non-blocking event emission/detection for `"trigger"`
- [x] Implement `SpatialHash2D` and `SpatialOctree3D` for an automatic broad phase
- [x] Implement the optional `BrioRigidBody` component/profile (velocity, acceleration, gravity, mass, friction and restitution)

### 5.5. Input, Audio, Serialization, Storage and Platform

- [x] Refactor `BrioKeyboard` to use a single global listener on the window, exposing `BrioKeyboard.globalIsDown` and `BrioKeyboard.globalIsUp`, and calling `preventDefault()` only on the configured keys
- [x] Implement `BrioMouse` (screen and world position, clicks, scroll wheel, cursor lock)
- [x] Implement `BrioTouch` (multi-touch events and basic gestures for mobile web and Capacitor)
- [x] Implement `BrioGamepad` (unified Gamepad API polling, standard button/axis mapping, deadzone and vibration)
- [x] Refactor `BrioAudio` to use the **Web Audio API** (`AudioContext`, `AudioBuffer`, `GainNode` for Master/BGM/SFX channels, automatic mobile autoplay unlock) with an `HTMLAudioElement` fallback _(2026-10-27: `BrioAudioMixer` with Master/BGM/SFX buses, unlock on the first gesture, `maxVoices`, `stop()`)_
- [x] Implement `BrioSerializer` with **pure binary** serialization (`ArrayBuffer` / `Uint8Array`) of the ECS buffers for `createCheckpoint()`, `restoreCheckpoint()` and `restart()`, plus an optional JSON translator (`toJSON` / `fromJSON`)
- [x] Remove the old `#cachedObjects`, `#cachedSprites` and `JSON.stringify` logic from inside `BrioGame`
- [x] Implement a cross-platform `BrioStorage` (`state` in memory, `session` via `sessionStorage`, `local` via `localStorage`, and `db` via `IndexedDB`, supporting direct storage of `BrioSerializer` binary snapshots)
- [x] Implement a `PlatformAdapter` to handle lifecycle, fullscreen, resize and storage particularities across Browser, Electron, Capacitor and headless environments
- [x] Remove `BrioUtils.addProperty` and replace `BrioUtils.timedAnimation` and `BrioUtils.wait` with the `BrioTimer` system, synchronized with `deltaTime` and with the scene's `pause()` state

---

## 6. Advanced TypeScript Typing, Documentation (JSDoc/ACO) and Tests

- [x] Expand `./src/tools/base_types.ts` with strict _template literal types_ and _union types_ for `KeyboardKey`, `MouseButton`, `GamepadButton`, `CSSColor`, `AnchorPoint` and `ViewportPreset` _(done in v0.2 for `KeyboardKey` and `CSSColor`; `MouseButton` and `GamepadButtonName` were already strict)_
- [ ] Add generics support to `BrioGame` and `BrioScene` for inference and autocompletion of registered asset and object identifiers
- [x] Audit and complete 100% **JSDoc / TSDoc** coverage on all public classes, methods, functions, properties and types (focused on _Agent Context Optimization - ACO_ and TypeDoc generation in `./docs/api/`)
- [x] Set up an automated test suite (Vitest + browser validation via ChromeDevTools MCP in the `./demo/` folder) and validate before every push

---

## 7. Technical Review of 2026-10-19 (Integrity of the `[x]` Items and Game Loop Integration)

### 7.1. Done in this review

- [x] Generational entity handles (`ECSWorld.generationOf`, `isAlive(id, generation)`) and `unbindECS()` in `BrioTransform2D` / `BrioTransform3D`: `destroy()` no longer lets stale references write into recycled slots
- [x] `bindECS(storage, id, adopt)` to rebind handles after `restoreSnapshot`; `restoreCheckPoint()` / `restart()` also restore the set of registered objects
- [x] `BrioCompositor` integrated into `BrioGame`: `BrioLayer` layers (`static` with an offscreen cache, `parallax`, `dynamic` with culling, `ui`), one pass per `BrioCamera2D`/`BrioViewport`, 3D passes per `BrioCamera3D` via `RenderBackend` and compositing of the active `BrioScene`
- [x] Removal of the per-frame `Array.from(...).sort(...)` from the game loop (item 3.2 was checked without the change in `BrioGame`)
- [x] `BrioRenderer.selectBestBackendType` restricted to implemented backends, and `BrioRenderer.createBackend()`
- [x] `Canvas2DBackend`: diffuse shading applied (`shade` was computed and discarded) and triangles reused without per-frame allocation
- [x] Ubiquitous Language: `BrioObject` -> `BrioObject2D`, `BrioTransform` -> `BrioTransform2D`; removal of `src/not-implemented/` (`BrioMap`, `BrioCamera`) from the exports and from `BrioGame`
- [x] Removal of the `BrioObject.instanceOfObject` flag and of the `-[0-9]+` name restriction (item 3.2 was checked without the change)
- [x] `ComponentStorage` with an optional layout: the `"2d"` preset does not allocate `transform3D` (ADR-0004); v2 binary snapshots record the layout and still read v1
- [x] Allocation-free `ECSWorld.query(mask, out)`, `clearAllDirty` limited to the high-water mark, caching of `PlatformAdapter.detectCapabilities()` with release of the probing WebGL contexts and a `crossOriginIsolated` check
- [x] `BrioGame.maxDeltaTime` (default 0.1 s) for tabs with throttled `requestAnimationFrame`, and `BrioCamera2D.follow` converging exactly (no sub-pixel drift invalidating static caches)
- [x] `package.json`: removal of the broken `./types` export, updated URLs and description
- [x] Demo `demo/test-2d-split-screen-layers--19-10-26` covering layers, split-screen, 3D PiP, pooling and a stale-handle probe
- [x] `Canvas2DBackend`: inverted backface culling (it discarded front faces and drew back faces) fixed
- [x] `Canvas2DBackend`: Painter's Algorithm sorting over the whole pass (all meshes), with rasterization in `endFrame()`; previously each mesh was sorted in isolation and the last one submitted covered the earlier ones
- [x] `Canvas2DBackend`: a single `fill()` per triangle with cached diffuse tones (no second darkening pass), 0.5 px dilation against antialiasing gaps, grouping of consecutive triangles with the same tone and wireframe strokes limited to 64 triangles per path (105k triangles in one path took ~16 s per frame)
- [x] Demo `demo/test-3d-glb-malfoy-model--19-10-26` and `tests/assets/GLBRealAsset.test.ts` with a real Sketchfab GLB through the `BrioGame` `preload -> load -> update` cycle

### 7.1.1. WebGL2 Backend (2026-10-20, study of three.js in `study/three.js`)

- [x] `WebGL2Backend`: geometry uploaded to the GPU once per mesh (VAO + `STATIC_DRAW` buffers), one draw call per mesh, GL state cache, programs per shader variant, opaque render list (program, material, front-to-back) and transparent render list (back-to-front), mirroring with `frontFace(CW)`, context loss handled
- [x] sRGB textures (`SRGB8_ALPHA8`) with mipmaps and anisotropy; lighting in linear space and sRGB output; `baseColorFactor` treated as linear
- [x] `BrioMaterial.doubleSided` and `alphaCutoff` (glTF `doubleSided`, `alphaMode: "MASK"`)
- [x] `BrioRenderer` registers `webgl2` in the cascade; `BrioGame` falls back to `canvas2d` if the WebGL2 context fails
- [x] Demo `test-3d-glb-malfoy-model`: textured mode, backend switch via `?backend=`; 105k triangles at 60 fps (~0.3 ms of CPU per frame, previously ~90 ms)
- [x] Tests: `WebGL2Backend.test.ts` (fake GL context), `GLBMaterialsAndNodes.test.ts`

### 7.2. Identified follow-ups

- [x] Make the `BrioCamera2D.follow` lerp framerate-independent (`1 - (1 - lerp)^(dt * 60)`)
- [x] Consider renaming `transform.layer` (depth within a `BrioLayer`) to `transform.depth`, avoiding a clash with the canonical term `Layer` in `GLOSSARY.md` _(done in v0.2)_
- [ ] `demo-2d-shooter--18-10-26`: `soldier.png` is a 900x700 spritesheet drawn whole at 64x64; use `BrioSpriteSheet` to crop the frame
- [ ] Decide about the 231 binary assets versioned in `demo/demo-2d-shooter--18-10-26/assets/` (`.gitignore` only covers `/assets/` at the root)
- [ ] `test-3d-glb-scene--18-10-26` depends on GLBs missing locally in `assets/3d/glb/` (`gwen_tennyson.glb`, `spider_gwen.glb`)
- [x] `GLBLoader`: load `baseColorTexture` (embedded via `bufferView`, `data:` URI or external URI), decoded once per image with `createImageBitmap`
- [x] `GLBLoader` / `BrioModel.instantiate`: bind the material by `primitive.material` instead of the part index
- [x] Prefix mesh/material names with the model name to avoid collisions in the global registry (`"Face"`, `"Hair"`) _(format `"<model>/<name>"` in GLB, glTF, OBJ and MTL)_
- [x] `GLBLoader`: apply node transforms (`matrix` / TRS) to non-skinned meshes (skinned meshes ignore the node, per the spec)
- [ ] `GLBLoader`: skinning (`JOINTS_0` / `WEIGHTS_0`) and animations; today the model stays in the bind pose
- [x] `Canvas2DBackend`: `"lambert"` shading with the average of the 3 normals and `doubleSided` support
- [x] `Canvas2DBackend`: near-plane clipping (Sutherland-Hodgman in clip space, produces 1 or 2 triangles)
- [ ] `Canvas2DBackend`: texture sampling
- [ ] `WebGL2Backend`: per-object frustum culling (bounding sphere, like three.js `Frustum.intersectsObject`), configurable lights/IBL, per-texel `alphaMode: "BLEND"`, mutable meshes (buffer versioning) _(per-object frustum culling done in v0.2; the rest is open)_
- [ ] `WebGPU` and `WebGL1` backends (ADR-0001 cascade) _(detailed in 8.1)_
- [x] `BrioModel.instantiate`: child parts registered in the ECS (each part has its own slot, covered by game and scene checkpoints)

---

## 8. Improvements Mapped on 2026-10-20 (Existing Engine)

> References: `docs/architecture/RENDERING_STUDY_THREEJS.md` (three.js study) and the reviews in sections 7.x.

### 8.1. Graphics Pipeline

- [ ] `WebGPUBackend` (hand-written WGSL with per-feature variants, pipeline cache with `createRenderPipelineAsync`, bind groups by update frequency: frame/material/object, mipmaps via render passes, timestamp queries); register it in the cascade
- [x] Cascade with a real fallback: if `init()` of the chosen backend fails (e.g. `requestAdapter()` returns `null`), try the **next** one in the cascade (`webgpu -> webgl2 -> webgl1 -> canvas2d`), not `canvas2d` directly
- [ ] Common `GpuResourceCache` layer / render list shared between `WebGL2Backend` and `WebGPUBackend` (equivalent to three.js `src/renderers/common`): sorting, culling and feature keys written once
- [ ] `WebGL1Backend` (no native VAO: `OES_vertex_array_object`; Uint32 indices via `OES_element_index_uint`; no native sRGB: `EXT_sRGB` or conversion in the shader)
- [x] Per-object frustum culling in the 3D passes (`BrioCamera3D` already has sphere culling; a bounding sphere in `BrioMesh` and its use in `BrioCompositor.#render3DPasses` are missing) _(done in v0.2: bounding spheres cached per mesh in `BrioCompositor`)_
- [ ] 2D pipeline on the GPU: sprite batching (atlas + dynamic quad buffer), so the 2D layers also move off Canvas2D; keep `Canvas2D` as the fallback
- [ ] Instancing (`BrioObject3D`s with the same mesh/material in one draw) and static mesh batching
- [ ] Configurable tone mapping (Neutral/ACES/AgX) and exposure; future HDR output
- [ ] Configurable anti-aliasing (MSAA on/off, FXAA/SMAA as post-processing) and `devicePixelRatio` / resolution scale
- [ ] Mutable meshes: version `BrioMesh` and re-upload only the changed buffers (`bufferSubData`)
- [ ] Per-texel `alphaMode: "BLEND"` (today approximated by a 0.5 alpha test) and per-object sorting of transparent objects
- [ ] Texture compression (KTX2/Basis Universal) and per-device texture size limits
- [ ] Frame capture on all backends (`game.captureFrame(): Promise<Blob>`): an MCP requirement (10.1)
- [ ] Unified render statistics in `RenderBackend` (`drawCalls`, `trianglesRendered`, programs/pipelines, GPU memory) exposed as `game.renderStats`
- [x] Context loss recovery tested in the browser (`WEBGL_lose_context`), including texture re-upload _(done in v0.2: Playwright test in `e2e/orbit-gallery.spec.ts`)_
- [ ] `Canvas2DBackend`: near-plane clipping; option to keep culling even on `doubleSided` materials for performance (today ~230 ms/frame at 105k triangles)

### 8.2. Assets and Loaders

- [ ] glTF: skinning (`JOINTS_0` / `WEIGHTS_0`, `inverseBindMatrices`) with GPU skinning and a CPU fallback
- [ ] glTF: animations (`animations`, `LINEAR` / `STEP` / `CUBICSPLINE` samplers) integrated into a `BrioAnimator3D`
- [ ] glTF: morph targets, `KHR_materials_emissive_strength`, `KHR_texture_transform`, `KHR_materials_unlit`, `KHR_mesh_quantization`, `EXT_meshopt_compression`, `KHR_draco_mesh_compression` (weigh the cost against zero-dependency)
- [ ] glTF: normal map, metallic-roughness, occlusion and emissive textures (requires the PBR model from 9.1)
- [ ] glTF: preserve the node hierarchy as child `BrioObject3D`s (today the transforms are "baked" into the meshes) and shared mesh instances
- [x] Prefix mesh/material names with the model name (collisions in the global registry, e.g. `"Face"`, `"Hair"`)
- [x] Child parts of `BrioModel.instantiate` registered in the ECS (checkpoints did not cover the parts)
- [x] Resource limits when parsing glTF/GLB (buffer sizes, image dimensions) against hostile files _(`ModelLoaderLimits`: file, JSON, components per accessor, image dimension read from the header, node depth; out-of-range indices drop the primitive with a warning)_
- [ ] Asset loading in a Worker (GLB parsing and image decoding off the main thread) and preload progress (`onProgress`) _(preload progress done in v0.2: `game.onLoadProgress()`; Worker loading is open)_
- [x] Asset release (`dispose`) and reference counting across scenes _(done in v0.2: `game.unloadAsset()`, `game.removeScene()` with reference counting by owner)_

### 8.3. Core, ECS and Performance

- [x] Fixed-step simulation (`fixedTimestep`) with render interpolation, separate from `requestAnimationFrame` _(`game.fixedUpdate()`, `interpolate`, `maxFixedSteps`, `game.step(dt)`)_
- [x] Seeded pseudo-random generator (`BrioRandom`) for deterministic replays (an MCP requirement, 10.1) _(xoshiro128\*\*; `game.random` saved in checkpoints and used by the camera shake)_
- [ ] User-defined custom components in the ECS (registration of SoA components beyond transform/physics)
- [ ] Systems (`BrioSystem`) with a declared execution order (pre-update, update, post-update, render)
- [ ] Automated benchmarks (entities/frame, triangles/frame, allocations per frame) running in CI
- [ ] Built-in profiler in `BrioDebugger` (time per system, per render pass, GPU timestamps)

### 8.4. Quality, Tests and Tooling

- [x] Automated visual tests (golden image per demo, comparison with tolerance) in a headless browser _(done in v0.2: `e2e/`, Playwright)_
- [x] CI pipeline (GitHub Actions): `tsc`, Vitest, build and package content validation (Node 22 and 24)
- [x] CI: visual tests _(done in v0.2: `e2e` job in `ci.yml`, Chromium)_
- [x] Public versioned examples in `examples/` (2D and 3D, procedural assets without binaries) _(the old demos remain local in `demo/`)_
- [ ] Move the demos to an examples repository/package with their own assets (the `demo/` folder became local-only on 2026-10-20) or host the assets in a bucket
- [x] Make `TODO.md` Prettier-compatible (the file already diverged from the formatter before this review) _(done in v0.2)_

---

## 9. Required New Features

### 9.1. Lighting and Materials

- [x] `BrioLight`: `directional`, `hemisphere`, `ambient` with color and intensity, registered in `BrioGame`/`BrioScene` and honored in Canvas2D
- [ ] `BrioLight`: `point` and `spot` with range and falloff
- [x] Light upload via Uniform Buffer Object (WebGL2) / bind group (WebGPU) with a state hash to avoid re-uploading
- [ ] PBR material model (metallic-roughness, GGX, Fresnel-Schlick) aligned with glTF, keeping `lambert`/`unlit`/`flat` for simple styles
- [ ] Image-based lighting: environment map (equirectangular HDR), pre-filtering (PMREM) and a default procedural environment (equivalent to `RoomEnvironment`)
- [ ] Shadows: directional shadow maps (cascaded for large scenes), spot and point; PCF/soft shadows
- [ ] Skybox / background from a cubemap or equirectangular image, and fog (`linear`, `exponential`)
- [ ] `toon` materials (cel shading with a ramp) and outlines, consistent with the educational/stylized audience
- [ ] 2D lighting (point lights and normal maps on sprites) for the 2D layers on the GPU

### 9.2. Audio

- [x] `BrioAudio` on the Web Audio API (`AudioContext`, `AudioBuffer`, Master/BGM/SFX buses with `GainNode`, mobile autoplay unlock) with an `HTMLAudioElement` fallback (item 5.5 open)
- [ ] Spatial 3D audio: `PannerNode` (HRTF) per `BrioObject3D`, `AudioListener` attached to `BrioCamera3D`, distance attenuation, directional cones
- [ ] Positional 2D audio (stereo pan by world position relative to `BrioCamera2D`)
- [ ] Effects: per-zone reverb (`ConvolverNode`), filters (occlusion with `BiquadFilterNode`), music ducking
- [ ] Music: crossfade, loops with intro/loop points, adaptive layers
- [ ] Voice pool with a limit of simultaneous instances per sound and priority

### 9.3. Animation

- [ ] `BrioAnimator3D`: glTF clips, blending, crossfade, layers and per-bone masks
- [ ] Tweens (`BrioTween`) with easings for any numeric property (transform, opacity, color)
- [ ] Declarative animation state machine (2D and 3D)
- [ ] 2D skeletal animation (Spine/DragonBones style) as a future phase

### 9.4. 3D Physics

- [ ] 3D collision resolution (today only the `SpatialOctree3D` broad phase and colliders): AABB, sphere, capsule, OBB
- [ ] 3D `BrioRigidBody` (gravity, mass, friction, restitution) and a character controller (capsule with steps and slopes)
- [ ] Raycast/shapecast in the 2D and 3D world (`world.raycast(origin, dir)`), the basis for shooting, selection and AI
- [ ] Collision against static meshes (triangle mesh) with a BVH
- [ ] Simple joints (distance, hinge) as a future phase

### 9.5. Input and Interaction

- [x] `BrioCamera3D.screenToRay` / `ndcToRay` (respect the camera `viewport`)
- [ ] 3D object picking in the engine (today the 3D example does ray-sphere tests in game code)
- [x] Action mapping (`BrioInputMap`: "jump" -> Space/A/tap) with runtime rebinding _(done in v0.2: `game.input`)_
- [ ] Ready-made camera controls: orbit, first-person, third-person (pointer lock)
- [ ] On-screen virtual controls for mobile (joystick and buttons)
- [ ] DOM-independent synthetic input injection (an MCP requirement, 10.1)

### 9.6. Content, Scenes and UI

- [x] `BrioMesh.createCylinder` (covers cone and truncated cone with `radiusTop`/`radiusBottom`) and subdivided `createPlane`
- [ ] `BrioMesh.createCapsule`, `createTorus`
- [ ] Declarative scene and prefab format (`BrioSceneDocument`, JSON with a schema generated from the TypeScript types): save, load, diff (an MCP requirement, 10.1)
- [ ] On-screen UI system (text with fonts, buttons, panels, bars, anchored layout, keyboard/gamepad focus) on the `"ui"` layer
- [ ] Visual-novel-style dialogue system (`TARGET_ARCHITECTURE` mentions _Persona_-style boxes)
- [ ] 2D and 3D particles (emitters, life/color/size curves, GPU when available)
- [x] Chunked `BrioTileMap` rendering and Tiled/LDtk import (item 5.3 open) _(done in v0.2)_
- [ ] Scene management with transitions (fade, wipe) and asynchronous loading

### 9.7. Platform, Networking and Distribution

- [ ] Save persistence with snapshot versioning/migration
- [ ] Networked multiplayer (WebSocket/WebRTC) with synchronization based on the ECS binary snapshots (rollback/lockstep as research)
- [ ] PWA (offline, manifest) and documented Electron/Capacitor packaging
- [ ] Accessibility: control remapping, subtitles, color-blindness modes, reduced motion
- [ ] Localization (i18n) of UI text
- [ ] WebXR (VR/AR) as a future phase on top of the GPU backends

---

## 10. MCP: Game Authoring by Agentic Platforms

> Full study and proposed architecture: `docs/architecture/MCP_GAME_AUTHORING.md`. Decision: `docs/adr/0006-mcp-agentic-game-authoring.md` (status _Proposed_). Target: MCP specification **2026-07-28** (stateless, no `initialize` handshake, Tasks and MCP Apps extensions).

### 10.1. Phase 0: Engine prerequisites

- [ ] Declarative `BrioSceneDocument` format + JSON Schema 2020-12 generated from the types (basis for `brio_scene_patch`)
- [ ] Fixed-step `game.step(dt)` + seeded `BrioRandom`: deterministic replays
- [ ] Introspection API: entities and components, assets, layers, cameras, scenes and render statistics
- [ ] Synthetic input injection (keyboard, mouse, touch, gamepad) through the `Brio*` input classes, without the DOM
- [ ] `game.captureFrame()` on all backends (Canvas2D, WebGL2, WebGPU) and in headless mode
- [ ] Per-entity binary snapshot diff (`BrioSerializer.diff(a, b)`)
- [ ] Hot reload of scene documents and assets, preserving the ECS state when possible

### 10.2. Phase 1: Read-only server (stdio)

- [ ] `@brio-js/mcp` package with the TypeScript SDK v2 (`@modelcontextprotocol/server`), explicit opt-in to the 2026-07-28 revision, `server/discover`
- [ ] Documentation resources: `brio://docs/glossary`, `brio://docs/api/{symbol}` (generated from the TypeDoc JSON), `brio://docs/adr/{n}`, `brio://schema/scene`
- [ ] Headless runtime: `brio_game_run` (headless), `brio_game_step`, `brio_game_stats`, `brio_entity_inspect`, `brio_game_screenshot` (headless Canvas2D)
- [ ] Games addressed by explicit handles (`gameId`) passed as an argument (sessionless protocol)
- [ ] Deterministic, ordered catalog, `readOnlyHint` / `destructiveHint` / `idempotentHint` annotations, `outputSchema` on every tool

### 10.3. Phase 2: Authoring

- [ ] Project tools: `brio_project_create` (scaffold with `AGENTS.md` and `.mcp.json`), `brio_project_info`, `brio_project_build`, `brio_project_test` (Vitest failures as `structuredContent`)
- [ ] Scene and entity tools: `brio_scene_list/read/create/patch/delete`, `brio_entity_add/update/remove`, `brio_prefab_create`
- [ ] Asset tools: `brio_asset_list`, `brio_asset_import` (validates glTF/PNG/audio and reports `BrioModel.warnings`), `brio_asset_inspect`
- [ ] Tool profiles (`read` by default, `author`, `play`, `full`) to limit context consumption
- [ ] Confirmation of destructive operations via Multi Round-Trip Requests (elicitation `input_required`)
- [ ] Security: filesystem scope restricted to the project (Roots is deprecated), path normalization, dirty working tree warning and a suggested branch per agent session

### 10.4. Phase 3: Live runtime

- [ ] `@brio-js/devtools` package (WebSocket bridge in the browser, enabled by `BrioGame({ devtools: true })` or `?brio-devtools=<token>`, removed by tree-shaking in production)
- [ ] Loopback-only bridge server, `Origin` validation, random token per game, explicit timeouts and no re-sending of expired tool calls
- [ ] `brio_game_run` in the browser/Electron, `brio_input_send`, `brio_checkpoint_create/restore/diff`
- [ ] Subscribable resources via `subscriptions/listen`: `brio://game/{id}/console`, `/stats`, `/entities`
- [ ] `brio_game_eval` only in the `full` profile, marked as destructive (equivalent to code execution)

### 10.5. Phase 4: MCP Apps and Tasks

- [ ] MCP App `ui://brio/player` (`text/html;profile=mcp-app`): the game running inside the agent's chat, with FPS, entity inspector and controls; CSP declared in `_meta.ui.csp`
- [ ] Tasks extension (`io.modelcontextprotocol/tasks`) for long-running operations: build, batch import, playtest suites and visual regression
- [ ] `brio_playtest_record` / `brio_playtest_replay` (deterministic input + assertions) and `brio_visual_snapshot` (golden image with tolerance)
- [ ] Streamable HTTP transport for hosted/remote use (OAuth 2.1 with Client ID Metadata Documents), tracing via OpenTelemetry in `_meta`

### 10.6. Phase 5: Ecosystem

- [ ] Agent Skill `brio-game-dev` (`SKILL.md`, agentskills.io standard) with flows: new game, new scene, import glTF, HUD, tests, visual regression
- [ ] `create-brio-game` (scaffolder also used by `brio_project_create`)
- [ ] `llms.txt` generated from TypeDoc for agents without MCP
- [ ] Publication in MCP registries and ready-made configurations for Claude Code, Claude Desktop, Codex, Cursor, VS Code/Copilot and Gemini CLI
- [ ] Evaluation suite: agents build N reference games and are scored by tests, performance and visual regression
- [ ] Decide the open questions from the study (declarative scene as the primary format, behavior scripting, headless screenshot fidelity, `npx` vs binary distribution)

---

## 11. Session of 2026-10-27 (v0.1.0 P0)

### 11.1. Done

- [x] P0 items from the session handoff: cascade with a real fallback, unified scene, Web Audio, `BrioLight`, fixed step + `BrioRandom`, 7.2 bugs, `screenToRay`/`createCylinder`, loader limits, public examples, CI and `package.json` (`files`, `glgreg/brio-js` URLs, cross-platform `build`, `prepack`, `check`)
- [x] Bug found and fixed: `BrioMesh.createSphere` generated clockwise triangles as seen from outside (with backface culling, the sphere showed its inner face); a winding test covers every primitive
- [x] `npm pack` validated: 196 files (`dist/` + README, LICENSE, GLOSSARY, package.json); types and the Node import checked in a consumer project
- [x] Examples validated in Chrome: WebGL2 and `?backend=canvas2d`, picking, lights, scenes, retry, unlocked Web Audio

### 11.2. Identified follow-ups

- [x] `BrioKeyboard.isPressed`/`isUp` miss taps shorter than one frame (keydown and keyup between two frames); buffer the transitions per frame _(fixed after v0.1.0: latched edges)_
- [ ] `Canvas2DBackend`: the Painter's Algorithm sorts by triangle centroid, so large surfaces cover objects; subdivide (`createPlane(..., segments)`) or consider a tiled z-buffer
- [x] `BrioCamera2D`s registered in `BrioScene` do not receive `game.random` automatically (only via `game.addCamera`) _(fixed in v0.2: assigned when the scene activates)_
- [x] `declarationMap` generated `.d.ts.map` files pointing to `src/`, which is not shipped in the package: option turned off
- [x] Load the 3D stack on demand: `BrioGame` statically imports WebGL2 and the loaders, so a 2D game bundles ~144 kB minified (the whole engine is ~162 kB) _(v0.2: backends and loaders are `import()`ed; the 3D object/camera/math classes are still referenced, see ROADMAP "Before 1.0")_
- [x] `BrioMouse`: item 5.5 mentions "cursor lock", but there is no Pointer Lock support in the code _(done in v0.2)_
- [x] Publish v0.1.0 to npm as `@brio-js/core` (npm rejected `brio-js` for its similarity to `uri-js`; requires the `brio-js` org on npm)

## 12. v0.2.0 (2026-11-04)

### 12.1. Done

- [x] Lazy 3D stack (backends and loaders), `transform.depth`, strict `KeyboardKey` / `CSSColor`, complete
      checkpoints (facade state and tile map tiles), snapshot format v3 with stride migration, generic
      `instantiate()` (3D prefabs), empty `preload()`, lifecycle errors as `Error` and `ready()` rejection
- [x] `BrioText`, collision events, tile map rendering and Tiled import, `BrioInputMap`, Pointer Lock, gamepad edge
      latching, high-DPI rendering, `resize()`, `useFullScreen("fit")`, load progress, asset unloading and scene
      removal with reference counting, per-object 3D frustum culling, `ui` layers composed above every scene
- [x] Playwright end-to-end suite (`e2e/`) for the three examples, WebGL context loss and high DPI; CI job in
      Chromium; Firefox and WebKit opt-in
- [x] New example `2d-tile-platformer`; `2d-star-catcher` uses `BrioText`, collision events and the input map

### 12.2. Open before 1.0

- [ ] Public API surface review (`docs/ROADMAP.md`, "Before 1.0"): decide which internals stay exported
- [ ] Persisted save format with facade state (checkpoints keep it in memory only)
- [ ] 2D bundles still include the 3D object, camera and math classes
- [ ] TypeDoc: a friendlier, still generated, documentation site
