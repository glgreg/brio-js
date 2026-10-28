# BrioJS

BrioJS is a modular, zero-dependency 2D and 3D Web Game Engine written in TypeScript. It is designed to bridge the complexity gap between visual no-code/block-based tools (such as Scratch and GDevelop) and heavyweight commercial engines (such as Unity and Unreal Engine).

## Core Philosophy

1. **Accessible Public API, High-Performance Backend**: Exposes an intuitive Object-Oriented API (`BrioGame`, `BrioScene`, `BrioObject2D`, `BrioObject3D`) alongside modular, tree-shakeable utility functions, backed internally by a Data-Oriented **Entity-Component-System (ECS)** using contiguous `TypedArrays` and $O(1)$ object pooling.
2. **Zero-Dependency Multi-Backend Rendering**: Automatically selects the best graphics pipeline available on the host device following the fallback cascade:
   `WebGPU -> WebGL2 -> WebGL1 -> Canvas2D` (including a lightweight software 3D projector fallback in `Canvas2D`).
3. **Multi-Canvas Layering, Split-Screen Viewports, and Worker Threads**: Supports $N$ rendering layers (`static`, `parallax`, `dynamic`, and ordered `ui` planes for complex dialogue/HUD overlays), multiple simultaneous camera viewports for local split-screen multiplayer, and offloads rendering (`OffscreenCanvas`) and physics simulation to Web Workers.
4. **Multi-Platform Ready**: Built to run across Web Browsers, Desktop apps (Electron), and Mobile apps (Capacitor) with automatic feature detection and platform fallbacks.
5. **Agent Context Optimization (ACO)**: Comprehensive JSDoc/TSDoc coverage across every public class, method, function, and property, alongside a strict Ubiquitous Language.

## Getting Started

> BrioJS is not published to npm yet. Until the first release, build it from source and import `dist/`,
> or install the packed tarball (`npm pack`) into your project.

```bash
git clone https://github.com/glgreg/brio-js.git
cd brio-js
npm install
npm run build        # compiles src/ into dist/ (ES modules + .d.ts)
npm pack             # optional: brio-js-<version>.tgz to `npm install` elsewhere
```

A minimal 2D game (`index.html` + `main.js`, served by any static server):

```html
<div id="game"></div>
<script type="module" src="./main.js"></script>
```

```js
import { BrioGame, BrioSprite, BrioObject2D } from "brio-js"; // or "./dist/index.js"

const game = new BrioGame({ width: 640, height: 360, container: document.getElementById("game") });
game.useKeyboard();

game.preload(() => [new BrioSprite("spr_player", "./player.png")])
    .load(() => [new BrioObject2D("obj_player", "spr_player")])
    .update((updater, dt) => {
        const player = updater.getObject("obj_player");
        if (game.keyboard.isDown("ArrowRight")) player.transform.position.x += 200 * dt;
        if (game.keyboard.isDown("ArrowLeft")) player.transform.position.x -= 200 * dt;
    });
```

A minimal 3D scene uses the `"3d"` preset, procedural meshes, a camera, and lights:

```js
import { BrioGame, BrioMesh, BrioMaterial, BrioObject3D, BrioCamera3D, BrioLight } from "brio-js";

const game = new BrioGame({ width: 800, height: 450, container: document.getElementById("game"), dimension: "3d" });

game.preload(() => [BrioMesh.createBox("mesh_box"), new BrioMaterial("mat_orange", { color: "#f97316" })])
    .load(() => [
        new BrioCamera3D("cam", { position: { x: 3, y: 3, z: 5 }, clearColor: "#0b1220" }),
        new BrioLight("sun", "directional", { direction: { x: -1, y: -2, z: -1 }, intensity: 2 }),
        new BrioLight("sky", "hemisphere", { color: "#9cc3ff", groundColor: "#2b2118", intensity: 0.6 }),
        new BrioObject3D("obj_box", "mesh_box", "mat_orange"),
    ])
    .update((updater, dt) => {
        game.gameObjects3D.get("obj_box").transform.rotation.y += dt;
    });
```

Key concepts:

- **Lifecycle**: `preload()` (async assets) -> `load()` (initial content) -> `update()` (per frame). Add `fixedUpdate()`
  for simulation at a fixed rate (`fixedTimestep`, optional render `interpolate`), and `game.step(dt)` to advance
  frames manually (tests, tools).
- **Scenes**: `new BrioScene(name).preload(...).load(...)`, `game.addScene()` / `game.setScene()`; `scene.restart()`
  and `game.createCheckPoint()` / `restoreCheckPoint()` cover the active scene.
- **Rendering**: 2D layers (`static`, `parallax`, `dynamic`, `ui`) and split-screen cameras; 3D through the backend
  cascade (WebGL2, falling back to the Canvas2D rasterizer when a backend fails to initialize).
- **Audio**: `BrioAudio` plays through Web Audio buses (`BrioAudioMixer`: master, bgm, sfx) and unlocks on the
  first user gesture; it falls back to `HTMLAudioElement` where Web Audio is missing.
- **Determinism**: `game.random` is a seeded `BrioRandom` (`seed` option) saved in checkpoints.

Complete runnable examples live in [`examples/`](./examples/): a 2D game (*Star Catcher*) and a 3D scene
(*Orbit Gallery*), with no binary assets.

## Implementation Status

The philosophy above describes the target architecture. Current state:

| Area | Status |
| --- | --- |
| SoA ECS, O(1) pooling, generational handles, binary snapshots (v2, layout-aware) | Implemented |
| `BrioScene` lifecycle (`preload` / `load` / `restart`) unified with `BrioGame` checkpoints | Implemented |
| `BrioLayer` compositor (`static` cache, `parallax`, `dynamic`, `ui`) and multi-viewport `BrioCamera2D` passes | Implemented and wired into `BrioGame` |
| `WebGL2Backend` for 3D passes (GPU-resident meshes, sRGB textures, `BrioLight` uniform buffer, double-sided materials) | Implemented; selected by the cascade when WebGL2 is available |
| Canvas2D backend with software 3D rasterizer (near-plane clipping, lights approximated by luminance) | Implemented; fallback when GPU backends fail to initialize |
| Lights (`BrioLight`: directional, ambient, hemisphere) | Implemented; point/spot lights, PBR, and shadows not yet |
| WebGPU and WebGL1 backends | Not implemented; `BrioRenderer` only selects implemented backends, so WebGPU-capable browsers currently get `webgl2` |
| glTF/GLB/OBJ loading (meshes, `baseColorTexture`, `doubleSided`, alpha modes, node transforms, resource limits) | Implemented; skinning and animations not yet |
| Web Audio in `BrioAudio` (Master/BGM/SFX buses, autoplay unlock, `HTMLAudioElement` fallback) | Implemented; 3D positional audio not yet |
| Fixed timestep with render interpolation, seeded `BrioRandom` | Implemented |
| MCP server for agentic game authoring | Studied and proposed ([ADR-0006](./docs/adr/0006-mcp-agentic-game-authoring.md)); not implemented |
| `RenderWorker` / `PhysicsWorker` (`OffscreenCanvas`, `SharedArrayBuffer`) | Not implemented; capability detection only |
| `BrioTileMap` rendering | Collider generation only; render tiles as objects on a `"static"` layer |

## Project Documentation

- [Domain Glossary](./GLOSSARY.md): Canonical ubiquitous language of the engine.
- [Target Architecture Specification](./docs/architecture/TARGET_ARCHITECTURE.md): Full blueprint of the 2D/3D engine, ECS backend, multi-backend renderer, layers, and workers.
- [Codebase Technical Audit](./docs/architecture/CODEBASE_AUDIT.md): Detailed audit of the initial implementation, performance bottlenecks, and identified bugs.
- [Rendering Study: three.js Techniques](./docs/architecture/RENDERING_STUDY_THREEJS.md): Techniques studied from three.js, BrioJS GPU backend status, and the WebGPU plan.
- [MCP Agentic Game Authoring](./docs/architecture/MCP_GAME_AUTHORING.md): Study of MCP 2026-07-28 and engine MCP servers, plus the proposed `@brio-js/mcp` architecture and tool catalog.
- [Engineering Roadmap & Checklist](./TODO.md): Tracked list of bugfixes, architectural refactors, and feature implementations.
- Architecture Decision Records (ADRs):
  - [ADR-0001: Zero-Dependency Multi-Backend Renderer Over Three.js](./docs/adr/0001-zero-dependency-multi-backend-renderer.md)
  - [ADR-0002: Public OOP Facade and Tooling Functions Over Internal SoA ECS](./docs/adr/0002-oop-facade-over-soa-ecs.md)
  - [ADR-0003: Multi-Canvas Layer Compositor, Multi-Viewport, and Offscreen Worker Pipeline](./docs/adr/0003-multi-canvas-layers-and-offscreen-workers.md)
  - [ADR-0004: Concrete 2D/3D Separation and Strict Ubiquitous Language](./docs/adr/0004-concrete-2d-3d-domain-and-strict-ubiquitous-language.md)
  - [ADR-0005: Binary ECS State Serialization for Checkpoints and Scene Snapshots](./docs/adr/0005-binary-ecs-state-serialization.md)
  - [ADR-0006: MCP Server and Runtime Bridge for Agentic Game Authoring](./docs/adr/0006-mcp-agentic-game-authoring.md) (Proposed)

Public examples live in `examples/`. Older demos (`demo/`) and their assets (`assets/`) are kept local only and are not versioned in the remote repository.

## Build & Documentation Scripts

- Build (any OS): `npm run build`
- Type check: `npm run typecheck`
- Tests (Vitest): `npm test`
- Everything CI runs (type check, tests, build): `npm run check`
- Package tarball: `npm pack` (builds first through `prepack`)
- Legacy builds: `npm run build:lin` / `npm run build:win`
- Generate API Documentation (TypeDoc into `./docs/api/`): `npm run doc`
