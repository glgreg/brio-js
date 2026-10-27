# Public OOP Facade and Tooling Functions Over Internal SoA ECS

BrioJS exposes an Object-Oriented public API (`BrioObject2D`, `BrioObject3D`, `BrioTransform2D`, `BrioTransform3D`) alongside modular, tree-shakeable functional utilities (`Vector2`, `Vector3`, `BrioMath`, `BrioCollision`), while internally storing all entity state in a Structure-of-Arrays (SoA) Entity-Component-System (ECS) backed by contiguous `TypedArrays`.

## Considered Options

- **Pure OOP internal storage (Array of Structures)**: Storing state directly inside class instances (`#transform`, `collision`) is simple to write initially, but causes heap fragmentation, garbage collection pressure during cloning/destruction, poor CPU cache locality, and costly data marshaling when uploading buffers to WebGL/WebGPU or Web Workers.
- **Pure ECS public API**: Exposing raw entity IDs, bitmasks, and systems directly to the user maximizes raw performance, but alienates beginners transitioning from block-based tools and undermines the pedagogical goal of teaching object-oriented programming.
- **Public OOP Handle (Facade) over Internal SoA ECS**: Public object instances store only a lightweight numeric `entityId` handle; their property getters and setters read and write directly into pre-allocated `Float32Array` and `Uint32Array` component pools in the active `ECSWorld`, while internal systems iterate over contiguous typed arrays.

## Consequences

- Public classes (`BrioObject2D`, `BrioObject3D`) must never hold authoritative mutable state in private JavaScript fields when that state belongs to an ECS component; they act strictly as ergonomic views over ECS component slots.
- Sub-property mutations (such as `object.transform.scale.x = 2`) use atomic view wrappers (`BrioVec2`, `BrioVec3`) that write directly into the underlying typed array slot and set the entity's transform dirty bit without allocating closures.
- Object instantiation (`instantiate`) and destruction (`destroy`) recycle numeric `entityId` slots in $O(1)$ time via an internal ECS object pool.
