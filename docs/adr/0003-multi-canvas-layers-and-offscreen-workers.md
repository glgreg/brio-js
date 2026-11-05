# Multi-Canvas Layer Compositor, Multi-Viewport, and Offscreen Worker Pipeline

BrioJS partitions scene rendering into explicit `BrioLayer` planes (`static`, `parallax`, `dynamic`, `ui`) and camera `Viewport` regions, and (target) offloads physics simulation and `OffscreenCanvas` rendering to Web Workers synchronized via `SharedArrayBuffer` with progressive fallbacks.

## Considered Options

- **Single Canvas on the Main Thread**: Redrawing all background tiles, parallax layers, active entities, dialogue boxes, and HUD elements on a single `<canvas>` in the browser's main thread every frame wastes GPU fill-rate on static layers and causes input jitter when physics or rendering spikes.
- **Multi-Canvas Layer Compositor + Multi-Viewport + Worker Pipeline**: Isolates layers by update frequency (`static` layers redraw only when dirty; `parallax` layers scroll by camera factors; `dynamic` layers update every frame; ordered `ui` layers stack dialogue boxes and HUDs independently) and supports multiple camera `Viewport` rectangles on the same screen for local split-screen multiplayer. The main thread handles DOM events and user scripts while workers execute physics and `OffscreenCanvas` rendering.

## Consequences

- Target: the engine's memory transport between the Main Thread, Physics Worker, and Render Worker must follow a strict 3-tier fallback chain:
    1. `SharedArrayBuffer` (zero-copy shared ECS `TypedArrays` when `crossOriginIsolated` is active);
    2. Transferable `ArrayBuffer` double-buffering (when `OffscreenCanvas` is supported but `SharedArrayBuffer` headers are absent);
    3. Main-thread execution (when running in legacy environments without `OffscreenCanvas`).
- Multiple `BrioCamera2D` or `BrioCamera3D` instances can be active simultaneously in a `BrioScene`, each bound to a normalized `Viewport` (`x, y, width, height` in `[0, 1]`) for split-screen or minimap rendering.

## Implementation status (2026-10-28)

Only the layer policies and the multi-viewport part of this decision are implemented. Today the engine runs the third tier of the fallback chain (main-thread execution) in every environment.

- **One canvas**: `BrioGame` creates a single `<canvas>` on the main thread. `BrioCompositor` draws every frame onto its 2D context: one 2D world pass per `BrioCamera2D` clipped to its viewport (non-`"ui"` layers by ascending `order`), then one 3D pass per `BrioCamera3D` through the active `RenderBackend`, then every `"ui"` layer once in screen space. There is no stack of DOM canvases per layer.
- **Layer policies**: `"dynamic"` layers are redrawn every frame with 2D frustum culling; `"parallax"` layers are redrawn every frame with the camera offset scaled by `scrollFactor`; `"static"` layers are rasterized into an offscreen cache surface (an `OffscreenCanvas` when available, otherwise a detached `<canvas>`) per layer and camera, and re-rasterized only when the layer, one of its objects, the camera, or `game.scale` changes. These caches are created and drawn on the main thread.
- **Multi-viewport**: implemented as described (`BrioViewport`, one pass per camera).
- **Workers**: there is no Physics Worker or Render Worker. Physics (`BrioRigidBody`, `SpatialHash2D`, `SpatialOctree3D`, `BrioCollision`) runs on the main thread inside user callbacks, and the canvas is never transferred with `transferControlToOffscreen()`. `ECSWorld` can allocate its buffers on `SharedArrayBuffer` (`useSharedMemory`) and `PlatformAdapter` reports `supportsSharedArrayBuffer`, but no worker transport consumes them yet. The worker pipeline and the first two tiers of the transport chain are deferred.
