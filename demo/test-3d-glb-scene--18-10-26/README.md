# BrioJS - 3D GLB Models Showcase Demo

Scope: `test-3d-glb-scene`  
Date: `18-10-26`

## Overview

This visual demo exercises the native zero-dependency GLB 3D model loading and scene composition pipeline added to BrioJS:

1. **Native GLB Binary Loading**:
   - Asynchronously parses binary `.glb` containers (Khronos glTF 2.0) directly from disk via `GLBLoader` and `BrioModel`.
   - Extracts binary buffer accessors with `DataView` into `Float32Array` (positions, normals, UVs) and `Uint16Array` / `Uint32Array` (indices).
   - Generates flat normal vectors when omitted.
   - Extracts materials and baseColorFactor values into `BrioMaterial`.

2. **Models in the Scene**:
   - `gwen_tennyson.glb`:
     - 10 Sub-Meshes, 10 Materials
     - 37,514 Triangles, 20,804 Vertices
     - Bounding Box: 2.1 x 2.6 x 0.4 units
     - Positioned on the left pedestal at `(X: -3.5, Z: 0)`
   - `harry_potter_-_malfoy_draconia_3d_model__dl.glb`:
     - 3 Sub-Meshes, 3 Materials
     - 105,122 Triangles, 68,553 Vertices
     - Bounding Box: 1.3 x 1.6 x 0.4 units
     - Positioned on the center pedestal at `(X: 0, Z: 0)`
   - `spider_gwen.glb`:
     - 8 Sub-Meshes, 7 Materials
     - 12,330 Triangles, 8,254 Vertices
     - Bounding Box: 1.3 x 2.0 x 0.3 units
     - Positioned on the right pedestal at `(X: 3.5, Z: 0)`
   - **Total Scene Complexity**: 154,966 Triangles and 97,611 Vertices rendered in software 3D.

3. **Software 3D Rasterizer & Backface Culling**:
   - `Canvas2DBackend`: Projects 3D vertices through `viewProjectionMatrix * worldMatrix`, performs screen-space 2D cross-product backface culling (eliminating ~46% of backward-facing triangles), sorts triangles with the Painter's Algorithm, and shades polygons with diffuse directional lighting.

4. **Camera Focus & BrioMath Interpolation**:
   - Focus presets: "All Models" (wide orbit), "Gwen Tennyson", "Malfoy Draconia", "Spider-Gwen".
   - `BrioMath.lerp`: Smoothly transitions camera target, elevation, and eye position when changing focus targets.
   - `BrioMath.wrap`: Keeps stage and turntable spin angles cleanly within `[0, 360)` degrees without numerical precision loss.
   - `BrioMath.smoothstep`: Drives gentle pedestal floating / breathing idle motion.
   - `BrioMath.clamp`: Restricts zoom and orbit distance sliders.

5. **Shading Modes**:
   - **Diffuse Shaded**: Default material appearance with directional lighting.
   - **Wireframe**: Displays the dense polygon topology of each character.
   - **Color Palette**: Assigns distinct character palettes to individual sub-meshes.
   - **Clay White**: Renders a clean monochromatic studio sculpture pass.

6. **State Persistence**:
   - In-memory checkpoints with `BrioSerializer.captureSnapshot` and `restoreSnapshot`.
   - IndexedDB storage with `BrioStorage.db.saveSnapshot` and `loadSnapshot`.

## How to Run

1. Build the library distribution:
   ```bash
   npm run build:lin
   ```

2. Start a local HTTP server at the root repository directory:
   ```bash
   python3 -m http.server 8088
   ```

3. Open in browser:
   ```
   http://localhost:8088/demo/test-3d-glb-scene--18-10-26/index.html
   ```
