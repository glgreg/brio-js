# Engine Completion Study

Status: **Reference** (2026-10-31). Current execution lives in [`docs/plans/TCC_FINAL_SPRINT.md`](../plans/TCC_FINAL_SPRINT.md), which narrows the wider [`ENGINE_COMPLETION_PLAN.md`](../plans/ENGINE_COMPLETION_PLAN.md).
This study supersedes the status columns of [`RENDERING_STUDY_THREEJS.md`](./RENDERING_STUDY_THREEJS.md) and complements
[`TARGET_ARCHITECTURE.md`](./TARGET_ARCHITECTURE.md).

## 1. Scope and method

The question: what must be added, fixed, improved or iterated so BrioJS can carry the TCC demos in 2D and 3D, keeping the data-oriented
ECS core behind the object-oriented public API.

Evidence came from four places, read during this study and not from memory:

| Source | Version read | Access |
| --- | --- | --- |
| BrioJS | `develop` at `f5ab0ff` | Stones, ADRs, and the source of rendering, objects, scenes, ECS, storage, loaders and game loop |
| three.js | `fa01dd6`, 2026-10-31, 0.187.0, MIT | Shallow clone, source read |
| Godot | `95c0fa5`, 2026-10-30, 4.8 beta, MIT | Shallow clone, source read |
| Unity | Unity 6.6 manual, Entities 1.4 | Official documentation |
| Unreal Engine | UE 5.8 documentation | Official documentation |
| NVIDIA | GPU Gems 2 and 3, PCSS, FXAA and Skinned Instancing papers, Depth Precision article | Official pages and PDFs |
| Standards | glTF 2.0 source, KHR_parallel_shader_compile, MDN, caniuse | Specifications and references |

The clones and notes sit in the gitignored `temp/` folder. Recreate them with:

```sh
git clone --depth 1 --single-branch https://github.com/mrdoob/three.js.git temp/repos/three.js
git clone --depth 1 --single-branch https://github.com/godotengine/godot.git temp/repos/godot
```

Paths below such as `three: src/objects/Skeleton.js:226` are relative to those clones at the commits above. Paths without a prefix are BrioJS.

### Study base in `temp/`

Read the base before working on a subsystem. It holds more detail than this document: line references, quotes, and what each source does not cover. The links below are relative and work on the machine where the study ran, because `temp/` is gitignored.

| Base file | Contents |
| --- | --- |
| [`temp/research/README.md`](../../temp/research/README.md) | Index of the base, pinned commits, how to recreate the clones |
| [`temp/research/three-js.md`](../../temp/research/three-js.md) | three.js evidence: animation, skinning, loader, render loop, programs, shading, shadows, instancing |
| [`temp/research/godot.md`](../../temp/research/godot.md) | Godot evidence: servers, scene changes, limits, 2D batching, shader model, animation, UI, per-file license exceptions |
| [`temp/research/unity.md`](../../temp/research/unity.md) | Unity documentation facts: scenes, ECS, rendering, animation, persistence |
| [`temp/research/unreal.md`](../../temp/research/unreal.md) | Unreal documentation facts: Mass, streaming, animation, materials, PSO, saves |
| [`temp/research/nvidia.md`](../../temp/research/nvidia.md) | NVIDIA algorithms: PSSM, PCSS, VSM, instancing, crowds, depth, WBOIT, FXAA |
| [`temp/research/standards.md`](../../temp/research/standards.md) | glTF, WebGL, Web Storage, File System and WebGPU facts |
| [`temp/research/shader-authoring.md`](../../temp/research/shader-authoring.md) | Custom shader APIs and guards in three.js, Godot, Unity, Unreal and the WebGL specifications |
| [`temp/repos/three.js`](../../temp/repos/three.js) | three.js source at `fa01dd6` |
| [`temp/repos/godot`](../../temp/repos/godot) | Godot source at `95c0fa5` |
| [`temp/research/sources/`](../../temp/research/sources) | [glTF specification](../../temp/research/sources/gltf-spec.adoc), [KHR_lights_punctual](../../temp/research/sources/khr-lights-punctual.md), [KHR_texture_transform](../../temp/research/sources/khr-texture-transform.md), and text extracted from [PCSS](../../temp/research/sources/nvidia-pcss.txt), [FXAA](../../temp/research/sources/nvidia-fxaa.txt), [Skinned Instancing](../../temp/research/sources/nvidia-skinned-instancing.txt) and [WBOIT](../../temp/research/sources/wboit.txt) |

If `temp/` is missing, recreate the clones with the commands above. The clones and downloads can be fetched again, but the notes `temp/research/*.md` exist only on the original machine. Section 9 lists the sources for rebuilding them, and this study keeps the conclusions.

### Limits of this study

- `npm run check` and `keystone stone doctor` could not run: this environment has no Node or Bun on PATH and no `node_modules`. BrioJS findings come from reading code. Nothing was measured in a browser, so performance targets in the plan are proposals until WP-02 exists.
- Some pages could not be read. Unreal's `material-parameter-collections` and `cascaded-shadow-maps` returned an empty body. Unity's LOD selection formula, the priority order among Unity batching methods and Unity 2D normal maps were not obtained. Unity `PlayerPrefs` and `persistentDataPath` facts came from a page summary, so check the wording before quoting them in the TCC text. The PSSM split formula is an image on the NVIDIA page; the plan uses the description, and the formula must be taken from three's `CSM.js` or the chapter when implementing.
- Licensing notes are engineering practice, not legal advice.
- The original TCC work plan delimits the project to 2D on the Canvas 2D API and evaluates it through user tests. This study covers 2D and 3D on WebGL2 at the maintainers' request, and they have freedom to change the scope. User tests are not planned.

The complete list of research gaps, the TCC questions and the provenance of each algorithm are in the local, gitignored [`docs/tcc/`](../tcc/README.md): [`LACUNAS_DE_PESQUISA.md`](../tcc/LACUNAS_DE_PESQUISA.md), [`QUESTOES_DO_TCC.md`](../tcc/QUESTOES_DO_TCC.md) and [`PROCEDENCIA.md`](../tcc/PROCEDENCIA.md).

## 2. Summary

BrioJS has a sound foundation: SoA storage with generational handles, binary snapshots, backend cascade, layer compositor, fixed step, seeded random, Web Audio mixer and hardened loaders. What it lacks is most of what makes a demo look and behave like a modern game:

- **3D**: no PBR, no normal maps, no point or spot lights, no shadows, no IBL, no tone mapping, no skeletal or node animation, no custom shaders, no culling, no instancing.
- **2D**: no text, no tile map rendering, no particles, no tint or blend modes, no GPU path, and the parent-child hierarchy is not rendered.
- **Structure**: one active scene at a time, no additive loading, no progress reporting, no way to free GPU memory, no file save, no UI.

The core decision is to build these on the same pattern the engine already has, instead of importing three's scene graph. three.js contributes shader code and rendering techniques, Godot contributes the public shader model and the 2D renderer shape, and Unity, Unreal and NVIDIA contribute concepts and algorithms.

## 3. Defects found in current code

All verified by reading the listed lines. Each one has a home in the plan.

| ID | Defect | Evidence | Consequence | WP |
| --- | --- | --- | --- | --- |
| D-01 | 2D hierarchy is not rendered | `src/game/BrioSpriteRenderer.ts:151-152` reads `transform.position`; only `BrioTransform2D` itself uses `worldPosition`. `src/cameras/BrioCamera2D.ts:270,440` also read local position | A child sprite ignores its parent on screen, in culling and in camera follow, although the API and glossary promise a hierarchy | WP-03 |
| D-02 | glTF accessors decode signed and normalized data wrongly | `src/assets/loaders/GLBLoader.ts:297-306` treats everything else as `getUint8`, so type 5122 reads wrong bytes; `normalized` is never read; `sparse` is ignored; `:687` drops non-float UVs to zero | Quantized models and rotation tracks in `snorm16`, which the glTF spec allows for animation output, load incorrectly | WP-04 |
| D-03 | A mesh used by several glTF nodes renders once | `GLBLoader.ts:405` keeps only the first node, then bakes it into vertices | Violates spec text "The same mesh MAY be instantiated by multiple nodes"; hierarchy is lost, so nodes cannot animate | WP-24 |
| D-04 | Lighting allocates every 3D pass | `src/rendering/lighting.ts:82-87` builds a template string per light; `src/rendering/BrioCompositor.ts:442` calls it per source per frame | Contradicts the zero-allocation constraint in `architecture.md` and the rendering stone | WP-05 |
| D-05 | GPU memory cannot be freed before `end()` | `src/rendering/WebGL2Backend.ts:191-193` holds every buffer and texture strongly; `RenderBackend` has no release method | Changing scenes leaks VRAM for the session | WP-30 |
| D-06 | `BrioTransform3D.opacity` has no visual effect | `RenderBackend.renderMesh3D` has no opacity parameter; `WebGL2Backend.ts:413,555` reads only `material.opacity` | Per-object fade is silently a no-op | WP-05 |
| D-07 | Shader failure throws inside a frame | `WebGL2Backend.ts:730-783`: synchronous compile, always checks status, throws from `#draw` | First use of a variant hitches, and a bad variant can break the frame. MDN says not to check compile status unless link fails | WP-15 |
| D-08 | Textures have one fixed setup | `WebGL2Backend.ts:712-718`: always `SRGB8_ALPHA8`, `REPEAT`, trilinear | Normal and metallic-roughness data would be decoded as sRGB, and glTF samplers are ignored | WP-13 |
| D-09 | One `drawImage` copy per 3D camera pass | `WebGL2Backend.ts:814-835` | Cost scales with cameras; transparent clears erase 2D content under the viewport | WP-11 |
| D-10 | Per-draw uniforms repeat per-pass data | `WebGL2Backend.ts:403-404,545-546`: view-projection copied per item and uploaded per draw | Avoidable CPU cost; three and Unity keep per-frame data separate | WP-11 |
| D-11 | Static layer cache is invalidated by any camera move | `BrioCompositor.ts:345-355` compares camera position | A scrolling `"static"` layer redraws every frame, so it never pays off during movement | WP-38 |
| D-12 | 2D culling turns off in common cases | `BrioCompositor.ts:259`: disabled when rotated or `game.scale !== 1` | Large 2D scenes pay for off-screen sprites | WP-03 |
| D-13 | `BrioAnimation` holds playback state in the clip | `src/assets/BrioAnimation.ts:44-47` | One clip cannot drive two objects independently | WP-29 |
| D-14 | Changing `sprite` always marks dirty | `src/objects/BrioObject2D.ts:121-124`, called each frame by `BrioAnimation.apply` | An animated sprite keeps invalidating its static layer even when the frame did not change | WP-05 |
| D-15 | IndexedDB writes resolve before commit, and quota errors escape | `src/storage/BrioStorage.ts:141`: resolves on request success, MDN defines commit through `complete`; `:280`: no handling of `QuotaExceededError`; no `onblocked` | A save can report success before the transaction commits, and a full store throws into game code | WP-33 |
| D-16 | One global database per origin | `BrioStorage.ts:56,247` | Two games on one origin overwrite each other | WP-33 |
| D-17 | Snapshots cannot be restored in a new session | ADR 0002 lists `flip`, sprite, mesh, material, collision and hierarchy outside the ECS; captures hold live object references | "Save to disk, reload page, continue" is not possible today | WP-10, WP-34 |
| D-18 | Scenes have no fixed step | `BrioScene` exposes only `onUpdate`; `BrioGame.#runFixedSteps` has a single game-level callback (`BrioGame.ts:1303-1313`) | Scene physics runs on variable `dt` or must live in game code | WP-05 |
| D-19 | Interpolation covers position of roots only | `BrioGame.ts:1333`, `:1321-1330` | Rotating objects stutter when `interpolate` is on | WP-05 |
| D-20 | `instantiate` accepts only 2D | `BrioGame.ts:2182` | No 3D prefab path, although the glossary defines Prefab for both | WP-05 |
| D-21 | Unused memory per slot | `src/ecs/ComponentStorage.ts`: 222 bytes per slot, of which `collider` and `rigidBody` (72 bytes) are unused | At the default 4096 capacity, each scene world allocates about 909 KB, of which about 295 KB is never read | WP-46 |

Documentation drift, separate from code: `src/physics/.stone.physics.md:66`, `src/input/.stone.input.md:77`, `src/audio/.stone.audio.md:72` and `src/math/.stone.math.md:76-77` describe default-namespace names as `src/index.ts` exports; `src/assets/.stone.assets.md:42` says `SpriteSourceRect` is not exported, while `src/index.ts:77` exports it; `src/math/.stone.math.md:73-75` contradicts its own frontmatter; `src/game/.stone.game.md` omits `cameras` from `depends_on`; `docs/ROADMAP.md:34` still lists the fixed short-tap issue. WP-00 fixes them.

## 4. Gap matrix

Legend for BrioJS: **Yes**, **Partial**, **No**. "Not read" and "Not consulted" mean this study has no evidence for that cell, not that the feature is absent. Decision is what the plan does.

### 4.1 Render architecture

Base: [three.js notes](../../temp/research/three-js.md#render-loop), [`WebGLRenderer.js`](../../temp/repos/three.js/src/renderers/WebGLRenderer.js), [`WebGLRenderLists.js`](../../temp/repos/three.js/src/renderers/webgl/WebGLRenderLists.js), [`WebGLProgram.js`](../../temp/repos/three.js/src/renderers/webgl/WebGLProgram.js), [`InstancedMesh.js`](../../temp/repos/three.js/src/objects/InstancedMesh.js), [`renderer_scene_cull.h`](../../temp/repos/godot/servers/rendering/renderer_scene_cull.h), [Unity notes](../../temp/research/unity.md#rendering), [Unreal notes](../../temp/research/unreal.md#materials), [NVIDIA notes](../../temp/research/nvidia.md#instancing-and-crowds).

| Capability | BrioJS | three.js | Godot | Unity / Unreal / NVIDIA | Decision |
| --- | --- | --- | --- | --- | --- |
| Render list sort | Yes, inside the backend | `WebGLRenderLists.js:1-51`: group, order, material, z; transparent back-to-front | Not read | Unity SRP Batcher groups by shader variant | Move to shared `RenderList`, sort by packed key |
| Per-object frustum culling | No | `WebGLRenderer.js:1873-1941` | `DynamicBVH` in `renderer_scene_cull.h:341` | NVIDIA crowd culls on CPU first | Add bounding spheres, cull over SoA arrays |
| Frame and camera UBO | No, lights only | `WebGLUniformsGroups.js` | Not read | Unity persistent per-material buffers | Add frame UBO, then material UBO |
| Instancing | No | `InstancedMesh`, `BatchedMesh` | `MultiMesh`, `multimesh_instance_3d` | GPU Gems 2 ch. 3; Unity: not for skinned meshes | `BrioInstancedMesh` plus auto-instancing in the list |
| LOD | No | `LOD.js` | `lod_bias`, visibility range `renderer_scene_cull.h:422,459-463` | Unity crossfade with `unity_LODFade`; Unreal HLOD | `BrioLOD` by distance; crossfade later |
| Render targets | No | `WebGLRenderTarget` | `SubViewport` | Not consulted | Required for shadows, post and minimap |
| Async shader compile | No (D-07) | `WebGLProgram.js:951-960` | Ubershaders in RD | Unreal PSO precaching, Unity prewarm | Parallel compile plus explicit warm-up |
| Context loss | Untested | Listener at `WebGLRenderer.js:405` | Not read | n/a | Test in the browser rig |
| Depth precision | Standard | `EXT_clip_control` optional, `WebGLCapabilities.js:95` | No match searching `renderer_rd` for reverse-Z | NVIDIA: reversed-Z needs clip control | Post-TCC |
| Backend set | WebGL2, Canvas2D | WebGL2, WebGPU | Vulkan, D3D12, Metal, GLES3 | caniuse: Firefox off by default, Safari macOS partial | Stay on WebGL2 for the TCC; keep the contract open |

### 4.2 Lights and shadows

Base: [three.js notes](../../temp/research/three-js.md#shadows), [`WebGLShadowMap.js`](../../temp/repos/three.js/src/renderers/webgl/WebGLShadowMap.js), [`WebGLLights.js`](../../temp/repos/three.js/src/renderers/webgl/WebGLLights.js), [`csm/`](../../temp/repos/three.js/examples/jsm/csm), [`rendering_server.cpp`](../../temp/repos/godot/servers/rendering/rendering_server.cpp), [`light_3d.h`](../../temp/repos/godot/scene/3d/light_3d.h), [NVIDIA notes](../../temp/research/nvidia.md#shadows), [PCSS text](../../temp/research/sources/nvidia-pcss.txt), [KHR_lights_punctual](../../temp/research/sources/khr-lights-punctual.md).

| Capability | BrioJS | three.js | Godot | Unity / Unreal / NVIDIA | Decision |
| --- | --- | --- | --- | --- | --- |
| Directional, ambient, hemisphere | Yes, 4 directional | Yes | Yes | Not consulted | Keep |
| Point, spot | No | `PointLight`, `SpotLight` | `light_3d` | Not consulted | Add |
| Light limits | 4, constant | Counts in program key, `WebGLPrograms.js:350-358,488-489`, so count changes compile a new program | Fixed defaults: 32 renderable, 8 per object (`rendering_server.cpp:3834-3835`) | Unity variant cost warning | Follow Godot: fixed capacity, no recompile when counts change |
| Shadow maps | No | `WebGLShadowMap.js`: PCF with `sampler2DShadow` | Atlas, size 4096 (2048 mobile), quality levels | Not consulted | Atlas with PCF |
| Cascades | No | `csm/CSM.js` | Yes | PSSM practical split, default weight 0.5; Unity: more cascades, more draw calls | Up to 4 cascades, cull casters per split |
| Soft shadows | No | VSM optional | Filter levels | PCSS three-step, VSM light bleeding "cannot be completely solved" | PCF by default, PCSS optional; VSM rejected as default |
| Static shadow cache | No | `autoUpdate`, `needsUpdate` at `WebGLShadowMap.js:95` | Not read | n/a | Same flags, big win for static scenes |
| glTF lights | No | `KHR_lights_punctual` | Yes | n/a | Import |

### 4.3 Cameras

Base: [`controls/`](../../temp/repos/three.js/examples/jsm/controls), [`Layers.js`](../../temp/repos/three.js/src/core/Layers.js), [`camera_3d.h`](../../temp/repos/godot/scene/3d/camera_3d.h), [`viewport.h`](../../temp/repos/godot/scene/main/viewport.h).

| Capability | BrioJS | three.js | Godot | Unity / Unreal / NVIDIA | Decision |
| --- | --- | --- | --- | --- | --- |
| 2D follow, shake, bounds | Yes | n/a | `camera_2d` | Not consulted | Keep; inject `game.random` in scenes |
| 3D controllers | No | `controls/`: Orbit, FirstPerson, PointerLock, Map | Not read | Not consulted | Port Orbit and PointerLock, add third-person |
| 3D follow, shake | No | Not read | Not read | Not consulted | Add to `BrioCamera3D` |
| Layer masks | No | `src/core/Layers.js` | `set_cull_mask`, `camera_3d.h:178` | Not consulted | 32-bit mask in `visual` slot |
| Render to texture | No | `WebGLRenderTarget` | `scene/main/viewport.h` | Not consulted | Minimap, mirrors, UI previews |
| Clear without objects | Partial | n/a | n/a | n/a | `BrioCompositor.ts:439` skips the clear when no 3D object exists; fix |

### 4.4 Materials and shaders

Base: [shader authoring notes](../../temp/research/shader-authoring.md), [three.js notes](../../temp/research/three-js.md#programs-and-custom-shaders), [`ShaderMaterial.js`](../../temp/repos/three.js/src/materials/ShaderMaterial.js), [`Material.js`](../../temp/repos/three.js/src/materials/Material.js), [`WebGLPrograms.js`](../../temp/repos/three.js/src/renderers/webgl/WebGLPrograms.js), [`ShaderChunk/`](../../temp/repos/three.js/src/renderers/shaders/ShaderChunk), [Godot notes](../../temp/research/godot.md#shader-model), [`shader_types.cpp`](../../temp/repos/godot/servers/rendering/shader_types.cpp), [`material.h`](../../temp/repos/godot/scene/resources/material.h), [Unreal notes](../../temp/research/unreal.md#materials), [Unity notes](../../temp/research/unity.md#rendering), [glTF specification](../../temp/research/sources/gltf-spec.adoc).

| Capability | BrioJS | three.js | Godot | Unity / Unreal / NVIDIA | Decision |
| --- | --- | --- | --- | --- | --- |
| Models | Unlit, flat, Lambert | Basic, Lambert, Phong, Standard, Physical, Toon, Matcap | `BaseMaterial3D` | Metal-rough standard | Add `"standard"` and `"toon"` |
| Texture slots | Base color | All glTF | All | Not consulted | Normal, metallic-roughness, occlusion, emissive |
| Alpha blend per texel | Approximated (`GLBLoader.ts:605-612`) | Yes | Yes | Not consulted | Real blend, sorted transparent list |
| Custom shader API | No | `ShaderMaterial`, `RawShaderMaterial` | `shader_type` with `vertex`, `fragment`, `light` and typed built-ins (`shader_types.cpp`) | Authoring tools not read | Godot-shaped hooks in GLSL ES 3.00, three-style raw escape hatch |
| Patch built-in material | No | `onBeforeCompile`, `customProgramCacheKey` (`Material.js:533,544`) | Not read | Not consulted | Named injection points |
| Parameters without recompile | No | Uniform objects | `set_shader_parameter` | Unreal instances; "A new Material is compiled for every combination of static parameters" | Dynamic parameters are uniforms; compile-time options are explicit and warned about |
| Variant discipline | Bitmask | Key string | Modes | Unity: "combinatorial explosion", ten keywords give 1024 | Keep a numeric key, report active variant count in stats |

Custom shader authoring across engines, which shaped decisions 8, 8a and 8b of the plan:

| Aspect | three.js | Godot | Unity | Unreal | BrioJS decision |
| --- | --- | --- | --- | --- | --- |
| Language | GLSL | Own GLSL-like language | HLSL in ShaderLab | HLSL in Custom node and files | Standard GLSL ES 3.00; files stay valid GLSL |
| Parameter declaration | Twice: JS `uniforms` and GLSL | In shader, with hints | `Properties` block plus shader code | Material parameters | In GLSL, comment annotations for hints |
| Setting values | `material.uniforms.x.value` | `set_shader_parameter` | `SetFloat` and similar; IDs for speed | Material instance dynamic | `set()`, plus an allocation-free `parameter()` handle |
| Wrong type | Not read | "no error will be thrown" | Editor warnings on textures | Not read | Warn once and ignore |
| Includes | `#include <chunk>` | `.gdshaderinc`, depth 25, no cycles | `#include` | Include File Paths | `<brio/...>` and relative files, depth 25, no cycles |
| On compile error | Logs source context, `onShaderError` | Not read | Not read | Retry in development, fallback materials | Log with file and line; last good program or error material |
| Program lifetime | `usedTimes` count, stage cache by code | `RID` resources | Not read | Keyed by input hash | Hash plus count |

The WebGL specification sets the safety floor: implementations must prevent out-of-bounds and uninitialized access by draws, out-of-range shader reads stay inside program storage with unspecified values, and denial of service cannot be prevented by structural limits on shaders. So BrioJS's guards protect engine state, resource lifetime and error handling, and its docs state plainly what remains undefined.

### 4.5 Scenes

Base: [Unity notes](../../temp/research/unity.md#scenes), [Unreal notes](../../temp/research/unreal.md#level-streaming), [Godot notes](../../temp/research/godot.md#architecture), [`scene_tree.h`](../../temp/repos/godot/scene/main/scene_tree.h), [`resource_loader.h`](../../temp/repos/godot/core/io/resource_loader.h), [`LoadingManager.js`](../../temp/repos/three.js/src/loaders/LoadingManager.js), [`RenderTransitionPass.js`](../../temp/repos/three.js/examples/jsm/postprocessing/RenderTransitionPass.js).

| Capability | BrioJS | three.js | Godot | Unity / Unreal | Decision |
| --- | --- | --- | --- | --- | --- |
| Separate scenes | Yes, own ECS world | `Scene` objects | Packed scenes | Not consulted | Keep; it matches snapshots |
| Replace scene | Yes, `setScene` | App code | `change_scene_to_*`, deferred swap (`scene_tree.h:207-219,432-436`) | `LoadSceneMode.Single` | Keep as the simple path |
| Additive load | No (`BrioGame.ts:1428` pushes one source) | App code | `add_child` | `LoadSceneMode.Additive`; Unreal sublevels | Compositor already takes a list, so extend it |
| Load without activating | No | n/a | Threaded load status | Unity holds at 0.9 until `allowSceneActivation`; World Partition "Loaded or Activated" | `activate: false` with an explicit `allowActivation` |
| Progress | No | `LoadingManager` | Progress pointer in `resource_loader.h:76` | `AsyncOperation.progress` | `BrioSceneLoadOperation` |
| Active scene semantics | One | n/a | `current_scene` | Unity: active scene receives new objects, supplies render settings | Same rule |
| Persistent content | Game-level registries | n/a | Autoloads | `DontDestroyOnLoad` | Existing game source already acts this way; document |
| Transitions | No | `RenderTransitionPass` | Not read | Not consulted | Built-in fade first, shader wipe after post-processing |
| Spatial streaming | No | n/a | Not read | Unreal grid cells and streaming sources | Post-TCC |

### 4.6 Asset lifecycle

Base: [`LoadingManager.js`](../../temp/repos/three.js/src/loaders/LoadingManager.js), [`Cache.js`](../../temp/repos/three.js/src/loaders/Cache.js), [`ImageBitmapLoader.js`](../../temp/repos/three.js/src/loaders/ImageBitmapLoader.js), [`resource_loader.h`](../../temp/repos/godot/core/io/resource_loader.h).

| Capability | BrioJS | three.js | Godot | Unity / Unreal | Decision |
| --- | --- | --- | --- | --- | --- |
| Preload | `Promise.all`, sequential groups | `LoadingManager`, `Cache` | `ResourceLoader` cache modes | Not consulted | Asset manager v2 |
| Reference counting | No | Manual `dispose()` | `RefCounted` | Unity `UnloadUnusedAssets` after Single load | Count per scene, release on unload |
| Dedup | Texture URI only | `Cache`, `getDependency` by type and index | Path cache | Not consulted | Dedup every asset by URL plus options |
| Worker decode | No | `ImageBitmapLoader` | Threaded load states | Not consulted | `createImageBitmap` now; GLB parse in a worker post-TCC |

### 4.7 Storage

Base: [storage facts](../../temp/research/standards.md#storage-mdn), [Unity persistence](../../temp/research/unity.md#persistence), [Unreal saves](../../temp/research/unreal.md#saves), [`config_file.h`](../../temp/repos/godot/core/io/config_file.h).

| Capability | BrioJS | three.js | Godot | Unity / Unreal | Decision |
| --- | --- | --- | --- | --- | --- |
| Memory, session, local, IndexedDB | Yes | n/a | n/a | PlayerPrefs on IndexedDB | Fix D-15, D-16; add `keys()`, namespaces |
| External file | No | n/a | `FileAccess`, `ConfigFile` with sections and optional encryption | `persistentDataPath`; Unreal `SaveGameToMemory` | `BrioStorage.file` with export and import |
| Save slots | No | n/a | User code | Unreal `USaveGame`, slot name, async recommended | `BrioSaveManager` |
| Versioned migration | Snapshot format only | n/a | Manual | Unity `JsonUtility`: missing fields keep defaults | Per-save version plus migrators; merge on load |
| Reactive state | No | n/a | Autoload singletons | n/a | `BrioStateStore` with a tier per key |
| Persistence request | No | n/a | n/a | MDN: `persist()`, `estimate()`, Safari 7-day eviction | Expose both; show the fact in docs |

File APIs: MDN marks `showSaveFilePicker` as limited availability, requiring a secure context and a user gesture. So export falls back to a Blob download, and import uses `<input type="file">`. OPFS is widely available since March 2023 and suits autosaves.

### 4.8 Animation

Base: [three.js notes](../../temp/research/three-js.md#animation), [`AnimationMixer.js`](../../temp/repos/three.js/src/animation/AnimationMixer.js), [`PropertyMixer.js`](../../temp/repos/three.js/src/animation/PropertyMixer.js), [`Skeleton.js`](../../temp/repos/three.js/src/objects/Skeleton.js), [`skinning_pars_vertex.glsl.js`](../../temp/repos/three.js/src/renderers/shaders/ShaderChunk/skinning_pars_vertex.glsl.js), [Godot notes](../../temp/research/godot.md#animation), [`animation_mixer.h`](../../temp/repos/godot/scene/animation/animation_mixer.h), [`animation_node_state_machine.h`](../../temp/repos/godot/scene/animation/animation_node_state_machine.h), [`skeleton_3d.h`](../../temp/repos/godot/scene/3d/skeleton_3d.h), [Unity notes](../../temp/research/unity.md#animation), [Unreal notes](../../temp/research/unreal.md#animation), [Skinned Instancing text](../../temp/research/sources/nvidia-skinned-instancing.txt).

| Capability | BrioJS | three.js | Godot | Unity / Unreal / NVIDIA | Decision |
| --- | --- | --- | --- | --- | --- |
| Sprite frames | Yes (D-13) | n/a | `animated_sprite_2d` | Not consulted | Split clip from player |
| Tweens and easings | `BrioTimer.tween` with no easing | No tween class in `src/animation` | `tween.h`, `easing_equations.h` | Not consulted | `BrioTween` |
| Skeleton | No | `Skeleton.js`, bones are `Object3D` | `skeleton_3d`, bones as indexed data | Unreal Mass batches | Godot-shaped: indexed SoA, not one object per bone |
| GPU skinning | No | Bone texture, `texelFetch` (`Skeleton.js:263`, `skinning_pars_vertex`) | Transform feedback, `skeleton.glsl` | NVIDIA palette skinning | three's bone texture: smallest and simplest in WebGL2 |
| Clip sampling | No | Interpolants, cubic in `GLTFLoader.js:2181-2253` | Track caches | glTF Appendix C | Implement from the spec with cursor cache |
| Mixing | No | `PropertyMixer.js:35` weighted accumulate | `animation_mixer.h:144` | Unity layers: override, additive, masks | Pose buffers, layers, per-bone masks |
| State machine | No | App code | `animation_node_state_machine.h` | Unity: exit time, conditions, duration, Any State | Data-defined `BrioAnimationStateMachine` |
| Blend spaces | No | App code | `animation_blend_space_1d/2d` | Unreal: samples on axes, triangulation | 1D first, 2D with triangulation after |
| Root motion | No | App code | `root_motion_view` | Unity: per-frame root delta | Delta applied to the owner transform |
| Morph targets | No | `WebGLMorphtargets` | Blend shapes | glTF spec | Data texture |
| Attachments | No | Child of bone | `bone_attachment_3d` | Sockets | `animator.attach(bone, object)` |
| Budgeting | No | No | Callback modes | Unreal URO "15Hz and under", Budget Allocator | `updateRate` per animator |
| Crowds | No | No | No | NVIDIA animation texture: 160 instanced draws vs 59,726 | Post-TCC, unless a demo needs it |

### 4.9 glTF coverage

Base: [glTF specification](../../temp/research/sources/gltf-spec.adoc) (skins at line 2091, animations at line 3066, interpolation at line 3993), [glTF facts](../../temp/research/standards.md#gltf-20-sourcesgltf-specadoc-line-numbers-refer-to-that-file), [`GLTFLoader.js`](../../temp/repos/three.js/examples/jsm/loaders/GLTFLoader.js), [`gltf_document.cpp`](../../temp/repos/godot/modules/gltf/gltf_document.cpp), [KHR_texture_transform](../../temp/research/sources/khr-texture-transform.md).

Implemented: GLB and JSON containers, buffers, base color factor and texture, alpha modes, double-sided, node transforms baked, generated normals, loader limits.

Missing and planned: accessor types (D-02), sparse, `normalized`, node tree (D-03), skins, animations, morph targets, tangents with MikkTSpace fallback by derivative frame, `COLOR_0`, `TEXCOORD_1`, samplers, material textures, `KHR_lights_punctual`, `KHR_materials_unlit`, `KHR_materials_emissive_strength`, `KHR_texture_transform`, `KHR_mesh_quantization`. Plugins post-TCC: `KHR_draco_mesh_compression`, `EXT_meshopt_compression`, `KHR_texture_basisu`.

New loader limits are needed for joints, animation channels, keyframes and morph targets, keeping the hostile-file invariant of the assets stone.

### 4.10 2D

Base: [Godot 2D notes](../../temp/research/godot.md#2d), [`rasterizer_canvas_gles3.h`](../../temp/repos/godot/drivers/gles3/rasterizer_canvas_gles3.h), [`tile_map_layer.h`](../../temp/repos/godot/modules/tilemap/tile_map_layer.h), [`light_2d.h`](../../temp/repos/godot/scene/2d/light_2d.h), [`cpu_particles_2d.h`](../../temp/repos/godot/scene/2d/cpu_particles_2d.h), [Unity notes](../../temp/research/unity.md#rendering).

| Capability | BrioJS | three.js | Godot | Unity / Unreal | Decision |
| --- | --- | --- | --- | --- | --- |
| Renderer | Canvas2D, `save`/`restore` per sprite (`BrioSpriteRenderer.ts:142-215`) | Sprite objects | Instanced batches broken on state change (`rasterizer_canvas_gles3.h:250,362-363`), buffer 16384 | Unity Chunk mode | GPU batcher, Canvas2D stays as fallback |
| Text | FPS overlay only (`BrioSpriteRenderer.ts:494`) | Textures, `TextGeometry` | `label`, `rich_text_label` | Not consulted | `BrioText` rasterized through Canvas2D |
| Tile rendering | No | n/a | Quadrants of 16 (`tile_map_layer.h:399`) | Unity Chunk vs Individual | Chunks of 16, y-sort mode |
| Tiled or LDtk | No | n/a | Importers | n/a | Tiled JSON first |
| Tint, blend modes | No | Yes | `CanvasItem.modulate`, `blend_*` | Not consulted | Add |
| Shapes, lines, nine-slice | No | n/a | `polygon_2d`, `line_2d`, `nine_patch_rect` | Not consulted | Add |
| 2D lights | No | n/a | `light_2d.h`, `light_occluder_2d` | Unity: spot, sprite, freeform, global | Point and global with normal maps; occluders later |
| 2D shaders | No | n/a | `canvas_item` hooks | Not consulted | Shares the shader API |
| Particles | No | Examples | `cpu_particles_2d` | Not consulted | CPU SoA plus instanced draw |

### 4.11 UI

Base: [Godot UI notes](../../temp/research/godot.md#ui), [`scene/gui/`](../../temp/repos/godot/scene/gui), [`control.h`](../../temp/repos/godot/scene/gui/control.h).

BrioJS has only the `"ui"` layer policy. Godot's `scene/gui` confirms the useful minimum: control with anchors, containers, label, button, panel, nine-patch, progress bar, slider. Decision: a small `BrioUI` over `"ui"` layers, with pointer, keyboard and gamepad focus. A DOM overlay was considered and rejected because it does not work inside the compositor and does not survive `OffscreenCanvas`.

### 4.12 Post-processing

Base: [`postprocessing/`](../../temp/repos/three.js/examples/jsm/postprocessing), [`FXAAShader.js`](../../temp/repos/three.js/examples/jsm/shaders/FXAAShader.js), [FXAA text](../../temp/research/sources/nvidia-fxaa.txt), [WebGL facts](../../temp/research/standards.md#webgl-mdn-best-practices-khronos-khr_parallel_shader_compile-rev-6).

three's `EffectComposer` chain shows the needed set: `RenderPass`, `OutputPass`, `FXAAPass`, `UnrealBloomPass`, `LUTPass`, `RenderPixelatedPass`, `RenderTransitionPass`. HDR targets need `EXT_color_buffer_float` or `EXT_color_buffer_half_float` (`WebGLExtensions.js:33-36`). MSAA targets use `renderbufferStorageMultisample` (`WebGLTextures.js:1797`). NVIDIA's FXAA paper requires "non-linear (perceptually encoded) RGB input", so FXAA runs after tone mapping. MDN recommends `invalidateFramebuffer` for discarding attachments.

### 4.13 Physics

Base: [`scene/3d/physics/`](../../temp/repos/godot/scene/3d/physics), [`character_body_3d.h`](../../temp/repos/godot/scene/3d/physics/character_body_3d.h), [`area_3d.h`](../../temp/repos/godot/scene/3d/physics/area_3d.h).

BrioJS has an opt-in rigid body, narrow-phase collision and broad phase, and no integration with the frame. Godot's `CharacterBody`, `Area` and raycast shape the game-facing needs: automatic stepping, trigger enter/stay/exit events, raycasts and a kinematic controller. Decision: a physics system over the `collider` and `rigidBody` buffers (D-21). The existing stride of 10 floats fits velocity 3, acceleration 3, mass, friction, restitution and flags. A full contact solver stays out of scope.

### 4.14 Input and audio

Base: [`virtual_joystick.h`](../../temp/repos/godot/scene/gui/virtual_joystick.h), [`audio_stream_player_2d.h`](../../temp/repos/godot/scene/2d/audio_stream_player_2d.h), [`audio_listener_2d.h`](../../temp/repos/godot/scene/2d/audio_listener_2d.h), [`PointerLockControls.js`](../../temp/repos/three.js/examples/jsm/controls/PointerLockControls.js).

- Input gaps: Pointer Lock, action map, synthetic input, virtual joystick (`scene/gui/virtual_joystick.h` exists in Godot), touch edges.
- Audio gaps: no `PannerNode` or `StereoPannerNode` in `src/` (search found none), no crossfade or ducking. The bus mixer stays; Godot's `audio_stream_player_2d` and `audio_listener_2d` confirm the shape.

### 4.15 ECS core

Base: [Unity ECS notes](../../temp/research/unity.md#ecs), [Unreal Mass notes](../../temp/research/unreal.md#mass-entity), [Godot architecture notes](../../temp/research/godot.md#architecture).

Unity and Unreal both store archetypes in chunks: Unity's are 16 KiB with a column per component and swap-remove; Unreal adds tags, chunk fragments, stateless processors and a command buffer applied at the end of a batch.

**Decision: do not adopt archetypes or chunks.** BrioJS's facades hold direct offsets into stable buffers, and the ECS stone makes that an invariant. Archetype moves would break both that and the O(1) slot-copy `instantiate`. Worlds are bounded (default 4096), and "Moving entities frequently is resource-intensive" per Unity itself. What BrioJS does adopt:

- deferred structural changes, as in Unity's command buffers and Unreal's `MassCommandBuffer`;
- ordered systems, as stateless processors over queries;
- dense per-mask index lists, so iteration skips dead slots without moving data;
- tags, as bits in `componentMasks`.

## 5. Adaptation rule: ECS core, OOP surface

Every new feature has to answer three questions: where its data lives, which facade exposes it, and whether snapshots capture it.

| Feature | ECS or pooled data | Public facade | In snapshot |
| --- | --- | --- | --- |
| Asset references, flags | `visual` stride: mesh or sprite id, material id, visibility, flags and layer mask | `object.mesh`, `object.material`, `object.sprite` keep string API | Yes, with a name table |
| 3D hierarchy | `parent` `Int32Array`, sorted update list | `addChild`, `children` | Parent yes, derived matrices no |
| World matrices | `worldMatrix3D` `Float32Array(capacity * 16)` in the 3D layout | `transform.worldMatrix` as a view | No, recomputed |
| 2D world transform | `worldMatrix2D` `Float32Array(capacity * 6)` | `transform.worldPosition` and friends | No, recomputed |
| Lights | New `light` stride | `BrioLight`, same public API, optional parent object | Yes |
| Skeleton pose | `BrioPosePool`: contiguous `Float32Array` of TRS per bone, plus matrices | `BrioAnimator`, `getBone()` returns a view | Time and state yes; pose derived |
| Bones | Indices, not entities | Named lookup | No |
| Colliders, bodies | Existing `collider`, `rigidBody` | `object.collision`, `BrioRigidBody` as views | Yes |
| Instances | Per-instance `Float32Array` | `BrioInstancedMesh.setMatrixAt` | Optional |
| Particles | SoA per emitter | `BrioParticleEmitter` | No by default |
| Sprite batching | Reads transform and visual arrays | Unchanged `BrioObject2D` | n/a |

Bones as indices is the most important difference from three. There, each bone is an `Object3D` updated through the scene graph. A model with 60 bones would consume 60 of the 4096 slots per character, and it would pay a facade per bone. Godot's approach of bones as indexed data inside `Skeleton3D` fits the ECS directly.

## 6. Optimization catalog

| Technique | Source | Applies to | WP |
| --- | --- | --- | --- |
| Pooled render items, packed sort keys | `WebGLRenderLists.js:82-118` | 3D and 2D lists | WP-11 |
| State cache, including textures and UBO bindings | `WebGLState`, `WebGLUniformsGroups.js:37-43` | Backend | WP-11 |
| Bounding-sphere culling before submission | `WebGLRenderer.js:1903-1941`; NVIDIA crowd CPU culling | 3D passes | WP-12 |
| Light state with no program change | Godot fixed limits; contrast with three's key | Lights | WP-16 |
| Parallel compile, link, deferred status | `WebGLProgram.js:951-960`; MDN; Khronos | Programs | WP-15 |
| Warm-up with fallback while compiling | Unreal PSO precaching, Unity prewarm | Scene load | WP-15 |
| `texStorage` plus `texSubImage` | MDN | Textures | Already used, keep |
| Avoid changing VAO attachments | MDN | Mesh v2 | WP-13 |
| Bone texture via `texelFetch`, no filtering | `Skeleton.js:263` | Skinning | WP-25 |
| Animation binding by index, cached cursors | Godot `TrackCache`; three `PropertyMixer` buffers | Animator | WP-26 |
| Accumulate weighted poses in preallocated buffers | `PropertyMixer.js:35` | Layers | WP-26 |
| Update-rate reduction by distance | Unreal URO | Animator | WP-27 |
| Static shadow maps updated on demand | `WebGLShadowMap.js:95` | Shadows | WP-20 |
| Shadow casters culled per cascade | PSSM chapter | Shadows | WP-20 |
| 2D instanced quads with batch breaks | Godot `rasterizer_canvas_gles3` | 2D | WP-35 |
| Tile chunks | Godot quadrants, Unity Chunk mode | Tiles | WP-38 |
| Discard attachments | MDN `invalidateFramebuffer` | Post | WP-42 |
| Asynchronous readback | MDN `fenceSync` | Frame capture | WP-48 |
| Deferred structural changes | Unity command buffers, Unreal `MassCommandBuffer` | ECS | WP-09 |

## 7. Third-party use policy

Base: [`three.js/LICENSE`](../../temp/repos/three.js/LICENSE), [`godot/LICENSE.txt`](../../temp/repos/godot/LICENSE.txt), [`godot/COPYRIGHT.txt`](../../temp/repos/godot/COPYRIGHT.txt).

Recorded as ADR 0007 by WP-01. This changes the previous line in `RENDERING_STUDY_THREEJS.md`, "BrioJS reimplements techniques, not code".

| Source | License seen | Allowed | Conditions |
| --- | --- | --- | --- |
| three.js | MIT | Direct port and adaptation | Keep the copyright and permission notice in `THIRD_PARTY_NOTICES.md`, shipped in the package, and mark ported files |
| Blocks inside three's shaders | Various upstream credits (Filament, Hill, others) | Port with credit | Preserve upstream comments; check the source before copying a block with an unclear origin |
| Godot | MIT (Expat) | Direct port and adaptation | `COPYRIGHT.txt` has per-file exceptions, such as `easing_equations.h` with Penner, `convex_hull`, `gjk_epa`, `trail_3d` and `thirdparty/`. Check each file first |
| Unity | Proprietary | Concepts from public documentation | Own implementation. No code, no reference source, no assets |
| Unreal | Proprietary, EULA | Concepts from public documentation | Own implementation. Do not read Unreal source for this work |
| NVIDIA | Book and paper copyright; GPU Gems 2 "All rights reserved" | Algorithms | Own implementation. Do not copy listings. Before reusing three's FXAA shader, check the upstream port's terms (`FXAAShader.js:11` credits Flick and Hoskins) or write the pass from the paper |

Project requirement stays: no runtime dependency (ADR 0001). Porting code is not adding a dependency.

## 8. Considered and rejected for the TCC

| Option | Why not now |
| --- | --- |
| Adopt three.js as renderer | ADR 0001 already rejected this; its scene graph conflicts with the ECS |
| Port TSL or the node material system | Bulk of three's size, and hand-written GLSL fits the budget |
| WebGPU backend | Firefox off by default and Safari macOS partial per caniuse; WebGL2 covers every demo; two backends double each feature. Contract stays ready |
| WebGL1 backend | Blocks UBO, instancing, `texelFetch` and sRGB textures that all planned features use. Canvas2D stays the safety net |
| Workers and `OffscreenCanvas` | Large cross-cutting risk with no demo value. ADR 0003 stays as target |
| Archetype ECS | See section 4.15 |
| Deferred shading, clustered lights | Forward with fixed limits matches the content; Godot uses the same limits in GLES3 |
| VSM as default | NVIDIA documents light bleeding that "cannot be completely solved without taking more samples" |
| Visual shader graph | Text shaders serve the teaching goal and the TCC demo; the graph is a future tool |
| DOM-based UI | See section 4.11 |

## 9. Sources

- three.js: <https://github.com/mrdoob/three.js> (`fa01dd6`). Godot: <https://github.com/godotengine/godot> (`95c0fa5`).
- Unity: [LoadSceneAsync](https://docs.unity.com/en-us/engine/current/script-reference/unityengine/scenemanagement/scenemanager/loadsceneasync), [allowSceneActivation](https://docs.unity.com/en-us/engine/current/script-reference/unityengine/asyncoperation/allowsceneactivation), [Set up multiple scenes](https://docs.unity.com/en-us/engine/current/manual/working-with-scenes/multi-scene-editing/setupmultiplescenes), [Archetypes](https://docs.unity3d.com/Packages/com.unity.entities@1.4/manual/concepts-archetypes.html), [Entity command buffers](https://docs.unity3d.com/Packages/com.unity.entities@1.4/manual/systems-entity-command-buffers.html), [SRP Batcher](https://docs.unity.com/en-us/engine/current/manual/analysis/graphics-performance-profiling/in-urp/reduce-draw-calls-urp/srpbatcher/srpbatcher), [GPU instancing](https://docs.unity.com/en-us/engine/current/manual/analysis/graphics-performance-profiling/reduce-draw-calls/gpuinstancing/gpuinstancing), [Shader variants](https://docs.unity.com/en-us/engine/current/manual/materials-and-shaders/shaders/shader-troubleshooting/shader-reducing/shader-variants/shader-variants), [Shadow cascades](https://docs.unity.com/en-us/engine/current/manual/lighting-overview/shadows/shadow-realtime/shadow-cascades/shadow-cascades), [LOD transitions](https://docs.unity.com/en-us/engine/6000.6/manual/analysis/graphics-performance-profiling/lod/lod-group/lod-transitions-lod-group), [Animation layers](https://docs.unity.com/en-us/engine/current/manual/animation-section/animation-mecanim/animation-animator-controller/animation-state-machines/animation-layers), [Transitions](https://docs.unity.com/en-us/engine/current/manual/animation-section/animation-mecanim/animation-animator-controller/animation-state-machines/class-transition), [Playables](https://docs.unity.com/en-us/engine/current/manual/animation-section/animation-mecanim/playables), [Root motion](https://docs.unity.com/en-us/engine/current/manual/animation-section/animation-mecanim/avatar-creationand-setup/root-motion), [JSON serialization](https://docs.unity.com/en-us/engine/current/manual/programming-environment/code-reload-serialization/script-serialization/json-serialization), [Tilemap Renderer](https://docs.unity.com/en-us/engine/current/manual/unity2d/tilemaps/reference/tilemap-renderer), [2D lights](https://docs.unity.com/en-us/engine/6000.0/manual/unity2d/2d-urp/2d-index/lights-2d-intro).
- Unreal: [Mass Entity](https://dev.epicgames.com/documentation/unreal-engine/overview-of-mass-entity-in-unreal-engine), [Level streaming](https://dev.epicgames.com/documentation/unreal-engine/level-streaming-in-unreal-engine), [World Partition](https://dev.epicgames.com/documentation/unreal-engine/world-partition-in-unreal-engine), [Blend spaces](https://dev.epicgames.com/documentation/unreal-engine/blend-spaces-in-unreal-engine), [Animation optimization](https://dev.epicgames.com/documentation/unreal-engine/animation-optimization-in-unreal-engine), [Instanced materials](https://dev.epicgames.com/documentation/unreal-engine/instanced-materials-in-unreal-engine), [PSO precaching](https://dev.epicgames.com/documentation/unreal-engine/pso-precaching-for-unreal-engine), [Saving and loading](https://dev.epicgames.com/documentation/unreal-engine/saving-and-loading-your-game-in-unreal-engine), [HLOD](https://dev.epicgames.com/documentation/unreal-engine/hierarchical-level-of-detail-in-unreal-engine).
- NVIDIA: [PSSM](https://developer.nvidia.com/gpugems/gpugems3/part-ii-light-and-shadows/chapter-10-parallel-split-shadow-maps-programmable-gpus), [Summed-Area VSM](https://developer.nvidia.com/gpugems/gpugems3/part-ii-light-and-shadows/chapter-8-summed-area-variance-shadow-maps), [PCSS](https://developer.download.nvidia.com/shaderlibrary/docs/shadow_PCSS.pdf), [Geometry instancing](https://developer.nvidia.com/gpugems/gpugems2/part-i-geometric-complexity/chapter-3-inside-geometry-instancing), [Animated crowds](https://developer.nvidia.com/gpugems/gpugems3/part-i-geometry/chapter-2-animated-crowd-rendering), [Skinned instancing](https://developer.download.nvidia.com/SDK/10/direct3d/Source/SkinnedInstancing/doc/SkinnedInstancingWhitePaper.pdf), [FXAA](https://developer.download.nvidia.com/assets/gamedev/files/sdk/11/FXAA_WhitePaper.pdf), [Depth precision](https://developer.nvidia.com/content/depth-precision-visualized).
- Shader authoring: [Unity ShaderLab Properties](https://docs.unity.com/en-us/engine/current/manual/materials-and-shaders/shaders/reference/sl-reference/sl-shader-object/sl-properties), [Unity includes](https://docs.unity.com/en-us/engine/current/manual/materials-and-shaders/shaders/writing-custom/shader-writing/sl/writing-shader-writing-shader-programs-hlsl/include-shader-program), [Unreal Custom expressions](https://dev.epicgames.com/documentation/unreal-engine/custom-material-expressions-in-unreal-engine), [Unreal shader development](https://dev.epicgames.com/documentation/unreal-engine/shader-development-in-unreal-engine), [Godot preprocessor](https://docs.godotengine.org/en/stable/tutorials/shaders/shader_reference/shader_preprocessor.html), [Godot shading language](https://docs.godotengine.org/en/stable/tutorials/shaders/shader_reference/shading_language.html), [WebGL 1 specification](https://registry.khronos.org/webgl/specs/latest/1.0/), [WebGL 2 specification](https://registry.khronos.org/webgl/specs/latest/2.0/).
- Transparency: [McGuire on WBOIT](https://casual-effects.blogspot.com/2014/03/weighted-blended-order-independent.html), [JCGT paper](https://jcgt.org/published/0002/02/09/).
- Standards: [glTF 2.0 source](https://github.com/KhronosGroup/glTF/tree/main/specification/2.0), [KHR_parallel_shader_compile](https://registry.khronos.org/webgl/extensions/KHR_parallel_shader_compile/), [WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices), [Storage quotas](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria), [File System API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API), [OPFS](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system), [showSaveFilePicker](https://developer.mozilla.org/en-US/docs/Web/API/Window/showSaveFilePicker), [IDBTransaction complete](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction/complete_event), [WebGPU support](https://caniuse.com/webgpu).
