# Game Lifecycle Plan

Status: **Active. This is the current plan** (decision DL-08, confirmed by the maintainer on 2026-11-16). Start every session here. The TCC was presented on 2026-11-13 and [`TCC_FINAL_SPRINT.md`](./TCC_FINAL_SPRINT.md) is closed; its open items are absorbed below. Work follows `branch -> develop -> main`.

Goal: every tool a developer or an agent needs to take a 2D or 3D game from prototype to a shipped build, on the existing architecture: ECS core, object-oriented public API, zero runtime dependencies in `@brio-js/core`.

Evidence and reasons:

- [`GAME_LIFECYCLE_STUDY.md`](../architecture/GAME_LIFECYCLE_STUDY.md): state of the engine, target capability classes, engine and developer responsibility, decisions DL-01 to DL-10, third-party sources.
- [`RENDER_QUALITY_AND_WEBGPU_STUDY.md`](../architecture/RENDER_QUALITY_AND_WEBGPU_STUDY.md): WebGPU, shader languages, upscaling, optimization order, low-fidelity rendering.
- [`MCP_PACKAGE_PLAN.md`](./MCP_PACKAGE_PLAN.md): the `@brio-js/mcp` package, track M.
- [`ENGINE_COMPLETION_PLAN.md`](./ENGINE_COMPLETION_PLAN.md): the detailed design of the work packages WP-00 to WP-54. This plan **does not repeat those designs**. A package here that says "Design: WP-25" is implemented from that section, with the scope and changes written here.

## 1. How to run a session

Follow section 1 of `ENGINE_COMPLETION_PLAN.md` (protocol, stones, study base, tests, checks, changelog), with these additions:

1. Pick the first `[ ]` package in the order of section 4 whose dependencies are `[x]` and whose decision, if any, is **Confirmed** in the study, section 8. If the decision is Open, stop and tell the maintainer; do not choose for them.
2. Mark it `[~]` with the branch name. Branches: `feat/<id>-slug`, for example `feat/a-03-skinning`. One package per pull request. Large packages list their own slices; one slice per pull request is fine.
3. The study base in `temp/` is gitignored. If it is missing, recreate the clones (study section 1 of `ENGINE_COMPLETION_STUDY.md`) and **read the cited source before writing code**. Line references here are carried over from the earlier study and may have moved.
4. Before porting third-party code, apply ADR 0007 and section 9 of the lifecycle study: file header, notice, and for Godot a check of `COPYRIGHT.txt`. For AMD and `meshoptimizer` material, follow the update of 2026-11-16 in ADR 0007 (decision DL-05, confirmed): port FSR 1 only from its MIT repository, and never copy from the current FidelityFX SDK.
5. Never use material from a commercial game: no assets, extracted data, decompiled code, names or level layouts. Test and demo content is original or has a checked license recorded in the example folder.
6. Each package states its **tier** (core, opt-in module, recipe; study section 4). Do not promote a recipe to an API without a maintainer decision.
7. Definition of done: tests added and passing, `npm run check` green, `npm run test:e2e` green when rendering, input or examples change, `CHANGELOG.md`, `GLOSSARY.md` for new terms, affected stones updated, `keystone stone doctor` clean, capability matrix updated when a backend differs, and the package ticked here in the same pull request.

Rules that hold for every package (from the sprint, section 4): no allocation in the game loop, generational handles, snapshot readers for older versions, limits on everything read from a file, TSDoc on public symbols, no AI attribution, English in code and documents.

Status marks: `[ ]` pending, `[~]` in progress, `[x]` done, `[-]` cut by the maintainers.
Sizes: **S** one session, **M** one or two, **L** three or more.
Priority: **P1** needed by a target class of study section 3, **P2** improves it, **P3** later.

Identifiers: a letter and a number name a package of this plan (`R-01`). Two prefixes come from the earlier documents and keep their meaning: `WP-nn` is a work package of `ENGINE_COMPLETION_PLAN.md`, and `D-nn` is a defect listed in section 3 of `ENGINE_COMPLETION_STUDY.md`. `P-1` to `P-3` with a single digit are the items of `PERFORMANCE_FOLLOWUPS.md`; `DL-nn` is a decision of the lifecycle study.

## 2. Lifecycle coverage

What "a complete game lifecycle" means here, and which packages close each stage.

| Stage | A developer or agent needs | Today | Packages |
| --- | --- | --- | --- |
| Prototype | Scaffold a project, primitives, hot reload, run and see | Playground, examples, `BrioMesh` primitives, shader hot reload | M-01 to M-06, M-09 |
| Content | Import models with animation, sprites that animate independently, tile maps, text, audio | Static glTF, sprite clips, tile maps, text, bus mixer | A-01 to A-06, T-06, R-02, R-03, S-01 |
| Authoring | Build rigs, clips, particles, UI and scenes as data | None | A-07 to A-11, T-03, U-02 to U-05, C-06 |
| Systems | Physics that resolves, queries, controllers, scene flow, saves | Events and opt-in bodies; one scene; in-memory checkpoints | P-01 to P-05, C-01 to C-05 |
| Look | Materials, shadows, post-processing, 2D lights, quality settings | Scalar PBR, one shadow, no post | R-03 to R-07, R-13, T-04, Q-01 to Q-03 |
| Scale | Many objects, many sounds, large levels | Frustum culling | R-01, R-08 to R-12, S-02, C-07 |
| Test | Deterministic replays, golden frames, allocation and frame budgets | `game.step`, seeded random, Playwright goldens, heap test | F-02, F-03, X-01, X-05, M-07 |
| Ship | Build, compress assets, offline, desktop and mobile shells, versioned saves | npm package only | X-02, X-03, C-05 |
| Reach | Run on every device class | WebGL2 and Canvas2D | G-01 to G-05 |

## 3. Status of the earlier plan

`ENGINE_COMPLETION_PLAN.md` says its status marks were not maintained during the sprint. This table is the reconciliation against the code at `995234a`. "Here" is the package of this plan that carries the remaining work.

| Earlier package | State at `995234a` | Here |
| --- | --- | --- |
| WP-00, WP-01 | Done (sprint S0) | None |
| WP-02 rig and benchmarks | Rig done; benchmark harness and the 3D heap scenario open | F-02, F-03 |
| WP-03, WP-05 | Done (D-01, D-04, D-06, D-12, D-14, D-18, D-19, D-20) | None |
| WP-04 glTF accessors | Open (D-02) | A-01 |
| WP-07, WP-08, WP-09 ECS groundwork | Open | F-04 |
| WP-10 snapshot with name table | Format v3 exists; restore after reload open (D-17) | C-05 |
| WP-11 contract v2 | Open | R-01 |
| WP-12 culling | Sphere culling done; layer masks open | R-10 |
| WP-13 mesh and texture v2 | Only `filter` and `wrap` | R-02 |
| WP-14 instancing, LOD | Open | R-08, R-09 |
| WP-15 program cache | Failures no longer throw; no parallel compile, no warm-up, no fallback material | R-04 |
| WP-16 lights | Point and spot done, capacity 8, lights are not in the ECS | R-12 |
| WP-17 standard material | Scalar roughness and metalness, emissive | R-03 |
| WP-18 tone mapping | Operators done in the fragment shader; no HDR target, no MSAA control | R-06 |
| WP-19 environment | Fog done; no image-based lighting, no sky | R-05 |
| WP-20 shadows | One directional map with PCF | R-07 |
| WP-21, WP-22 shader API | `surface()` and `vertex()` hooks, `TIME`, parameters, hot reload | R-04 |
| WP-23 canvas domain, shader lab | Open | T-01, X-04 |
| WP-24 to WP-28 animation | Open | A-02 to A-06 |
| WP-29 tweens, sprite animator | Open (D-13) | T-06 |
| WP-30 asset manager | `unloadAsset`, progress and reference counting on scene removal exist | C-01 |
| WP-31 to WP-34 scenes, storage, saves | Open (D-15, D-16) | C-02 to C-05, U-01 |
| WP-35, WP-36 GPU 2D, 2D visuals | Open | T-01, T-02 |
| WP-37 text | `BrioText` done; `FontFace` loading and bitmap fonts open | T-02 |
| WP-38 tile maps | Chunks and Tiled import done; flips, animated tiles, several tilesets open (`ROADMAP.md`) | T-02 |
| WP-39, WP-40 2D lights, particles | Open | T-04, T-03 |
| WP-41 UI | Open | U-02 |
| WP-42 post-processing | Open | R-06 |
| WP-43 canvas scaling | DPR and `"fit"` done; integer scale and render scale open | Q-01 |
| WP-44 camera controllers | Pointer Lock done; controllers, follow, shake, render-target camera open | P-05 |
| WP-45 input | Input map done; injection and virtual controls open | X-05, U-06 |
| WP-46 physics | Open (D-21) | P-01 to P-04 |
| WP-47 spatial audio | Open | S-01 to S-04 |
| WP-48 profiler | Open | X-01 |
| WP-49 to WP-51 demos | Lantern Courtyard and the showcase games exist; the three target demos do not | X-04 |
| WP-52 benchmark, WP-53 release | Open | F-03, X-03 |

## 4. Order of work

```text
L0 Foundations      F-01 F-02 F-03 F-04 F-05
L1 Render core      R-01 R-02 R-04            (everything visual waits for R-01)
L2 Content          A-01 A-02 A-03 A-04 A-05  |  C-01 C-02 C-04 C-05  |  P-01 P-02 P-03   (three parallel lanes)
L3 Look             R-03 R-06 R-07 R-05 Q-01 Q-03 R-13
L4 2D on the GPU    T-01 T-02 T-06 T-03 T-05 T-07 T-04
L5 Interface, sound U-01 U-02 U-03 U-04 U-05 U-06  |  S-01 S-02 S-03 S-04
L6 Scale            R-08 R-09 R-10 R-12 R-11 Q-02
L7 Authoring        A-06 A-07 A-08 A-09 A-10 A-11 C-06
L8 WebGPU           G-01 G-02 G-03 G-04 G-05 Q-04
L9 Delivery         X-01 X-02 X-03 X-04 X-05 P-04 P-05 C-03 C-07 U-07
MCP                 M-01 to M-09, in parallel from L0 (see MCP_PACKAGE_PLAN.md)
```

Notes on the order:

- L2 lanes do not share files and can run in parallel sessions. The animation lane needs R-02 for vertex attributes.
- L5 is independent of the GPU work except U-02, which draws through T-01 when it exists and through Canvas2D before.
- L8 can start as soon as R-01 is merged, but each visual feature added after G-03 must then land on both backends. Starting it late is cheaper; starting it before the features stabilize is not recommended.
- The **shortest path to each target class** of study section 3:
  - Stylized 3D platformer: R-01, R-02, R-04, A-01 to A-05, P-01 to P-03, P-05, Q-01, R-06, R-13.
  - Dense 3D action: the path above, plus R-03, R-07, R-08, R-09, R-10, R-12, S-01, S-02, C-01, C-02.
  - Hand-animated 2D action: R-01, T-01, T-02, T-06, T-03, T-05, T-07, P-01 to P-03, U-01, U-02.
  - Touch games and visual novels: U-01, U-03, U-04, U-05, U-06, C-04, C-05, C-03.
- **Releases.** Which packages make each version is the maintainers' decision. The v0.3 list in `docs/ROADMAP.md` predates this plan and names a WebGPU backend, which this plan places after the shared layer (L8). A suggestion, to be confirmed: v0.3 as L0 and L1, the interface contract with DOM roots and the React package (U-01, U-03, U-04), and the first MCP release (M-01 to M-04).

## 5. Work packages

### Track F: foundations

#### F-01 Adopt the plan `[x]`

P1, S. No dependencies. Decision DL-08. Done on 2026-11-16, in the pull request that added this plan.

- Decisions DL-01, DL-02 and DL-04 to DL-08 are Confirmed in study section 8. **DL-03, DL-09 and DL-10 stay open** and block only the packages named there.
- `CLAUDE.md`, `.keystone/identity.md`, `.keystone/standards.md` and `docs/ROADMAP.md` point to this plan; `TCC_FINAL_SPRINT.md` is closed and keeps its progress log.
- Records written: ADR 0008 (interface in two tiers, React in its own package, supersedes plan decision 16), and updates of 2026-11-16 in ADR 0001 (WebGPU order, GLSL and WGSL as separate variants), ADR 0006 (one MCP package, first-class) and ADR 0007 (AMD, NVIDIA Image Scaling, tooling dependencies).

#### F-05 Detach `develop` from the TCC `[ ]`

P2, S. Depends on the last merge of `main` into the `tcc` branch, which freezes that branch. Maintainers decide each removal.

- List what on `develop` exists only for the TCC, and propose per item whether it is removed, archived or kept as history: `docs/plans/TCC_FINAL_SPRINT.md`, `docs/plans/PERFORMANCE_FOLLOWUPS.md` (after F-02 closes it), the TCC demo definitions and "must" priorities of `ENGINE_COMPLETION_PLAN.md` section 2, mentions of the presentation in the Key and in stones, the `docs/tcc/` entry of `.gitignore`, and `TODO.md` sections that the plans replaced.
- Do not delete anything that is the only record of a design the plans still cite. `ENGINE_COMPLETION_PLAN.md` and `ENGINE_COMPLETION_STUDY.md` stay, because this plan references their work packages and defects.

Accept: no document on `develop` describes TCC work as pending; every internal link still resolves; `keystone stone doctor` clean.

#### F-02 Sprint leftovers `[ ]`

P1, M. No dependencies. Stones: `rendering`, `objects`.

- P-1 of [`PERFORMANCE_FOLLOWUPS.md`](./PERFORMANCE_FOLLOWUPS.md): remove the per-object allocations of the 3D path, then delete the `test.fixme` of `boxes3d` in `e2e/heap.spec.ts`.
- P-3: regenerate and review the golden frames; enable the Lantern Courtyard golden.
- D-07 remainder: a visible error material instead of skipped draws.

Accept: `e2e/heap.spec.ts` passes for every scenario; all goldens enabled.

#### F-03 Benchmark harness `[ ]`

P1, M. Depends on F-02. Design: WP-02 (benchmark part) and WP-52.

- `benchmarks/` with scripted scenes driven by `game.step(1 / 60)`: 10,000 sprites; 4,000 static meshes; 2,000 instances of 20 meshes; 16 skinned characters (when A-03 exists); one post-processed scene.
- Output JSON: CPU frame time (median and spread over runs), draw calls, triangles, heap growth, bundle size per preset. Machines and browser versions recorded with each result.
- A comparison with three.js on matching scenes stays optional, as in WP-52.

Why: every budget in these documents is a proposal until this exists. Accept: a CI job stores the JSON; the budgets in the render study, section 6, are replaced by measured numbers.

#### F-04 ECS groundwork `[ ]`

P1, L. Depends on F-03 (to measure). Design: WP-07, WP-08, WP-09. Stones: `ecs`, `objects`, `game`, `scenes`.

- Asset ids in the `visual` buffer, so render code stops looking names up in maps (WP-07).
- Parent indices and world matrices in arrays, updated in one ordered pass (WP-08).
- Ordered systems and deferred structural changes (WP-09). Animators, physics, particles and audio emitters of later tracks run as systems.
- One snapshot version bump for all three; older readers kept.

Why: skinning, instancing, physics and scene documents all read these buffers. Accept: as written in WP-07 to WP-09.

### Track R: render core, materials, scale

#### R-01 Render contract v2, render list, render targets `[ ]`

P1, L. Depends on F-02. Design: WP-11. Stones: `rendering`, `scenes`, `game`.

- Replace per-object `renderMesh3D()` with `beginPass`, `submit(list)`, `endPass`, as in WP-11. Add `capabilities`, `createRenderTarget`, `release` and backend `stats`.
- `RenderList` with pooled items and packed sort keys lives outside the backend, in `src/rendering/gpu/` (render study section 2). Write it without `gl.*` calls so G-01 can reuse it unchanged.
- Render targets with color, depth and multiple color attachments. They are needed by R-06, R-07, Q-01, Q-04, T-01 and the minimap camera.
- Frame and pass data in one UBO, uploaded once per pass (D-10). One composite to the visible canvas per frame where the 2D order allows it (D-09).
- `Canvas2DBackend` implements the same contract and reports its capabilities.

Slices: (1) list and keys behind the old contract; (2) new contract on WebGL2; (3) render targets; (4) Canvas2D.

Accept: examples unchanged in golden tests; draw calls and CPU time recorded before and after with F-03.

#### R-02 Mesh and texture v2 `[ ]`

P1, M. Depends on R-01. Design: WP-13. Stones: `assets`, `rendering`.

- `BrioMesh`: optional `tangents`, `colors`, `uvs2`, `joints`, `weights`, `morphTargets`; `boundingSphere`; mutable ranges with `markAttributeDirty`; `createCapsule`, `createTorus`.
- `BrioTexture`: `colorSpace`, per-axis wrap, min and mag filters, mipmap control, `fromData`.
- glTF: samplers, `TANGENT`, `COLOR_0`, `TEXCOORD_1`; data textures tagged linear.

Accept: as in WP-13.

#### R-03 Standard material maps and alpha blending `[ ]`

P1, L. Depends on R-02. Design: WP-17. Stones: `assets`, `rendering`.

- Normal, metallic-roughness, occlusion and emissive maps; tangent frame from `TANGENT` or derivatives; `COLOR_0` multiplies base color.
- `alphaMode: "opaque" | "mask" | "blend"` with a back-to-front transparent list.
- `"toon"` shading with a ramp.
- glTF: core material textures, `KHR_materials_unlit`, `KHR_materials_emissive_strength`, `KHR_texture_transform`.

Port: GGX and normal mapping chunks from three.js, with upstream credits kept (ADR 0007). Accept: goldens with Khronos sample assets, license checked per asset.

#### R-04 Shader API completion and program cache `[ ]`

P1, L. Depends on R-01. Design: WP-15, WP-21, WP-22. Decision DL-02 (confirmed) for the shader variants. Stones: new `shaders`, `rendering`, `assets`.

Remaining from the sprint, section S3, plus what this study adds:

- Built-in materials rewritten on the same hooks, so `material.inject()` works.
- `light()` hook; custom varyings; custom vertex attributes; `defines`; render state on the material; includes with `<brio/...>`; parameter discovery and annotations; `parameter()` handles; `shader.onCompile`; global parameters; per-object parameters.
- **New: a clip-space hook** (`void clip(inout vec4 position)`) that runs after projection, and the built-ins `RESOLUTION` (render target size in pixels) and `VIEWPORT`. Needed by vertex snapping (render study section 7).
- **New: named shader variants.** GLSL and WGSL are separate languages and are never mixed or translated in core (ADR 0001, update of 2026-11-16). Inline: `new BrioShader(name, { glsl: { fragment, vertex }, wgsl: { fragment, vertex } })`; files: a `.wgsl` file next to the `.glsl` one. The existing top-level `fragment` and `vertex` options keep meaning GLSL. The WGSL variant is stored and checked for presence only, until G-04 uses it. Add "Shader Variant" to `GLOSSARY.md`.
- Parallel compile with `KHR_parallel_shader_compile`, deferred status checks, `game.compileShaders()` warm-up with progress, a visible error material, program reference counting.

Accept: as in WP-21, plus a test that a clip hook moves vertices and that a shadow pass honors `vertex()` and `clip()`.

#### R-05 Environment lighting and sky `[ ]`

P2, L. Depends on R-03, R-06. Design: WP-19.

- `BrioEnvironment` from an equirectangular HDR, prefiltered at load; a procedural default so no asset is required; sky background (solid, gradient, equirectangular).

Accept: as in WP-19.

#### R-06 HDR target, MSAA and effect chain `[ ]`

P1, L. Depends on R-01, R-04 (for the `screen` domain). Design: WP-18, WP-42. Stones: `rendering`, `shaders`.

- Scene renders into an RGBA16F target when the float color buffer extensions allow; tone mapping moves from each material's fragment shader to one pass. Keep the in-fragment path as the fallback and for Canvas2D parity notes.
- MSAA on the scene target through a multisample renderbuffer and blit; `antialias` in the game configuration.
- `camera.effects = [...]` over a pooled set of targets that resize with the canvas. Effects: bloom, vignette, color grading by lookup table, pixelate, and custom effects through a `screen` shader.
- The chain has two effect slots, before and after the upscale step of Q-02 (render study section 5.2).
- `invalidateFramebuffer` on discarded attachments.

Accept: one golden per effect and per tone mapping operator; a disabled chain allocates no target.

#### R-07 Shadows completion `[ ]`

P1, L. Depends on R-01. Design: WP-20.

- Shadow atlas; 1 to 4 cascades with the practical split; casters culled per cascade; spot shadows; point shadows with a limit; `autoUpdate` and `needsUpdate` for static scenes; optional PCSS; skinning and `vertex()` hooks in the shadow pass.

Accept: as in WP-20, and a static scene issues no shadow draw after its first frame.

#### R-08 Instancing and static batches `[ ]`

P1, L. Depends on R-01, F-04. Design: WP-14, extended. Decision DL-09. Stones: `rendering`, `objects`, `ecs`.

```ts
// Explicit: one mesh, many transforms, no entity per instance.
const rocks = new BrioInstancedMesh("inst_rocks", "mesh_rock", "mat_rock", 2000);
rocks.setMatrixAt(i, matrix); rocks.setColorAt(i, "#8a8a8a"); rocks.count = 1200;
scene.add(rocks);

// Automatic: consecutive opaque items with the same mesh and material are merged by the render list.
game.rendering.autoInstancing = true; // default; threshold decided by benchmark
```

- `drawElementsInstanced` with per-instance matrix and color attributes. Instances are culled in groups: the batch keeps a grid of cells with bounds, and only visible cells upload.
- Automatic merging in the render list for ordinary objects that share mesh and material. Skinned meshes are excluded.
- **Static batches** answer DL-09: props placed once (`scene.addStatic(model, transforms)`) live in instance buffers, not in ECS slots, so thousands of them do not consume the 4096 capacity. They cannot move, be parented or receive collision events; state this in the documentation.
- Canvas2D: instances are expanded to single draws.

Engine: the mechanism and the grouping. Developer: deciding what is static. Accept: 10,000 instances of 20 meshes within the draw-call budget of F-03; `renderStats` reports instances and merged draws.

#### R-09 Level of detail `[ ]`

P1, M. Depends on R-01, R-08 (instances select levels per cell). Tier: opt-in module, on by default when a `BrioLOD` is assigned. Stones: `rendering`, `assets`.

Design: study section 5, including the API sketch. In addition:

- Import: glTF `MSFT_lod` when present, and the node naming convention `name_LOD0`, `name_LOD1`. Both go through the loader limits (a maximum number of levels).
- Selection runs while building the render list, from the bounding sphere already used by culling. No per-frame allocation; a level change only swaps the mesh id of the item.
- `game.rendering.lod`: `enabled`, `bias`, `maxLevel`. Per object: `lod`, `cullDistance`, `lodBias`.
- Hysteresis of 10% of the threshold by default.
- Not in this package: crossfade, hierarchical LOD, runtime simplification. Generating levels is X-02.

Accept: a scene whose triangle count drops with distance in `renderStats`; no flicker when the camera oscillates around a threshold (test with `game.step`); turning `enabled` off restores level 0.

#### R-10 Visibility: distance, layers, sectors, spatial index `[ ]`

P1, M. Depends on R-01. Tier: core for distance and layers, opt-in for sectors. Stones: `rendering`, `cameras`, `scenes`.

- `object.cullDistance` and a per-layer default. `camera.cullingMask` and `object.renderLayers` (WP-12 remainder).
- **Sectors**: `scene.sectors.define("hall", { sees: ["corridor", "stairs"] })`, `object.sector = "hall"`. The camera's sector comes from a volume test (box or sphere per sector) or is set by game code. Objects in sectors the camera's sector does not see are skipped before culling. Objects without a sector are always considered.
- A uniform grid for static objects, built once, so culling stops visiting every object. Reuse the grid code of `SpatialOctree3D` after its rename (P-01).
- Occlusion culling is not in this package; decide it by measurement.

Engine: the test and the API. Developer: sector layout. Accept: a multi-room test scene draws only the visible rooms; `renderStats` reports objects skipped by distance, layer and sector.

#### R-11 Compressed assets `[ ]`

P2, M. Depends on A-01. Plan decision 17 stays. Stones: `assets`.

- Core: `KHR_mesh_quantization`; a loader extension interface (`BrioModel.registerExtension(name, handler)`) with limits applied to handler output.
- Plugins loaded with `import()`, each in its own entry point: `KHR_texture_basisu`, `EXT_meshopt_compression`, `KHR_draco_mesh_compression`. Check each decoder's license and size before choosing it, and record it in `THIRD_PARTY_NOTICES.md`.
- Compressed GPU texture formats are selected from the formats the backend reports.

Accept: a compressed model renders identically within tolerance; a game that does not use a plugin does not download it.

#### R-12 Lights at scale `[ ]`

P1, M. Depends on R-01, F-04. Design: WP-16 remainder. Stones: `objects`, `rendering`, `ecs`.

- Lights move into the ECS and can be parented to objects.
- The pass UBO holds up to 64 lights that survive frustum and range culling. Each draw receives up to 8 indices of the lights that reach its bounding sphere, cached while neither moved. The shader capacity stays fixed, so a change in light count compiles nothing. The earlier study records the same limits in Godot (32 renderable, 8 per object).
- Excess lights are dropped by distance and intensity, with one warning.
- glTF `KHR_lights_punctual` import.

Accept: 64 lights in a scene with no new program; a test that an object lit by nine lights keeps the eight strongest.

#### R-13 Low-fidelity rendering kit `[ ]`

P1, S. Depends on R-04, R-06, Q-01. Tier: opt-in module plus recipe. Design: render study section 7.

- `shading: "vertex"`: lights evaluated per vertex.
- `<brio/retro>` include: `brio_snap(position, gridSize)` for the clip hook and `brio_affine` helpers for texture coordinates.
- Effects `BrioDither` (ordered pattern, color depth) and `BrioPixelate`.
- `examples/3d-retro-room`: original low-polygon content, readable code.

Accept: one golden per technique; the example runs on WebGL2 and degrades on Canvas2D with one warning.

### Track A: animation, skinning, rigging

Bones are indices in a pose pool, never entities (plan decision 4). The loader, the authoring API and the binder all produce the same data structures.

#### A-01 glTF accessor completeness `[ ]`

P1, S. Design: WP-04. Fixes D-02. Stone: `assets`. Accept: as in WP-04.

#### A-02 glTF scene tree `[ ]`

P1, M. Depends on F-04. Design: WP-24. Fixes D-03. Accept: as in WP-24.

#### A-03 Skeleton and GPU skinning `[ ]`

P1, L. Depends on R-02, A-02. Design: WP-25. Stones: new `animation`, `rendering`, `assets`.

- `BrioSkeleton`, `BrioPosePool`, bone texture read with `texelFetch`, skinning in the shadow pass and in picking, padded bounds, CPU skinning on Canvas2D for small meshes.
- New loader limits: joints per skin, skins per model, influences.
- Budget target from the study: 16 characters of 5,000 to 10,000 triangles and 60 bones. Measure with F-03.

Accept: as in WP-25, plus the budget scene recorded in the benchmark.

#### A-04 Clips and animator `[ ]`

P1, L. Depends on A-03. Design: WP-26. Accept: as in WP-26.

#### A-05 State machine, blend spaces, root motion, attachments, update rate `[ ]`

P1, M. Depends on A-04. Design: WP-27. The state machine also drives sprite clips (T-06). Accept: as in WP-27.

#### A-06 Morph targets `[ ]`

P2, M. Depends on A-04. Design: WP-28. Accept: as in WP-28.

#### A-07 Authoring skeletons and clips in code `[ ]`

P1, M. Depends on A-04. Tier: core data API. Stone: `animation`.

```ts
const skeleton = BrioSkeleton.create("skl_arm", [
    { name: "root" },
    { name: "upper", parent: "root", position: [0, 1, 0] },
    { name: "lower", parent: "upper", position: [0, 1, 0] },
]);

const wave = BrioAnimationClip.create("clip_wave", { duration: 1, loop: true })
    .rotation("upper", [0, 0.5, 1], [quatA, quatB, quatA], "linear")
    .position("root", [0, 1], [[0, 0, 0], [0, 0.1, 0]], "step");

animator.addClip(wave);
const pose = animator.capturePose();            // copy of the current pose
const bent = BrioAnimationClip.fromPoses("clip_bend", [pose, otherPose], [0, 0.4]);
```

- Builders validate at build time (unknown bone, unsorted times, wrong value count) and produce the typed arrays the loader produces. Nothing here runs in the frame.
- Clip utilities: `subclip(start, end)`, `reverse()`, `retarget(skeleton)` by bone name, `additiveFrom(referenceClip)`.
- Clips and skeletons serialize to plain JSON for scene documents (C-06) and to glTF (A-10).

Why: procedural creatures, tests without model files, teaching, and the MCP tools, which create content as data. Accept: a clip built in code plays identically to the same clip loaded from a generated GLB; builder errors name the bone and the key.

#### A-08 Skin binding `[ ]`

P2, M. Depends on A-03, A-07. Tier: opt-in module (loaded on demand). Stone: `animation`.

```ts
const skinned = BrioSkinBinder.bind(mesh, skeleton, { mode: "smooth", maxInfluences: 4, falloff: 2 });
BrioSkinBinder.normalize(skinned); BrioSkinBinder.mirror(skinned, "x");
```

- `"rigid"`: each vertex follows the nearest bone segment. `"smooth"`: weights from inverse distance to bone segments raised to `falloff`, the four largest kept and normalized.
- Runs at load or on demand, never per frame; reports its time; returns a new mesh with `joints` and `weights`.
- Weight inspection for tools: weights per bone as a vertex color mesh, for a debug view (X-01).
- State the limit in the documentation: distance weights bleed between nearby limbs. Production characters should arrive rigged; this serves simple and procedural shapes.

Engine: the binder and utilities. Developer or tool: judging the result. Accept: a cylinder bound to a three-bone chain bends without collapsing in a golden test; weights always sum to one.

#### A-09 Procedural animation: inverse kinematics and springs `[ ]`

P2, M. Depends on A-04. Tier: opt-in module. Design reference: Godot's two-bone IK and spring bone nodes, named in the earlier backlog; check `COPYRIGHT.txt` before porting.

- `animator.postPose(callback)`: edits the pose pool after clips are mixed and before skinning matrices are built. This is the single extension point.
- Solvers built on it: two-bone IK with a pole target (feet on slopes, hands on objects), look-at with limits, spring bones for hair and tails.
- `BrioSpring` in `math`: a damped spring for scalars and vectors, stepped with a fixed `dt`, deterministic. Also used by T-05 and P-05.

Accept: a foot-placement example; solver results are deterministic under `game.step`.

#### A-10 glTF writer `[ ]`

P2, M. Depends on A-07. Tier: opt-in module. Stone: `assets`.

- `BrioModel.toGLB(model)`: nodes, meshes, materials with their textures, skins and clips. Output passes the engine's own loader and limits.

Why: rigs and clips authored in the engine must be savable, and the MCP tools need an interchange format. Accept: load, write, load again gives equal data; the Khronos validator reports no error on a written file (run as a development check, not a dependency).

#### A-11 2D skeletal animation `[ ]`

P3, L. Depends on T-01, T-05, A-07. Design reference: Godot `skeleton_2d`.

- The same skeleton, pose pool, clips and animator with two-dimensional bone transforms; skinned mesh sprites; an importer for one open 2D rig format, chosen after a license check.

Accept: a jointed 2D character plays a blended clip with one draw call.

### Track T: 2D on the GPU

The letter T (two-dimensional) is used because `D-nn` already names the defects of the earlier study.

#### T-01 GPU 2D renderer `[ ]`

P1, L. Depends on R-01, F-04. Design: WP-35 and the `canvas` domain of WP-23. Stones: `rendering`, `objects`.

- Instanced sprite batcher on the GPU backends; batches break on texture, shader or blend change; `"static"` layers cache into a render target; Canvas2D stays as the fallback with the same image within tolerance.
- `canvas` shader domain with `vertex()` and `fragment()` hooks; `BrioObject2D.material`.
- One GPU frame in which 2D layers and 3D passes follow the layer order (T-07 uses this).

Accept: as in WP-35.

#### T-02 2D visual set, fonts, tile map remainder `[ ]`

P1, M. Depends on T-01. Design: WP-36, WP-37 and WP-38 remainders.

- `tint`, `blendMode`, `ySort`; `BrioShape2D`; `BrioNineSlice`; repeated sprites.
- `BrioFont` through the `FontFace` interface in `preload()`; `BrioBitmapFont`.
- Tile maps: flipped and rotated tiles, animated tiles, several tilesets.

Accept: goldens on GPU and Canvas2D.

#### T-03 Particles `[ ]`

P1, M. Depends on T-01 for 2D, R-08 for 3D. Design: WP-40. Tier: opt-in module. Stone: new `particles`.

- `BrioParticleEmitter2D` and `BrioParticleEmitter3D`: SoA buffers, pooled, simulated on the CPU in a system, seeded by `game.random`.
- Settings: rate, bursts, lifetime, speed, direction and spread, gravity, drag, size, color and opacity over life, rotation, world or local space, blend mode, sprite-sheet frames over life, emission shapes (point, circle, box, cone).
- Emitters attach to objects and bones (`animator.attach`).
- Determinism: an emitter's state is its seed and time, so replays match; particles are not in snapshots by default.
- GPU simulation is a WebGPU extra (G-05).

Accept: 10,000 particles within the frame budget of F-03; no allocation once running; identical frames across two replays.

#### T-04 2D lights `[ ]`

P2, M. Depends on T-01. Design: WP-39. Accept: as in WP-39.

#### T-05 Deformable sprites and the interaction field `[ ]`

P1, M. Depends on T-01, R-04. Tier: opt-in module plus recipe. Stones: `rendering`, `objects`.

```ts
const bush = new BrioObject2D("obj_bush", "spr_bush");
bush.meshSprite = { columns: 2, rows: 6 };          // drawn as a grid, so a vertex() hook can bend it
bush.material = "mat_foliage";                       // canvas-domain shader that includes <brio/sway>

game.interaction.add(player, { radius: 48, strength: 1 });  // world-space influence, follows the object
game.shaderGlobals.set("uWind", 0.4);
```

- **Mesh sprites**: a sprite drawn as a subdivided quad. Costs vertices only where enabled.
- **Interaction field**: up to 16 influences per pass (position, radius, strength, velocity), uploaded once per frame in a UBO, readable from `canvas` and `surface` shaders as `BRIO_INFLUENCES`. Sorted by distance to the camera when there are more.
- `<brio/sway>` include: displacement from wind (a global parameter and noise) plus the push of nearby influences, weighted by the vertex height inside the sprite so the base stays planted.
- Stateful response (leaves that keep swinging after the player passes) uses a per-object shader parameter driven by `BrioSpring` in game code. This part is a recipe, in `examples/2d-meadow`, with original art.
- 3D grass and cloth-like props use the same field through `surface` shaders.
- Canvas2D: mesh sprites draw undeformed, with one warning.

Engine: mesh sprites, the field, the include. Developer: which objects react and how. Accept: golden of a bent sprite; the field upload is one buffer write per frame regardless of object count.

#### T-06 Sprite animator and tweens `[ ]`

P1, S. Design: WP-29. Fixes D-13. Accept: as in WP-29.

#### T-07 Mixing 2D and 3D `[ ]`

P1, M. Depends on T-01. Stones: `rendering`, `scenes`, `objects`.

- Layer order decides composition for both dimensions: a 3D camera pass becomes an entry in the layer order instead of always drawing after 2D. Default order stays as today, so existing games do not change.
- `BrioSprite3D`: a sprite as a textured quad in 3D space with depth test, with `billboard: "none" | "spherical" | "cylindrical"`. Uses sprite-sheet frames and the sprite animator.
- A 3D object inside a 2D layer: an orthographic 3D pass whose units are pixels, for 3D props in 2D games.
- Render-target cameras (R-01) cover the remaining cases: a 3D scene shown as a texture in 2D, and a 2D scene on a 3D surface.

Accept: goldens of a billboard in a 3D scene, a 3D prop between two 2D layers, and unchanged goldens for every existing example.

### Track Q: resolution and image quality

#### Q-01 Render scale and presentation `[ ]`

P1, M. Depends on R-01. Design: WP-43 remainder and render study section 5.2. Stones: `game`, `rendering`, `cameras`.

- `camera.renderScale` (0.25 to 1) and `game.rendering.renderScale`: the 3D pass renders into a smaller target and is presented at full size with `"linear"`, `"nearest"` or, after Q-02, `"fsr1"`.
- 2D layers, text and UI compose at native resolution.
- Canvas scale mode `"integer"`, `ResizeObserver`, pixel snapping for sprites and 2D cameras (`camera.pixelSnap`).
- Optional dynamic resolution: the scale follows a frame-time target between two bounds. Off by default; excluded from deterministic replays.

Accept: goldens at scale 0.5 for each filter; text stays at native resolution; input coordinates unchanged.

#### Q-02 FSR 1 upscaling and sharpening `[ ]`

P2, M. Depends on Q-01, R-06, Q-03. Decision DL-05 (confirmed; ADR 0007, update of 2026-11-16). Tier: opt-in module, loaded on demand.

- Port EASU and RCAS from the MIT repository `GPUOpen-Effects/FidelityFX-FSR` (render study section 5). Header on the adapted files and AMD's notice in `THIRD_PARTY_NOTICES.md`. Do not read or copy from the current FidelityFX SDK, whose license is different.
- Presets `"ultraQuality"`, `"quality"`, `"balanced"`, `"performance"` with AMD's published ratios; `sharpness` parameter; texture mip bias applied while a preset is active (take the formula from the integration PDF in the repository).
- RCAS alone is available as a sharpening effect at scale 1.
- Canvas2D: ignored with one warning.

Accept: golden per preset; the effect costs nothing when off; measured gain recorded with F-03.

#### Q-03 Anti-aliasing `[ ]`

P1, S. Depends on R-06.

- `antialias: "none" | "msaa" | "fxaa"`. FXAA runs after tone mapping. Apply the note of ADR 0007 on the origin of the three.js FXAA port, or write the pass from NVIDIA's paper as original code.

Accept: golden per mode.

#### Q-04 Temporal anti-aliasing and temporal upscaling `[ ]`

P3, L. Depends on R-01, G-03. Original code from public literature; no vendor code.

- Sub-pixel jitter of the projection, a motion vector target (including skinned and instanced objects), history reprojection with neighborhood clamping, and upscaling inside the resolve.
- Start on WebGPU; bring to WebGL2 only if the measurements justify it.

Accept: a moving-camera golden sequence without ghosting on the test scene; a written comparison with Q-02.

### Track G: WebGPU

Decision DL-01 is confirmed (ADR 0001, update of 2026-11-16). Read render study sections 1 to 4 first.

#### G-01 Shared GPU layer `[ ]`

P1, L. Depends on R-01 and on the visual features that exist at that point.

- Move out of `WebGL2Backend.ts` everything listed as backend-neutral in render study section 2 into `src/rendering/gpu/`. The WebGL2 backend becomes a device layer that implements a small internal interface (`GpuDevice`: buffers, textures, programs or pipelines, passes, draws).
- One uniform layout table that generates declarations for both shading languages.
- No behavior change: every golden must pass unchanged.

Accept: `WebGL2Backend.ts` contains no sorting, light packing or cascade math; goldens identical.

#### G-02 Built-in shaders in WGSL `[ ]`

P1, L. Depends on G-01. Decision DL-02 (confirmed).

- Hand-written WGSL for every built-in chunk, with the same chunk names and hook points as the GLSL set. Variant selection by the same feature key.
- An offline validation test, like `tests/rendering/ShaderSources.test.ts` does for GLSL, using a WGSL validator when one is installed on the machine. A development tool, never a dependency of the package.

Accept: every feature combination validates in both languages.

#### G-03 WebGPU device layer `[ ]`

P1, L. Depends on G-02.

- Spike first, one session: adapter and device, one triangle, composite onto the 2D canvas with `drawImage`, device loss. Record the findings in the rendering stone before continuing.
- Then: `WebGPUBackend` registered through `registerBackend("webgpu", ...)` in its own chunk; asynchronous pipeline creation with a cache; bind groups by update frequency; texture upload and mipmap generation; depth convention correction; MSAA resolve; shadow passes; render targets.
- `init()` resolves `false` when no adapter or device is available, so the cascade continues to WebGL2.
- Browser tests need a Chromium with WebGPU in CI. If the CI image cannot provide it, tell the maintainer; do not skip the tests silently.

Accept: every 3D example renders on WebGPU within tolerance of its WebGL2 golden; forced device loss recovers.

#### G-04 Parity and custom shaders `[ ]`

P1, M. Depends on G-03.

- Remaining features to parity with the capability matrix (render study section 8).
- Custom shaders through the WGSL variant of R-04, with the selection rule of render study section 4: under `"auto"`, a game with a GLSL-only shader stays on WebGL2 and logs once.
- `preferredBackend` documentation and a `?backend=` switch in the examples.

Accept: the shader lab example shows both variants; the rule is covered by a test.

#### G-05 Compatibility mode and WebGPU extras `[ ]`

P3, L. Depends on G-04.

- Read the compatibility mode restrictions first (render study section 1; not obtained by this study). Request `featureLevel: "compatibility"` as a second attempt before falling to WebGL2, if the backend can stay within the restrictions.
- Extras that use compute, each behind a capability and never required: GPU particle simulation, GPU culling of instances, clustered light assignment.

Accept: each extra has a measured gain in F-03 and a fallback path.

### Track U: interface

#### U-01 Interface contract: state stores, requests, notices `[ ]`

P1, M. Depends on C-04 for persistence tiers. Design: WP-34 (state part) and ADR 0008. Tier: core. Stones: `storage`, `game`, new `ui`.

This is the only surface an interface uses, in either tier and in any framework (study section 10). There is no general event emitter for interfaces to subscribe to.

```ts
// Game side
const hud = game.state.define("hud", { defaults: { score: 0, hp: 100 } });
hud.set("score", 10);                                         // read by the interface as a snapshot

game.ui.onRequest("startGame", ({ slot }: { slot: number }) => game.saves.load(`slot${slot}`));
game.ui.notify("toast", { text: "Saved" });                   // transient, not state

// Interface side (any framework)
hud.subscribe(() => render(hud.getSnapshot()));
game.ui.send("startGame", { slot: 1 });                       // handled at the start of the next update()
game.ui.onNotice("toast", ({ text }) => showToast(text));
```

- **State store**: `game.state.define(name, { defaults, tier, version, migrate })` with `get`, `set`, `getSnapshot`, `subscribe(key, listener)` and `subscribe(listener)`. `getSnapshot()` returns an immutable object that keeps its identity until a value changes, and listeners are called at most once per frame, after `update()`. React's `useSyncExternalStore` requires exactly this ("repeated calls to getSnapshot must return the same value", "must be immutable").
- **Request** (interface to game): a named, typed message. The game declares it with `game.ui.onRequest(name, handler)`; the interface calls `game.ui.send(name, payload)`. Requests are queued and handled at the start of the next `update()`, in arrival order. A request with no handler warns once. Payloads are plain data and are copied.
- **Notice** (game to interface): `game.ui.notify(name, payload)` and `game.ui.onNotice(name, listener)`. Queued and delivered after `update()`, with the store notifications. A notice with no listener is dropped.
- Requests are recorded and replayed with input (X-05). Stores are part of saves (C-05) and visible to the MCP introspection (M-02).
- Values written every frame (a health bar while it drains) should not cause a component render each frame; the store offers `subscribeFrame(key, listener)` for direct style writes.
- `onRequest`, `onNotice` and `subscribe` return a function that removes the registration, and registrations made by a scene or a DOM root end with it.

Accept: no allocation on `set` when the value is unchanged; a listener count test for batching; a request sent during `update()` is handled in the next one, never the current; a replay that includes requests reproduces a run.

#### U-02 Canvas widgets `[ ]`

P1, L. Depends on T-02; draws through Canvas2D until T-01 exists. Design: WP-41. Tier: opt-in module. Stone: new `ui`.

- `BrioUI` tree on `"ui"` layers: panel, label, image, button, progress bar, slider, nine-slice, containers, anchors and margins, a theme object.
- Pointer hit testing with consume rules, keyboard and gamepad focus navigation, layout only when dirty.
- Widgets bind to the state store: `new BrioUIProgressBar({ value: hp.bind("current"), max: hp.bind("max") })`.

Use it for: in-world UI, UI that must appear in captures, post-processing and golden tests, and games that must run inside a worker later. Accept: as in WP-41.

#### U-03 DOM roots `[ ]`

P1, M. Depends on U-01. Decision DL-04 (confirmed; ADR 0008). Tier: opt-in module. Stone: `ui`.

```ts
const hud = game.ui.mount("hud", { order: 10 });   // creates <div data-brio-ui="hud"> over the canvas
hud.element.innerHTML = `<button id="pause">Pause</button><p id="score"></p>`;
score.subscribe("value", (v) => (hud.element.querySelector("#score")!.textContent = String(v)));
hud.visible = false;                                // also hidden by scene changes when bound to a scene
```

- A DOM root is where a React tree (U-04) or plain markup is mounted. It talks to the game only through the contract of U-01.
- `game.ui.mount(name, options)` creates a positioned root inside the game container, above the canvas, sized and scaled with the canvas so that one CSS pixel equals one logical game pixel in every scale mode, including `"fit"` and high-DPI. `mount(element)` adopts an existing element.
- **Input arbitration**: the root has `pointer-events: none`; interactive descendants opt in with `pointer-events: auto`. A pointer event that lands on such an element never reaches the game. While an editable element has focus, `game.keyboard` and the input map ignore key events. `game.ui.focusNavigation` maps input-map actions to DOM focus movement for gamepad and keyboard.
- Roots follow scene visibility, `game.pause()` (an attribute `data-brio-paused` for CSS), and are removed by `game.end()`.
- Styles: a small reset scoped to `[data-brio-ui]`; no global CSS. The developer's own CSS and any framework work unchanged.
- **Stated limits**, to go in the documentation and the capability matrix: a DOM root is always above the canvas and cannot sit between canvas layers; it is not in `captureFrame()`, post-processing, render targets or golden frames; its text depends on host fonts; it does not exist in headless runs or inside a worker.
- HTML-in-Canvas would remove most of these limits by letting the page draw live elements into a canvas, WebGL texture or WebGPU texture. It is an origin trial in Chrome ("through Chrome 160") whose interface is still being renamed, and this study found no commitment from other browsers. Do not build on it; revisit when it ships in two engines.

Engine: mounting, scaling, input arbitration, lifetime. Developer: markup, style, components. Accept: browser tests for scaling across DPR 1 and 2 and `"fit"`; a click on a DOM button does not register as a game click; typing in an input does not move the player.

#### U-04 React binding: `@brio-js/react` `[ ]`

P1, S. Depends on U-03, M-01 (package folder pattern: `packages/react`). Decision DL-04 (confirmed; ADR 0008). A separate package with `react` 18 or newer as a peer dependency. Core gains nothing React-specific.

React is the primary way to write a DOM root: menus, heads-up displays and touch layouts in the documentation and examples are written with it first.

```tsx
function Hud() {
    const score = useBrioState(hudStore, "score");            // useSyncExternalStore over the U-01 contract
    const startGame = useBrioRequest<{ slot: number }>("startGame");
    useBrioNotice("toast", ({ text }) => toast(text));
    return <button onClick={() => startGame({ slot: 1 })}>Score {score}</button>;
}
createBrioRoot(game.ui.mount("hud")).render(<Hud />);
```

- Hooks: `useBrioState`, `useBrioRequest` (a stable function), `useBrioNotice`, `useBrioGame`. Components: `createBrioRoot`, and `<BrioCanvas>` to host a game inside an existing React application with correct mount and unmount, including React's development double mount.
- The package only adapts the contract of U-01. It does not reach engine objects, and it adds no second way to exchange data.
- Works with the usual web toolchain (a Vite React project). An example project and a playground template use it.
- Plain JavaScript and Web Components use the same contract directly and need no package; one short guide shows it.

Accept: a store change renders a component once per frame; unmounting `<BrioCanvas>` ends the game and frees the canvas; the package builds against the lowest and the current supported React versions in its CI job.

#### U-05 Dialogue and text reveal `[ ]`

P1, M. Depends on U-01; renders through U-02 or U-03. Tier: opt-in module plus recipe. Stone: `ui`.

```ts
const talk = new BrioDialogue(script);                 // plain data: nodes, lines, choices, conditions
talk.on("line", ({ speaker, text }) => box.show(speaker, text));
talk.on("choices", (options) => box.ask(options));
talk.start("intro"); talk.advance(); talk.choose(1);
```

- The runner publishes the current line and choices to a state store and accepts `advance` and `choose` as requests (U-01), so a canvas widget or a React component can present it without holding the runner.
- `BrioDialogue` is a runner with no rendering: nodes with speaker, text key, next node, choices with conditions over a state store, and events. Its position is state, so it is saved and restored.
- `BrioTextReveal`: reveals text over game time (characters per second, pauses on punctuation, skip), deterministic under `game.step`. Works on `BrioText`, on a canvas label and on a DOM element.
- Minimal inline markup for color, emphasis and pauses, parsed once when the line starts.
- Text comes from keys in a locale table, so localization does not need a redesign later.
- Recipe, in `examples/2d-visual-novel` with original content: backgrounds and portraits as layers, a backlog, auto-advance, save and load.

Engine: the runner, the reveal, persistence. Developer: script format beyond the node model, presentation, pacing. Accept: a script with a branch and a condition replays identically; save in the middle of a line and restore.

#### U-06 Touch controls `[ ]`

P1, S. Depends on U-02 or U-03. Design: WP-45, touch part.

- `BrioVirtualStick` and `BrioVirtualButton`, available as canvas widgets and as DOM elements, that feed the input map as an axis and as actions. Multi-touch, dead zone, dynamic origin option.
- Touch edges shorter than a frame are latched (known issue in `ROADMAP.md`).
- Shown only when a touch device is detected, by default.

Accept: a browser test with two simultaneous touches driving a stick and a button.

#### U-07 React renderer for canvas widgets `[ ]`

P3, M. Depends on U-02, U-04. A later option recorded in ADR 0008; not planned before the widget set is stable.

- A custom React renderer inside `@brio-js/react` that creates canvas widgets instead of DOM elements, so one component tree can drive either tier. This is the shape native platforms use with React: React's core over a non-DOM renderer.
- Decide after U-02 and U-04 are in use, from real demand.

Accept: decided when picked.

### Track S: sound

#### S-01 Positional audio `[ ]`

P1, M. Design: WP-47, extended. Stones: `audio`, `assets`, `objects`.

```ts
const growl = enemy.audio.play("aud_growl", { loop: true, refDistance: 2, maxDistance: 30, rolloff: 1 });
game.audio.playAt("aud_shot", position, { bus: "sfx" });
scene.audio.listener = camera;       // default: the first active camera of the scene
```

- An emitter per playing voice follows its object's world position each frame. 3D uses `PannerNode`; 2D uses `StereoPannerNode` for pan from the horizontal offset to the camera, and gain from distance.
- Options map to the node's properties: `panningModel` (`"equalpower"` by default, `"HRTF"` optional), `distanceModel` (`"inverse"` by default, `"linear"`, `"exponential"`), `refDistance` (1), `maxDistance` (10000), `rolloffFactor` (1), cone angles (360) and outer gain (0). Defaults in parentheses are the platform's.
- The listener follows a camera. Feature-detect its parameters: MDN notes that the deprecated `setPosition()` and `setOrientation()` "are currently the only way to set the orientation and position in Firefox" (bug 1283029), so use `positionX` and its siblings when present and the methods otherwise.
- Updates write `AudioParam` values without allocating. Emitter state (sound, time, loop) is restorable from checkpoints.
- `HTMLAudioElement` fallback: distance attenuation by volume only, no panning.

Engine: emitters, listener, update. Developer: ranges and which sounds are positional. Accept: fake Web Audio tests for both listener paths; a browser test that a source moving left to right changes the panner position.

#### S-02 Voice budget and buses `[ ]`

P1, M. Depends on S-01. Stones: `audio`.

- A global budget of real voices (default 32). Each voice has a `priority` and an audibility (gain after distance and bus volume). When the budget is exceeded, the least audible, lowest-priority voices become **virtual**: tracked in time but not played, and resumed when they become audible again. This is common practice in audio middleware; the implementation is original.
- Custom buses: `BrioAudioMixer.addBus("ambience", { parent: "sfx" })`. `AudioBusName` widens from the three fixed names; the three stay as defaults.
- `renderStats`-style counters: real and virtual voices, per bus.

Accept: 200 looping emitters with a budget of 32 produce at most 32 source nodes; a virtual voice resumes at the right offset.

#### S-03 Music `[ ]`

P2, S. Design: WP-47, music part.

- Crossfade between tracks, loop regions with an intro, ducking of one bus by another through gain automation, pause in the `HTMLAudioElement` fallback (known issue in `ROADMAP.md`).

Accept: fake Web Audio tests of the gain ramps.

#### S-04 Environment effects `[ ]`

P3, M. Depends on S-02, P-02.

- Reverb zones with a `ConvolverNode` whose impulse response is generated in code (decaying noise), so no asset is required. A send bus per zone; emitters inside blend in.
- Occlusion: a low-pass `BiquadFilterNode` per emitter driven by a raycast from the listener, at a reduced rate.

Accept: entering a zone ramps the send; an occluder between listener and emitter lowers the cutoff.

### Track P: physics, queries, controllers

#### P-01 Physics in the ECS `[ ]`

P1, L. Depends on F-04. Design: WP-46, first half. Fixes D-21.

- Colliders and bodies in the `collider` and `rigidBody` buffers with facades as views; a physics system in the fixed phase; solid pairs resolved; trigger and collision events from a persistent pair set; numeric broad-phase keys; rename `SpatialOctree3D` with a deprecated alias.

Accept: as in WP-46; determinism through snapshots.

#### P-02 Queries `[ ]`

P1, M. Depends on P-01.

- `game.physics.raycast2D` and `raycast3D` (first hit and all hits, with a layer mask), overlap tests for box, circle, sphere and capsule, and shape casts (a shape swept along a segment). Results are written into caller-provided or pooled records.
- `game.pick(x, y)` for 3D objects: ray against bounds, then triangles by option.

Why: controllers, shooting, selection, camera arms, audio occlusion and AI all start from a query. Accept: tests against analytic cases; no allocation per query after warm-up.

#### P-03 Character controller `[ ]`

P1, M. Depends on P-02. Design: WP-46, controller part; Godot's `CharacterBody` as the reference shape.

```ts
const body = new BrioCharacterBody3D(player, { radius: 0.4, height: 1.8, maxSlope: 45, stepHeight: 0.3 });
body.velocity.y -= 20 * dt;
body.moveAndSlide(dt);                       // in fixedUpdate
if (body.isOnWall && game.input.isPressed("jump")) jumpAwayFrom(body.wallNormal); // the game's own rule
```

- 2D and 3D versions: move, collide, slide, with slope and step limits, moving platform velocity, and one-way platforms in 2D.
- Reports `isOnFloor`, `isOnWall`, `isOnCeiling`, their normals, and the list of contacts of the last move.
- **Not in the engine**: wall jumps, slides, dashes, coyote time, jump buffering. They are short rules over the reported contacts and belong in `examples/` as recipes, with the reasons written in the code.

Accept: the 2D platformer example runs without game-side collision resolution; no tunneling through thin walls at the tested speeds.

#### P-04 Static mesh colliders `[ ]`

P2, L. Depends on P-02.

- Triangle mesh colliders for level geometry with a bounding volume hierarchy built at load; capsule and oriented boxes; queries and the character controller work against them.

Accept: a character walks on an imported level mesh.

#### P-05 Camera controllers `[ ]`

P1, M. Depends on R-01; the third-person arm uses P-02. Design: WP-44.

- `BrioOrbitControls`, `BrioFirstPersonControls`, `BrioThirdPersonControls` (an arm that shortens when a shape cast hits geometry, smoothed with `BrioSpring`); `BrioCamera3D.follow` and `shake`; render-target cameras for minimaps.

Accept: as in WP-44.

### Track C: content flow

#### C-01 Asset manager v2 `[ ]`

P1, M. Depends on R-01. Design: WP-30. Fixes D-05 fully. Accept: as in WP-30.

#### C-02 Scene manager `[ ]`

P1, M. Depends on C-01. Design: WP-31. Accept: as in WP-31.

#### C-03 Transitions `[ ]`

P2, S. Depends on C-02, R-06. Design: WP-32. Accept: as in WP-32.

#### C-04 Storage v2 `[ ]`

P1, M. Design: WP-33. Fixes D-15, D-16. Accept: as in WP-33.

#### C-05 Saves `[ ]`

P1, M. Depends on C-04, F-04, U-01. Design: WP-34 and WP-10. Fixes D-17.

- `game.saves` with versioned slots, migrators, the `.briosave` container, export and import, and restore after a page reload through the snapshot name table.
- State stores, animator state, dialogue position and emitter state are included.

Accept: as in WP-34 and WP-10.

#### C-06 Scene documents `[ ]`

P2, L. Depends on F-04, A-07. Decision DL-10. Tier: opt-in module. Stones: `scenes`, `assets`.

- `BrioSceneDocument`: a JSON description of a scene (assets, layers, cameras, lights, objects with transforms and components, prefabs, sectors, UI roots), with a JSON Schema 2020-12 published in the package.
- `scene.toDocument()` and `BrioScene.fromDocument(doc)`; loading validates against limits like the model loaders do.
- Code stays first-class: a document describes content, and behavior stays in code that finds objects by name.
- Hot reload: applying a changed document patches the running scene where it can and reports what needed a restart.

Why: agents edit data more reliably than imperative code (MCP study), and documents make scenes diffable in version control. Accept: round trip equality; an invalid document is rejected before anything changes.

#### C-07 World streaming `[ ]`

P3, L. Depends on C-02, R-10.

- Additive scenes loaded and unloaded by distance to streaming sources, on a grid or by sector links, with a budget per frame for activation work.

Accept: a camera crosses a world of 16 cells with flat memory in `renderStats`.

### Track X: tooling and delivery

#### X-01 Debug views, profiler, frame capture `[ ]`

P1, M. Design: WP-48. Also a prerequisite of the MCP package.

- `game.captureFrame(options): Promise<Blob>` on every backend, with the option to include DOM roots left out explicitly and documented.
- Stats overlay with per-system time; views for wireframe, bounds, skeletons, skin weights, LOD level, sectors, the shadow atlas and the interaction field; GPU timer when available.

Accept: zero overhead when off; a captured frame equals the golden of the same step.

#### X-02 Asset tooling `[ ]`

P2, M. Depends on M-01 (package folder pattern). Decision DL-05 (confirmed). A Node tool, exposed as a command of the tooling package and as MCP tools; never part of core.

- `brio lod <model>`: generates levels with `meshoptimizer` (MIT, its JavaScript simplifier) and writes them into the model with the naming convention of R-09.
- `brio compress <model>`: mesh quantization and compression, texture conversion.
- `brio inspect <model>`: triangles, draw calls, bones, clips, texture memory, against budgets.

Accept: generated levels load through R-09; the tool refuses to overwrite its input without a flag.

#### X-03 Packaging and release `[ ]`

P2, M. Design: WP-53, extended.

- Bundle budgets per preset enforced in CI; the public API surface review of `ROADMAP.md` ("Before 1.0").
- A documented path for an offline-capable web build, and for desktop and mobile shells through the existing `PlatformAdapter` targets.
- A quality settings model (`game.rendering.quality = "low" | "medium" | "high" | custom`) that groups render scale, shadows, effects and LOD bias, stored through the state store.

Accept: a new user follows the guide from an empty folder to an installable build.

#### X-04 Reference examples `[ ]`

P1, L. Depends on the shortest paths of section 4. Replaces WP-49 to WP-51.

Four examples, each with original or license-checked content recorded in its folder, readable code, a golden test and a replay test. They exercise the capability classes of study section 3 and copy nothing from the games that inspired the classes:

- `3d-platformer`: skinned character, state machine, character controller with the movement recipes, third-person camera, low-fidelity kit.
- `3d-dense-level`: sectors, instancing, LOD, many lights, positional audio with a voice budget, additive scene loading.
- `2d-action`: GPU 2D, mesh sprites reacting to the player, particles, 2D lights, a 3D prop between layers.
- `2d-visual-novel`: DOM interface, dialogue, saves, touch.

Plus the shader lab of WP-23.

#### X-05 Input injection and replay `[ ]`

P1, S. Design: WP-45, injection part. Also a prerequisite of the MCP package.

- `game.input.inject(event)` for keyboard, mouse, touch and gamepad, routed through the input classes without DOM events.
- `game.input.record()` and `replay(recording)`: timestamped by fixed step, so a replay with the same seed reproduces a run.

Accept: a recorded run replays to an identical snapshot.

## 6. Stones and glossary

Create stones when the first package touches the area: `animation` (`src/animation`), `shaders` (`src/shaders`), `ui` (`src/ui`), `particles` (`src/particles`), and `gpu` if `src/rendering/gpu` grows its own invariants.

Glossary terms to add with their packages, in addition to section 8 of the earlier plan: Request, Notice, Canvas Widget, Shader Variant, Level of Detail, Sector, Static Batch, Instanced Mesh, Render Scale, Upscaler, Mesh Sprite, Interaction Field, Influence, Skin Binder, Pose, Emitter (audio), Listener, Virtual Voice, Character Body, Query, State Store, DOM Root, Dialogue, Text Reveal, Scene Document, Recipe.

## 7. Risks

| Risk | Mitigation |
| --- | --- |
| About sixty packages | The shortest paths in section 4 reach each target class with a subset. P3 packages wait for evidence |
| R-01 changes every visual path | Goldens first (F-02); slices behind the old contract; no feature work on the old contract after slice 2 |
| Two GPU backends drift apart | Shared layer before the second backend; one layout table; goldens run on both |
| GLSL-only custom shaders on WebGPU | The selection rule keeps such games on WebGL2 and says why (DL-02) |
| DOM UI gives a different result from canvas UI in captures and tests | Limits are stated in the capability matrix; examples that need captures use canvas widgets |
| Runtime weight grows with opt-in modules | Each opt-in module has its own entry point and a bundle budget (X-03) |
| Port from a source whose license changed | Section 9 of the lifecycle study names the exact repository and copy allowed per source |
| Budgets are guesses | F-03 replaces them; a package that claims a performance result cites a benchmark file |
| The study base is missing on the machine | Session rule 3: recreate the clones and read before writing |
