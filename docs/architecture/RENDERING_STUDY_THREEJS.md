# Rendering Study: three.js Techniques and the BrioJS GPU Backends

Status: **Reference** (2026-10-20). The source studied is a shallow clone of `mrdoob/three.js` in `study/three.js` (gitignored, MIT license). BrioJS reimplements techniques, not code (ADR-0001).

## 1. Why the demo runs on WebGL2 and not WebGPU

The cascade `WebGPU -> WebGL2 -> WebGL1 -> Canvas2D` (ADR-0001) is implemented in `BrioRenderer.selectBestBackendType()`. It only picks backends that are **both supported by the runtime and implemented by BrioJS**. Only `WebGL2Backend` and `Canvas2DBackend` are registered today, so on a WebGPU-capable browser the cascade skips `webgpu` and lands on `webgl2`. This is intentional: an unimplemented backend is never selected. The selection becomes `webgpu` as soon as a `WebGPUBackend` factory is registered.

Two caveats for the WebGPU backend:

- **Async adapter**: `navigator.gpu` existing does not guarantee an adapter. `requestAdapter()` can return `null` on blocklisted drivers. `BrioGame` already falls back when `init()` returns `false`, but the fallback must cascade to the **next** backend (`webgl2`), not straight to `canvas2d`.
- **Linux**: as of late 2026, WebGPU is on by default in Chrome and Edge on Windows, macOS, ChromeOS, and Android. Linux is partial (Intel Gen12+ in Chromium since 2026-01; Firefox Linux still in Nightly). Linux users, including this development machine, will often get WebGL2 even after WebGPU lands.

## 2. Techniques studied in three.js (WebGL path), status in BrioJS

| three.js module                                    | Technique                                                                  | BrioJS status                                                                              |
| -------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `WebGLAttributes`                                  | Upload each attribute once (`bufferData`), track `version` for updates     | Done (upload once). **Missing**: versioned re-upload for mutable meshes                    |
| `WebGLBindingStates`                               | VAO cache per geometry + program                                           | Done (one VAO per mesh with fixed attribute locations)                                     |
| `WebGLState`                                       | Cache GL state, skip redundant calls                                       | Done for program, VAO, cull, blend, depth mask, front face                                 |
| `WebGLPrograms` / `WebGLProgram`                   | Program cache keyed by material features (`#define` variants)              | Done (map, lit, flat, alpha test)                                                          |
| `WebGLRenderLists`                                 | Opaque: program, material, then front-to-back. Transparent: back-to-front  | Done                                                                                       |
| `WebGLRenderer.projectObject` + `Frustum`          | Per-object frustum culling with bounding spheres                           | **Missing** (`BrioCamera3D` has sphere culling, but the compositor does not use it for 3D) |
| `WebGLTextures`                                    | `texStorage2D` + mipmaps, sRGB storage, anisotropy, `flipY=false` for glTF | Done                                                                                       |
| Color management (`colorspace_pars_fragment`)      | Linear lighting, sRGB output, linear `baseColorFactor`                     | Done                                                                                       |
| `meshlambert` / `meshphysical` shader chunks       | Lambert, then PBR (metallic/roughness, GGX, Fresnel)                       | Lambert + hemisphere only. **Missing**: PBR, normal maps, emissive, AO                     |
| `WebGLLights`                                      | Light uniform arrays / UBOs, hashed light state                            | **Missing**: lights are constants in the shader                                            |
| `WebGLShadowMap`                                   | Shadow maps (directional, spot, point)                                     | **Missing**                                                                                |
| `PMREMGenerator`, `RoomEnvironment`                | Image-based lighting (prefiltered environment maps)                        | **Missing**. This is why the three.js reference looks softer than BrioJS                   |
| `WebGLMorphtargets`, `SkinnedMesh`, `Skeleton`     | Morph targets and GPU skinning (bone textures)                             | **Missing**; glTF skins render in bind pose                                                |
| `InstancedMesh`, `BatchedMesh`                     | Instancing and multi-draw batching                                         | **Missing**                                                                                |
| Tone mapping (`toneMapping`, ACES / AgX / Neutral) | HDR to LDR curve before sRGB output                                        | **Missing**                                                                                |
| `WebGLInfo`                                        | Draw calls, triangles, programs, memory                                    | Partial (`drawCalls`, `trianglesRendered`)                                                 |

## 3. WebGPU path in three.js (for the future `WebGPUBackend`)

- `src/renderers/webgpu/WebGPURenderer.js` is built on a backend-agnostic core in `src/renderers/common/`: `Renderer`, `RenderObjects`, `Pipelines`, `Bindings`, `UniformsGroup`, `RenderBundles`, `Textures`. The core has two implementations, `webgpu/WebGPUBackend.js` and `webgl-fallback/WebGLBackend.js`, with a `forceWebGL` option.
- Shaders come from the TSL node system (`src/nodes`), compiled to WGSL or GLSL. BrioJS should **not** copy that system; it is the bulk of three's size. Hand-written WGSL with a small variant system (like the WebGL2 `#define` approach) fits the zero-dependency budget.
- Ideas worth reusing:
    - Pipeline cache keyed by material features plus vertex layout, created asynchronously with `createRenderPipelineAsync` to avoid frame hitches.
    - Bind groups split by update frequency: per-frame (camera, lights), per-material (textures, factors), per-object (world matrix in a dynamic-offset uniform buffer or a storage buffer indexed by instance).
    - Render bundles for static geometry.
    - Timestamp queries for GPU timing (`TimestampQueryPool`).
    - Mipmap generation through a compute or render pass, since WebGPU has no `generateMipmap`.
- BrioJS plan: introduce a shared `GpuResourceCache` / render-list layer used by both `WebGL2Backend` and `WebGPUBackend` (the equivalent of `src/renderers/common`), so sorting, culling, and material feature keys are written once.

## 4. Measured results (Malfoy Draconia GLB, 105,122 triangles, 960x540)

| Backend                     | CPU render time | FPS        | Notes                                                        |
| --------------------------- | --------------- | ---------- | ------------------------------------------------------------ |
| Canvas2D (before this work) | ~90 ms          | ~10        | Back-face culled, no textures                                |
| Canvas2D (now)              | ~230 ms         | ~4         | `doubleSided` respected, so nothing is culled; fallback only |
| WebGL2                      | ~0.3 ms         | 60 (vsync) | 3 draw calls, sRGB textures, smooth lighting                 |

## 5. Next rendering steps (tracked in TODO section 8.1)

1. `WebGPUBackend`, with the cascade fallback fixed to try the next backend.
2. Frustum culling in `#render3DPasses`.
3. A light system (`BrioLight` directional, point, spot, hemisphere, ambient) with UBO upload.
4. A PBR material model and IBL.
5. Shadows.
6. GPU skinning and animation from glTF.
7. Instancing.
8. Tone mapping.
9. 2D sprite batching on the GPU backends, so the 2D layers also leave Canvas2D.
