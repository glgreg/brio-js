# BrioJS

BrioJS is a modular, zero-dependency 2D and 3D Web Game Engine written in TypeScript. It is designed to bridge the complexity gap between visual no-code/block-based tools (such as Scratch and GDevelop) and heavyweight commercial engines (such as Unity and Unreal Engine).

## Core Philosophy

1. **Accessible Public API, High-Performance Backend**: Exposes an intuitive Object-Oriented API (`BrioGame`, `BrioScene`, `BrioObject2D`, `BrioObject3D`) alongside modular, tree-shakeable utility functions, backed internally by a Data-Oriented **Entity-Component-System (ECS)** using contiguous `TypedArrays` and $O(1)$ object pooling.
2. **Zero-Dependency Multi-Backend Rendering**: Automatically selects the best graphics pipeline available on the host device following the fallback cascade:
   `WebGPU -> WebGL2 -> WebGL1 -> Canvas2D` (including a lightweight software 3D projector fallback in `Canvas2D`).
3. **Multi-Canvas Layering, Split-Screen Viewports, and Worker Threads**: Supports $N$ rendering layers (`static`, `parallax`, `dynamic`, and ordered `ui` planes for complex dialogue/HUD overlays), multiple simultaneous camera viewports for local split-screen multiplayer, and offloads rendering (`OffscreenCanvas`) and physics simulation to Web Workers.
4. **Multi-Platform Ready**: Built to run across Web Browsers, Desktop apps (Electron), and Mobile apps (Capacitor) with automatic feature detection and platform fallbacks.
5. **Agent Context Optimization (ACO)**: Comprehensive JSDoc/TSDoc coverage across every public class, method, function, and property, alongside a strict Ubiquitous Language.

## Implementation Status (`refactor` branch)

The philosophy above describes the target architecture. Current state:

| Area | Status |
| --- | --- |
| SoA ECS, O(1) pooling, generational handles, binary snapshots (v2, layout-aware) | Implemented |
| `BrioLayer` compositor (`static` cache, `parallax`, `dynamic`, `ui`) and multi-viewport `BrioCamera2D` passes | Implemented and wired into `BrioGame` |
| `WebGL2Backend` for 3D passes (GPU-resident meshes, sRGB textures, smooth Lambert lighting, double-sided materials) | Implemented; selected by the cascade when WebGL2 is available |
| Canvas2D backend with software 3D rasterizer (fallback for 3D passes) | Implemented |
| WebGPU and WebGL1 backends | Not implemented; `BrioRenderer` only selects implemented backends, so WebGPU-capable browsers currently get `webgl2` |
| glTF/GLB loading (meshes, `baseColorTexture`, `doubleSided`, alpha modes, node transforms) | Implemented; skinning and animations not yet |
| MCP server for agentic game authoring | Studied and proposed ([ADR-0006](./docs/adr/0006-mcp-agentic-game-authoring.md)); not implemented |
| `RenderWorker` / `PhysicsWorker` (`OffscreenCanvas`, `SharedArrayBuffer`) | Not implemented; capability detection only |
| Web Audio API in `BrioAudio` | Not implemented; `HTMLAudioElement` only |
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

Demos (`demo/`) and their assets (`assets/`) are kept local only and are not versioned in the remote repository.

## Build & Documentation Scripts

- Build (Linux/macOS): `npm run build:lin`
- Build (Windows): `npm run build:win`
- Generate API Documentation (TypeDoc into `./docs/api/`): `npm run doc`
