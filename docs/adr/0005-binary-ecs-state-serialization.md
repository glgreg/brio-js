# Binary ECS State Serialization for Checkpoints and Scene Snapshots

`BrioSerializer` captures and restores scene state using pure binary buffers (`ArrayBuffer` / `Uint8Array`) copied directly from the internal ECS `TypedArrays`, replacing the previous `JSON.stringify` approach in `BrioGame`.

## Considered Options

- **`JSON.stringify` on OOP instances**: Fails silently on ES private fields (`#transform`, `#position`), allocates large temporary strings on the heap, loses object prototypes on `JSON.parse`, and causes frame drops when creating checkpoints during gameplay.
- **Pure Binary Serialization of ECS Buffers (`ArrayBuffer`) with optional JSON Translation Layer**: Because authoritative entity state resides in contiguous `TypedArrays`, taking a snapshot or checkpoint is a fast binary memory copy (`TypedArray.prototype.set` / `slice`), executing in sub-millisecond time without garbage collection spikes.

## Consequences

- In-memory operations (`createCheckPoint` / `restoreCheckPoint` and `restart` on `BrioGame`; `createCheckpoint` / `restoreCheckpoint` and `restart` on `BrioScene`) and `IndexedDB` persistence via `BrioStorage.db` (`saveSnapshot` / `loadSnapshot`) operate directly on binary `Uint8Array` snapshots produced by `BrioSerializer.captureSnapshot`.
- An optional translation layer (`BrioSerializer.toJSON` / `BrioSerializer.fromJSON`) can be used when human-readable export or external level/save inspection is explicitly needed.

## Implementation status (2026-10-28)

- `BrioSerializer.toJSON` and `BrioSerializer.fromJSON` are ordinary static methods of `BrioSerializer`, shipped in the same module as `captureSnapshot` / `restoreSnapshot`; they are not lazy-loaded. Code that never calls them still includes them when it imports `BrioSerializer`.
- There is no `SceneSnapshot` type. A raw snapshot is a `Uint8Array`. `BrioScene.captureState()` returns a `BrioSceneState` (exported as a type): the snapshot bytes plus the handle, slot, and layer of every registered 2D/3D object, so a restore can also unregister objects added after the capture and register again the ones removed after it. `BrioGame` keeps an equivalent internal capture that also stores the `BrioRandom` state and the active scene's `BrioSceneState`.
- A snapshot only covers state stored in ECS buffers; properties still held in JavaScript fields (see ADR-0002 "Implementation status") are not captured.

## Update (v0.2, 2026-11-04): format version 3 and facade state

- **Compatibility contract.** Snapshots are written in format version 3, whose header records the stride of every
  component section. Every engine release reads all earlier versions (1 and 2 imply the strides of the storage that
  wrote them, unchanged since). Component fields are only appended to a stride, never reordered or removed; a section
  with a shorter stride is migrated entity by entity, the missing trailing fields reading as `0`. A future field that
  cannot default to `0` ships with an explicit migration in `BrioSerializer`. `BrioSerializer.FORMAT_VERSION` and
  `BrioSerializer.inspect()` let games check a stored save before restoring it.
- **Facade state in checkpoints.** The previous bullet ("properties still held in JavaScript fields are not
  captured") no longer holds for checkpoints: `BrioGame` and `BrioScene` captures add each object's
  `captureState()` (sprite, flip, hierarchy, tag, collider, `BrioText` content; mesh, material, collider and child
  parts for 3D) and the tiles of every tile map, so restores are complete. The raw snapshot bytes still contain ECS
  data only; a persisted save format that also stores the facade state is tracked in `docs/ROADMAP.md`
  ("Before 1.0").
