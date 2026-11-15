# Game Lifecycle Study

Status: **Study / Proposed** (2026-11-15). Nothing in this document is implemented by it. The work packages are in [`GAME_LIFECYCLE_PLAN.md`](../plans/GAME_LIFECYCLE_PLAN.md). Rendering quality, WebGPU and upscaling have their own study, [`RENDER_QUALITY_AND_WEBGPU_STUDY.md`](./RENDER_QUALITY_AND_WEBGPU_STUDY.md), and the MCP package has its own plan, [`MCP_PACKAGE_PLAN.md`](../plans/MCP_PACKAGE_PLAN.md).

This study continues [`ENGINE_COMPLETION_STUDY.md`](./ENGINE_COMPLETION_STUDY.md). That study asked what the TCC demos needed. This one asks a wider question, after the presentation of 2026-11-13.

## 1. Scope and method

The question: **what is still missing for BrioJS to carry a complete game, from first prototype to a shipped build, in 2D and in 3D**, and which part of each missing capability belongs to the engine and which to the game developer.

The maintainer named the areas to cover: glTF and GLB animation, skeletal animation authored in the engine, rigging and skinning, optimizations for realistic graphics, WebGPU in the backend cascade, upscaling (DLSS, FSR, XeSS), particles, UI components with hooks for HTML, CSS, plain JavaScript or React, and the MCP server as a separate package.

Evidence used:

| Source | What was read | How |
| --- | --- | --- |
| BrioJS | `develop` at `995234a`: every document under `docs/`, the Key, `TODO.md`, `CHANGELOG.md`, and the source files cited in section 2 | Read in this session |
| Earlier studies | `ENGINE_COMPLETION_STUDY.md` and `ENGINE_COMPLETION_PLAN.md`, with their three.js (`fa01dd6`) and Godot (`95c0fa5`) line references | Read; **the references were not re-read**, see the limits below |
| Web platform | WebGPU implementation status, MCP specification and SDK, FSR, XeSS and NIS licenses, Web Audio, HTML-in-Canvas, React | Pages fetched on 2026-11-15, listed in section 9 of each document |

### Limits of this study

- **The local study base is absent.** `temp/research/` and the clones in `temp/repos/` are gitignored and exist only on the maintainer's machine. Every `three:` and `godot:` line reference in these documents is carried over from the earlier study, not checked again. A session that implements a package must recreate the clones (commands in `ENGINE_COMPLETION_STUDY.md` section 1) and read the source itself.
- **Nothing was built, run or measured.** Statements about the engine come from reading code. Budgets such as triangle counts are proposals until the benchmark harness of package F-03 exists.
- **Some facts could not be obtained** and are marked "not obtained" where they appear: the FSR 1 mip bias formula (the integration PDF could not be read), the list of restrictions of WebGPU compatibility mode, and the graphics APIs XeSS supports.
- **The reference games were not examined.** No binary, asset, source or decompiled material of any commercial game was read. Section 3 uses only the capability classes the maintainer described.
- Licensing notes are engineering practice, not legal advice.

## 2. The engine today

State of `develop` at `995234a`, checked in the code. "Sprint" refers to [`TCC_FINAL_SPRINT.md`](../plans/TCC_FINAL_SPRINT.md); its open items are still open and are absorbed by the plan.

| Area | Exists | Missing | Evidence |
| --- | --- | --- | --- |
| ECS | SoA storage, generational handles, O(1) pooling, one world per scene, capacity 4096 by default (`maxEntities`) | Systems, deferred structural changes, asset ids and hierarchy in buffers | `src/ecs/`, `src/game/BrioGame.ts:67` |
| Backends | WebGL2 and Canvas2D, loaded on demand; `BrioRenderer.registerBackend()` accepts asynchronous factories; `PlatformAdapter` detects `navigator.gpu` | A WebGPU backend; a shared layer two GPU backends can use | `src/rendering/BrioRenderer.ts`, `src/tools/PlatformAdapter.ts` |
| Render contract | Immediate calls: `beginFrame`, `setLights`, `setPassParameters`, `renderMesh3D` per object, `endFrame`; `releaseMesh`, `releaseTexture` | Render targets, a submitted render list, capabilities, instancing, a 2D path on the GPU | `src/rendering/contracts/RenderBackend.ts` |
| 3D shading | Unlit, flat, Lambert, `"standard"` with scalar roughness and metalness, emissive, fog, tone mapping in the fragment shader, anisotropic filtering | Normal, metallic-roughness, occlusion and emissive maps; tangents; vertex colors; real alpha blending; image-based lighting; toon | `src/rendering/WebGL2Backend.ts:62-67` (six feature bits) |
| Lights | 4 directional, 8 point or spot per pass, in a UBO | More lights per scene with per-object selection; light culling | `src/rendering/lighting.ts:5,8` |
| Shadows | One directional shadow map, PCF 3x3 | Cascades, spot and point shadows, static caching, skinning in the shadow pass | `src/rendering/WebGL2Backend.ts:1439` |
| Post-processing | None. Tone mapping is per material fragment | HDR target, MSAA control, effect chain, bloom, anti-aliasing, resolution scale | No framebuffer besides the shadow one |
| Custom shaders | `BrioShader` with `surface()` and `vertex()` hooks, `TIME`, `CAMERA_POSITION`, parameters, hot reload | `light()` hook, includes, custom varyings and attributes, `screen` and `canvas` domains, render state | `src/assets/BrioShader.ts` |
| Geometry | `positions`, `normals`, `uvs`, `indices`; box, plane, sphere, cylinder | Tangents, colors, second UV set, joints, weights, morph targets, mutable buffers, capsule, torus | `src/assets/BrioMesh.ts:19-25` |
| glTF | GLB and JSON containers, base color, alpha modes, baked node transforms, loader limits | Node tree, skins, animations, morph targets, samplers, material textures, extensions; accessor decoding is incomplete (D-02) | `src/assets/loaders/GLBLoader.ts:408,430` (skinned nodes are skipped) |
| Animation | `BrioAnimation` for sprite frames, with playback state inside the clip (D-13); `BrioTimer.tween` without easing | Everything skeletal; tweens with easing; state machines | `src/assets/BrioAnimation.ts`, `src/core/BrioTimer.ts:128` |
| Culling | Per-object frustum culling with bounding spheres in 3D; 2D culling with rotation and scale | Instancing, level of detail, distance and sector visibility, occlusion | `src/cameras/BrioCamera3D.ts:445` |
| 2D | Canvas2D sprites with hierarchy, layers, parallax, static caches, text, chunked tile maps | A GPU 2D renderer, tint, blend modes, shapes, nine-slice, particles, 2D lights, per-sprite shaders, deformable sprites | `src/game/BrioSpriteRenderer.ts` |
| UI | `"ui"` layers and `BrioText` | Widgets, layout, focus, a DOM bridge, dialogue | No `src/ui/` |
| Audio | Web Audio mixer with `master`, `bgm` and `sfx` buses, voice limit per sound, gesture unlock | Positional audio, a listener, custom buses, crossfade, ducking, reverb, occlusion, priorities | `src/audio/BrioAudioMixer.ts:4`; no `PannerNode` in `src/` |
| Physics | Collision events, opt-in `BrioRigidBody`, uniform-grid broad phase | A stepped physics system, a solver for solids, raycasts, a character controller, mesh colliders | `src/physics/.stone.physics.md` |
| Scenes and assets | One active scene, `setScene`, load progress, `unloadAsset`, reference counting on removal | A scene manager, additive loading, activation hold, transitions, streaming | `src/game/BrioGame.ts:2546` |
| Storage | Memory, session, local and IndexedDB adapters; binary snapshots, format v3; in-memory checkpoints | Save slots, files, OPFS, a state store, restore after a page reload (D-15, D-16, D-17) | `src/storage/` |
| Agent tooling | `game.step()`, seeded `game.random`, `game.renderStats` | Frame capture, input injection, introspection, scene documents, snapshot diff, the MCP package | `src/game/BrioGame.ts:1660` |

Two facts about the present design shape most of the plan:

1. **The 2D path never touches the GPU.** The showcase game Lumen Vigil draws its sprites as lit 3D quads to get lighting and shaders (`showcase/README.md:24`). That workaround is the evidence that GPU 2D (package T-01) is the base for 2D lights, particles at scale, per-sprite shaders and deformable sprites.
2. **The render contract is immediate and has no render targets.** Post-processing, cascaded shadows, resolution scaling, upscaling, minimaps and a second GPU backend all need the contract of package R-01 first.

## 3. Reference games as capability targets

The maintainer named three commercial games as study objects. The rule of this project applies in full:

- They are **targets for capability, not templates.** BrioJS does not reproduce their names, characters, art, levels, music, mechanics tuning or look.
- **No material of those games is an input**: no binaries, assets, extracted data, decompiled code or leaked source. The lists below contain only capability classes as the maintainer described them, each of which is a generic technique documented in public literature and in MIT-licensed engines.
- When a package needs a test scene, it uses original content or assets with a checked license (see `ENGINE_COMPLETION_PLAN.md` section 9, asset licenses).

Each row answers: what the capability is, whether the engine has it, what the engine should own, what stays with the developer, and the package that delivers the engine part.

### 3.1 Stylized 3D platformer class (the maintainer's first example)

Described as: shaders in the style of fifth-generation consoles, a focused 3D camera, skeletal animation, deliberately limited lighting, and movement physics such as wall jumping and sliding. The maintainer notes that much of this already works.

| Capability | Engine today | Engine responsibility | Developer responsibility | Package |
| --- | --- | --- | --- | --- |
| Low-resolution rendering with nearest upscale | `BrioTexture.filter: "nearest"`; no internal resolution control | Render scale per camera, integer scaling, nearest or sharp upscale | Pick the resolution | Q-01 |
| Vertex snapping, affine texture mapping | `vertex()` hook works in object space; no clip-space hook, no custom varyings | Clip-space hook, `RESOLUTION` built-in, custom varyings, a `<brio/retro>` include with both techniques | Decide the amount; write variants | R-04, R-13 |
| Color quantization, ordered dithering | No screen-space pass | `screen` shader domain and an effect chain | Palette and pattern choice | R-06, R-13 |
| Vertex lighting, limited lights | Per-pixel only | A `"vertex"` shading model (lighting evaluated per vertex) | Light placement and count | R-13 |
| Skinned character with blended clips | None | Skeleton, GPU skinning, animator, state machine, root motion | Clips, states, transition rules | A-01 to A-06 |
| Third-person camera | `BrioCamera3D` with `lookAt`, no controller | Orbit, first-person and third-person controllers with a collision-aware arm | Feel: distances, lag, limits | P-05 |
| Wall jump, slide, air control | Game code over `BrioCollision` | A kinematic character controller that reports floor, wall and ceiling contacts with normals, plus raycasts and shape casts | The movement rules themselves: when a wall jump is allowed, how much speed a slide keeps | P-01 to P-03 |

The last row is the clearest example of the split. A wall jump is a rule of one game. What the engine must supply is the information the rule needs (a wall contact and its normal, on a fixed step, deterministic) and a controller that moves and slides without tunneling.

### 3.2 Dense 3D action class (the maintainer's second example)

Described as: a rich world with thousands of objects, where only objects that should be visible are rendered and polygon counts drop with distance; heavier characters, about 5,000 to 10,000 triangles each; directional audio tied to objects, with many sounds layered (several enemies, environment, footsteps, music).

| Capability | Engine today | Engine responsibility | Developer responsibility | Package |
| --- | --- | --- | --- | --- |
| Thousands of objects | Capacity 4096 per world, one draw per object, recursion per object | Render list with packed keys, per-frame UBO, instancing and automatic batching of repeated meshes, a configurable capacity documented with its memory cost | Mark what is static; reuse meshes and materials | R-01, R-08 |
| Render only what is visible | Frustum culling per object | Distance culling per object, visibility sectors with portals or explicit links, a spatial index for static objects | Author the sectors and links; they are level design | R-10 |
| Fewer polygons with distance | None | Level of detail as a native, configurable, switchable feature (section 5) | Supply the levels, or generate them with the tool | R-09, X-02 |
| 5k to 10k triangle skinned characters, several on screen | None | Bone texture skinning, pose pool, animation update rate by distance, skinned bounds | Model and rig within the budget | A-03, A-05 |
| Material detail | Scalar PBR | Normal, metallic-roughness, occlusion and emissive maps; image-based lighting; cascaded shadows | Texture authoring | R-03, R-05, R-07 |
| Texture and mesh memory | PNG, JPEG, WebP decoded to RGBA | Optional KTX2 and meshopt decoders as plugins, mesh quantization in core | Compress assets at build time | R-11 |
| Positional audio per object | None | Emitters bound to objects, a listener bound to the camera, distance models, cones | Which sounds, ranges and priorities | S-01 |
| Many simultaneous sounds | Voice limit per sound | A global voice budget with priority and distance-based stealing; custom buses | Assign priorities and buses | S-02 |
| Music under effects | `bgm` bus | Crossfade, loop points, ducking | The mix | S-03 |
| Level streaming | One scene at a time | Additive scenes with progress and activation hold, release of GPU memory | Split the world into scenes | C-01, C-02 |

### 3.3 Hand-animated 2D action class (the maintainer's third example)

Described as: 2D sprites that move beyond frame animation and react to the player (walking near foliage moves the leaves), and a mix of 2D with 3D.

| Capability | Engine today | Engine responsibility | Developer responsibility | Package |
| --- | --- | --- | --- | --- |
| Sprites that deform | A sprite is one rectangle | Mesh sprites (a sprite drawn as a grid of vertices), per-sprite shaders with a `vertex()` hook, per-object shader parameters | Which sprites deform and how | T-01, T-05 |
| Foliage that reacts to the player | None | Global shader parameters, an **interaction field** (a small set of world-space influence points uploaded once per frame), a `<brio/sway>` include | Register the player as an influence; tune stiffness | T-05 |
| Independent animation per object | Clip holds playback state (D-13) | Clip and animator split; state machine shared with 3D | Clips and states | T-06 |
| 2D lights and normal-mapped sprites | None | `BrioLight2D`, sprite normal maps | Light placement | T-04 |
| Particles | None | 2D and 3D emitters, SoA, deterministic | Emitter settings | T-03 |
| 2D mixed with 3D | Order is fixed: 2D, then 3D, then `ui` | One GPU frame where 2D layers and 3D passes interleave by layer order; billboards; sprites as textured quads in 3D space with depth | Scene composition | T-01, T-07 |
| Pixel-perfect output | DPR scaling and `"fit"` | Integer scale mode, pixel snapping for sprites and cameras | Base resolution | Q-01 |

### 3.4 Touch games and visual novels (named in the UI request)

| Capability | Engine today | Engine responsibility | Developer responsibility | Package |
| --- | --- | --- | --- | --- |
| HUD and menus that react to the game | `BrioText` on `ui` layers | A reactive state store; canvas widgets; a DOM layer bound to the same store | Layout and style | U-01 to U-04 |
| UI written in HTML, CSS, JavaScript or React | None | `game.ui.mount()` for a DOM root over the canvas, input arbitration, scaling with the canvas, and a React binding in a separate package | The components | U-03, U-04 |
| Text boxes, typewriter effect, choices | None | A dialogue runner (data in, events out) and a text reveal primitive | The script, portraits, pacing | U-05 |
| Touch controls | Touch state and input map bindings | Virtual stick and buttons that feed the input map | Placement and look | U-06 |

## 4. Engine responsibility and developer responsibility

The tables above apply one rule, stated here so later sessions can apply it to features this study did not list.

A capability belongs to **the engine** when at least one of these holds:

1. It needs internal buffers or GPU state the public API does not expose (skinning, batching, culling, shadow passes).
2. It must be deterministic and captured by snapshots to keep `game.step()` replays and checkpoints valid (animation time, physics, particles, random).
3. More than one genre needs it and getting it right is expensive (character controller, audio voice management, save migration).
4. It is a safety boundary (loader limits, shader guards, storage quota handling).

It belongs to **the developer** when it is a rule, a tuning value or content: when a wall jump is allowed, how leaves bend, which enemy is audible, how a level is split into sectors.

Between the two there are three delivery tiers, and each package states which one it uses:

| Tier | Meaning | Example |
| --- | --- | --- |
| Core | Always present in `@brio-js/core`, part of the frame | Culling, render list, animator |
| Opt-in module | In core, loaded with `import()` or tree-shaken when unused, configurable and switchable | Level of detail, particles, UI widgets, post effects |
| Recipe | Not an API. An example in `examples/`, a shader include, or a section of the agent skill | Wall jump, a foliage sway shader, a visual novel script format |

A recipe is the right answer more often than it seems. The engine audience includes learners and agents: a short, readable recipe built on a small mechanism teaches more, and constrains less, than a large configurable feature.

## 5. Level of detail and visibility: native or developer code

The maintainer asked whether drawing only visible objects and dropping polygons with distance should be native behavior that can be configured or turned off, or left to each developer.

**Recommendation: selection and culling are native, on by default when the data exists, configurable and switchable. Producing the detail levels and the visibility sectors is content, done by the developer or by a tool.**

Reasons:

- Selection must run inside the render list, over the same bounds and distances culling already computes. Game code cannot do it without paying a second traversal and without racing the renderer (a mesh swapped in `update()` is one frame late and allocates when it changes registries).
- The earlier study found the same split in every engine it read: three.js ships an `LOD` object and leaves levels to the user; Godot selects by a threshold (`lod_bias`, visibility range, `renderer_scene_cull.h:422,459-463`) and generates levels at import; Unity documents LOD groups with crossfade; Unreal documents HLOD (`ENGINE_COMPLETION_STUDY.md` section 4.1).
- Generating levels needs a mesh simplifier. Godot bundles `meshoptimizer` for it (`COPYRIGHT.txt`: "Files: thirdparty/meshoptimizer/*", Expat). A simplifier in the runtime would add weight every game pays for, so it belongs in the tooling (package X-02), which may depend on `meshoptimizer` (MIT) because tooling is outside the zero-dependency rule of ADR 0001.

What "native and configurable" means in the API, as a proposal for package R-09:

```ts
// Levels come from the model (glTF MSFT_lod, or nodes named hero_LOD0, hero_LOD1...) or from code.
const lod = new BrioLOD("lod_crate", [
    { mesh: "mesh_crate_0", screenSize: 0.25 }, // used while the object covers 25% of the view height or more
    { mesh: "mesh_crate_1", screenSize: 0.08 },
    { mesh: "mesh_crate_2", screenSize: 0.02 },
]);
crate.lod = lod;                 // per object; null turns it off for that object
crate.cullDistance = 120;        // beyond this distance the object is not drawn at all

game.rendering.lod = { enabled: true, bias: 1.0, maxLevel: 0 }; // global switch, quality bias, level floor
```

- The metric is **screen coverage** (projected bounding-sphere diameter over viewport height), not raw distance, so one setting stays correct across fields of view, resolutions and split screens. A distance form stays available because it is easier to teach.
- A hysteresis band around each threshold stops flicker at the boundary.
- `renderStats` reports objects per level, so the effect is visible.
- Shadows use the same level or one level coarser, by option.
- Crossfade between levels and hierarchical LOD are later steps.

Visibility beyond the frustum, for package R-10, in order of cost and benefit:

1. **Distance culling** per object and per layer: native, trivial, and the largest win for dense scenes.
2. **Sectors**: the developer assigns objects to named sectors and lists which sectors see which. The engine draws only the sectors visible from the camera's sector. This is the classic answer for interiors and it needs no baking.
3. **A spatial index for static objects**, so culling stops visiting every object.
4. **Occlusion culling** by rasterizing occluders is a later step, decided by measurement.

## 6. Skeletal animation: imported, authored, rigged

The earlier plan designed imported animation (WP-24 to WP-28): node tree, bones as indices in a pose pool, bone texture, clips, animator, state machine, morph targets. This study keeps that design and adds what the maintainer asked for beyond import.

"Skeletal animation made in the engine" and "rigging and skinning" mean three separate capabilities in an engine without an editor:

| Capability | What it is | Engine part | Package |
| --- | --- | --- | --- |
| Authoring in code | Build a skeleton and clips without a model file | `BrioSkeleton.create(bones)`, `BrioAnimationClip.create(tracks)`, keyframe builders, pose library; the same data structures the loader fills | A-07 |
| Procedural animation | Poses computed at runtime on top of clips | Two-bone and look-at inverse kinematics, spring bones, a `postPose` hook that edits the pose pool before skinning matrices are built | A-09 |
| Rigging and skin binding | Attach a mesh to a skeleton by computing joints and weights | `BrioSkinBinder`: rigid binding (each vertex follows its nearest bone) and smooth binding (distance-weighted, four influences, normalized); weight editing and mirroring utilities | A-08 |

Boundaries:

- **Automatic rigging of arbitrary characters is tooling, not runtime.** Good automatic weights need mesh analysis that does not belong in a game frame. The runtime binder covers procedural creatures, simple props and teaching; production characters arrive rigged in glTF. The MCP package can call the binder and return a preview.
- **Export matters as much as import.** A rig authored in the engine must be savable. Package A-10 adds a glTF writer for skeletons, skins and clips, which also gives the MCP package an interchange format.
- **2D skeletal animation** shares the pose pool and animator with 3D (bones as indices, two-dimensional transforms) and draws through mesh sprites. It depends on the GPU 2D renderer (package A-11).

## 7. Conflicts with documented decisions

The Keystone protocol asks that a request which conflicts with a documented decision be answered with the conflict, its consequence and a compliant alternative, and that the maintainers decide. These are the conflicts this study found. None of them is changed by this study; each one is a decision in section 8.

| Documented decision | Request or finding | Consequence if followed | Proposed resolution |
| --- | --- | --- | --- |
| Plan decision 16: "UI is canvas-based, not DOM". The study rejected a DOM overlay because "it does not work inside the compositor and does not survive `OffscreenCanvas`" | UI written in HTML, CSS, JavaScript or React | A DOM layer cannot be interleaved with canvas layers, is not captured by `captureFrame`, post-processing or golden tests, and cannot run in a worker | Two tiers that share one state store: canvas widgets for in-world and captured UI, a DOM layer for menus, text-heavy screens and touch controls. Decision DL-04 |
| Plan decision 1 and sprint section 6: WebGPU is not planned before the presentation | WebGPU in the cascade | Two GPU backends double the surface of every visual feature | Extract a shared layer first, then build the WebGPU backend to parity. Decision DL-01 |
| Plan decision 8: standard GLSL ES 3.00 is the only shading language | WebGPU accepts only WGSL | Custom `BrioShader` code written in GLSL does not run on WebGPU without translation | Options in the render study, section 4. Decision DL-02 |
| ADR 0001: cascade `WebGPU -> WebGL2 -> WebGL1 -> Canvas2D` | Every planned feature uses WebGL2 features; the study already rejected a WebGL1 backend | A WebGL1 entry that will never be implemented misleads readers | Keep the type for compatibility, state in ADR 0001 that WebGL1 is not planned. Decision DL-03 |
| ADR 0001: zero runtime dependencies | The MCP package needs the MCP SDK (Apache-2.0) and Zod | None for the engine: the rule protects `@brio-js/core` | State in ADR 0006 that the rule applies to core, and that `@brio-js/mcp` is a Node tool with ordinary dependencies. Decision DL-06 |
| ADR 0006 and the MCP study: two packages, `@brio-js/mcp` and `@brio-js/devtools` | One separate package that works with core as soon as it is installed | A second package is one more version to keep in step | Ship the browser bridge inside `@brio-js/mcp` and keep only a small hook in core. Decision DL-07 |
| ADR 0007: adaptable sources are three.js and Godot | FSR 1 is MIT, from AMD; `meshoptimizer` is MIT | Without an amendment, a port of FSR 1 has no policy entry | Amend ADR 0007 with a rule per source. Decision DL-05 |
| `CLAUDE.md`, "Current focus": start at the TCC sprint | The presentation date has passed | Sessions keep opening a finished plan | The maintainers repoint the focus when they adopt the new plan. Decision DL-08 |

## 8. Decisions for the maintainers

A package that depends on an open decision says so in its header. **Do not start such a package until the decision is marked Confirmed here**, by a maintainer, in a commit.

| ID | Decision | Recommendation | Status | Blocks |
| --- | --- | --- | --- | --- |
| DL-01 | Add WebGPU as a second GPU backend, after the shared layer exists | Yes, in the order of the plan's track G | Open | G-01 to G-05 |
| DL-02 | How custom shaders reach WebGPU | Built-in shaders get hand-written WGSL twins. Custom shaders accept an explicit `wgsl` variant; a GLSL-only shader keeps its game on WebGL2 under `"auto"`. A translator is an optional later plugin | Open | G-04, R-04 |
| DL-03 | WebGL1 in the cascade | Not planned; say so in ADR 0001 | Open | None |
| DL-04 | UI in two tiers (canvas widgets and a DOM layer) over one state store; React binding as a separate package `@brio-js/react` | Yes; supersedes plan decision 16 with an ADR | Open | U-03, U-04 |
| DL-05 | Amend ADR 0007: FSR 1 from the MIT repository may be ported with AMD's notice; FSR 2 only from the Expat-licensed copy bundled in Godot, never from the current SDK; NVIDIA Image Scaling stays concept-only although it is MIT, to keep one rule per vendor; `meshoptimizer` may be a tooling dependency | Yes | Open | Q-02, X-02 |
| DL-06 | Zero-dependency rule applies to `@brio-js/core`; tooling packages may have dependencies | Yes; record in ADR 0006 | Open | M-01 |
| DL-07 | Package layout: same repository, core stays at the root, `packages/mcp` is a self-contained package folder (own `package.json`, lockfile and CI job, like `showcase/`) that holds server and bridge; no separate devtools package; no root npm workspaces | Yes | Open | M-01 |
| DL-08 | Adopt `GAME_LIFECYCLE_PLAN.md` as the current plan and repoint `CLAUDE.md` and `.keystone/identity.md` | Maintainers' call | Open | None |
| DL-09 | Default ECS capacity and whether dense 3D scenes use one entity per static prop or an instanced static batch | Keep 4096 as default, document the cost per slot, and add static instanced batches that do not consume one slot per prop | Open | R-08 |
| DL-10 | Scene documents as an optional authoring format (code stays first-class) | Optional; required only by the MCP authoring tools | Open | C-06, M-05 |

## 9. Third-party sources for the new areas

Applies ADR 0007. "Port" means adapting code with a file header and a notice in `THIRD_PARTY_NOTICES.md`. "Concept" means reading public documentation or papers and writing original code.

| Source | License read | Use | Note |
| --- | --- | --- | --- |
| three.js, Godot | MIT (ADR 0007) | Port | Unchanged. Check Godot's `COPYRIGHT.txt` per file |
| AMD FSR 1 (`GPUOpen-Effects/FidelityFX-FSR`) | MIT, "Copyright (c) 2021 Advanced Micro Devices, Inc." | Port, after DL-05 | New notice entry for AMD |
| AMD FSR 2 as bundled in Godot (`thirdparty/amd-fsr2`) | Expat per Godot's `COPYRIGHT.txt`, "2022-2023, Advanced Micro Devices, Inc." | Port only from that copy, after DL-05 | HLSL compute shaders; a large port, not planned |
| AMD FidelityFX SDK, current (`docs/license.md`) | Binary redistribution only, "No reverse engineering, decompilation, or disassembly" | Concept only, from its public documentation | The current SDK is **not** MIT. Do not copy from it |
| NVIDIA Image Scaling SDK | MIT, "Copyright(c) 2022 NVIDIA CORPORATION & AFFILIATES" | Concept only, by project rule | The license would allow a port; the project keeps NVIDIA material as reference, see DL-05 |
| NVIDIA DLSS | Proprietary, distributed through NGX and Streamline for native graphics APIs | Not usable | No web interface exists |
| Intel XeSS | Intel Simplified Software License, "provided in binary form only", no reverse engineering | Not usable | Native SDK |
| `meshoptimizer` | MIT, with a JavaScript and WebAssembly simplifier (`meshopt_simplifier.js`) | Dependency of tooling only, after DL-05 | Never a dependency of core |
| MCP TypeScript SDK (`@modelcontextprotocol/server`) | Apache-2.0 | Dependency of `@brio-js/mcp` | Not vendored |
| Unity, Unreal | Proprietary | Concept, from public documentation | Unchanged |
| Commercial games used as targets | Proprietary | None | Capability classes only, see section 3 |
| Papers and conference talks | Copyright of their authors | Concept | Cite them in the file that implements the technique; no listings copied |

## 10. Sources

Engine documents: [`ENGINE_COMPLETION_STUDY.md`](./ENGINE_COMPLETION_STUDY.md), [`ENGINE_COMPLETION_PLAN.md`](../plans/ENGINE_COMPLETION_PLAN.md), [`TCC_FINAL_SPRINT.md`](../plans/TCC_FINAL_SPRINT.md), [`PERFORMANCE_FOLLOWUPS.md`](../plans/PERFORMANCE_FOLLOWUPS.md), [`MCP_GAME_AUTHORING.md`](./MCP_GAME_AUTHORING.md), ADRs 0001 to 0007.

Web pages read on 2026-11-15:

- Licenses: [FSR 1 repository](https://github.com/GPUOpen-Effects/FidelityFX-FSR) and its [license](https://raw.githubusercontent.com/GPUOpen-Effects/FidelityFX-FSR/master/license.txt); [FidelityFX SDK license](https://github.com/GPUOpen-LibrariesAndSDKs/FidelityFX-SDK/blob/main/docs/license.md); [Godot `COPYRIGHT.txt`](https://raw.githubusercontent.com/godotengine/godot/master/COPYRIGHT.txt); [NVIDIA Image Scaling SDK](https://github.com/NVIDIAGameWorks/NVIDIAImageScaling); [Intel XeSS](https://github.com/intel/xess) and its [license](https://raw.githubusercontent.com/intel/xess/main/LICENSE.txt); [meshoptimizer](https://github.com/zeux/meshoptimizer) and its [JavaScript modules](https://github.com/zeux/meshoptimizer/tree/master/js).
- Web Audio: [AudioListener](https://developer.mozilla.org/en-US/docs/Web/API/AudioListener), [PannerNode](https://developer.mozilla.org/en-US/docs/Web/API/PannerNode), [spatialization basics](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Web_audio_spatialization_basics).
- UI: [HTML-in-Canvas origin trial changes](https://developer.chrome.com/blog/html-in-canvas-ot-changes), [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore), [OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas).

The sources for WebGPU, upscaling and MCP are listed in their own documents.
