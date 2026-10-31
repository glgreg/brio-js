# Third-Party Code Policy

Status: **Accepted** (2026-10-31)

BrioJS may adapt source code from three.js and Godot under their MIT licenses, with attribution. Unity, Unreal and NVIDIA material is used for concepts and algorithms only, and BrioJS writes its own code from them. This replaces the earlier line in [`RENDERING_STUDY_THREEJS.md`](../architecture/RENDERING_STUDY_THREEJS.md), "BrioJS reimplements techniques, not code". The evidence is in section 7 of [`ENGINE_COMPLETION_STUDY.md`](../architecture/ENGINE_COMPLETION_STUDY.md). This policy is engineering practice, not legal advice.

## Policy

| Source | License seen | Allowed | Conditions |
| --- | --- | --- | --- |
| three.js | MIT (`LICENSE`, "three.js authors") | Direct port and adaptation | Notice in `THIRD_PARTY_NOTICES.md`, header on each adapted file |
| Blocks inside three.js shaders | Upstream credits vary (for example Filament and Hill) | Port with credit | Keep the upstream comments. Check the source first when a block's origin is unclear |
| Godot | MIT (`LICENSE.txt`), listed as Expat in `COPYRIGHT.txt` | Direct port and adaptation | Check the file in `COPYRIGHT.txt` first, because some files carry other holders or licenses: `scene/animation/easing_equations.h` (Robert Penner), `core/math/convex_hull.*` and `modules/godot_physics_3d/gjk_epa.cpp` (Expat and Zlib), `scene/3d/trail_3d.*` (CozyCubeGames) and everything under `thirdparty/`. A port from one of those adds its own notice |
| Unity | Proprietary | Concepts from public documentation | Own implementation. No code, reference source or assets |
| Unreal Engine | Proprietary, EULA | Concepts from public documentation | Own implementation. Unreal source is not read for this work |
| NVIDIA | Book and paper copyright; GPU Gems 2 states "All rights reserved" | Algorithms | Own implementation, no copied listings. The three.js FXAA shader credits Jasper Flick and Dave Hoskins (`FXAAShader.js:11`), so its terms are checked before it is reused. Otherwise the pass is written from the NVIDIA paper |

Each adapted file starts with a header that names the source path and the pinned commit, so a reader can find the original and an audit can search for it:

```ts
// Adapted from three.js <path> @ fa01dd6 (MIT). See THIRD_PARTY_NOTICES.md.
// Adapted from Godot <path> @ 95c0fa5 (MIT). See THIRD_PARTY_NOTICES.md.
```

## Considered Options

- **Reimplement everything (previous line)**: The simplest origin story, but it means rewriting existing shader code such as GGX or tone mapping curves by hand, with no functional gain.
- **Depend on three.js at runtime**: Rejected by ADR 0001 for its size and for a scene graph that conflicts with the ECS.
- **Adapt MIT code with attribution, concepts only from proprietary sources (chosen)**: Reuses proven code where the license allows it and keeps the origin of every adapted file visible.

## Consequences

- `THIRD_PARTY_NOTICES.md` ships in the npm package through `files` in `package.json`, and CI fails when it is missing from the package. Requiring it in every package also covers any adapted file, so CI does not need to search for headers.
- Adapting code does not add a runtime dependency, so ADR 0001 holds. Adapted code must follow the engine's conventions: no allocation in the game loop, TSDoc on public symbols, and the existing data layout.
- Public documentation is the only Unity and Unreal input.
- The notice exists before the first adapted file, so the first port needs no packaging change.
