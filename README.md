# BrioJS

[![npm](https://img.shields.io/npm/v/@brio-js/core.svg)](https://www.npmjs.com/package/@brio-js/core)
[![CI](https://github.com/glgreg/brio-js/actions/workflows/ci.yml/badge.svg)](https://github.com/glgreg/brio-js/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE.txt)

**A zero-dependency 2D and 3D web game engine written in TypeScript.** BrioJS gives you an approachable,
object-oriented API (`BrioGame`, `BrioScene`, `BrioObject2D`, `BrioObject3D`) on top of a data-oriented
Entity-Component-System core, so a first game reads like a script while the engine keeps its state in contiguous
typed arrays.

It is built for learning and fast prototyping: it sits between visual tools such as Scratch or GDevelop and heavyweight
engines such as Unity or Unreal.

- **2D and 3D in one engine**: sprites, layers, and split-screen cameras next to meshes, materials, lights, and glTF models.
- **GPU rendering with a fallback**: WebGL2 by default, with a Canvas2D software rasterizer when the GPU path is unavailable.
- **Batteries included**: scenes, input (keyboard, mouse, touch, gamepad), Web Audio, 2D collisions, and storage.
- **Save states built in**: binary ECS snapshots power checkpoints and restarts, and a seeded random generator makes runs reproducible.
- **No dependencies**: about 160 kB minified for the whole engine, and tree-shakeable named exports.

## Installation

```bash
npm install @brio-js/core
```

BrioJS is published as ES modules with TypeScript declarations. It runs in modern browsers (Chrome, Edge, Firefox,
Safari) and works with any bundler (Vite, esbuild, webpack, Rollup) or directly through a `<script type="module">`:

```html
<script type="module">
    import { BrioGame } from "https://cdn.jsdelivr.net/npm/@brio-js/core@0.1/dist/index.js";
</script>
```

## Quick start

### A 2D game

```html
<div id="game"></div>
<script type="module" src="./main.js"></script>
```

```js
// main.js
import { BrioGame, BrioSprite, BrioObject2D } from "@brio-js/core";

const game = new BrioGame({ width: 640, height: 360, container: document.getElementById("game") });
game.useKeyboard();

game.preload(() => [new BrioSprite("spr_player", "./player.png")])
    .load(() => [new BrioObject2D("obj_player", "spr_player")])
    .update((updater, dt) => {
        const player = updater.getObject("obj_player");
        if (game.keyboard.isDown("ArrowRight")) player.transform.position.x += 200 * dt;
        if (game.keyboard.isDown("ArrowLeft")) player.transform.position.x -= 200 * dt;
    });
```

### A 3D scene

```js
import { BrioGame, BrioMesh, BrioMaterial, BrioObject3D, BrioCamera3D, BrioLight } from "@brio-js/core";

const game = new BrioGame({
    width: 800,
    height: 450,
    container: document.getElementById("game"),
    dimension: "3d",
});

game.preload(() => [BrioMesh.createBox("mesh_box"), new BrioMaterial("mat_orange", { color: "#f97316" })])
    .load(() => [
        new BrioCamera3D("cam", { position: { x: 3, y: 3, z: 5 }, clearColor: "#0b1220" }),
        new BrioLight("sun", "directional", { direction: { x: -1, y: -2, z: -1 }, intensity: 2 }),
        new BrioLight("sky", "hemisphere", { color: "#9cc3ff", groundColor: "#2b2118", intensity: 0.6 }),
        new BrioObject3D("obj_box", "mesh_box", "mat_orange"),
    ])
    .update((updater, dt) => {
        game.gameObjects3D.get("obj_box").transform.rotation.y += dt;
    });
```

### Examples

The [`examples/`](./examples/) folder has two complete, runnable projects with no binary assets:

- **Star Catcher** (2D): title and play scenes, layers, camera shake, fixed-step simulation, sound, and a saved best score.
- **Orbit Gallery** (3D): procedural meshes, lights, an orbit camera, and mouse picking; add `?backend=canvas2d` to see the fallback renderer.

```bash
git clone https://github.com/glgreg/brio-js.git && cd brio-js
npm install && npm run build
npx http-server . -p 8080   # then open http://localhost:8080/examples/
```

## Core concepts

| Concept | What it does |
| --- | --- |
| **Lifecycle** | `preload()` loads assets asynchronously, `load()` creates the initial content, and `update()` runs every frame. `fixedUpdate()` runs simulation at a fixed rate (`fixedTimestep`, with optional render `interpolate`). |
| **Presets** | `dimension: "2d"` (no 3D memory), `"3d"`, or `"hybrid"` (2D layers composed over 3D passes). |
| **Scenes** | `new BrioScene(name).preload(...).load(...)`, then `game.addScene()` / `game.setScene()`. `scene.restart()` returns to the state right after `load()`. |
| **Layers and cameras** | `BrioLayer` planes (`static` cached, `parallax`, `dynamic` culled, `ui` in screen space); one pass per `BrioCamera2D` / `BrioCamera3D` viewport for split-screen and minimaps. |
| **Rendering backends** | The cascade picks WebGL2 when available and moves to the next backend if one fails to initialize, ending with the Canvas2D rasterizer. |
| **Lights** | `BrioLight` (`directional`, `ambient`, `hemisphere`) per game or scene; without lights a default sky-and-sun rig is used. |
| **Models** | `BrioModel` loads GLB, glTF, and OBJ/MTL with textures; names are namespaced as `"<model>/<name>"`. |
| **Audio** | `BrioAudio` plays through `BrioAudioMixer` buses (`master`, `bgm`, `sfx`) and unlocks on the first click or key press. |
| **Save states** | `game.createCheckPoint()` / `restoreCheckPoint()` / `restart()` snapshot the ECS, the active scene, and `game.random`. |
| **Determinism** | `game.random` is a seeded `BrioRandom` (`seed` option); `game.step(dt)` advances frames manually for tests and tools. |

Every public class, method, and property is documented with TSDoc, so editors show usage examples inline. Generate the
API reference with `npm run doc`.

## Status

BrioJS is at **v0.1**: the API is usable but may still change between minor versions. What works today and what is
missing:

| Area | Status |
| --- | --- |
| ECS core, pooling, generational handles, binary snapshots | Stable |
| Scenes, fixed timestep, seeded randomness | Stable |
| 2D layers, multi-viewport cameras, sprites, animations, 2D collisions | Stable |
| WebGL2 3D renderer and Canvas2D fallback | Stable; frustum culling and context-loss recovery are planned |
| Lights | Directional, ambient, and hemisphere; point/spot, PBR, and shadows are planned |
| glTF / GLB / OBJ | Static meshes and textures; skinning and animation are planned |
| Web Audio | Buses and autoplay unlock; positional audio is planned |
| WebGPU backend | Planned for v0.2 |
| Tile map rendering, UI widgets, particles | Planned |

Known issues and the roadmap are tracked in [`docs/ROADMAP.md`](./docs/ROADMAP.md); release notes are in
[`CHANGELOG.md`](./CHANGELOG.md).

## Documentation

- [Roadmap and known issues](./docs/ROADMAP.md)
- [Domain glossary](./GLOSSARY.md): the engine's ubiquitous language.
- [Target architecture](./docs/architecture/TARGET_ARCHITECTURE.md): ECS backend, multi-backend renderer, layers, and workers.
- [Rendering study](./docs/architecture/RENDERING_STUDY_THREEJS.md): techniques studied from three.js and the WebGPU plan.
- [MCP game authoring](./docs/architecture/MCP_GAME_AUTHORING.md): the proposed MCP server for agentic game creation.
- Architecture decision records:
  [0001 renderer](./docs/adr/0001-zero-dependency-multi-backend-renderer.md),
  [0002 OOP facade over ECS](./docs/adr/0002-oop-facade-over-soa-ecs.md),
  [0003 layers and workers](./docs/adr/0003-multi-canvas-layers-and-offscreen-workers.md),
  [0004 2D/3D domain](./docs/adr/0004-concrete-2d-3d-domain-and-strict-ubiquitous-language.md),
  [0005 binary serialization](./docs/adr/0005-binary-ecs-state-serialization.md),
  [0006 MCP authoring](./docs/adr/0006-mcp-agentic-game-authoring.md) (proposed).

## Contributing

```bash
npm install
npm run check      # type check, tests (Vitest), and build, the same as CI
npm run test:watch
```

Issues and pull requests are welcome at [github.com/glgreg/brio-js](https://github.com/glgreg/brio-js/issues).
The internal engineering checklist (in Portuguese) is [`TODO.md`](./TODO.md).

## License

[MIT](./LICENSE.txt) © Gustavo L. Gregorio
