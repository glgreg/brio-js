# Identity

## 1. Purpose

BrioJS is a zero-dependency 2D and 3D web game engine written in TypeScript. It exists to fill the gap between visual
no-code/low-code tools (Scratch, GDevelop, Construct) and complex commercial engines (Unity, Unreal): learners move
from block programming to real JavaScript/TypeScript without hitting a wall, and experienced developers and AI agents
can prototype quickly while keeping control over layers, viewports, GPU rendering and memory. The project originates
from an IFPR undergraduate thesis (TCC).

The value every change must preserve: an approachable, fully documented object-oriented public API over a
high-performance, allocation-free data-oriented core, with no runtime dependencies.

## 2. Project Type

Library: a browser game engine published to npm as `@brio-js/core` (ES modules with TypeScript declarations). It
targets modern browsers and is designed to run inside Electron and Capacitor shells.

## 3. Audience and Maintainers

- **Users**: students moving from block-based programming to textual code; indie developers; LLM-assisted workflows
  that author games through the API (and, later, through an MCP server, see ADR 0006).
- **Maintainers**: Gustavo L. Gregorio (`glgreg`, author) and Lucas Bigliardi Vicente.
- **Review**: pull requests into `develop` and `main` on `github.com/glgreg/brio-js`, gated by CI.

## 4. Lifecycle Stage

Active development. Version 0.1.0 is the first public release: the API is usable but may still change between minor
versions, so refactoring is acceptable when it serves the target architecture, as long as public API changes are
recorded in `CHANGELOG.md`. Next milestone: v0.2 (WebGPU backend, per-object frustum culling, unified render stats,
context-loss recovery, visual regression tests).

## 5. Project Metadata

- **Versioning**: SemVer (pre-1.0: minor versions may break the API); release notes in `CHANGELOG.md`.
- **Documentation**:
  - `README.md`: installation, quick start, core concepts, status.
  - `GLOSSARY.md`: the ubiquitous language (canonical names and names to avoid).
  - `docs/adr/`: architecture decision records 0001 to 0006.
  - `docs/architecture/`: target architecture, codebase audit, rendering study, MCP game authoring study.
  - `docs/ROADMAP.md`: known issues and planned work (English); `TODO.md`: detailed engineering checklist
    (written in Portuguese before the switch to English).
  - TSDoc on every public symbol; `npm run doc` generates the TypeDoc reference in `docs/api/` (not versioned).
