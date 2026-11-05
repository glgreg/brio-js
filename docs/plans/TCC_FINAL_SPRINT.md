# TCC Final Sprint

Status: **Active. This is the current plan.** Created 2026-10-31. Final presentation: **Friday 2026-11-13**.

Start every session here. This file overrides [`ENGINE_COMPLETION_PLAN.md`](./ENGINE_COMPLETION_PLAN.md) on order and priority. That plan is the design reference: read the cited work package for its design, and apply the scope written here.

## 1. Context

- **`develop` is the TCC's present.** Work continues from it. Earlier plans do not bind this work, including the registered work plan and the older `TODO.md`.
- **Scope is flexible.** The maintainers have freedom to change it, so 2D and 3D are both in.
- **AI sessions run almost continuously until the freeze.** Capacity is high, so do not reduce scope by assuming a lack of time. Only the maintainers cut scope. If an item is at risk, tell them.
- **The presentations need visual polish.** Shaders, shadows, lights and some post-processing are core work.
- **Automated tests continue**, including browser tests.
- **Order: first make the project solid, then write.** Engineering ends at the code freeze, and the remaining days belong to the text and the presentation.
- **User tests with people are not planned**, for lack of time. This does not affect automated tests.
- **Do not edit the `tcc` branch now.** At the very end, `main` will be merged into it and its documentation kept. Reading from it is fine, for example for its CC0 assets.
- **Parked, do not raise unless asked:** backup of local notes, line-by-line audit of code origin, IFPR rules, the reading list and the remaining research gaps. `docs/tcc/` records them.

## 2. Calendar

| Dates | Focus |
| --- | --- |
| Sun 01/11 to Sun 08/11 | Engineering, in the order of section 5 |
| Thu 05/11 at the latest | Demos start, in parallel with the remaining work |
| **End of Sun 08/11** | **Code freeze.** After this, only fixes for bugs that break a demo |
| Mon 09/11 to Thu 12/11 | Writing, figures, measurements, rehearsal |
| Fri 13/11 | Final presentation |

The freeze date is a proposal the maintainers can move, here in this table.

## 3. Environment

Checked by S0 on 2026-10-31, on the maintainer's Windows machine.

| Tool | State |
| --- | --- |
| Bun 1.4.4 | In `~/.bun/bin`, on the user PATH. A session can inherit an older PATH; if `bun` is not found, run `$env:Path = "$env:USERPROFILE\.bun\bin;$env:Path"` |
| Node, npm | **Not installed.** `npm run check` and `npm ci` cannot run, and `bun run check` fails too, because the script calls `npm test` |
| `gh` | Logged in as the maintainer |

The maintainer accepted the commands below as the equivalent of `npm run check` for now. They run the same steps, on the Bun runtime:

```powershell
bun install --no-save                       # uses the versions in package-lock.json and writes no bun.lock
bun run typecheck
bun --bun run test
bun run build
bun pm pack --dry-run --ignore-scripts      # the file list in place of npm pack --dry-run
bun .keystone/bin/keystone.js stone doctor
```

Baseline on `develop`: type check clean, 273 tests passed and 3 skipped (`GLBRealAsset` needs a local asset that is not in the repository), build and pack clean, doctor with 0 errors.

Limits of this setup:

- Local results come from Bun, not Node. CI runs on Node 22 and 24, so it is the real evidence, and a pull request needs it green before merging.
- Playwright (S1) has not been tried on Bun. If S1 needs Node, stop and tell the maintainer.
- `keystone stone doctor` can warn `stale-index` when it is a false positive: with `core.autocrlf=true`, `.keystone/architecture.md` is CRLF on disk and the generated index is LF. The content is the same, and the warning goes away with `--fix`. A real change shows up in `git diff`.

If something else is missing or does not work, **tell the maintainer what is missing and what it blocks, per `CLAUDE.md`. Do not change scripts or project structure to work around it.** Record the working commands in this section.

## 4. Sprint rules

1. **`develop` stays demo-ready.** Each item is a short branch and pull request that can merge on its own. Sessions can run in parallel on items that do not share files.
2. **Do not cut scope on your own.** Report risks to the maintainers. Do not leave half-finished features merged.
3. **No large refactors of existing structure.** Extend contracts additively, with new optional methods on `RenderBackend`. New internal capabilities such as render targets are fine.
4. **Project invariants hold:** no allocation in the game loop, generational handles, snapshot readers for older versions, `ModelLoaderLimits` on anything read from a file, TSDoc on public symbols, zero runtime dependencies, no AI attribution, English in code and docs.
5. **Automated tests are required.** Vitest for logic, and browser tests from S1 for anything visual, because the fake WebGL context only checks calls. A regression gets a test that reproduces it. CI stays green.
6. **Definition of done per item:** tests added and passing, `npm run check` or its confirmed equivalent green, `CHANGELOG.md` updated, affected stones updated, `keystone stone doctor` clean, and the item ticked here in the same pull request.
7. **Use real sources:** consult [`temp/research/`](../../temp/research/README.md) and the clones in `temp/repos/` when designing. Do not work from memory. When a technique is used or ported, add it to the local [`docs/tcc/PROCEDENCIA.md`](../tcc/PROCEDENCIA.md).
8. **Third-party code:** three.js and Godot may be ported under MIT with a file header and `THIRD_PARTY_NOTICES.md`, after checking Godot's `COPYRIGHT.txt` for the file. Unity, Unreal and NVIDIA are concepts and algorithms only.

Status marks: `[ ]` pending, `[~]` in progress, `[x]` done, `[-]` cut by the maintainers.

## 5. Work, in order

S1 goes first among the features because everything visual depends on it. S8, S9 and S10 do not touch the GL pipeline, so they can run in parallel sessions.

### S0 Baseline `[x]`

- Commit the planning documents left uncommitted in the working tree: `.gitignore`, `jsconfig.json`, `.keystone/identity.md`, `CLAUDE.md`, `docs/ROADMAP.md`, the study and the plans. Use a `docs/` branch and pull request, and review the diff first.
- Install dependencies and run the baseline, per section 3. Report failures to the maintainer before new work. Run `keystone stone doctor`.
- Fix the documentation drift listed at the end of section 3 of the [study](../architecture/ENGINE_COMPLETION_STUDY.md).
- Add `docs/adr/0007` for the third-party policy, `THIRD_PARTY_NOTICES.md`, and its entry in `files` in `package.json` (WP-01).

### S1 Browser test rig `[~]`

Design in WP-02.

- [x] Playwright as a dev dependency only, with headless Chromium and WebGL2.
- [x] Golden-image tests with tolerance, deterministic through `game.pause()` and `game.step(1 / 60)`, starting with the two current examples, on WebGL2 and Canvas2D.
- [~] Heap growth check over a run of frames, for the no-allocation rule. `e2e/heap.spec.ts` passes for 2D, text, collisions and tile maps; the 3D scenario is open, see [`PERFORMANCE_FOLLOWUPS.md`](./PERFORMANCE_FOLLOWUPS.md).
- [x] Added to `.github/workflows/ci.yml`.

### S2 Repairs `[~]`

The defect IDs are in section 3 of the study.

- [x] D-01: render the 2D hierarchy through world transforms; camera follow, culling and collision read world values (WP-03).
- [x] D-12: 2D culling works with rotation and `game.scale`.
- [ ] D-02: glTF accessors, all component types, `normalized` and `sparse` (WP-04).
- [x] D-04: replace the lighting string key with a numeric version.
- [x] D-06: `transform.opacity` takes effect in 3D.
- [x] D-14: `object.sprite` returns early when unchanged.
- [x] D-20: `game.instantiate()` accepts `BrioObject3D`.
- [x] D-18: `BrioScene.fixedUpdate()`.
- [x] D-19: interpolation covers rotation and scale.
- [x] 3D frustum culling with bounding spheres, using the existing `isSphereInFrustum` (WP-12).
- [x] `BrioCompositor.#render3DPasses` clears when there are no 3D objects. Scene 2D cameras get `game.random`.

### S3 BrioShader `[ ]`

Confirmed by the maintainer: **`BrioShader` is an ordinary asset in the lifecycle**, loaded in `preload()` and found by name. Shaders must be highly customizable in GLSL, with a simple public API. The design is in WP-21 of the [completion plan](./ENGINE_COMPLETION_PLAN.md), and the evidence is in [`shader-authoring.md`](../../temp/research/shader-authoring.md).

```ts
game.preload(() => [
    new BrioShader("shd_water", "./shaders/water.glsl"),
    new BrioMaterial("mat_water", { shader: "shd_water", parameters: { uFoam: 0.4 } }),
]);
```

- [ ] D-07: program failure never throws from a draw. It logs once with file and line, then uses the last good program or a visible error material. Use `KHR_parallel_shader_compile` when present (WP-15).
- [ ] Rewrite the built-in fragment shader on the same hooks, so `inject()` and `standard` share one path.
- [ ] `BrioShader` from a `.glsl` file or inline, accepted by `game.preload()` and `scene.preload()`.
- [ ] `surface` domain with `vertex()`, `fragment()` and `light()` hooks and built-ins. `TIME` comes from game time.
- [ ] `BrioMaterial` `shader` and `parameters` options; `material.inject()`; `material.set()` with JavaScript values; allocation-free `material.parameter()`.
- [ ] Parameters discovered with `getActiveUniform`; comment annotations `@color`, `@range`, `@default`, `@linear`.
- [ ] `varying` rewrite, custom vertex attributes, `defines`, render state on the material.
- [ ] Reference-counted, hash-deduplicated programs; source limits; reserved `brio_` names; include resolver with depth 25 and no cycles; the `<brio/...>` library (WP-22).
- [ ] Hot reload by assigning `shader.source`, keeping the last good program; `shader.onCompile`.
- [ ] Texture settings: color space, wrap, filter, data textures (WP-13).
- [ ] Raw mode.
- [ ] `screen` domain, used by S6.
- [ ] Layer shader for 2D: draw a `BrioLayer` offscreen in Canvas2D, upload it to GL, run a shader, and copy back. Per-sprite 2D shaders need the GPU 2D renderer in section 6.
- [ ] Canvas2D: warns once and uses the `fallback`.
- [ ] Global parameters: `game.shaderGlobals` (WP-22).

### S4 Lights and standard material `[ ]`

- [ ] `point` and `spot` in `BrioLight` and the `BrioLights` UBO, fixed capacity, attenuation from `KHR_lights_punctual`. No recompile when the count changes (WP-16). Lights stay JS objects in this sprint.
- [ ] Canvas2D: point lights through luminance per triangle.
- [ ] `shading: "standard"`, with GGX, metallic and roughness, ported from `three: ShaderChunk`, built on the hooks of S3.
- [ ] Normal, metallic-roughness, occlusion and emissive maps; `TANGENT` or derivative frame; `COLOR_0`; glTF import with `KHR_materials_unlit`, `KHR_materials_emissive_strength`, `KHR_texture_transform`, `KHR_lights_punctual` (WP-17).
- [ ] Per-texel alpha blend, object-level sort.
- [ ] `"toon"` shading.

### S5 Shadows `[ ]`

Design in WP-20. Evidence in [`nvidia.md`](../../temp/research/nvidia.md#shadows) and `three: WebGLShadowMap.js`.

- [ ] Internal depth render target and shadow atlas; hardware PCF through `sampler2DShadow`.
- [ ] Directional shadows with up to 4 cascades, practical split with default weight 0.5, casters culled per split.
- [ ] Spot shadows.
- [ ] Point shadows, with a limit.
- [ ] `castShadow`, `receiveShadow`, `bias`, `normalBias`; `autoUpdate` and `needsUpdate` for static scenes.
- [ ] Custom `vertex()` hooks and skinning apply in the shadow pass.

### S6 Post-processing and tone mapping `[ ]`

Design in WP-18 and WP-42. `three: examples/jsm/postprocessing`.

- [ ] HDR render target, RGBA16F when `EXT_color_buffer_float` or `EXT_color_buffer_half_float` allows, with a fallback to tone mapping in the fragment shader. MSAA through a multisample renderbuffer and blit.
- [ ] Tone mapping: `reinhard`, `aces`, `agx`, `neutral`, with `exposure`.
- [ ] Effect chain on a camera, over shared targets: `camera.effects = [...]`.
- [ ] Effects: bloom, FXAA after tone mapping, vignette, color grading, pixelate, and custom effects through a `screen` shader. For FXAA, check the terms of three's upstream port or write it from the NVIDIA paper.
- [ ] `invalidateFramebuffer` on discarded attachments.
- [ ] Canvas2D: effects are skipped with one warning.

### S7 glTF tree and skeletal animation `[ ]`

Bones as indices in a pose pool is confirmed. Design in WP-24 to WP-28. Formulas in the [glTF specification](../../temp/research/sources/gltf-spec.adoc), line 3066 and line 3993.

- [ ] D-03: keep the glTF node tree and shared meshes instead of baking (WP-24).
- [ ] `BrioMesh` `joints` and `weights`; `BrioSkeleton`; pose pool; bone texture with `texelFetch` (WP-25). New loader limits.
- [ ] `BrioAnimationClip` with `STEP`, `LINEAR` and `CUBICSPLINE`; per-track cursor; binding by index.
- [ ] `BrioAnimator`: `play`, `crossFade`, speed, loop, events, layers with bone masks, override and additive. Node animation for non-skinned parts (WP-26).
- [ ] State machine: states, transitions with conditions, `exitTime`, duration; 1D blend space; root motion; `animator.attach(bone, object)` (WP-27).
- [ ] Morph targets (WP-28).
- [ ] Skinning works with custom `surface` shaders and shadows.
- [ ] Canvas2D: CPU skinning for low-poly models.

### S8 Scene manager and asset release `[ ]`

Design in WP-30 to WP-32.

- [ ] `game.scenes` as `BrioSceneManager`, keeping `get`, `has` and iteration; `game.setScene()` stays.
- [ ] `load(name, { mode: "single" | "additive", activate })`, returning an operation with `onProgress`, `ready`, `allowActivation()`, `done`.
- [ ] `unload(name)`, `setActive(name)`, `push(name)`, `pop()`, with the active scene receiving new objects.
- [ ] Compositor renders every loaded scene in order.
- [ ] Reference count per scene; `RenderBackend.release?()` frees GPU buffers and textures (D-05).
- [ ] Per-item progress in preload; failures reported per item; asset dedup.
- [ ] Transitions: color fade, and shader wipes through S6.

### S9 Storage and saves `[ ]`

Design in WP-33 and WP-34. Facts in [`standards.md`](../../temp/research/standards.md).

- [ ] D-15: resolve `db` writes on transaction `complete`; handle `onblocked`, `versionchange` and `QuotaExceededError`.
- [ ] D-16: `BrioStorage.namespace("game")`; `keys()` on every tier.
- [ ] `BrioStorage.file`: `exportFile` with `showSaveFilePicker` when present, else a Blob download; `importFile` with a hidden input.
- [ ] `BrioStorage.opfs`, `requestPersistence()`, `estimate()`.
- [ ] `game.state.define(name, { tier, version, defaults, migrate })`, with `get`, `set`, `subscribe`, a debounced write, and a flush on `pagehide`.
- [ ] `game.saves`: `save`, `load`, `list`, `delete`, `export`, `import`. The `.briosave` file has a magic, a version and a checksum, and bad files are rejected before anything changes.
- [ ] Restoring ECS worlds after a page reload (D-17): add a name table to the snapshot, plus the JS-side fields it needs, with a version bump and older readers kept. Scope it with the maintainers if it requires the ECS refactors in section 6.

### S10 2D content `[~]`

- [ ] Sprite clip separated from playback (D-13); `BrioTween` with easing (WP-29).
- [~] `BrioText`: font, size, color, align, wrap, with `FontFace` loading in preload (WP-37). Done in v0.2 except `FontFace` loading.
- [x] `BrioTileMap` rendering in chunks of 16 tiles, and Tiled JSON import (WP-38).
- [ ] `BrioParticleEmitter2D`, SoA, seeded by `game.random` (WP-40).
- [ ] UI: label, image, button, bar, slider, containers, anchors, pointer and keyboard focus (WP-41).
- [ ] `tint`, `blendMode`, shapes, nine-slice (WP-36).

### S11 Cameras and canvas `[ ]`

- [ ] DPR with `maxPixelRatio`, `ResizeObserver`, fit, fill and integer scale modes (WP-43).
- [ ] `BrioOrbitControls`, `BrioFirstPersonControls` with Pointer Lock (WP-44).
- [ ] `BrioCamera3D` follow and shake; render-to-texture camera for a minimap.

### S12 Demos `[ ]`

Start by 05/11. Use only the public API, in `examples/`, with readable code because it is teaching material. Each demo gets a golden test.

- [ ] **2D platformer**: scenes, layers, tile map, animated sprites, parent and child objects, text and HUD, particles, sound, a layer shader, save through file and IndexedDB. The CC0 pack in `mepi/assets` on the `tcc` branch is a candidate; read its license file and check the font separately.
- [ ] **3D scene**: animated GLB character (check the model's license), PBR, point, spot and directional lights, shadows, tone mapping, bloom and FXAA, custom shader from a `.glsl` file, orbit camera, additive scene load, save.
- [ ] **Shader lab**: live GLSL editing, error list, parameter sliders. Reuse the Monaco setup in `showcase/` on the `tcc` branch if it fits (WP-23).

### S13 Freeze `[ ]`

- [ ] `CHANGELOG.md`, `README.md` status, `docs/ROADMAP.md`, `GLOSSARY.md`, stones, TSDoc, `keystone stone doctor`, `npm pack --dry-run`.
- [ ] Merge to `main` through a pull request, per the standards, when the maintainers ask. The version number is their decision.
- [ ] Capture material for the text: screenshots, `game.renderStats`, bundle size per preset, frame time on the machines at hand, with the method noted.

## 6. Queue after the core

Pull from this list, in order, whenever the items above are done before the freeze. Tell the maintainers what was picked.

| Item | Work packages |
| --- | --- |
| Image-based lighting, sky, fog | WP-19 |
| Instancing, LOD | WP-14 |
| GPU 2D renderer, which enables per-sprite 2D shaders | WP-35, then the `canvas` domain in WP-23 |
| 2D lights | WP-39 |
| Physics events, raycasts, character controller, 3D resolution | WP-46 |
| 3D particles | WP-40 |
| Comparative benchmark with three.js | WP-52 |
| Input map, spatial audio, profiler | WP-45, WP-47, WP-48 |
| ECS refactors: asset ids, hierarchy arrays, systems | WP-07 to WP-09 |

Not planned before the presentation:

| Item | Reason |
| --- | --- |
| WebGPU, WebGL1, Workers | Decision confirmed by the maintainer: focus on WebGL2 |
| User tests with people | Not enough time |

## 7. Writing phase

From 09/11 the sessions serve the text. Useful local material, in `docs/tcc/`:

- [`PROCEDENCIA.md`](../tcc/PROCEDENCIA.md): origin of each technique, with references.
- [`QUESTOES_DO_TCC.md`](../tcc/QUESTOES_DO_TCC.md): academic points, including how to treat the original objectives.
- [`LACUNAS_DE_PESQUISA.md`](../tcc/LACUNAS_DE_PESQUISA.md): what must be verified before citing.
- The [study](../architecture/ENGINE_COMPLETION_STUDY.md) and the ADRs: decisions, alternatives and limits.

## 8. Progress log

Add one line per merged item: date, item, pull request, and anything the maintainers cut.

| Date | Item | Note |
| --- | --- | --- |
| 2026-10-31 | Planning | Sprint created; planning documents not yet committed |
| 2026-10-31 | S0 | PR #13. Node and npm not installed; Bun sequence accepted as the equivalent for now |
| 2026-11-05 | v0.2.0 | PR #14, released as 0.2.0. S1 rig, D-20, 3D frustum culling, scene camera random, text, tile maps, input map, DPR and fit |
| 2026-11-05 | S2 | `fix/s2-repairs`: D-01, D-04, D-06, D-12, D-14, D-18, D-19, empty 3D pass clear, loop error boundary, pause when hidden, touch-action, heap budget test. D-02 (glTF accessors) stays open. Browser and performance runs moved to a desktop machine: [`PERFORMANCE_FOLLOWUPS.md`](./PERFORMANCE_FOLLOWUPS.md) |
