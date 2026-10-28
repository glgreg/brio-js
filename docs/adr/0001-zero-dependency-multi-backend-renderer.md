# Zero-Dependency Multi-Backend Renderer Over Three.js

BrioJS implements its own zero-dependency rendering pipeline behind a strict hardware abstraction contract (`RenderBackend`, in `src/rendering/contracts/RenderBackend.ts`) with an automatic fallback cascade of `WebGPU -> WebGL2 -> WebGL1 -> Canvas2D`, supporting both 2D and 3D scenes, rather than adopting Three.js as its base graphics engine.

## Considered Options

- **Three.js as the base rendering engine**: Provides mature 3D capabilities and a `WebGPURenderer` with `WebGL2` fallback, but adds over 150 KB (minified and gzipped), breaks the zero-dependency principle, forces an object-heavy scene graph (`Object3D`) that conflicts with a Data-Oriented ECS backend, and lacks fallbacks for `WebGL1` (removed in r163) and `Canvas2D` (deprecated).
- **Custom zero-dependency `RenderBackend` (`WebGPU -> WebGL2 -> WebGL1 -> Canvas2D`)**: Keeps the engine lightweight and tree-shakeable, streams contiguous `TypedArrays` directly from the internal ECS to GPU instanced/batched buffers, and guarantees execution on legacy school laboratory hardware where hardware acceleration or WebGL2 is unavailable.

## Consequences

- Every rendering backend (target: `WebGPUBackend`, `WebGL2Backend`, `WebGL1Backend`, `Canvas2DBackend`) implements the single `RenderBackend` contract, so the same compositor calls drive every API. Output is equivalent in geometry, camera, and draw order, not pixel-identical: each backend documents the features it does not support (see "Implementation status").
- For 3D scenes running on environments that fall back all the way to `Canvas2D`, `Canvas2DBackend` includes a lightweight software 3D projector and rasterizer (matrix projection plus Painter's Algorithm sorting) for low-poly and wireframe educational meshes.

## Implementation status (2026-10-28)

- **Implemented backends**: `WebGL2Backend` (`src/rendering/WebGL2Backend.ts`) and `Canvas2DBackend` (`src/rendering/BrioRenderer.ts`). `WebGPUBackend` and `WebGL1Backend` do not exist yet; `BrioRenderer.registerBackend()` lets one be plugged in.
- **Cascade**: `BrioRenderer.selectBestBackendType()` only picks backends that are both supported by the runtime and implemented. `BrioRenderer.initBackend()` walks the cascade at runtime: a backend whose `init()` resolves `false` or throws is disposed and the **next** candidate is tried.
- **Scope of the backends**: the backend renders only the 3D passes (`BrioCamera3D`). 2D layers and `"ui"` layers are always drawn by the Canvas 2D context of the game canvas (`BrioSpriteRenderer` through `BrioCompositor`). `WebGL2Backend` renders into an internal WebGL2 canvas and copies each viewport onto that 2D canvas.
- **Feature differences** (the contract does not guarantee visual parity):
    - `Canvas2DBackend` has no texture sampling (materials render with their base color), no per-pixel lighting (one shade per triangle from the luminance of the lights), and no z-buffer: triangles are sorted back-to-front per pass (Painter's Algorithm), so intersecting or cyclically overlapping triangles can be drawn in the wrong order.
    - `WebGL2Backend` uses a depth buffer, sRGB textures with mipmaps, per-pixel Lambert and hemisphere lighting, and a program cache keyed by material features.
- **Data path**: the 3D passes read each object's `transform.worldMatrix` and draw one mesh per call; instanced or batched uploads straight from ECS buffers are not implemented yet (see `docs/architecture/RENDERING_STUDY_THREEJS.md`).
