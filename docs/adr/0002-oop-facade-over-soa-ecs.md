# Public OOP Facade and Tooling Functions Over Internal SoA ECS

BrioJS exposes an Object-Oriented public API (`BrioObject2D`, `BrioObject3D`, `BrioTransform2D`, `BrioTransform3D`) alongside modular, tree-shakeable functional utilities (`Vector2`, `Vector3`, `BrioMath`, `BrioCollision`), while internally storing all entity state in a Structure-of-Arrays (SoA) Entity-Component-System (ECS) backed by contiguous `TypedArrays`.

## Considered Options

- **Pure OOP internal storage (Array of Structures)**: Storing state directly inside class instances (`#transform`, `collision`) is simple to write initially, but causes heap fragmentation, garbage collection pressure during cloning/destruction, poor CPU cache locality, and costly data marshaling when uploading buffers to WebGL/WebGPU or Web Workers.
- **Pure ECS public API**: Exposing raw entity IDs, bitmasks, and systems directly to the user maximizes raw performance, but alienates beginners transitioning from block-based tools and undermines the pedagogical goal of teaching object-oriented programming.
- **Public OOP Handle (Facade) over Internal SoA ECS**: Public object instances store only a lightweight numeric `entityId` handle; their property getters and setters read and write directly into pre-allocated `Float32Array` and `Uint32Array` component pools in the active `ECSWorld`, while internal systems iterate over contiguous typed arrays.

## Consequences

- Target: public classes (`BrioObject2D`, `BrioObject3D`) never hold authoritative mutable state in private JavaScript fields when that state belongs to an ECS component; they act strictly as ergonomic views over ECS component slots. "Implementation status" lists the state that has not reached the ECS yet.
- Sub-property mutations (such as `object.transform.scale.x = 2`) go through reactive view wrappers (`BrioVec2`, `BrioVec3`, `BrioQuat`) that write directly into the underlying typed array slot and notify the owning transform, which sets the entity's transform dirty bit. The wrappers are created once per transform, so a property write in the game loop allocates nothing.
- Object instantiation (`instantiate`) and destruction (`destroy`) recycle numeric `entityId` slots in $O(1)$ time via an internal ECS object pool.

## Implementation status (2026-10-28)

- **In the ECS**: a `BrioTransform2D` bound to a slot keeps `position`, `size`, `scale`, `pivot`, `skew`, `renderSize`, `rotation`, `opacity` and `layer` in the `transform2D` buffer; a bound `BrioTransform3D` keeps its `position`, `scale`, Euler `rotation`, `quaternion`, `opacity` and `layer` in the `transform3D` buffer. Both store `visibility` in the `visual` buffer (`VISUAL_VISIBILITY_OFFSET`). This is the state that binary snapshots (`BrioSerializer`) capture and restore. Before an object is registered (unbound transform), the same values live in local fields and are written to the slot on `bindECS()`.
- **Still in JavaScript fields** (authoritative, and therefore **not** part of binary snapshots): 2D `flip`, the parent/child hierarchy of both transforms and of `BrioObject3D`, the sprite name of `BrioObject2D`, the mesh and material names of `BrioObject3D`, and the `collision` descriptor of both object types. A checkpoint restore therefore keeps the current values of these properties instead of the captured ones.
- **Allocated but unused**: `ComponentStorage` allocates (and snapshots copy) the `collider` and `rigidBody` buffers, but no facade writes them yet; of the `visual` buffer only the visibility flag is used. `BrioRigidBody` is a standalone object, not an ECS component.
- Moving the remaining state into ECS components is tracked as future work; until then, documentation must not promise that every property round-trips through a snapshot.
