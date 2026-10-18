# BrioJS

BrioJS is a modular, zero-dependency 2D and 3D Web Game Engine written in TypeScript. It is designed to bridge the complexity gap between visual no-code/block-based tools (such as Scratch and GDevelop) and heavyweight commercial engines (such as Unity and Unreal Engine).

## Core Philosophy

1. **Accessible Public API, High-Performance Backend**: Exposes an intuitive Object-Oriented API (`BrioGame`, `BrioScene`, `BrioObject2D`, `BrioObject3D`) alongside modular, tree-shakeable utility functions, backed internally by a Data-Oriented **Entity-Component-System (ECS)** using contiguous `TypedArrays` and $O(1)$ object pooling.
2. **Zero-Dependency Multi-Backend Rendering**: Automatically selects the best graphics pipeline available on the host device following the fallback cascade:
   `WebGPU -> WebGL2 -> WebGL1 -> Canvas2D` (including a lightweight software 3D projector fallback in `Canvas2D`).
3. **Multi-Canvas Layering, Split-Screen Viewports, and Worker Threads**: Supports $N$ rendering layers (`static`, `parallax`, `dynamic`, and ordered `ui` planes for complex dialogue/HUD overlays), multiple simultaneous camera viewports for local split-screen multiplayer, and offloads rendering (`OffscreenCanvas`) and physics simulation to Web Workers.
4. **Multi-Platform Ready**: Built to run across Web Browsers, Desktop apps (Electron), and Mobile apps (Capacitor) with automatic feature detection and platform fallbacks.
5. **Agent Context Optimization (ACO)**: Comprehensive JSDoc/TSDoc coverage across every public class, method, function, and property, alongside a strict Ubiquitous Language.

## Project Documentation

- [Domain Glossary](./GLOSSARY.md): Canonical ubiquitous language of the engine.
- [Target Architecture Specification](./docs/architecture/TARGET_ARCHITECTURE.md): Full blueprint of the 2D/3D engine, ECS backend, multi-backend renderer, layers, and workers.
- [Codebase Technical Audit](./docs/architecture/CODEBASE_AUDIT.md): Detailed audit of the initial implementation, performance bottlenecks, and identified bugs.
- [Engineering Roadmap & Checklist](./TODO.md): Tracked list of bugfixes, architectural refactors, and feature implementations.
- Architecture Decision Records (ADRs):
  - [ADR-0001: Zero-Dependency Multi-Backend Renderer Over Three.js](./docs/adr/0001-zero-dependency-multi-backend-renderer.md)
  - [ADR-0002: Public OOP Facade and Tooling Functions Over Internal SoA ECS](./docs/adr/0002-oop-facade-over-soa-ecs.md)
  - [ADR-0003: Multi-Canvas Layer Compositor, Multi-Viewport, and Offscreen Worker Pipeline](./docs/adr/0003-multi-canvas-layers-and-offscreen-workers.md)
  - [ADR-0004: Concrete 2D/3D Separation and Strict Ubiquitous Language](./docs/adr/0004-concrete-2d-3d-domain-and-strict-ubiquitous-language.md)
  - [ADR-0005: Binary ECS State Serialization for Checkpoints and Scene Snapshots](./docs/adr/0005-binary-ecs-state-serialization.md)

## Build & Documentation Scripts

- Build (Linux/macOS): `npm run build:lin`
- Build (Windows): `npm run build:win`
- Generate API Documentation (TypeDoc into `./docs/api/`): `npm run doc`
