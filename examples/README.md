# BrioJS examples

Runnable examples that use only the public API of the built package (`dist/`). They ship no binary files:
sprites are inline SVG and sounds are synthesized in code (`shared/procedural-assets.js`), so everything here is
original work under the repository's MIT license.

| Example                                           | What it shows                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`2d-star-catcher`](./2d-star-catcher/)           | Complete 2D game: title and play scenes (`preload` / `load` / `restart`), static, dynamic and `ui` layers, `BrioText` HUD, collision events, an input map (keyboard + gamepad), camera shake, `fixedUpdate` with interpolation, seeded `game.random` (`?seed=`), Web Audio buses, best score saved with `BrioStorage.local`                                            |
| [`3d-orbit-gallery`](./3d-orbit-gallery/)         | Simple 3D scene: procedural meshes (box, sphere, cylinder, cone, plane), directional and hemisphere `BrioLight`s, orbit camera, mouse picking with `BrioCamera3D.screenToRay`, WebGL2 with Canvas2D fallback (`?backend=canvas2d`)                                                                                                                                     |
| [`2d-tile-platformer`](./2d-tile-platformer/)     | Small platformer: a `BrioTileMap` imported from Tiled JSON and drawn in chunks from a `BrioSpriteSheet`, merged tile colliders, tile queries (spikes), camera follow with world bounds, coin prefabs spawned with `game.instantiate()`, collision events, checkpoints that bring back collected coins, `useFullScreen("fit")` with pixel-art rendering                 |
| [`3d-lantern-courtyard`](./3d-lantern-courtyard/) | Night scene for the 3D look: `"standard"` metallic-roughness materials, point lanterns and a sweeping spot light, a moon with shadows, a water pool driven by a custom `BrioShader` loaded from `water.glsl`, fog and tone mapping (T cycles operators), an orbit camera, 3D prefabs dropped with `game.instantiate()`, a `BrioText` HUD over the 3D view (`"hybrid"`) |

## Running

```bash
npm install
npm run build
npx http-server . -p 8080 -c-1   # any static server works; serve the repository root
```

Then open:

- http://localhost:8080/examples/2d-star-catcher/
- http://localhost:8080/examples/3d-orbit-gallery/
- http://localhost:8080/examples/2d-tile-platformer/
- http://localhost:8080/examples/3d-lantern-courtyard/

Browsers keep audio muted until the first click or key press (autoplay policy); `BrioAudioMixer` resumes it
automatically on that first interaction.
