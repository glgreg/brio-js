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
- **Batteries included**: scenes, text, tile maps (Tiled import), collision events, action-based input (keyboard,
  mouse, touch, gamepad), Web Audio, and storage.
- **Save states built in**: checkpoints and restarts restore the whole game state, and a seeded random generator makes runs reproducible.
- **Sharp on every screen**: renders at the device pixel ratio and can fit the window while game code stays in logical pixels.
- **No dependencies**: tree-shakeable named exports; the 3D backends and model loaders load on demand.

## Installation

```bash
npm install @brio-js/core
```

BrioJS is published as ES modules with TypeScript declarations. It runs in modern browsers (Chrome, Edge, Firefox,
Safari) and works with any bundler (Vite, esbuild, webpack, Rollup) or directly through a `<script type="module">`:

```html
<script type="module">
    import { BrioGame } from "https://cdn.jsdelivr.net/npm/@brio-js/core@0.2/dist/index.js";
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
import { BrioGame, BrioSprite, BrioObject2D, BrioText, BrioLayer, BrioCollision } from "@brio-js/core";

const game = new BrioGame({ width: 640, height: 360, container: document.getElementById("game") });
game.useKeyboard();
game.input.bind("left", "ArrowLeft", "a").bind("right", "ArrowRight", "d");

let coins = 0;
const score = new BrioText("txt_score", "Coins: 0", { size: 20, strokeWidth: 3 });

game.preload(() => [new BrioSprite("spr_player", "./player.png"), new BrioSprite("spr_coin", "./coin.png")])
    .load(() => {
        const hud = new BrioLayer({ name: "hud", order: 100, policy: "ui" });
        hud.addObject(score);

        const player = new BrioObject2D("obj_player", "spr_player");
        const coin = new BrioObject2D("obj_coin", "spr_coin");
        coin.tag = "coin";
        coin.transform.position = { x: 300, y: 0 };
        for (const object of [player, coin]) {
            BrioCollision.addRectangle({ object, colliderType: "trigger", pos: { x: 0, y: 0 }, size: { x: 32, y: 32 } });
        }
        player.onCollisionEnter((other) => {
            if (other.tag !== "coin") return;
            score.text = `Coins: ${++coins}`;
            game.destroy(other);
        });
        return [hud, score, player, coin];
    })
    .update((updater, dt) => {
        const player = updater.getObject("obj_player");
        player.transform.position.x += game.input.axis("left", "right") * 200 * dt;
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

The [`examples/`](./examples/README.md) folder has two complete, runnable projects with no binary assets:

- **Star Catcher** (2D): title and play scenes, a text HUD, collision events, an input map with gamepad support, camera shake, fixed-step simulation, sound, and a saved best score.
- **Tile Platformer** (2D): a Tiled map drawn in chunks, tile colliders, coins spawned from a prefab, checkpoints, and a camera that follows the player, fitted to the window.
- **Orbit Gallery** (3D): procedural meshes, lights, an orbit camera, and mouse picking; add `?backend=canvas2d` to see the fallback renderer.

The examples are listed in [`examples/`](./examples/README.md) (README has the details).

```bash
git clone https://github.com/glgreg/brio-js.git && cd brio-js
npm install && npm run build
node e2e/serve.mjs 8080   # zero-dependency static server; then open http://localhost:8080/examples/2d-star-catcher/
```

## Core concepts

| Concept | What it does |
| --- | --- |
| **Lifecycle** | `preload()` loads assets asynchronously, `load()` creates the initial content, and `update()` runs every frame. `fixedUpdate()` runs simulation at a fixed rate (`fixedTimestep`, with optional render `interpolate`). |
| **Presets** | `dimension: "2d"` (no 3D memory), `"3d"`, or `"hybrid"` (2D layers composed over 3D passes). |
| **Scenes** | `new BrioScene(name).preload(...).load(...)`, then `game.addScene()` / `game.setScene()`. `scene.restart()` returns to the state right after `load()`. |
| **Text** | `BrioText` draws text (font, size, color, alignment, wrapping, outline, shadow) as a regular 2D object, in the world or on a `"ui"` layer. |
| **Collisions** | Colliders (`BrioCollision.addRectangle` / `addCircle`) raise `onCollisionEnter` / `onCollisionStay` / `onCollisionExit` once per frame; `BrioCollision.resolveCollision()` separates solid objects. |
| **Input** | `game.input` maps actions to keys, mouse buttons, gamepad buttons and sticks, and touch; bindings can be changed and saved at runtime. |
| **Tile maps** | `BrioTileMap` (hand-made grids, CSV or Tiled JSON) renders from a `BrioSpriteSheet` in cached chunks and builds merged colliders. |
| **Screen** | `pixelRatio` keeps the game sharp on high-DPI screens; `game.useFullScreen("fit")` scales a fixed logical resolution to the window. |
| **Layers and cameras** | `BrioLayer` planes (`static` cached, `parallax`, `dynamic` culled, `ui` in screen space); one pass per `BrioCamera2D` / `BrioCamera3D` viewport for split-screen and minimaps. |
| **Rendering backends** | The cascade picks WebGL2 when available and moves to the next backend if one fails to initialize, ending with the Canvas2D rasterizer. |
| **Lights** | `BrioLight` (`directional`, `ambient`, `hemisphere`) per game or scene; without lights a default sky-and-sun rig is used. |
| **Models** | `BrioModel` loads GLB, glTF, and OBJ/MTL with textures; names are namespaced as `"<model>/<name>"`. |
| **Audio** | `BrioAudio` plays through `BrioAudioMixer` buses (`master`, `bgm`, `sfx`) and unlocks on the first click or key press. |
| **Save states** | `game.createCheckPoint()` / `restoreCheckPoint()` / `restart()` restore every object (transforms, sprites, colliders, text, hierarchy, tile maps), the active scene, and `game.random`; binary snapshots (`BrioSerializer`, format v3) stay readable across versions. |
| **Assets** | `game.onLoadProgress()` drives loading bars; `game.unloadAsset()` and `game.removeScene()` free memory, scenes keep only what another owner still uses. |
| **Determinism** | `game.random` is a seeded `BrioRandom` (`seed` option); `game.step(dt)` advances frames manually for tests and tools. |

Every public class, method, and property is documented with TSDoc, so editors show usage examples inline. Generate the
API reference with `npm run doc`.

## Status

BrioJS is at **v0.2**, a preview for simple 2D and 3D games: the API is usable but may still change between minor
versions (see the breaking changes in [`CHANGELOG.md`](./CHANGELOG.md)). What works today and what is missing:

| Area | Status |
| --- | --- |
| ECS core, pooling, generational handles, binary snapshots | Stable |
| Scenes, fixed timestep, seeded randomness | Stable |
| 2D layers, multi-viewport cameras, sprites, animations, 2D collisions and collision events | Stable |
| Text, tile maps (Tiled JSON / CSV), input map, high-DPI and fit-to-window | New in v0.2 |
| WebGL2 3D renderer and Canvas2D fallback | Stable, with per-object frustum culling and context-loss recovery (tested in browsers) |
| Lights | Directional, ambient, and hemisphere; point/spot, PBR, and shadows are planned |
| glTF / GLB / OBJ | Static meshes and textures; skinning and animation are planned |
| Web Audio | Buses and autoplay unlock; positional audio is planned |
| WebGPU backend | Planned for v0.3 |
| UI widgets, particles, tweens | Planned |

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
  [0006 MCP authoring](./docs/adr/0006-mcp-agentic-game-authoring.md) (proposed),
  [0007 third-party code](./docs/adr/0007-third-party-code-policy.md).

## Contributing

```bash
npm install
npm run check      # type check, tests (Vitest), and build, the same as CI
npm run test:e2e   # the examples in a real browser (Playwright, Chromium)
npm run test:watch
```

Issues and pull requests are welcome at [github.com/glgreg/brio-js](https://github.com/glgreg/brio-js/issues); see
[`CONTRIBUTING.md`](./CONTRIBUTING.md). The detailed engineering checklist is [`TODO.md`](./TODO.md).

## License

[MIT](./LICENSE.txt) © Gustavo L. Gregorio. Third-party notices are in
[`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).
