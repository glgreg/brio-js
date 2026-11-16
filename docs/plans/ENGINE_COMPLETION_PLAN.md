# Engine Completion Plan

Status: **Design reference and post-TCC backlog** (created 2026-10-31). Findings and evidence: [`ENGINE_COMPLETION_STUDY.md`](../architecture/ENGINE_COMPLETION_STUDY.md).

> **Until the TCC presentation on 2026-11-13, follow [`TCC_FINAL_SPRINT.md`](./TCC_FINAL_SPRINT.md).** It overrides the scope, order and priorities below. Use this file for the design of each work package, and apply only the scope the sprint gives it. Status marks in this file are not maintained during the sprint.

Goal: a usable BrioJS release in 2D and 3D, on the existing architecture: ECS core, OOP public API, zero runtime dependencies.

After the TCC, this file resumes as the source of truth for the remaining work. `docs/ROADMAP.md` stays the public summary, and `TODO.md` stays as history.

## 1. How to run a session

1. Read `.keystone/protocol.md` and `.keystone/standards.md`, then this section.
2. Pick the first `[ ]` work package in section 6 whose dependencies are `[x]`, following the order in section 4. Mark it `[~]` with the branch name.
3. Create `feat/wp-NN-slug` or `fix/wp-NN-slug` from `develop`.
4. Read the stones listed in the work package with `keystone stone show <id>`. Search the code for every place that relies on a value before changing it.
5. **Read the study base for the milestone** (table below) before designing anything, and consult the reference source itself instead of working from memory. If `temp/repos` is missing, recreate it (commands in the study, section 1). Use the same commits when a line reference must match.
6. Implement with tests. A regression gets a test that reproduces it. New GL behavior needs a browser test once WP-02 exists, because the fake WebGL context in `tests/helpers/fakeWebGL2.ts` only asserts calls.
7. Before finishing: `npm run check`, `keystone stone doctor`, TSDoc on every public symbol, `CHANGELOG.md`, `GLOSSARY.md` for new terms, stones updated, `docs/ROADMAP.md` when a known issue closes. When the package uses or ports a technique from a reference, record it in the local [`docs/tcc/PROCEDENCIA.md`](../tcc/PROCEDENCIA.md) as well as in `THIRD_PARTY_NOTICES.md`.
8. Mark `[x]` here in the same pull request. Note anything cut under the work package.
9. Keep a pull request to one work package. Commit format: `<type>(<scope>): summary`, English, no AI attribution (`CLAUDE.md`).

Study base per milestone. Plan references written as `three: <path>` and `godot: <path>` resolve inside [`temp/repos/three.js`](../../temp/repos/three.js) and [`temp/repos/godot`](../../temp/repos/godot). Start at [`temp/research/README.md`](../../temp/research/README.md). The study also links the base per subsystem, in its section 4.

| Milestone | Read first |
| --- | --- |
| M0 | [`ENGINE_COMPLETION_STUDY.md`](../architecture/ENGINE_COMPLETION_STUDY.md) sections 3 and 7, [`godot/COPYRIGHT.txt`](../../temp/repos/godot/COPYRIGHT.txt), [`three.js/LICENSE`](../../temp/repos/three.js/LICENSE) |
| M1 | [`three-js.md`](../../temp/research/three-js.md), [`standards.md`](../../temp/research/standards.md), [glTF specification](../../temp/research/sources/gltf-spec.adoc) |
| M2 | [`three-js.md`](../../temp/research/three-js.md), [`godot.md`](../../temp/research/godot.md), [`unity.md`](../../temp/research/unity.md), [`unreal.md`](../../temp/research/unreal.md), [`nvidia.md`](../../temp/research/nvidia.md), [`standards.md`](../../temp/research/standards.md) |
| M3 | [`three-js.md`](../../temp/research/three-js.md), [`godot.md`](../../temp/research/godot.md), [`nvidia.md`](../../temp/research/nvidia.md), [`ShaderChunk/`](../../temp/repos/three.js/src/renderers/shaders/ShaderChunk), [`PMREMGenerator.js`](../../temp/repos/three.js/src/extras/PMREMGenerator.js), [`csm/`](../../temp/repos/three.js/examples/jsm/csm), [KHR_lights_punctual](../../temp/research/sources/khr-lights-punctual.md), [PCSS text](../../temp/research/sources/nvidia-pcss.txt) |
| M4 | [`shader-authoring.md`](../../temp/research/shader-authoring.md), [`godot.md`](../../temp/research/godot.md), [`shader_types.cpp`](../../temp/repos/godot/servers/rendering/shader_types.cpp), [`three-js.md`](../../temp/research/three-js.md), [`unreal.md`](../../temp/research/unreal.md) |
| M5 | [`three-js.md`](../../temp/research/three-js.md), [`godot.md`](../../temp/research/godot.md), [`unity.md`](../../temp/research/unity.md), [`unreal.md`](../../temp/research/unreal.md), [glTF specification](../../temp/research/sources/gltf-spec.adoc), [`GLTFLoader.js`](../../temp/repos/three.js/examples/jsm/loaders/GLTFLoader.js), [Skinned Instancing text](../../temp/research/sources/nvidia-skinned-instancing.txt) |
| M6 | [`unity.md`](../../temp/research/unity.md), [`unreal.md`](../../temp/research/unreal.md), [`standards.md`](../../temp/research/standards.md), [`scene_tree.h`](../../temp/repos/godot/scene/main/scene_tree.h), [`resource_loader.h`](../../temp/repos/godot/core/io/resource_loader.h), [`LoadingManager.js`](../../temp/repos/three.js/src/loaders/LoadingManager.js) |
| M7 | [`godot.md`](../../temp/research/godot.md), [`rasterizer_canvas_gles3.h`](../../temp/repos/godot/drivers/gles3/rasterizer_canvas_gles3.h), [`tile_map_layer.h`](../../temp/repos/godot/modules/tilemap/tile_map_layer.h), [`scene/gui/`](../../temp/repos/godot/scene/gui), [`unity.md`](../../temp/research/unity.md) |
| M8 | [`postprocessing/`](../../temp/repos/three.js/examples/jsm/postprocessing), [`controls/`](../../temp/repos/three.js/examples/jsm/controls), [`scene/3d/physics/`](../../temp/repos/godot/scene/3d/physics), [FXAA text](../../temp/research/sources/nvidia-fxaa.txt), [`nvidia.md`](../../temp/research/nvidia.md) |
| M9 | The notes above for each feature shown, plus [`three.js`](../../temp/repos/three.js) for the comparison in WP-52 |

Rules that apply to every work package:

- **Hot path**: no allocation per frame, no per-frame closures, no string building. `tests/rendering/BrioCompositor.test.ts` already checks part of this; WP-02 adds a browser measure.
- **ECS first**: answer the three questions in study section 5 before writing a facade: where the data lives, which facade exposes it, whether snapshots capture it.
- **Buffers stay stable**: facades hold direct references, per the ECS stone. Changing or adding a buffer means bumping `BRIO_SNAPSHOT_VERSION` and keeping readers for older versions.
- **Fallback is explicit**: each visual feature states its Canvas2D behavior, and warns once when it degrades. See section 7.
- **Hostile files**: anything read from a model file goes through `ModelLoaderLimits`.
- **Ubiquitous language**: new names go in `GLOSSARY.md` first, and avoid the terms it rejects. New public classes use the `Brio` prefix.
- **Third-party code**: follow ADR 0007 once WP-01 lands. Until then follow study section 7. Unity, Unreal and NVIDIA are concept-only.

Status marks: `[ ]` pending, `[~]` in progress, `[x]` done, `[-]` cut with a reason.
Sizes are rough: **S** fits one session, **M** one or two, **L** three or more. Dates up to the TCC presentation live in the sprint.
Priorities: **must** is needed by a demo, **should** improves the demos and can be cut, **post** is after the TCC.

## 2. TCC definition of done

Three demos, in `examples/`, built only with the public API, with original or properly licensed assets:

| Demo | Must show |
| --- | --- |
| **2D platformer** | Tile map from Tiled JSON, animated sprites through a state machine, parent-child objects, parallax, particles, text and HUD, a custom sprite shader, sound, scene changes with a loading screen, save and load through file and IndexedDB. 2D lights if WP-39 is done |
| **3D third-person** | Skinned GLB character with blended animation, PBR with normal maps, point and spot lights, cascaded shadows, tone mapping, bloom and FXAA, orbit or third-person camera, additive scene loading, a custom shader loaded from a `.glsl` file, save and load. IBL if WP-19 is done |
| **Hybrid and shader lab** | 3D world with 2D HUD and minimap through a render target; a live shader editor that recompiles at runtime and reports errors without breaking the frame; a stats overlay |

A technical comparison (WP-52) can support the text: BrioJS against three.js on matching scenes, in frame time, draw calls, memory and bundle size. User tests were cut on 2026-10-31 for lack of time (WP-54).

The maintainers have freedom to change the TCC scope, so 2D and 3D on WebGL2 are in.

## 3. Decisions taken

Each one has its rationale in the study. Change them here before work starts on the matching package. Decisions marked **Confirmed** were approved by the maintainer on 2026-10-31.

| # | Decision | Section |
| --- | --- | --- |
| 1 | **Confirmed.** Focus on WebGL2 to deliver the TCC. It is the only GPU backend until then. WebGPU, WebGL1 and Workers are post-TCC. The contract stays open for them | 4.1, 8 |
| 2 | Canvas2D stays as fallback. It does not reach feature parity, and each feature documents what it does there | 7 here |
| 3 | **Confirmed.** No archetypes or chunks. Slot-based SoA stays, plus command buffers, ordered systems and dense index lists | 4.15 |
| 4 | **Confirmed.** Bones are indices in a pose pool, not entities or objects | 5 |
| 5 | Asset references move to integer ids in the `visual` buffer; the string API stays | 5 |
| 6 | Lights move into the ECS | 5 |
| 7 | Fixed light capacity, so a change in light count never compiles a new program | 4.2 |
| 8 | **Confirmed.** Shaders must be highly customizable in GLSL, the common language of shaders. Standard GLSL ES 3.00 is the only language, with hooks and typed built-ins following Godot's model, plus a raw mode for full control. No new shading language and no node graph | 4.4 |
| 8a | **Confirmed.** The public API must make injecting and loading custom shaders simple. One concept, `BrioShader`, loads like any other asset, inline or from a `.glsl` file. `BrioMaterial` references it, and `material.inject()` adds a snippet to a built-in material. There is no separate material class. Parameters are discovered from the GLSL, so nothing is declared twice | 4.4 |
| 8b | **Confirmed.** Simplicity does not drop the guards other engines apply: reference-counted programs, fixed uniform storage, type checks, source limits, reserved names, a fallback on error, and no exception inside a frame | 4.4 |
| 9 | Dynamic parameters are uniforms, compile-time options are explicit, and the variant count is visible in stats | 4.4 |
| 10 | GPU 2D renders into the same GL framebuffer as 3D, and the frame reaches the visible canvas in one composite. Direct presentation is an optional later step, decided by measurement | WP-11, WP-35 |
| 11 | Additive scenes reuse the compositor source list. The active scene receives new objects and supplies render settings | 4.5 |
| 12 | Scene load exposes progress and an activation hold, shaped like Unity's `AsyncOperation` | 4.5 |
| 13 | Saves are versioned slots with migrators. Export uses `showSaveFilePicker` when present, otherwise a Blob download. No encryption, because a key in a web client protects nothing | 4.7 |
| 14 | PCF cascaded shadows by default; PCSS optional; VSM not adopted | 4.2 |
| 15 | Text is rasterized through Canvas2D into an atlas. MSDF is post-TCC | 4.10 |
| 16 | UI is canvas-based, not DOM | 4.11 |
| 17 | Draco, meshopt and KTX2 decoders stay out of core, as optional plugins after the TCC, to respect ADR 0001 | 4.9 |

## 4. Order of work

```text
M0 Foundations     WP-00 WP-01 WP-02
M1 Correctness     WP-03 WP-04 WP-05
M2 Render core     WP-07 WP-08 WP-09 WP-10 WP-11 WP-12 WP-13 WP-14 WP-15
M3 Light/material  WP-16 WP-17 WP-18 WP-19 WP-20
M4 Shaders         WP-21 WP-22 WP-23
M5 Animation       WP-24 WP-25 WP-26 WP-27 WP-28 WP-29
M6 Content flow    WP-30 WP-31 WP-32 WP-33 WP-34
M7 2D and UI       WP-35 WP-36 WP-37 WP-38 WP-39 WP-40 WP-41
M8 Systems         WP-42 WP-43 WP-44 WP-45 WP-46 WP-47 WP-48
M9 Delivery        WP-49 WP-50 WP-51 WP-52 WP-53 WP-54
```

M3, M4, M5 and M6 can run in parallel after M2. M7 needs WP-11 and WP-21.

**If time gets short**, this is the minimum path to all three demos, in order: WP-00, 01, 02, 03, 04, 05, 07, 08, 10, 11, 12, 13, 15, 16, 17, 18, 20, 21, 22, 23, 24, 25, 26, 27, 29, 30, 31, 33, 34, 35, 36, 37, 38, 40 (2D part), 41, 42, 43, 44, 49, 50, 51, 52, 53. It leaves out instancing, LOD, IBL, morph targets, 2D lights, physics events and spatial audio, so the 2D demo uses game-side collision. If the 3D demo needs a softer look, restore WP-19 first.
## 5. Dependency notes

- Everything visual depends on WP-11. Do not start materials or shaders against the old contract.
- WP-10 waits for WP-07, WP-08 and WP-16, because each one adds data the snapshot format must carry. Bump the format once.
- WP-25 needs WP-13 for vertex attributes and WP-24 for joint nodes.
- WP-23 and the 2D part of WP-21 need WP-35.
- WP-42 needs render targets from WP-11, and HDR from WP-18.

## 6. Work packages

### M0 Foundations

#### WP-00 Baseline and context repair `[ ]`

must, S. No dependencies.

- Install Node 22 or later (`.keystone/bin/keystone` and `npm` need it), then `npm ci`. Record the baseline of `npm run check` and `keystone stone doctor` in the pull request.
- Fix the documentation drift listed at the end of study section 3.
- Link this plan from `docs/ROADMAP.md` (already done when this plan was added; confirm).
- Decide what `TODO.md` becomes: mark superseded items as pointing here.

Accept: all checks green on `develop`; doctor reports no errors.

#### WP-01 Third-party policy `[ ]`

must, S. No dependencies. Stones: `rendering`.

- Write ADR 0007 from study section 7. Correct the "reimplements techniques, not code" line in `RENDERING_STUDY_THREEJS.md`.
- Add `THIRD_PARTY_NOTICES.md` with the three.js and Godot MIT notices. Add it to `files` in `package.json`.
- Header convention for ported files: `// Adapted from three.js <path> @ fa01dd6 (MIT). See THIRD_PARTY_NOTICES.md.` Add a CI check that fails when a file has this header and the notice is missing from the package.

Accept: `npm pack --dry-run` lists the notice.

#### WP-02 Browser test rig and benchmarks `[ ]`

must, M. Depends on WP-00. Files: `tests/browser/`, `benchmarks/`, `.github/workflows/ci.yml`.

- Add Playwright as a dev dependency only, with headless Chromium. WebGL2 through a software rasterizer in CI.
- Golden-image tests with tolerance, driven by `game.pause()` and `game.step(1 / 60)`, for determinism.
- Benchmark harness: frame CPU time, draw calls, triangles, JS heap growth over 600 frames, bundle size per preset. Write results as JSON.
- First goldens: the two current examples. First baseline: 10,000 sprites and the existing GLB case.

Accept: CI runs one golden test per backend and stores benchmark JSON. Performance numbers in this plan get replaced by measured ones.

### M1 Correctness

#### WP-03 2D hierarchy and 2D culling `[ ]`

must, M. Fixes D-01, D-12. Stones: `objects`, `cameras`, `rendering`, `math`.

- Add `worldMatrix2D` (6 floats per slot, 2D layout) with cached updates driven by dirty flags. `BrioSpriteRenderer` draws through `ctx.setTransform` from it, replacing the per-object `save`, `translate`, `rotate`, `restore`.
- World opacity multiplies down the hierarchy; visibility cascades. Y-sort is out of scope here.
- Culling works with rotation, zoom and `game.scale`, through a rotated world AABB test.
- `BrioCamera2D.follow`, `isVisible`, and collision read world values. Decide and document: colliders follow world position and uniform scale.

Accept: parent move, rotate and scale tests through the recording context; `worldToScreen` still replays the compositor exactly; 2D culling stays on when rotated.

#### WP-04 glTF accessor completeness `[ ]`

must, S. Fixes D-02. Stone: `assets`.

- Decode all six component types correctly, in the fast and safe paths. Honor `normalized`, using the glTF formulas for snorm and unorm. Support `sparse`, with limits. Promote quantized UVs and normals to float.
- Tests use a generated GLB from `tests/helpers/glb.ts`.

Accept: quantized attributes render identically to float ones in a golden test.

#### WP-05 Small correctness set `[ ]`

must, M. Fixes D-04, D-06, D-14, D-18, D-19, D-20. Stones: `rendering`, `game`, `scenes`, `objects`.

- Lighting: replace the string key with a numeric version sum plus light count. No string building per frame.
- 3D opacity: pass effective opacity to the backend, combining `transform.opacity` and `material.opacity`, and choose the transparent list from it.
- `object.sprite` setter returns early when unchanged.
- `BrioScene.fixedUpdate()` with the same accumulator as the game. Interpolation covers rotation and scale.
- `game.instantiate()` accepts `BrioObject3D`, cloning parts.
- `BrioCompositor.#render3DPasses` clears even with no objects. Scenes inject `game.random` into their 2D cameras at activation (ROADMAP known issue).

Accept: each item has a regression test.

### M2 Render core

#### WP-07 Asset ids in the visual buffer `[ ]`

must, M. Stones: `ecs`, `objects`, `assets`, `rendering`.

- `BrioAssetIdTable` interns names per game: mesh, sprite, material. Asset id 0 means none.
- `visual` stride: `[0]` mesh or sprite id, `[1]` material id, `[2]` visibility (existing, offset unchanged), `[3]` flags: flip X and Y, cast shadow, receive shadow, frustum culled, and layer mask bits. If a 32-bit mask does not fit next to the flags, extend the stride to 5 in WP-10.
- `object.mesh`, `object.material`, `object.sprite`, `flip` keep their API and read through the table. Render code uses ids, so it stops doing `Map.get` per object.

Accept: render path has no per-object string lookup; `flip` and sprite restore through snapshots after WP-10.

#### WP-08 Transform hierarchy over arrays `[ ]`

must, M. Stones: `ecs`, `objects`.

- `parent` `Int32Array(capacity)`, plus an update order list rebuilt only when the hierarchy changes (parents before children).
- `worldMatrix3D` `Float32Array(capacity * 16)`, in the 3D layout only. One pass per frame computes dirty entries in order. `transform.worldMatrix` returns a subarray view created once per transform.
- Keep the guarantee that direct writes into a slot are detected. Prefer a dirty flag set by writers and retain the 10-float compare only under a debug flag, if the benchmark shows gain; otherwise keep it.

Accept: benchmark shows lower cost at 4,000 objects than recursive getters, measured in WP-02; existing transform tests pass.

#### WP-09 Systems and deferred structural changes `[ ]`

should, S. Stones: `ecs`, `game`, `scenes`.

- `BrioSystem` with phase (`preFixed`, `fixed`, `update`, `postUpdate`, `preRender`) and an explicit order. Internal systems first: world matrices, animators, physics, particles. Public registration is simple and optional.
- `world.commands`: queued create, destroy and mask changes, played back at a defined point in the frame. `game.destroy` during iteration uses it internally.
- `world.query` keeps dense per-mask index lists, updated on structural change only.

Accept: destroying objects inside a query is safe; no allocation in playback beyond the queue's first growth.

#### WP-10 Snapshot format v3 `[ ]`

must, M. Depends on WP-07, WP-08, WP-16. Stones: `storage`, `ecs`, `scenes`, `game`.

- Add sections: parent indices, lights, and an embedded name table mapping asset ids and object names to slots. Keep readers for versions 1 and 2.
- With the name table, `game.restoreFromBytes()` can recreate objects after a page reload. Fixes the core of D-17.
- `collision` moves into the buffers in WP-46; leave room through a section table so later additions do not rewrite the format.

Accept: save, reload the page, restore gives the same frame in a golden test.

#### WP-11 RenderBackend v2 and shared render list `[ ]`

must, L. Fixes D-09, D-10. Stones: `rendering`, `scenes`, `game`.

Contract:

```ts
interface RenderBackend {
    readonly capabilities: RenderCapabilities; // features the backend implements
    init(surface): Promise<boolean>;
    beginFrame(frame: FrameInfo): void;
    beginPass(pass: RenderPassDescriptor): void; // target, viewport, clear, camera UBO data
    setLights?(environment: LightingEnvironment): void;
    submit(list: RenderList): void;              // sorted items
    endPass(): void;
    endFrame(): void;                            // one composite to the visible canvas
    createRenderTarget(descriptor): BrioRenderTarget;
    release(resource: BrioMesh | BrioTexture | BrioRenderTarget): void;
    readonly stats: RenderBackendStats;          // draw calls, triangles, programs, memory
    dispose(): void;
}
```

- `RenderList` and packed keys live in shared code, adapted from `three: src/renderers/webgl/WebGLRenderLists.js`. Pooled items hold slot id, mesh id, material id, depth.
- Frame and camera UBO at binding 1. Per-object data stays as uniforms until WP-14.
- State cache adds textures per unit, UBO bindings, blend mode.
- The canvas receives one `drawImage` per frame, after all passes. Keep the ordering guarantee: 2D below 3D, then `ui`. Until WP-35, 2D still draws on the Canvas2D context, so the order needs a composite per 3D source as today, restricted to a union rect.
- `game.renderStats` merges compositor and backend counters (ROADMAP v0.2 item).
- Update `Canvas2DBackend` to the same contract.

Accept: existing examples unchanged in golden tests; draw call count and CPU time recorded before and after.

#### WP-12 Culling and bounds `[ ]`

must, S. Stones: `rendering`, `cameras`, `assets`.

- `BrioMesh.boundingSphere`, computed once. World sphere uses the max-scale axis, reading `worldMatrix3D`.
- Compositor culls with `BrioCamera3D.isSphereInFrustum` before submission. Respects a per-object `frustumCulled` flag.
- Layer mask on cameras and objects (`camera.cullingMask`, `object.renderLayers`).
- Skinned meshes get a padded bound from WP-25.

Accept: `renderStats.objectsCulled3D`; off-screen objects produce no draw; test on a scene of 4,000 objects.

#### WP-13 Mesh and texture v2 `[ ]`

must, M. Fixes D-08. Stones: `assets`, `rendering`.

- `BrioMesh` gains optional `tangents`, `colors`, `uvs2`, `joints`, `weights`, `morphTargets`. Fixed attribute locations extend the current 0, 1, 2. One VAO per mesh; never change its attachments (MDN).
- Mutable geometry: `mesh.version`, with `markAttributeDirty(name, start?, count?)`; `bufferSubData` on changed ranges.
- Primitives: `createCapsule`, `createTorus`, adapted from `three: src/geometries`.
- `BrioTexture` gets `colorSpace` (`"srgb"` or `"linear"`), `wrapU`, `wrapV`, `minFilter`, `magFilter`, `generateMipmaps`, and data textures (`BrioTexture.fromData`). Pixel-art filtering becomes possible.
- glTF: read samplers; tag normal, metallic-roughness and occlusion as linear. Read `TANGENT`, `COLOR_0`, `TEXCOORD_1`.
- `BrioTexture` constructor stops creating an `Image` when none is needed, so it works headless.

Accept: linear textures sample unconverted; a mutable mesh updates on screen; tests for each attribute.

#### WP-14 Instancing and LOD `[ ]`

should, M. Stones: `rendering`, `objects`.

- `BrioInstancedMesh` (mesh, material, capacity) with `setMatrixAt`, `setColorAt`, per-instance attributes, and a world bound for culling. Uses `drawElementsInstanced` and a divisor-1 attribute.
- Auto-instancing in the list: consecutive opaque items sharing mesh and material become one draw. Threshold decided by benchmark, because Unity warns that overhead can outweigh benefit at low counts.
- `BrioLOD`: list of mesh levels with distance thresholds. Crossfade is out of scope.
- Skinned meshes are excluded, as in Unity.

Accept: a benchmark scene of 10,000 cubes draws in a handful of calls.

#### WP-15 Program cache and asynchronous compile `[ ]`

must, M. Fixes D-07. Stone: `rendering`.

- Program key: numeric features, plus shader id, plus vertex layout.
- Follow Khronos and MDN: compile all, link all, then poll `COMPLETION_STATUS_KHR`; check compile status only if link failed.
- While a program compiles, the draw uses a fallback program or skips, as a policy per material (Unreal's "skip or default material"). The frame never throws.
- `game.compileShaders(scene?)`: warm-up during loading, reporting progress, like Unreal's precaching and Unity's prewarm. `renderStats.programs` shows active variants.

Accept: a bad shader logs once and the frame continues; loading a scene with warm-up produces no first-use hitch in the benchmark.

### M3 Lights and materials

#### WP-16 Point and spot lights in the ECS `[ ]`

must, M. Depends on WP-11. Stones: `objects`, `rendering`, `ecs`, `assets`.

- `BrioLightType` adds `"point"` and `"spot"`, with `range`, `decay`, `innerAngle`, `outerAngle`, position and direction. Public `BrioLight` API stays.
- New `light` stride with `ComponentMask.LIGHT`. Lights may parent to objects.
- `BrioLights` UBO with fixed capacity 32, as in Godot's default, with up to 16 evaluated per fragment at first. Lights are culled by range and frustum per pass. Excess lights drop by distance and intensity, and warn once.
- Attenuation matches `KHR_lights_punctual`, whose README is the reference. Import that extension.
- Canvas2D: point lights contribute through luminance per triangle; spot treated as point.

Accept: changing light count compiles nothing; test with 32 lights.

#### WP-17 Standard material `[ ]`

must, L. Depends on WP-13, WP-15, WP-16. Stones: `assets`, `rendering`.

- `shading: "standard"`, with `metallic`, `roughness`, `emissive`, `normalMap`, `metallicRoughnessMap`, `occlusionMap`, `emissiveMap`, `normalScale`, `occlusionStrength`.
- Port the GGX BRDF from `three: ShaderChunk/bsdfs` and `lights_physical_pars_fragment`, keeping upstream credit. Follow glTF: non-metal F0 0.04, `COLOR_0` multiplies base color.
- Normal mapping uses `TANGENT` when present, otherwise the derivative frame (`three: normal_fragment_begin`, `getTangentFrame`).
- Add `"toon"` with a ramp texture; it suits the educational audience.
- Real per-texel alpha blending: `alphaMode: "opaque" | "mask" | "blend"`. Replace the approximation at `GLBLoader.ts:605-612`. Object-level back-to-front sort; WBOIT stays post.
- glTF: all core material textures, `KHR_materials_unlit`, `KHR_materials_emissive_strength`, `KHR_texture_transform`.
- Canvas2D: `standard` falls back to base color Lambert.
- Material parameters go through a material UBO when the benchmark favors it, as in Unity's persistent per-material buffers.

Accept: golden tests with Khronos sample assets in a local fixture folder, license checked per asset.

#### WP-18 Tone mapping and color pipeline `[ ]`

must, S. Depends on WP-11. Stone: `rendering`.

- Render 3D into an RGBA16F target when `EXT_color_buffer_float` or `EXT_color_buffer_half_float` allows, per `three: WebGLExtensions.js:33-36`. Otherwise tone map directly in the fragment shader.
- `game.toneMapping`: `"none"`, `"reinhard"`, `"aces"`, `"agx"`, `"neutral"`, plus `exposure`. Port from `three: tonemapping_pars_fragment`, keeping each block's credit.
- MSAA through multisample renderbuffer and blit, since the default framebuffer MSAA no longer applies. `antialias` setting on game config.

Accept: golden tests per operator; default output for lit Lambert content stays documented in the changelog, because it changes visually.

#### WP-19 Environment, sky, fog `[ ]`

should, L. Depends on WP-17, WP-18. Stones: `rendering`, `assets`.

- `BrioEnvironment` from equirectangular HDR. Port `three: src/extras/PMREMGenerator.js` and `examples/jsm/loaders/HDRLoader.js`. Procedural default from `three: examples/jsm/environments/RoomEnvironment.js`, so no asset is needed.
- Sky background: solid, gradient, equirectangular.
- Fog: linear and exponential, by feature bit.

Accept: PBR metal sphere reflects the environment in a golden test. PMREM generation runs during loading, not in the frame.

#### WP-20 Shadows `[ ]`

must, L. Depends on WP-11, WP-12, WP-16. Stones: `rendering`, `cameras`, `objects`.

- Shadow atlas: depth texture, default 4096, 2048 on mobile, as in Godot (`rendering_server.cpp:3695-3696`). Hardware PCF through `sampler2DShadow`, per `three: WebGLShadowMap.js`.
- Directional: 1 to 4 cascades using the practical split with default weight 0.5 (NVIDIA PSSM). Reference `three: examples/jsm/csm`. Tighten near and far to visible content, and cull casters per split.
- Spot: one atlas tile. Point: six tiles, with a limit, since it is the costliest.
- `castShadow`, `receiveShadow` in `visual` flags; `bias`, `normalBias`, `shadow.autoUpdate`, `needsUpdate` for static scenes (`three: :86-95`).
- Render opposite faces for casters (`three: :51`).
- PCSS as an option: blocker search, penumbra `(dReceiver - dBlocker) * wLight / dBlocker`, then PCF. Should-have.
- Canvas2D: no shadows.

Accept: golden tests; benchmark of shadow pass cost; static scene does no shadow draw after the first frame.

### M4 Shaders

#### WP-21 Shader API `[ ]`

must, L. Depends on WP-15, WP-17 for `standard` hooks, WP-13 for custom attributes. Stones: new `shaders`, `rendering`, `assets`. Read [`shader-authoring.md`](../../temp/research/shader-authoring.md) first.

Goal (decisions 8, 8a, 8b): everything GLSL can do is reachable, and the common cases take one or two lines.

```ts
// 1. Inject a snippet into a built-in material. Lights, shadows and skinning keep working.
const gold = new BrioMaterial("mat_gold", { shading: "standard", color: "#ffcc00" });
gold.inject({ fragment: `ROUGHNESS *= 0.5 + 0.5 * sin(TIME);` });

// 2. Load a shader file like any other asset, and reference it by name.
game.preload(() => [
    new BrioShader("shd_water", "./shaders/water.glsl"),
    new BrioMaterial("mat_water", { shader: "shd_water", parameters: { uFoam: 0.4 } }),
]);

// 3. Or write it inline.
const tint = new BrioShader("shd_tint", {
    fragment: `uniform vec3 uTint; void fragment() { ALBEDO *= uTint; }`,
});

// 4. Change parameters. Values never recompile.
water.set("uFoam", 0.7);                // number, array, vector, CSS color, BrioTexture or texture name
const foam = water.parameter("uFoam");  // reusable handle, allocation-free in the game loop
foam.value = 0.9;

// 5. Replace the source at runtime. The last good program stays on screen until the new one links.
shader.source = { fragment: newCode };
shader.onCompile(({ ok, errors }) => showErrors(errors)); // lines refer to the author's file

// 6. Take full control when needed.
new BrioShader("shd_raw", { raw: true, vertex: vertexSource, fragment: fragmentSource });
```

A shader file stays valid GLSL, so ordinary editors and linters work on it:

```glsl
// water.glsl
#pragma brio domain surface
#include <brio/noise>
#include "./waves.glsl"

uniform vec3 uDeep;        // @color @default(#06324a)
uniform float uFoam;       // @range(0, 1) @default(0.2)
uniform sampler2D uRipple; // @linear @default(white)

varying float vCrest;

void vertex() {
    vCrest = wave(VERTEX.xz, TIME);
    VERTEX.y += vCrest * 0.1;
}

void fragment() {
    ALBEDO = mix(uDeep, vec3(1.0), smoothstep(1.0 - uFoam, 1.0, vCrest));
    ROUGHNESS = 0.1;
}
```

**Simplicity rules**

- One public concept. `BrioShader` is an asset, loaded in `preload()` and found by name. `BrioMaterial` gains a `shader` option. There is no `BrioShaderMaterial`.
- GLSL is the source of truth. Parameters come from the program through `getActiveUniform`, so nothing is declared twice, unlike three's `ShaderMaterial`. Optional comment annotations supply defaults, color space and ranges, like Godot hints and Unity attributes, while the file stays valid GLSL.
- `material.set()` accepts plain JavaScript values and converts them. CSS colors become linear when annotated `@color`.
- The engine supplies built-ins and adds matrices, skinning, instancing, lights and shadows automatically in `surface`. `TIME` comes from game time, so pause and `game.step()` stay deterministic.
- Hot reload is assigning `shader.source` or calling `shader.reload()` for a file.
- `material.inject()` works because built-in materials are written on the same hooks, so a snippet simply runs after the built-in `fragment()` or `vertex()`.

**Customization surface**

- Domains, from Godot's `shader_type`: `surface` with hooks `vertex()`, `fragment()`, `light()`; `canvas` in WP-23; `screen` in WP-42. All share this API.
- `surface` built-ins: `VERTEX, NORMAL, TANGENT, UV, UV2, COLOR, MODEL_MATRIX, VIEW_MATRIX, PROJECTION_MATRIX, TIME, ALBEDO, ALPHA, METALLIC, ROUGHNESS, EMISSION, NORMAL_MAP, AO, BONE_INDICES, BONE_WEIGHTS, INSTANCE_ID`.
- All GLSL ES 3.00 types: scalars, vectors, matrices, arrays, structs, `sampler2D`, `samplerCube`, `sampler3D`, `sampler2DArray`, integer samplers. Helper functions and constants anywhere in the file.
- `varying` declarations, rewritten to `out` and `in` per stage, as in Godot.
- Custom vertex attributes: `mesh.setAttribute("aWind", data, 1)` with `attribute float aWind;`, on a reserved location range.
- `defines: { USE_X: 1 }`. Changing one recompiles and counts as a variant, per decision 9.
- Render state on the material: `blend`, `cull`, `depthTest`, `depthWrite`, `colorWrite`.
- A separate `vertex()` runs in shadow passes too, so displaced geometry casts the right shadow, and alpha `discard` is honored there.
- Raw mode writes both stages with its own `#version 300 es`, gets documented attribute locations, can bind the frame UBO through `#include <brio/frame>`, and may declare uniform blocks. `#extension` lines enable the matching WebGL extension when present.
- Implementation stays small: a resolver for `#include`, a scanner for `uniform` annotations and hook names, then string assembly with `#line`. No GLSL parser.

**Guards**

| Guard | Rule | Basis |
| --- | --- | --- |
| Isolation from engine memory | Shaders never receive ECS or asset buffers directly. Parameter values live in a fixed `Float32Array` sized from the active uniforms at link time | WebGL spec: implementations prevent out-of-bounds access for draws |
| Program lifetime | Stages and programs are deduplicated by hash of the final source and released by reference count at zero | `three: WebGLPrograms.js:642-676`, `WebGLShaderCache.js`; Unreal keys compiled shaders by input hash |
| Texture lifetime | A material holds a counted reference to its textures through WP-30. Texture units are allocated and checked against `MAX_TEXTURE_IMAGE_UNITS`, with reserved units for engine use | `three: WebGLTextures.js:572-578` |
| Parameter checks | An unknown name or wrong type warns once and is ignored. Godot fails silently on type mismatch; BrioJS reports it | Godot shading language docs |
| Redundant uploads | Compare with cached value before upload | `three: WebGLUniforms.js:169-292` |
| Source limits | `ShaderLimits`, like `ModelLoaderLimits`: source size, include depth 25, cycles rejected, define count, and active uniforms against GL limits | Godot preprocessor docs; WebGL2 token limit of 1024 |
| Reserved names | `brio_` and `BRIO_` belong to the engine; the `webgl_` prefix is rejected by the spec. A clash reports an error at compile time | WebGL spec, reserved identifiers |
| No crash in the frame | A failed compile logs once with file and line, shows source context, and uses the last good program or a visible error material. Never throws from a draw | `three: WebGLProgram.js:15-26`; Unreal fallback materials; D-07 |
| Context loss | Programs rebuild from source, and parameters are restored from their CPU copy | `WebGL2Backend` rebuild path |
| Loading | Files go through `fetchLimited`, like models. Cross-origin textures need CORS, as the spec requires | WebGL spec, origin restrictions |
| Untrusted shaders | Documented as a risk. The WebGL spec states denial of service cannot be prevented by structural limits, and Godot warns that loops can freeze the application. Do not run shaders from strangers in a shared page | WebGL spec, denial of service |
| Undefined results | Out-of-range array reads stay inside program storage but return unspecified values, and locals are uninitialized. The docs teach this and suggest `#define BRIO_DEBUG` checks | WebGL spec; Godot docs |

- Canvas2D: custom shaders are ignored with one warning, and the material's `fallback` color or texture is used.

Accept:

- Each numbered form in the sample above works, in a browser test.
- A `surface` shader works with skinning, instancing, lights and shadows without extra author code.
- A syntax error reports the author's file and line, including inside an `#include`. The frame keeps rendering.
- Parameter writes never recompile, and `parameter().value =` allocates nothing.
- Loading and releasing the same shader 100 times leaves GL program and shader counts flat in `renderStats`.
- A cyclic include, an oversized source and a reserved name are rejected with clear messages.

#### WP-22 Shader library, globals and overrides `[ ]`

must for includes and globals, should for per-object overrides. M. Depends on WP-21. Stones: `shaders`, `assets`.

- `#include <brio/...>` library: noise, color, lighting functions, PBR helpers, and `BrioShader.registerInclude(name, source)` for shared user code.
- `material.inject()` gets named points beyond the hook end: `vertexBefore`, `fragmentBefore`, `lightAfter`, equivalent to `onBeforeCompile` plus `customProgramCacheKey`, without string patching by the author.
- Global parameters shared across materials: `game.shaderGlobals.set("uWind", 1.2)`, read as `uniform float uWind; // @global`, in one UBO. Follows Godot's `global_shader_parameter_set`. Declared before use, as Godot requires.
- Per-object overrides: `object.setShaderParameter("uHit", 1)` through per-instance data, like Godot's instance uniforms and Unity's `MaterialPropertyBlock`. Numbers and vectors only, and a limit of 16 as in Godot.
- A short shader guide in the docs, with examples for each level of the API, since this is teaching material.

Accept: injection keeps PBR and shadows intact; one global updates all users with one UBO upload; overrides do not create new programs.

#### WP-23 Canvas domain and shader lab `[ ]`

must, M. Depends on WP-21, WP-35. Stone: `shaders`.

- `canvas` domain with Godot's built-ins: `UV, COLOR, TEXTURE, SCREEN_UV, NORMAL_MAP, TIME`, optional `light()`.
- The 2D API matches the 3D one: `object.material = "mat_outline"`, with `BrioObject2D` referencing a material by name, and `game.preload` loading the `.glsl` file. A batch breaks on shader change.
- `examples/shader-lab`: an editor, live recompile, error list with line links, and parameter sliders generated from uniforms and annotations. The `showcase` playground on the `tcc` branch already integrates Monaco, so check it before writing a new editor.

Accept: the lab survives invalid input, shows the correct line, and keeps drawing the last good program.

### M5 Animation

#### WP-24 glTF scene tree `[ ]`

must, M. Fixes D-03. Depends on WP-08. Stones: `assets`, `objects`.

- Stop baking. `ParsedModelData` gets `nodes` (parent, TRS, mesh, skin) per the glTF rules: `T * R * S`, disjoint trees, ignore skinned mesh node transform.
- `BrioModel.instantiate` recreates the tree. Shared meshes stay shared. Joint nodes do not become objects unless they have attachments or non-joint children.
- Keep a `bake: true` option for simple static use, and to preserve current test behavior where it matters.
- Dependency cache by type and index, as in `three: GLTFLoader.js:2986`. New limits: nodes, skins, joints, channels, keyframes.

Accept: a model using a mesh twice renders both; negative determinant nodes render correctly.

#### WP-25 Skeleton and skinning `[ ]`

must, L. Depends on WP-13, WP-24. Stones: new `animation`, `rendering`, `assets`.

- `BrioSkeleton` asset: `parents: Int16Array`, `names`, `inverseBind: Float32Array`, sorted parents first.
- `BrioPosePool`: contiguous `Float32Array`: 10 floats of TRS per bone, 16 floats of world matrix, 16 of skinning matrix. Allocated per skinned instance, with free-list reuse.
- Skinning matrices: `world * inverseBind`, relative to the mesh root (`three: Skeleton.js:226`).
- Bone texture RGBA32F, 4 texels per bone, `texelFetch`, `texSubImage2D` once per frame only if the pose changed (`three: Skeleton.js:263`, `skinning_pars_vertex`).
- Glue: `JOINTS_0`, `WEIGHTS_0`, normalized types, unsigned byte or short. `JOINTS_1` is optional and warns when unused.
- Canvas2D: CPU skinning with a shared function, marked low-poly only.
- Shadows and picking include skin. Conservative padded bounds for culling.

Accept: Khronos `RiggedSimple` and `CesiumMan`, license checked, in golden tests; 60-bone pose update allocates nothing.

#### WP-26 Clips and animator `[ ]`

must, L. Depends on WP-25. Stone: `animation`.

```ts
const animator = hero.getAnimator();          // BrioAnimator, created by instantiate() when clips exist
animator.play("Idle");
animator.crossFade("Run", 0.25);              // seconds
animator.addLayer("upper", { mask: animator.boneMask("Spine", { recursive: true }), mode: "override", weight: 1 });
animator.play("Shoot", { layer: "upper", loop: false });
animator.onEvent("footstep", () => stepSound.play());
```

- `BrioAnimationClip`: tracks as typed arrays, values decoded once to floats. One per skeleton or node path.
- Sampler per glTF Appendix C: `STEP`, `LINEAR`, shortest-path slerp, `CUBICSPLINE` with normalized quaternion result, and clamp outside the range. Reference `three: GLTFLoader.js:2181-2253` for cubic.
- Binary search with a per-track cursor, so playing forward stays O(1).
- Binding at clip attach maps tracks to bone index or object slot, once, as in Godot's `TrackCache`. No string paths per frame.
- Pose accumulation in preallocated buffers, with weights, modeled on `three: PropertyMixer.js:35`: layer `override` and `additive`, per-bone mask. Additive requires a reference pose (Unity documents matching properties).
- Node tracks write through `transform` buffers directly.
- Runs in a system: `animator.updateMode: "update" | "fixed" | "manual"`, like Godot's callback modes. Deterministic with `game.step`.
- State captured in snapshots: clip ids, time, weights.

Accept: blend test by pose values against known results; no per-frame allocation; deterministic replay test.

#### WP-27 State machine, blend spaces, root motion, attachments `[ ]`

must, M. Depends on WP-26. Stone: `animation`.

- `BrioAnimationStateMachine`: data-defined states, transitions with conditions over parameters, `exitTime` (normalized, conditions checked after it), `duration`, `offset`, any-state, and priority. Follows Unity's documented semantics and Godot's `advance_condition`.
- `BrioBlendSpace1D`. 2D is a should-have, with triangulation, like Unreal and Godot.
- Root motion: per-frame root delta applied to the owner, with option per axis. Follows Unity's Root Transform description.
- `animator.attach(boneName, object)`: writes the bone's world matrix into the object's parent reference each frame, like Godot's `BoneAttachment3D`.
- `animator.updateRate` (for example `15`), with pose reuse between updates and an automatic distance option, following Unreal's URO guidance. Should-have.

Accept: a walk-run-jump machine in `examples` with no user blending code.

#### WP-28 Morph targets `[ ]`

should, M. Depends on WP-26. Stone: `animation`.

- Data array texture, as in `three: WebGLMorphtargets.js`. POSITION, NORMAL, TANGENT applied before skinning (glTF). `weights` tracks with their output layout. Weight data per instance.

Accept: Khronos `AnimatedMorphCube` golden test.

#### WP-29 Tweens and sprite animator `[ ]`

must, S. Fixes D-13. Stones: `animation`, `assets`, `scenes`.

- Split `BrioAnimation` into clip (data) and `BrioSpriteAnimator` (per-object state). Keep `BrioAnimation` working with a deprecation note, or drop it with a changelog entry, since it is pre-1.0.
- The animation state machine in WP-27 also drives sprite clips, sharing conditions and parameters.
- `BrioTween` over `BrioTimer`: any numeric property or vector, easing set, chain and parallel, cancel, pause. Easing formulas from Penner, whose terms are recorded in Godot's `COPYRIGHT.txt`.

Accept: two objects play one clip independently; tween respects pause.

### M6 Content flow

#### WP-30 Asset manager v2 `[ ]`

must, M. Fixes D-05. Depends on WP-11. Stones: `game`, `assets`, `rendering`.

- `BrioLoadingTracker`, modeled on three's `LoadingManager`: per-item start, end, error, overall progress by count and bytes, retry, and a URL modifier.
- Dedup by URL plus options, with a cache mode like Godot's `REUSE`, `REPLACE` and `IGNORE`.
- Reference count per owner scene. `game.assets.release(owner)` frees what reached zero. Backend `release()` deletes GPU objects, using a counter so WeakMap entries and owned lists stop leaking.
- Asset failure is reported per item and has a policy: fail the scene, or use a placeholder.
- `BrioSprite` preload uses `addEventListener`/`decode`, so sprites can share `TextureRegistry` images (assets stone).

Accept: load and unload a scene 20 times in the browser with flat VRAM and JS heap, read through `renderStats.memory`.

#### WP-31 Scene manager `[ ]`

must, M. Depends on WP-30. Stones: `scenes`, `game`, `rendering`.

```ts
const op = game.scenes.load("level_2", { mode: "additive", activate: false });
op.onProgress((p) => bar.setValue(p));
await op.ready;                 // assets and load() done; held like Unity's 0.9
op.allowActivation();
await op.done;

game.scenes.setActive("level_2");       // new objects and render settings come from here
await game.scenes.unload("level_1");    // releases its assets
game.scenes.push("pause_menu");         // overlay, pauses below; pop() resumes
```

- `game.scenes` becomes `BrioSceneManager`; the old `Map` access stays through `.get()`, `.has()`, iteration. `game.setScene(name)` stays as a shortcut for single mode.
- Loaded scenes form an ordered list; the compositor renders each as a source. Each has `visible`, `paused`, `order`. Lights stay per scene, with the option to share the active scene's lights.
- Queue rule from Unity: an operation held at activation stalls later operations, documented. A later `setScene` still wins over a pending one.
- Snapshot covers all loaded scenes.
- Deferred swap, as in Godot's `_flush_scene_change`: scene changes apply at a frame boundary.

Accept: an additive level streams in with the first scene still running; progress is monotonic; the test covers cancel, double load and unload during load.

#### WP-32 Transitions `[ ]`

should, S. Depends on WP-31, later WP-42 for shader wipes. Stones: `scenes`, `rendering`.

- `game.scenes.transition("level_2", { type: "fade", duration: 0.5, color: "#000" })`. Loading screen scene support.
- Shader-based wipes after WP-42, with the `screen` domain, like `three: RenderTransitionPass`.

Accept: input is blocked during a transition by option; time is measured with `game.step`.

#### WP-33 Storage v2 `[ ]`

must, M. Fixes D-15, D-16. Stone: `storage`.

- `db`: resolve on transaction `complete`. Handle `onblocked` and `versionchange` (close and reopen). Add `keys()`, `getMany`, `setMany`. Constructor option or `BrioStorage.namespace("my_game")`, keeping the default name and adding a migration path.
- `session`, `local`: catch `QuotaExceededError`, return `{ ok: false, reason }`, or throw a typed `BrioStorageQuotaError` by policy. Add `keys()`. Document the 5 MiB practical limit.
- New `BrioStorage.opfs` adapter: `read`, `write`, `delete`, `list`, with binary support, falling back to `db`. Writes use a temp file then a rename-style replace.
- New `BrioStorage.file`: `exportFile(name, data, { type })` (`showSaveFilePicker` when present and inside a user gesture, otherwise Blob download) and `importFile({ accept })` through a hidden input. Electron and Capacitor hooks through `PlatformAdapter`.
- `BrioStorage.requestPersistence()` and `estimate()`.
- All with fallbacks that are observable, as `isPersistent()` already is.

Accept: fake IndexedDB tests for commit timing, and browser tests for each adapter, with quota simulated.

#### WP-34 State store and save system `[ ]`

must, M. Depends on WP-10, WP-33. Stones: `storage`, `game`.

```ts
const settings = game.state.define("settings", {
    tier: "local",                   // "memory" | "session" | "local" | "db" | "opfs"
    version: 2,
    defaults: { music: 0.8, sfx: 1 },
    migrate: { 1: (v) => ({ ...v, sfx: 1 }) },
});
settings.set("music", 0.5);          // debounced write, flushed on pagehide
settings.subscribe("music", (v) => BrioAudioMixer.setVolume("bgm", v));

await game.saves.save("slot1", { label: "Forest", includeWorld: true });
await game.saves.load("slot1");
const blob = await game.saves.export("slot1");   // .briosave
await game.saves.import(file);
```

- Missing fields keep defaults on load, as in `JsonUtility`. Migration runs in order.
- `.briosave` container: magic, version, JSON metadata, game state section, binary world sections, CRC32. Corrupt or foreign files are rejected before touching the world, matching the snapshot invariant.
- Save async by default, as Unreal recommends. Flush critical state on `pagehide` and `visibilitychange`.
- No encryption, stated in docs: a secret shipped to the browser protects nothing. Checksums detect corruption, not cheating.
- Autosave slot rotation is optional.

Accept: full round trip in the browser through every tier and through a file; migration test; corrupted file test.

### M7 2D and UI

#### WP-35 GPU 2D renderer `[ ]`

must, L. Depends on WP-03, WP-07, WP-11. Stones: `rendering`, new `rendering2d` if it grows, `objects`.

- `BrioSpriteBatcher`: instanced quads, with a per-instance buffer filled from `worldMatrix2D`, source rect, tint, opacity. Batches break on texture, shader or blend change, as in `godot: drivers/gles3/rasterizer_canvas_gles3.h`. Default capacity 16384 per buffer (Godot's default), growing by chunks.
- Bind several textures per batch, up to what `MAX_TEXTURE_IMAGE_UNITS` allows, to reduce breaks.
- Layers, order and camera passes keep their semantics. `"static"` layers cache into a render target.
- `BrioGameConfig.renderer2D: "auto" | "gpu" | "canvas2d"`. Auto uses GPU when WebGL2 is available. `BrioSpriteRenderer` stays as the fallback, and it must produce the same image within tolerance.
- `game.ctx` becomes documented as Canvas2D only. Debug overlays render to a small canvas and upload as a texture, or stay on the visible 2D canvas during composite.
- Measure, and then decide direct presentation (decision 10).

Accept: goldens match Canvas2D within tolerance; benchmark at 10,000 and 50,000 sprites against the WP-02 baseline; split-screen still works.

#### WP-36 2D visual set `[ ]`

must, M. Depends on WP-35. Stones: `objects`, `assets`.

- `BrioObject2D`: `tint`, `blendMode` (`"normal" | "add" | "multiply" | "screen"`), both in the ECS. `ySort` on layers.
- `BrioShape2D` (rect, circle, line, polygon, with fill and stroke), batched as triangles on GPU, Path2D on Canvas2D.
- `BrioNineSlice`, repeated and tiled sprites, for backgrounds. Use texture repeat on GPU, `createPattern` on Canvas2D.
- Both backends implement each one, or document the difference.

Accept: golden tests on both backends.

#### WP-37 Text `[ ]`

must, M. Depends on WP-35. Stone: new `text` or `objects`.

- `BrioText`: font family, size, weight, color, align, wrap, line height, outline. Rasterized through an offscreen Canvas2D into a glyph atlas per font and size, and batched as sprites. Layout cached until text changes.
- `BrioFont` asset, loading through the `FontFace` API, in `preload`.
- `BrioBitmapFont`, for pixel games, through a sprite sheet with a JSON or BMFont layout.
- Canvas2D backend draws through `fillText`.
- Multi-line wrap, UTF-8 by code point, no bidi or complex shaping beyond what the browser gives through glyph rasterization. Document the limit.

Accept: changing a score each frame allocates only when the string changes; it renders identically through both backends within tolerance.

#### WP-38 Tile map rendering `[ ]`

must, M. Fixes D-11. Depends on WP-35. Stones: `assets`, `rendering`.

- Chunks of 16 by 16 tiles, default as in Godot. Each chunk caches a vertex buffer on GPU, or an offscreen canvas on Canvas2D. Only visible chunks draw.
- `"chunk"` mode: fast, no interleaving. `"sorted"` mode: for y-sort with characters. Same trade-off as Unity's Chunk vs Individual.
- `setTile` invalidates one chunk. Layers, animated tiles and parallax. Merged colliders stay.
- `BrioTileMap.fromTiled(json)`: layers, tilesets, objects, flips. LDtk is post-TCC.
- Replace the `"static"` cache rule for large maps: a static layer scrolled by the camera no longer redraws its contents.

Accept: a 500 by 500 map scrolls with draw cost tied to the screen, not map size; test with a Tiled fixture.

#### WP-39 2D lights `[ ]`

should, M. Depends on WP-35, WP-23. Stones: `rendering`, `objects`.

- `BrioLight2D`: point, global, with `color`, `energy`, `height`, `range`, `layerMask`, blend `add`, `sub`, `mix`, per `godot: scene/2d/light_2d.h`.
- Normal maps on sprites: `BrioSprite.normalMap`, with lighting in the canvas domain. Fixed capacity per batch.
- Hard shadows through `BrioLightOccluder2D` are post-TCC.
- Canvas2D: global light as a tint; others ignored with a warning.

Accept: golden test with a normal-mapped sprite.

#### WP-40 Particles `[ ]`

must, M. Depends on WP-35; 3D part needs WP-14. Stone: new `particles`.

- `BrioParticleEmitter2D` and `3D`: SoA buffers (`position`, `velocity`, `life`, `size`, `color`, ...). Pooled, with no per-particle objects. Simulated on the CPU in a system, using `game.random` for replays.
- Settings: rate, burst, lifetime, speed, angle, gravity, size and color over life curves, world or local space, blend mode.
- Draws through the batcher in 2D, instancing in 3D. Canvas2D 2D path with a lower limit. GPU simulation is post-TCC.

Accept: 10,000 particles at target frame time on the benchmark machine; no allocation once running.

#### WP-41 UI `[ ]`

must, L. Depends on WP-36, WP-37. Stone: new `ui`.

- `BrioUI` tree on a `"ui"` layer: `BrioUIPanel`, `Label`, `Image`, `Button`, `ProgressBar`, `Slider`, `NineSlice`. Containers: vertical, horizontal, grid. Anchors and margins, from Godot's `Control` model.
- Pointer events, with hit testing and consume-input rules against gameplay. Focus navigation by keyboard and gamepad.
- Theme object for fonts, colors, slices. Scale with viewport (WP-43).
- Each element is backed by `BrioObject2D` or batcher draw calls. Layout runs only when dirty.
- Virtual joystick in WP-45 uses this.

Accept: pause menu and HUD built in the demos; keyboard-only navigation works.

### M8 Systems

#### WP-42 Post-processing `[ ]`

must, M. Depends on WP-11, WP-18. Stones: `rendering`, `shaders`.

- `camera.effects = [new BrioBloom(), new BrioFXAA()]` or `game.postProcess`. Chain over shared render targets, and resize automatically. Port structure from `three: EffectComposer`, `OutputPass`.
- Effects: FXAA after tone mapping, as NVIDIA requires perceptual input; bloom (`UnrealBloomPass` as reference); LUT; vignette; pixelate; custom `screen` domain shader. SSAO is post-TCC.
- `invalidateFramebuffer` on attachments no longer needed (MDN).
- Before reusing the FXAA shader from three, check the terms of its upstream port, or write the pass from the paper.
- Canvas2D: effects are skipped, warning once. CSS `filter` is not used.

Accept: goldens per effect; disabled effect costs no render target.

#### WP-43 Canvas scaling `[ ]`

must, S. Stones: `game`, `rendering`, `cameras`.

- `devicePixelRatio`, with `maxPixelRatio` config; `ResizeObserver`; scale modes `"none" | "fit" | "fill" | "stretch" | "integer"`, for letterboxing and pixel art; `game.resolutionScale`.
- `game.toggleFullScreen()` from a user gesture. Mouse and touch conversions keep working (existing `getWorldPosition` tests extend).
- Static caches and targets resize once.

Accept: test across DPR 1, 2; pixel art keeps integer scale.

#### WP-44 Camera controllers and features `[ ]`

must, M. Depends on WP-11. Stones: `cameras`, `input`.

- `BrioOrbitControls`, adapted from `three: controls/OrbitControls.js`, deterministic with `dt`. `BrioFirstPersonControls` with Pointer Lock, adapted from `PointerLockControls.js`. `BrioThirdPersonControls`, own design: spring arm with collision check when WP-46 exists.
- `BrioMouse.requestPointerLock()`, `lockedDelta`.
- `BrioCamera3D.follow`, `shake`, seeded by `game.random`.
- Render target camera: `camera.target = new BrioRenderTarget(...)`, for the minimap demo; both 2D and 3D.
- 3D picking: `game.pick(x, y)` by rays against bounding spheres, then triangles optional.

Accept: scenes reproduce with `game.step`; minimap golden.

#### WP-45 Input map `[ ]`

should, S. Stone: `input`.

- `BrioInputMap`: actions over keyboard, mouse, gamepad, touch, with runtime rebinding, saved through `game.state`.
- Synthetic input: `game.input.inject(...)` (also an MCP prerequisite).
- Touch edges and a virtual joystick on UI, like Godot's `virtual_joystick`.
- Gamepad edges stay sampled; document.

Accept: replay of recorded input reproduces a run with `game.step`.

#### WP-46 Physics integration `[ ]`

should, L. Fixes D-21. Stones: `physics`, `ecs`, `math`, `objects`.

- Move `collision` and `BrioRigidBody` into `collider` and `rigidBody` buffers, with facades as views. Snapshots then capture them, closing the last part of D-17.
- Physics system in `fixed` phase: integrate, broad phase, narrow phase, resolve solid pairs, restitution.
- Events: `onTriggerEnter`, `onTriggerStay`, `onTriggerExit`, `onCollision`, using a persistent pair set. No allocation per pair after warm-up. Broad phase stops building string keys per frame: numeric hash.
- `BrioPhysics.raycast2D`, `raycast3D`, and overlap queries.
- 3D resolution for box and sphere. Character controller: move-and-slide against static colliders, like Godot's `character_body_3d`, in 2D and 3D, with slope and step limits.
- Mesh colliders and joints are post-TCC. Rename `SpatialOctree3D` with a deprecated alias.

Accept: determinism test through snapshots; a platformer controller works in the 2D demo without game-side resolution.

#### WP-47 Spatial audio `[ ]`

should, S. Stones: `audio`, `assets`.

- `audio.playAt(position)` and an `object.audio` attachment. `PannerNode` for 3D with distance model; `StereoPannerNode` for 2D. Listener follows the active camera.
- Fallback mode: distance attenuation only.
- Crossfade between `bgm` tracks; ducking through bus automation; loop points.
- Pause in fallback mode (ROADMAP known issue).

Accept: fake Web Audio tests in `tests/helpers/fakeWebAudio.ts`.

#### WP-48 Debug and profiler `[ ]`

should, M. Stones: `game`, `rendering`.

- `game.debugging.stats`: overlay with frame time, draw calls, triangles, programs, memory, culled counts, per-system time.
- `game.captureFrame(): Promise<Blob>`, for test and TCC figures, with asynchronous readback (`fenceSync`, per MDN) where needed.
- Wireframe, bounds, normals, skeleton, shadow atlas, cascade views.
- GPU timer through `EXT_disjoint_timer_query_webgl2` when present.

Accept: overhead when off is zero, by branch only.

### M9 Delivery

#### WP-49 2D platformer demo `[ ]`

must, M. Depends on the M7 must items, WP-27, WP-29, WP-31, WP-34, WP-46 or a game-side collision fallback.

Build per section 2. Keep game code short and readable, because it is teaching material. Assets are original or CC0 with attribution in the example folder.

Accept: runs on Chromium, Firefox and Safari; `?backend=canvas2d` runs with documented degradation.

#### WP-50 3D third-person demo `[ ]`

must, L. Depends on WP-17, WP-20, WP-27, WP-31, WP-34, WP-42, WP-44.

Accept: same as WP-49, and the frame target recorded on the reference machine, including one low-end device such as school lab hardware.

#### WP-51 Hybrid and shader lab demo `[ ]`

must, M. Depends on WP-23, WP-41, WP-44.

#### WP-52 Comparative benchmark `[ ]`

must, M. Depends on WP-02, WP-50.

- Identical scenes in BrioJS and three.js, using the three.js version at the pinned commit: 10,000 static meshes, 200 skinned characters, 10,000 sprites where comparable, one PBR scene.
- Metrics: frame CPU time, draw calls, JS heap growth, GC pauses, bundle minified and gzipped, load time.
- Multiple runs, median and spread, machines listed. Publish scripts in `benchmarks/`, so the TCC result is reproducible. Report where three.js wins.

Accept: a table and method section ready for the TCC text.

#### WP-53 Release `[ ]`

must, M. Depends on the demos.

- Lazy 3D stack via dynamic `import()`, to reduce 2D bundle size (ROADMAP known issue). Set bundle budgets from real numbers, and enforce them in CI.
- TypeDoc, README, getting-started guides for each major system, migration notes, glossary.
- `TARGET_ARCHITECTURE.md` and ADRs updated with status. ADR for the shader API, one for the animation model, one for save format.
- Decide the version number with the maintainers: 0.2.0, or 1.0.0 if the API should freeze. `npm pack --dry-run`, publish, tag.

Accept: a new user can follow the README to a running 2D and 3D scene.

#### WP-54 User test support `[-]`

Cut on 2026-10-31: the tests are not planned, for lack of time. If they return after the TCC, the engine work would be a getting-started path, readable beginner errors, optional local task timing with no personal data, and a run on school lab hardware on WebGL2 and on `?backend=canvas2d`.

### Post-TCC backlog

Not started until the demos ship. Each becomes a work package when picked.

| Item | Reference |
| --- | --- |
| `WebGPUBackend`, async pipelines, render bundles | `three: src/renderers/common`; study 4.1 |
| Workers and `OffscreenCanvas`, shared ECS memory | ADR 0003 |
| `WebGL1Backend`, only if lab hardware proves it necessary | ADR 0001 |
| Weighted blended OIT | McGuire and Bavoil |
| Reversed-Z when `EXT_clip_control` exists | NVIDIA Depth Precision; `three: WebGLCapabilities.js:95` |
| SSAO or GTAO, SSR, volumetrics | `three: GTAOPass`; Godot GLES3 `s4ao` |
| Skinned crowds through animation textures | NVIDIA GPU Gems 3 ch. 2 |
| IK, spring bones | `godot: two_bone_ik_3d`, `spring_bone_simulator_3d` |
| LOD crossfade, HLOD, occlusion culling | Unity LOD, Unreal HLOD |
| GPU particles | `godot: gpu_particles_2d` |
| Draco, meshopt, KTX2 as optional plugins | `three: loaders` |
| GLB parse in a Worker | Study 4.6 |
| LDtk import, 2D skeletal animation, light occluders, MSDF text | Godot `skeleton_2d`, `light_occluder_2d` |
| World streaming by grid | Unreal World Partition |
| Mesh colliders with BVH, joints, contact solver | TODO 9.4 |
| Network, PWA packaging, WebXR, accessibility, i18n | TODO 9.7 |
| MCP authoring (needs scene documents, captures, input injection) | ADR 0006, TODO 10 |

## 7. Backend capability matrix

Target state. Update when reality differs. `game.renderBackend.capabilities` exposes this at runtime.

| Feature | WebGL2 | Canvas2D fallback |
| --- | --- | --- |
| 2D sprites, tint, blend, shapes, text, tiles, particles | Yes | Yes, with a lower particle limit; `tint` through composite operations |
| 2D shaders, 2D lights | Yes | No: warn once, draw unshaded |
| 3D meshes | Yes | Yes, low-poly |
| Textures on 3D | Yes | No (ROADMAP known issue) |
| Standard material | Yes | Base color Lambert |
| Point, spot, directional lights | Yes | Luminance per triangle |
| Shadows, IBL, post-processing | Yes | No: warn once |
| Skinning | GPU | CPU, low-poly |
| Morph targets | GPU | No |
| Custom shaders | Yes | `fallback` material |
| Instancing | Yes | Expanded to single draws |

## 8. New stones and glossary terms

Create when the first package touches them, with `keystone stone create`, and link them.

- Stones: `animation` (`src/animation`), `shaders` (`src/shaders`), `ui` (`src/ui`), `particles` (`src/particles`), `text` if it outgrows `assets`.
- Glossary: Animator, Skeleton, Bone, Clip, Pose, State Machine, Blend Space, Shader, Domain, Uniform Parameter, Render Target, Effect, Scene Manager, Active Scene, Additive Scene, Save Slot, State Store, Particle Emitter, Light Probe if added.
- `transform.layer` to `transform.depth` rename (TODO 7.2): do it in WP-03, since 2D rendering changes anyway.

## 9. Risks

| Risk | Mitigation |
| --- | --- |
| Scope is large: 53 active packages | The TCC sprint narrows it for 2026-11-13. After that, the minimum path in section 4 still ends in working demos. Cut from the should list first |
| WP-11 breaks existing behavior | Golden tests from WP-02 come first. No feature work on the old contract |
| Text, shadows and PBR need visual checks that a fake GL cannot make | Browser rig required before M3 |
| Bundle size grows | Budget enforced at WP-53, optional features behind dynamic import |
| Shader variants explode | Numeric key, variant count in stats, warm-up lists per scene |
| Canvas2D diverges | Capability matrix above, warnings, and a golden per feature only where it is claimed |
| Asset licenses in demos and tests | Original or CC0 assets, attribution files, no Sketchfab asset in the repository |
| Reference code moves | Line references are pinned to the commits in study section 1 |
| No Node in the current environment | WP-00 first. No package can claim done without `npm run check` |
