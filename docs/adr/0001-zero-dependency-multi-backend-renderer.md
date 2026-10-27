# Zero-Dependency Multi-Backend Renderer Over Three.js

BrioJS implements its own zero-dependency rendering pipeline behind a strict hardware abstraction contract (`BrioRenderBackend`) with an automatic fallback cascade of `WebGPU -> WebGL2 -> WebGL1 -> Canvas2D`, supporting both 2D and 3D scenes, rather than adopting Three.js as its base graphics engine.

## Considered Options

- **Three.js as the base rendering engine**: Provides mature 3D capabilities and a `WebGPURenderer` with `WebGL2` fallback, but adds over 150 KB (minified and gzipped), breaks the zero-dependency principle, forces an object-heavy scene graph (`Object3D`) that conflicts with a Data-Oriented ECS backend, and lacks fallbacks for `WebGL1` (removed in r163) and `Canvas2D` (deprecated).
- **Custom zero-dependency `BrioRenderBackend` (`WebGPU -> WebGL2 -> WebGL1 -> Canvas2D`)**: Keeps the engine lightweight and tree-shakeable, streams contiguous `TypedArrays` directly from the internal ECS to GPU instanced/batched buffers, and guarantees execution on legacy school laboratory hardware where hardware acceleration or WebGL2 is unavailable.

## Consequences

- Every rendering backend (`WebGPURenderer`, `WebGL2Renderer`, `WebGL1Renderer`, `Canvas2DRenderer`) must implement a single deterministic contract so visual output remains consistent across APIs.
- For 3D scenes running on environments that fall back all the way to `Canvas2D`, `Canvas2DRenderer` includes a lightweight software 3D projector and rasterizer (matrix projection plus Painter's Algorithm sorting) for low-poly and wireframe educational meshes.
