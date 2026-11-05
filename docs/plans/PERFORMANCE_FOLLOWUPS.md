# Performance follow-ups

Status: **open, to run on a desktop machine.** Created 2026-11-05 during S1/S2 of
[`TCC_FINAL_SPRINT.md`](./TCC_FINAL_SPRINT.md).

The maintainer's notebook (5.6 GB RAM) crashes while Playwright runs several SwiftShader Chromium instances, so the
measurements below were cut short. This page lists what was measured, what was fixed without measuring again, and the
exact steps to finish on a machine that can run the browser suite. CI (`e2e` job) also runs the suite on every pull
request.

## How to run

All commands from the repository root, after `npm ci`.

```bash
npm run build                                          # e2e tests load dist/
npx playwright test e2e/heap.spec.ts --workers=1        # allocation budget, about 1-2 minutes
node e2e/tools/profile-allocations.mjs boxes3d 60 500   # allocation sites of the 3D path
node e2e/tools/profile-allocations.mjs sprites2d 200 500
npm run test:e2e                                        # the whole browser suite (golden screenshots)
```

- `e2e/heap.spec.ts` builds minimal games with the public API, warms them up, records every allocation made by
  engine code (`dist/`) with the DevTools sampling heap profiler (collected garbage included) and checks, per
  scenario, the bytes per frame with few and with many objects:
    - `FIXED_BUDGET` (512 B/frame): what any frame may allocate;
    - `PER_OBJECT_BUDGET` (4 B per added object per frame): any object, array or closure created per object is
      larger, so it fails.
- `e2e/tools/profile-allocations.mjs` prints the top allocation sites (`function file:line <- caller`) per object
  per frame. Line numbers refer to `dist/*.js`; the sampling profiler reports the line where the function starts.
- On machines with little memory, keep `--workers=1` and run one spec at a time.

## Measurements so far

Chromium 1.64 (SwiftShader), notebook, 2026-11-05, engine code only:

| Scenario                                           | Few objects | Many objects | Per added object | Status                     |
| -------------------------------------------------- | ----------- | ------------ | ---------------- | -------------------------- |
| `sprites2d` (dynamic layer, moving)                | 138 B (10)  | 129 B (200)  | -0.05 B          | Passes                     |
| `collisions` (200 triggers with `onCollisionStay`) | 141 B (10)  | 134 B (200)  | -0.04 B          | Passes                     |
| `text` (`BrioText` with outline)                   | 127 B (5)   | 131 B (100)  | 0.04 B           | Passes                     |
| `tilemap` (one 4x4 map per object)                 | 124 B (2)   | 166 B (40)   | 1.12 B           | Passes with the 4 B budget |
| `boxes3d` (WebGL2, rotating cubes)                 | 1400 B (5)  | 6410 B (100) | **52.7 B**       | **Fails: P-1**             |

The fixed cost of roughly 130 B per frame is V8 boxing floating-point values that cross into the Canvas and
WebGL APIs (`translate`, `drawImage`, `uniform*`). It does not grow with the scene, so it is accepted and capped.

## Open items

### P-1: 3D path allocates per object per frame

Sites reported by the profiler with 60 rotating cubes (bytes per object per frame, before the fixes in the next
section):

| B/object/frame | Site                                                                                                                      | Notes                                                                                                                                                                                                                                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 35.5           | `BrioTransform3D` rotation callback (`src/objects/BrioTransform3D.ts`, the `BrioVec3` callback that syncs the quaternion) | The module scratch objects (`SYNC_EULER`, `SYNC_QUAT`) already removed the object literals; what remains is probably boxed arguments `(rx, ry, rz)` passed to the closure and `quaternion.set()`. Try reading the components inside the callback instead of receiving them, or syncing lazily (mark dirty, rebuild the quaternion when `localMatrix` is read). |
| 18.4           | `mat4.multiply` from `BrioCamera3D.viewProjectionMatrix`                                                                  | **Fixed, not re-measured**: the product is now cached and recomputed only after the view or projection changes.                                                                                                                                                                                                                                                |
| 16.6           | `Array.prototype.sort` in `WebGL2Backend.endFrame`                                                                        | **Fixed, not re-measured**: replaced by `sortInPlace` (`src/tools/sort.ts`, stable merge sort with a reused buffer).                                                                                                                                                                                                                                           |
| 13.5           | `WebGL2Backend.#computeNormalMatrix`                                                                                      | Writes into a preallocated `Float32Array`; the allocation is likely boxing while the function runs in a lower tier. Check after a longer warm-up, or compute the normal matrix in the vertex shader (`inverse(transpose(mat3(uWorld)))`) or once per object when its world matrix changes.                                                                     |
| 8.3            | `BrioCompositor.#renderObject3D`                                                                                          | Recursion with a `parentOpacity` argument; look for boxed doubles (opacity, culling center).                                                                                                                                                                                                                                                                   |
| 5.5            | `WebGL2Backend.#geometryFor`                                                                                              | Should only allocate on the first draw of a mesh; check that the `WeakMap` lookup is the only per-frame work.                                                                                                                                                                                                                                                  |
| 2.0            | `BrioCompositor.#isMeshVisible`                                                                                           | Boxed values written to `#cullCenter`.                                                                                                                                                                                                                                                                                                                         |
| 12.5 / 24.4    | `BrioVec3` getter, test harness                                                                                           | `rotation.y += 0.01` in the test itself; not engine work.                                                                                                                                                                                                                                                                                                      |

Done when `boxes3d` passes `e2e/heap.spec.ts`: remove its `test.fixme` line.

### P-2: frame time not measured

No frame-time numbers exist yet for the TCC text (S13 asks for frame time per machine and bundle size per preset).
Measure on the presentation machine, with the browser's own GPU (not SwiftShader), for example by stepping
`game.step(1 / 60)` 1000 times per scenario and recording `performance.now()` per step, plus `game.renderStats`.

### P-3: golden screenshots after visual changes

The 3D work in progress (lights, tone mapping, shadows, custom shaders) changes the pixels of
`e2e/orbit-gallery.spec.ts`. Regenerate the goldens on the desktop machine with `npm run test:e2e:update`,
review the new images in the pull request, and check that CI (Ubuntu image) agrees.

## Fixed without a new measurement

- `BrioCamera3D.viewProjectionMatrix` caches the product (`#viewProjDirty`).
- `WebGL2Backend` sorts draw items with `sortInPlace` instead of `Array.prototype.sort`.
- `CollisionEventSystem` sorts sweep candidates with `sortInPlace`: candidates are added in registration order
  every frame, so the previous insertion sort was quadratic in the worst case.
- `BrioTransform3D` syncs Euler angles and the quaternion through module scratch objects (no object literals).
- Render interpolation (D-19) reads and writes rotations through pooled records and scratch objects.
- Lighting builds its environment only when a light changes and reports a numeric `version` (D-04).
