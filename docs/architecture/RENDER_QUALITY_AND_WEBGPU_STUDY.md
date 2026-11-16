# Render Quality and WebGPU Study

Status: **Study** (2026-11-15). Decisions DL-01, DL-02 and DL-05 were confirmed by the maintainer on 2026-11-16. Companion of [`GAME_LIFECYCLE_STUDY.md`](./GAME_LIFECYCLE_STUDY.md); read its section 1 for the method and limits, which apply here. Work packages are in [`GAME_LIFECYCLE_PLAN.md`](../plans/GAME_LIFECYCLE_PLAN.md), tracks R (render), G (WebGPU) and Q (quality).

Questions answered here:

1. What is needed to add WebGPU to the cascade without doubling the cost of every feature.
2. Whether DLSS, FSR or XeSS apply to the web, and what BrioJS can implement.
3. Which optimizations a denser, more realistic 3D scene needs, and in which order.
4. What a low-fidelity "retro" look needs from the engine.

## 1. WebGPU availability

Read on 2026-11-15 from the [gpuweb implementation status wiki](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status) (last edited 2026-10-02), [web.dev](https://web.dev/blog/webgpu-supported-major-browsers) (2025-11-25) and [caniuse](https://caniuse.com/webgpu).

| Browser | On by default | Not yet |
| --- | --- | --- |
| Chrome, Edge | Windows x86/x64, macOS, ChromeOS since 113. Android 12+ on ARM, Qualcomm and Intel GPUs since 121; Imagination on Android 16+ since 139. Linux: Intel Gen12+ since 144, NVIDIA (driver 535.183.01+) on Wayland since 147 | Other Linux GPUs and Windows ARM64 are behind a flag. Samsung Xclipse and other Android GPUs are "TBD" |
| Firefox | Windows since 141. macOS on Apple Silicon since 145 (macOS 26) and 147 (all versions) | Linux and Intel Macs are Nightly only ("Mozilla expects to ship on Linux in 2026"). Android is behind a flag |
| Safari | macOS 26, iOS 26, iPadOS 26, visionOS 26 | Earlier OS versions |

caniuse lists Firefox as "Disabled by default" and Safari as "Partial support", which conflicts with the wiki for Windows and macOS; the wiki is per platform and more specific.

**WebGPU compatibility mode.** Chrome 146 shipped an opt-in mode that "lets you run WebGPU on older graphics APIs like OpenGL ES 3.1", requested with `navigator.gpu.requestAdapter({ featureLevel: "compatibility" })`, "starting with Android", with ChromeOS and Direct3D 11 described as being explored ([New in WebGPU 146](https://developer.chrome.com/blog/new-in-webgpu-146)). It targets "a slightly restricted subset of the WebGPU spec". The list of restrictions is on [WebGPU Fundamentals](https://webgpufundamentals.org/webgpu/lessons/webgpu-compatibility-mode.html) and was **not obtained** by this study; read it before package G-05.

None of these pages mentions a hardware ray tracing interface in WebGPU. This study found no evidence of one, so ray tracing on the web means a software technique in compute or fragment shaders, which is out of scope.

Consequences for BrioJS:

- **WebGL2 remains a first-class backend for years**, not a legacy path: Linux, part of Android, Intel Macs on Firefox and older Apple systems land on it. Every visual feature must exist on WebGL2 unless it is declared WebGPU-only in the capability matrix.
- **The cascade already behaves correctly** when WebGPU is present but unusable: `BrioRenderer.initBackend()` disposes a backend whose `init()` resolves `false` or throws and tries the next one ([`RENDERING_STUDY_THREEJS.md`](./RENDERING_STUDY_THREEJS.md) section 1). `requestAdapter()` returning `null` is such a case.
- The cascade order becomes: WebGPU core, WebGPU compatibility (when G-05 exists), WebGL2, Canvas2D.

## 2. What blocks a second GPU backend today

`WebGL2Backend.ts` is one file of about 1,700 lines that holds, together: GLSL source strings, the program cache, feature bits, light packing, the draw list and its sort, texture and buffer upload, the shadow pass, and the copy onto the 2D canvas. The contract it implements is immediate: the compositor calls `renderMesh3D()` once per object (`src/rendering/contracts/RenderBackend.ts`).

Writing `WebGPUBackend` against that contract would duplicate all of it. The earlier study already named the fix: "introduce a shared `GpuResourceCache` / render-list layer used by both `WebGL2Backend` and `WebGPUBackend` (the equivalent of `src/renderers/common`), so sorting, culling, and material feature keys are written once" (`RENDERING_STUDY_THREEJS.md` section 3), and designed the contract as WP-11 of [`ENGINE_COMPLETION_PLAN.md`](../plans/ENGINE_COMPLETION_PLAN.md).

So the order is fixed: **contract v2 (R-01), then the shared layer (G-01), then the WebGPU device layer (G-03)**. Features added before G-01 should be written with the split in mind: logic that does not call `gl.*` goes in a backend-neutral module.

What is backend-neutral, and what is device-specific:

| Backend-neutral (`src/rendering/gpu/`) | Device-specific (one implementation per API) |
| --- | --- |
| Render list, packed sort keys, pooled items | Buffers, textures, samplers, upload |
| Material feature key and variant bookkeeping | Shader module or program creation, pipeline or program cache |
| Light selection and packing into typed arrays | Binding of uniform data (UBO, bind group) |
| Shadow cascade split and fit math | Render pass begin and end, attachments, resolve |
| Bone and morph data packing | Draw submission, instancing calls |
| Uniform layout tables (one description, two code generators) | Presentation to the canvas, context or device loss |
| Effect chain graph and render target pool sizes | Timestamp or timer queries |

## 3. WebGPU backend design notes

These are API facts from the WebGPU specification and MDN, to be re-read at implementation time ([WebGPU API on MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API), [specification](https://www.w3.org/TR/webgpu/), [WGSL](https://www.w3.org/TR/WGSL/)). They state how each concern of the WebGL2 backend maps.

| Concern | WebGL2 today | WebGPU |
| --- | --- | --- |
| Start-up | Synchronous context | `requestAdapter()` then `requestDevice()`, both asynchronous and both may fail. `init()` already returns a promise |
| Loss | `webglcontextlost` and restore, tested in `e2e/` | `device.lost` promise; recreate the device and every resource from CPU copies |
| Programs | `compileShader`, `linkProgram`, variants by `#define` | `createShaderModule` plus `createRenderPipelineAsync`. A pipeline also fixes vertex layout, blend, depth and target formats, so the cache key is wider than the WebGL2 one |
| Per-frame and per-pass data | Two UBOs (lights, pass) | Bind group 0: frame and pass. Bind group 1: material. Bind group 2: object (dynamic offset into one large uniform buffer, or a storage buffer indexed by instance) |
| Textures | `texStorage2D`, `generateMipmap` | `copyExternalImageToTexture`; mipmaps must be generated by the engine with a small render pass, because there is no `generateMipmap` |
| Shadows | Depth texture, `sampler2DShadow` | Depth texture with a comparison sampler |
| MSAA | Default framebuffer or multisample renderbuffer plus blit | Multisampled color attachment with `resolveTarget` |
| Depth | `[-1, 1]` clip depth | `[0, 1]` clip depth: projection matrices need a variant, and reversed depth becomes simple |
| Instancing | `drawElementsInstanced` with divisors | Native `instanceCount`, step mode per buffer |
| Skinning | Bone texture read with `texelFetch` (planned) | Storage buffer of bone matrices, or the same texture path for compatibility mode |
| Compute | Not available | Compute shaders: GPU particles, GPU culling and temporal upscaling become possible. These are WebGPU-only extras, never requirements |
| Timing | `EXT_disjoint_timer_query_webgl2` when present | `timestamp-query` feature when present |

**Presentation.** Today the WebGL2 backend renders into its own canvas and the compositor copies each viewport onto the visible 2D canvas with `drawImage` (ADR 0001, implementation status). A canvas with a WebGPU context is also a valid image source for `drawImage`, so the first WebGPU version can keep the same composite; confirm this in the G-03 spike, including the timing rule that the copy happens in the same task as the render. The longer-term presentation, where the GPU canvas is the visible one and 2D is drawn on the GPU, is decision 10 of the earlier plan and arrives with the GPU 2D renderer (T-01).

**Matrices and conventions.** The projection depth range differs between the two APIs. Keep one set of camera matrices in engine conventions and let each device layer apply a fixed clip-space correction matrix, so game code and culling never see the difference.

## 4. The shader language problem

Plan decision 8, confirmed by the maintainer, makes standard GLSL ES 3.00 the single authoring language. WebGPU accepts only WGSL. There are two kinds of shader to consider.

**Built-in shaders** (the engine's own vertex and fragment code). These can be written twice by hand, as the earlier rendering study recommended ("Hand-written WGSL with a small variant system ... fits the zero-dependency budget"). To keep the twins in step: one table of chunks per language with the same chunk names and hook points, the same uniform layout table generating both declarations, and a golden test per feature that must pass on both backends within tolerance.

**Custom shaders** (`BrioShader` hooks written by users). Options:

| Option | How | Cost | Risk |
| --- | --- | --- | --- |
| A. Translator in core | Parse GLSL, emit WGSL | A GLSL front end is thousands of lines; the earlier plan chose "No GLSL parser" | High: partial coverage produces confusing errors |
| B. Translator as a plugin | An optional package that loads an existing translator compiled to WebAssembly on demand | A large download, only for games that need it; a dependency outside core | Medium: depends on a third-party toolchain whose license and size must be checked first |
| C. Explicit variants | The author supplies WGSL next to GLSL, each under its own name: `new BrioShader("shd_water", { glsl: { fragment, vertex }, wgsl: { fragment, vertex } })`, or a `water.wgsl` file next to `water.glsl`. The existing top-level `fragment` and `vertex` options keep meaning GLSL | Authors who want WebGPU write the hook twice | Low. Hooks are short by design |
| D. Restricted hook subset | Translate only hook bodies that use a documented subset | A small translator, but a second dialect to document | Medium: "valid GLSL that is rejected" breaks the promise that files stay valid GLSL |

**Decision DL-02, confirmed on 2026-11-16: option C.** The maintainer's reason is the ubiquitous-language rule of the project: GLSL and WGSL are different languages, so they are kept as separate, named variants, and nothing in core pretends one is the other. Option B stays possible later as a plugin outside core, if demand appears. Rules that make C safe:

- Under `preferredBackend: "auto"`, a game that registers any shader without a WGSL variant runs on WebGL2. The engine logs once which shader kept it there. Nothing breaks, and nothing is silently drawn wrong.
- Under an explicit `"webgpu"`, a GLSL-only shader uses the material's `fallback` and warns once, the same rule Canvas2D already follows.
- The hook names, built-ins and parameter annotations are identical in both languages, so `material.set()` and `material.parameters` do not change.
- The glossary term is **Shader Variant**: the source of one shader in one language. Documents and messages say "the WGSL variant of `shd_water`", never "the translated shader".
- The shader lab and the MCP tools can show both variants side by side, which is also good teaching material.

The cost of this decision is stated plainly: until a translator exists, a custom shader is extra work to bring to WebGPU. That is acceptable because WebGL2 stays first-class (section 1).

## 5. Upscaling: DLSS, FSR, XeSS

### 5.1 What exists and what the licenses allow

| Technology | Kind | Needs | License read | Usable on the web |
| --- | --- | --- | --- | --- |
| NVIDIA DLSS | Temporal, neural | NVIDIA hardware and the NGX or Streamline SDK on native graphics APIs | Proprietary | **No.** There is no browser interface. One unofficial demo reimplemented a network in WebGPU compute shaders and took about two seconds per frame ([Tom's Hardware](https://tomshardware.com/pc-components/gpus/modder-gets-nvidias-dlss-5-working-in-a-web-browser-using-webgpu-147mb-browser-port-runs-on-non-nvidia-gpus-and-macos-but-takes-two-seconds-per-render)); it is not a route for an engine |
| Intel XeSS | Temporal, neural | Native SDK | Intel Simplified Software License: "provided in binary form only", no reverse engineering ([license](https://raw.githubusercontent.com/intel/xess/main/LICENSE.txt)) | **No** |
| AMD FSR 1 | Spatial: one frame in, one frame out | Color only. "taking the current anti-aliased frame and upscaling it to display resolution without relying on other data such as frame history or motion vectors" ([GPUOpen](https://gpuopen.com/fidelityfx-superresolution/)) | MIT ([license](https://raw.githubusercontent.com/GPUOpen-Effects/FidelityFX-FSR/master/license.txt)) | **Yes**, on WebGL2 and WebGPU, as two fragment passes |
| AMD FSR 2 | Temporal | Depth, motion vectors and jittered rendering; HLSL compute shaders ([SDK documentation](https://github.com/GPUOpen-LibrariesAndSDKs/FidelityFX-SDK/blob/main/Kits/FidelityFX/docs/techniques/super-resolution-temporal.md)) | The current SDK license allows binary redistribution only and forbids reverse engineering ([license](https://github.com/GPUOpen-LibrariesAndSDKs/FidelityFX-SDK/blob/main/docs/license.md)). An earlier release is bundled in Godot as Expat (`thirdparty/amd-fsr2`, [`COPYRIGHT.txt`](https://raw.githubusercontent.com/godotengine/godot/master/COPYRIGHT.txt)) | Only on WebGPU (compute), only from the Expat copy, and only as a large port. Not planned |
| AMD FSR 3 | Temporal plus frame generation | Native swap chain control | Current SDK license, as above | **No** |
| NVIDIA Image Scaling | Spatial | Color only, after tone mapping | MIT ([repository](https://github.com/NVIDIAGameWorks/NVIDIAImageScaling)) | Technically yes, but the project keeps NVIDIA material as reference only (ADR 0007); FSR 1 covers the same need |

### 5.2 What BrioJS should implement

**Step 1, render scale (Q-01).** The largest gain is the simplest: render the 3D pass at a fraction of the display resolution into a render target, and present it at full size. 2D layers, text and UI are composed at native resolution on top, so they stay sharp. This is also what a retro look needs, with a nearest filter instead of an upscaler.

**Step 2, FSR 1 (Q-02).** Two passes after tone mapping and anti-aliasing:

- EASU ("Edge-Adaptive Spatial Upsampling") scales to display resolution; RCAS ("Robust Contrast-Adaptive Sharpening") sharpens. GPUOpen states that the passes "work best in perceptual color space, and should therefore be integrated after tone mapping", and that the input is the anti-aliased frame.
- Presets published by AMD, per dimension: Ultra Quality 1.3x, Quality 1.5x, Balanced 1.7x, Performance 2.0x.
- Textures should be sampled with a negative mip bias when rendering below display resolution. The FSR 1 formula was **not obtained** (the integration PDF could not be read); take it from the PDF in the FSR 1 repository when implementing. For reference, the FSR 2 documentation gives `mipBias = log2(renderResolution / displayResolution) - 1.0`.
- The reference header `ffx_fsr1.h` lets the integrator supply the texture fetch callbacks. GLSL ES 3.00 has no `textureGather`, so the WebGL2 version implements them with `texelFetch` or `textureOffset`. Verify against the header when porting.
- Port from the MIT repository, with AMD's notice in `THIRD_PARTY_NOTICES.md` (decision DL-05, confirmed; ADR 0007, update of 2026-11-16).

**Step 3, anti-aliasing (Q-03).** FSR 1 expects an anti-aliased input, so anti-aliasing comes first in the chain: MSAA on the scene target, or FXAA. FXAA runs after tone mapping because NVIDIA's paper requires "non-linear (perceptually encoded) RGB input" (`ENGINE_COMPLETION_STUDY.md` section 4.12), and its licensing note from ADR 0007 still applies: check the terms of the three.js port or write the pass from the paper.

**Step 4, temporal techniques (Q-04, later).** Temporal anti-aliasing and temporal upscaling give the quality people associate with DLSS-class upscalers, and they are implementable as original code from public literature: jitter the projection per frame, write per-pixel motion vectors to a second render target, and blend each frame with a reprojected, clamped history. They need R-01 (render targets, multiple attachments) and motion vectors for skinned and moving objects, which touch every vertex shader. They are scheduled after the first WebGPU release, and decided by measurement.

Order of the chain, fixed by the constraints above:

```text
scene (HDR, render scale, MSAA optional)
  -> bloom and other HDR effects
  -> tone mapping
  -> FXAA (if no MSAA)
  -> EASU upscale to display size
  -> RCAS sharpen
  -> LDR effects that should stay sharp (vignette, film grain, dither)
  -> 2D layers and UI at native resolution
```

**For 2D and pixel art** an upscaler is the wrong tool. The right ones are integer scaling, nearest filtering and snapping sprites and cameras to whole pixels (Q-01).

## 6. Optimization order for denser 3D scenes

The target class is section 3.2 of the lifecycle study: thousands of props, several skinned characters of 5,000 to 10,000 triangles. Proposed budget for the reference machine, to be replaced by measurements from F-03: 300,000 to 500,000 triangles visible, under 500 draw calls, 16 skinned characters, 60 frames per second on integrated graphics at a render scale the game chooses.

Ordered by expected gain per unit of work. Each row names the mechanism, why it comes at that position, and its package.

| # | Technique | Why here | Package |
| --- | --- | --- | --- |
| 1 | Fix the measured per-object allocations in the 3D path (P-1 in [`PERFORMANCE_FOLLOWUPS.md`](../plans/PERFORMANCE_FOLLOWUPS.md): 52.7 bytes per object per frame) | Garbage collection pauses hide every other gain | F-02 |
| 2 | Render list with packed keys, frame and pass data uploaded once, state cache for textures | Removes per-draw redundant work; required by everything below | R-01 |
| 3 | Distance culling and visibility sectors | Removes whole groups before any per-object work | R-10 |
| 4 | Instancing: explicit `BrioInstancedMesh` and automatic merging of consecutive items with the same mesh and material | Dense scenes repeat props; one draw instead of hundreds | R-08 |
| 5 | Level of detail | Cuts triangles where they are not visible | R-09 |
| 6 | Static shadow caching and caster culling per cascade | The shadow pass redraws the scene; static scenes can skip it | R-07 |
| 7 | Light selection per object, with more lights in the scene than in the shader | Keeps the fixed shader capacity while scenes hold dozens of lights | R-12 |
| 8 | Skinning through a bone texture, pose updates only when changed, animation rate by distance | Characters are the costliest draws | A-03, A-05 |
| 9 | Compressed textures and quantized meshes | GPU memory and download size, which decide whether the scene loads at all on a phone | R-11 |
| 10 | Asynchronous shader compilation with a warm-up at load | Removes first-use stutter | R-04 |
| 11 | Spatial index for static objects, then occlusion culling | Only when the profiler shows culling itself as a cost | R-10 |
| 12 | Clustered light assignment, GPU culling, GPU particles | WebGPU-only extras, after parity | G-05 |

Things deliberately not planned: deferred shading (the earlier study rejected it for this content, section 8), ray tracing (no web interface found), virtualized geometry.

### Texture and mesh compression

Plan decision 17 keeps Draco, meshopt and KTX2 decoders out of core as optional plugins, and that stays. The split proposed for R-11:

- **In core**: `KHR_mesh_quantization` (smaller vertex formats, no decoder needed once accessors are complete), and the loader interface that lets a plugin claim an extension.
- **As plugins**, loaded with `import()`: `KHR_texture_basisu` (KTX2), `EXT_meshopt_compression`, `KHR_draco_mesh_compression`. Each plugin's license and size are checked when it is written.
- **In tooling** (X-02): the compression itself, at build time.

## 7. Low-fidelity rendering

The stylized class of the lifecycle study (section 3.1) needs little new machinery, but each technique reaches into a part of the pipeline that custom shaders cannot touch today. All are generic techniques of real-time rendering and are implemented as original code.

| Technique | What it does | What the engine lacks | Where |
| --- | --- | --- | --- |
| Vertex snapping | Rounds each vertex to a coarse grid in screen space, so geometry jitters as it moves | A hook after projection (clip space) and the render resolution as a built-in | R-04 |
| Affine texture mapping | Interpolates texture coordinates without perspective correction | Custom varyings. GLSL ES 3.00 has no `noperspective` qualifier, so the include multiplies the coordinates by `w` in the vertex stage and divides in the fragment stage; WGSL has `@interpolate(linear)` | R-04, R-13 |
| Vertex lighting | Evaluates lights per vertex and interpolates the result | A `"vertex"` shading model | R-13 |
| Low resolution, nearest upscale | Renders small and scales up without filtering | Render scale and filter choice | Q-01 |
| Color depth reduction and ordered dithering | Quantizes the final color with a threshold pattern | The `screen` domain and an effect slot after tone mapping | R-06, R-13 |
| Short draw distance with fog | Hides the far plane | Exists (`BrioCamera3D.fog`); add distance culling | R-10 |
| Vertex colors | Colors stored per vertex, often instead of lights | `COLOR_0` on `BrioMesh` and in the loader | R-02 |

Delivery tier: a shader include (`<brio/retro>`), two ready effects (`BrioDither`, `BrioPixelate`) and one example. No global "retro mode": the developer combines the pieces, which is what makes each game look like itself.

## 8. Capability matrix after this plan

Extends section 7 of `ENGINE_COMPLETION_PLAN.md`. "Extra" means available only there and never required by a built-in feature.

| Feature | WebGPU | WebGL2 | Canvas2D |
| --- | --- | --- | --- |
| All built-in materials, lights, shadows, skinning, morph targets | Yes | Yes | Per the earlier matrix |
| Custom shaders | With a WGSL variant | Yes (GLSL) | `fallback` material |
| Post-processing chain, render scale, FSR 1 | Yes | Yes | No: warn once |
| Instancing, level of detail, sectors | Yes | Yes | Level of detail and sectors yes; instances expanded |
| GPU 2D renderer, 2D lights, mesh sprites | Yes | Yes | Sprites only; deformation ignored with one warning |
| GPU particles, GPU culling, clustered lights, temporal upscaling | Extra | No | No |

## 9. Sources

- WebGPU status: [gpuweb implementation status](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status), [web.dev announcement](https://web.dev/blog/webgpu-supported-major-browsers), [caniuse](https://caniuse.com/webgpu), [New in WebGPU 146](https://developer.chrome.com/blog/new-in-webgpu-146), [compatibility mode lesson](https://webgpufundamentals.org/webgpu/lessons/webgpu-compatibility-mode.html) (linked, not read).
- WebGPU interface: [MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API), [specification](https://www.w3.org/TR/webgpu/), [WGSL](https://www.w3.org/TR/WGSL/). Used from general knowledge of the API in section 3; re-read when implementing.
- Upscaling: [FSR 1 on GPUOpen](https://gpuopen.com/fidelityfx-superresolution/), [FSR 1 repository](https://github.com/GPUOpen-Effects/FidelityFX-FSR), [FidelityFX SDK](https://github.com/GPUOpen-LibrariesAndSDKs/FidelityFX-SDK) and its [license](https://github.com/GPUOpen-LibrariesAndSDKs/FidelityFX-SDK/blob/main/docs/license.md), [FSR 2 technique page](https://github.com/GPUOpen-LibrariesAndSDKs/FidelityFX-SDK/blob/main/Kits/FidelityFX/docs/techniques/super-resolution-temporal.md), [NVIDIA Image Scaling](https://github.com/NVIDIAGameWorks/NVIDIAImageScaling), [Intel XeSS](https://github.com/intel/xess), [Godot `COPYRIGHT.txt`](https://raw.githubusercontent.com/godotengine/godot/master/COPYRIGHT.txt).
- Engine documents: [`RENDERING_STUDY_THREEJS.md`](./RENDERING_STUDY_THREEJS.md), [`ENGINE_COMPLETION_STUDY.md`](./ENGINE_COMPLETION_STUDY.md) sections 4.1, 4.2, 4.4, 4.12 and 6, ADR 0001, ADR 0007.
