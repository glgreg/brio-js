# Binary ECS State Serialization for Checkpoints and Scene Snapshots

`BrioSerializer` captures and restores scene state using pure binary buffers (`ArrayBuffer` / `Uint8Array`) copied directly from the internal ECS `TypedArrays`, replacing the previous `JSON.stringify` approach in `BrioGame`.

## Considered Options

- **`JSON.stringify` on OOP instances**: Fails silently on ES private fields (`#transform`, `#position`), allocates large temporary strings on the heap, loses object prototypes on `JSON.parse`, and causes frame drops when creating checkpoints during gameplay.
- **Pure Binary Serialization of ECS Buffers (`ArrayBuffer`) with optional JSON Translation Layer**: Because authoritative entity state resides in contiguous `TypedArrays`, taking a snapshot or checkpoint is a fast binary memory copy (`TypedArray.prototype.set` / `slice`), executing in sub-millisecond time without garbage collection spikes.

## Consequences

- In-memory operations (`createCheckpoint`, `restoreCheckpoint`, `restart`, and `IndexedDB` persistence via `BrioStorage.db`) operate directly on binary `SceneSnapshot` buffers.
- An optional, lazy-loaded translation layer (`BrioSerializer.toJSON` / `BrioSerializer.fromJSON`) can be used when human-readable export or external level/save inspection is explicitly needed.
