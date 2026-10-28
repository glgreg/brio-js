# BrioJS examples

Runnable examples that use only the public API of the built package (`dist/`). They ship no binary files:
sprites are inline SVG and sounds are synthesized in code (`shared/procedural-assets.js`), so everything here is
original work under the repository's MIT license.

| Example | What it shows |
| --- | --- |
| [`2d-star-catcher`](./2d-star-catcher/) | Complete 2D game: title and play scenes (`preload` / `load` / `restart`), static and dynamic layers, camera shake, `fixedUpdate` with interpolation, seeded `game.random`, Web Audio buses, best score saved with `BrioStorage.local` |
| [`3d-orbit-gallery`](./3d-orbit-gallery/) | Simple 3D scene: procedural meshes (box, sphere, cylinder, cone, plane), directional and hemisphere `BrioLight`s, orbit camera, mouse picking with `BrioCamera3D.screenToRay`, WebGL2 with Canvas2D fallback (`?backend=canvas2d`) |

## Running

```bash
npm install
npm run build
npx http-server . -p 8080 -c-1   # any static server works; serve the repository root
```

Then open:

- http://localhost:8080/examples/2d-star-catcher/
- http://localhost:8080/examples/3d-orbit-gallery/

Browsers keep audio muted until the first click or key press (autoplay policy); `BrioAudioMixer` resumes it
automatically on that first interaction.
