# Multi-Canvas Layer Compositor, Multi-Viewport, and Offscreen Worker Pipeline

BrioJS partitions scene rendering into explicit `BrioLayer` planes (`static`, `parallax`, `dynamic`, `ui`) and camera `Viewport` regions, and offloads physics simulation and `OffscreenCanvas` rendering to Web Workers synchronized via `SharedArrayBuffer` with progressive fallbacks.

## Considered Options

- **Single Canvas on the Main Thread**: Redrawing all background tiles, parallax layers, active entities, dialogue boxes, and HUD elements on a single `<canvas>` in the browser's main thread every frame wastes GPU fill-rate on static layers and causes input jitter when physics or rendering spikes.
- **Multi-Canvas Layer Compositor + Multi-Viewport + Worker Pipeline**: Isolates layers by update frequency (`static` layers redraw only when dirty; `parallax` layers scroll by camera factors; `dynamic` layers update every frame; ordered `ui` layers stack dialogue boxes and HUDs independently) and supports multiple camera `Viewport` rectangles on the same screen for local split-screen multiplayer. The main thread handles DOM events and user scripts while workers execute physics and `OffscreenCanvas` rendering.

## Consequences

- The engine's memory transport between the Main Thread, Physics Worker, and Render Worker must follow a strict 3-tier fallback chain:
  1. `SharedArrayBuffer` (zero-copy shared ECS `TypedArrays` when `crossOriginIsolated` is active);
  2. Transferable `ArrayBuffer` double-buffering (when `OffscreenCanvas` is supported but `SharedArrayBuffer` headers are absent);
  3. Main-thread execution (when running in legacy environments without `OffscreenCanvas`).
- Multiple `BrioCamera2D` or `BrioCamera3D` instances can be active simultaneously in a `BrioScene`, each bound to a normalized `Viewport` (`x, y, width, height` in `[0, 1]`) for split-screen or minimap rendering.
