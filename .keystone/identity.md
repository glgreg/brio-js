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

Active development, public preview. Version 0.2.0 targets simple 2D and 3D games (text, collision events, tile maps,
input map, high-DPI, complete checkpoints); the API is usable but may still change between minor versions, so
refactoring is acceptable when it serves the target architecture, as long as public API changes are recorded in
`CHANGELOG.md`. Next milestone: the TCC final presentation on 2026-11-13, with code freeze proposed for 2026-11-08
(`docs/plans/TCC_FINAL_SPRINT.md`); `develop` is the base of that work. After it: v0.3 (WebGPU backend, UI widgets,
camera controllers, point/spot lights, particles). Before 1.0, the public API surface review listed in
`docs/ROADMAP.md` ("Before 1.0") decides what the package root exports.

## 5. Project Metadata

- **Versioning**: SemVer (pre-1.0: minor versions may break the API); release notes in `CHANGELOG.md`.
- **Documentation**:
  - `README.md`: installation, quick start, core concepts, status.
  - `GLOSSARY.md`: the ubiquitous language (canonical names and names to avoid).
  - `docs/adr/`: architecture decision records 0001 to 0007.
  - `docs/architecture/`: target architecture, codebase audit, rendering study, MCP game authoring study.
  - `docs/plans/TCC_FINAL_SPRINT.md`: **the current plan**, up to the final presentation on 2026-11-13. It overrides older
    plans.
  - `docs/plans/ENGINE_COMPLETION_PLAN.md`: design reference and post-TCC backlog; its evidence is
    `docs/architecture/ENGINE_COMPLETION_STUDY.md`, which links the local study base in the gitignored `temp/` folder
    (`temp/research/` notes, `temp/repos/` reference clones). Read that base before working on a package.
  - `docs/tcc/` (local, gitignored): TCC questions, research gaps and the provenance of algorithms and reference code.
  - `docs/ROADMAP.md`: known issues and planned work; `TODO.md`: detailed engineering checklist.
  - `CONTRIBUTING.md`: setup, checks (`npm run check`, `npm run test:e2e`), branches and conventions.
  - TSDoc on every public symbol; `npm run doc` generates the TypeDoc reference in `docs/api/` (not versioned).
