# BrioJS 3D Native Objects, Snapshots & IndexedDB Persistence Demo

Scope: `test-3d-native-object`  
Date: `18-10-26`

## Overview

This visual demo exercises the native 3D capabilities, binary snapshot serialization, and IndexedDB persistence recently added to BrioJS:

1. **3D Native Entities & Hierarchies**:
   - `BrioObject3D` with `BrioTransform3D` (parent-child scene graph).
   - `BrioMesh` procedural geometries (`createBox`, `createSphere`, `createPlane`).
   - `BrioMaterial` shading options (`phong`, `flat`, `unlit`, and `wireframe`).
   - Hierarchical orbital animation: satellite sphere orbits the central core box, and a sub-satellite box orbits the sphere, demonstrating recursive local-to-world matrix propagation (`Matrix4.multiply(world, parentWorld, local)`).

2. **Extensive `BrioMath` Functions**:
   - `BrioMath.smoothstep(value, edge0, edge1)`: Smooth Hermite interpolation factor for organic pulsing scale of the central core.
   - `BrioMath.wrap(value, min, max)`: Wraps rotational degrees between `0` and `360` degrees without numerical drift.
   - `BrioMath.degToRad(deg)`: Converts wrapped degrees to radians for trigonometric orbital trajectories.
   - `BrioMath.remap(value, inMin, inMax, outMin, outMax)`: Remaps trigonometric oscillation from `[-1, 1]` to opacity and lighting highlights in `[0.45, 1.0]`.
   - `BrioMath.lerp(start, end, t)`: Smooth camera tracking and distance interpolation.
   - `BrioMath.clamp(value, min, max)`: Restricts zoom levels and slider ranges.
   - `BrioMath.randomRange(min, max)` & `BrioMath.randomInt(min, max)`: Procedural spawning of random 3D objects with randomized dimensions, positions, and colors.

3. **Snapshots & Binary Serialization**:
   - `BrioSerializer.captureSnapshot(ecsWorld)`: Captures contiguous binary `Uint8Array` of all 3D transforms and entity allocations in sub-millisecond execution.
   - `BrioSerializer.restoreSnapshot(ecsWorld, snapshot)`: Restores complete world state in O(1) bulk memory copies.
   - `BrioSerializer.toJSON(snapshot)`: Inspects snapshot data structure with live modal preview.

4. **Multi-tier IndexedDB Storage**:
   - `BrioStorage.db.saveSnapshot(key, snapshot)`: Persists raw binary ECS snapshots into IndexedDB without Base64 overhead.
   - `BrioStorage.db.loadSnapshot(key)`: Retrieves binary snapshots from IndexedDB.
   - `BrioStorage.db.set(key, meta)` & `get(key)`: Manages slot metadata (timestamp, entity count, bytes).
   - Slot 1 and Slot 2 persistent storage with real-time slot status inspection.

5. **Software 3D Rasterization Backend**:
   - `Canvas2DBackend.renderMesh3D`: Software 3D projection, depth sorting via Painter's Algorithm, normal diffuse lighting, and backface rasterization onto HTML5 Canvas.

## How to Run

1. Build the library distribution:
   ```bash
   npm run build:lin
   ```

2. Serve the root directory via any HTTP server (e.g. `npx serve .` or `python3 -m http.server 8080`).

3. Navigate to:
   ```
   http://localhost:3000/demo/test-3d-native-object--18-10-26/index.html
   ```
