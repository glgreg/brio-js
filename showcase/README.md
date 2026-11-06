# BrioJS showcase

The project website: a landing page, three demo games and the playground, an in-browser IDE for BrioJS games.
English is the default language and Portuguese is complete (toggle in the header, or `?lang=pt`).

Live: <https://playground.briojs.gregorium.com> (Vercel project `brio-js-preview`, root directory `showcase`).

## Pages

| Page | File | What it does |
| --- | --- | --- |
| Landing | `index.html`, `src/landing.ts` | Project story, a live WebGL2 scene (`public/scenes/hot-spring.js`), the game gallery |
| Player | `play.html`, `src/play.ts` | Runs `public/games/<id>/` in an iframe with controls, features and credits |
| Playground | `playground.html`, `src/playground.ts`, `src/ide/` | Monaco editor, file tree, drag and drop assets, sandbox, console, zip export/import |
| Credits | `credits.html`, `src/credits.ts` | Every third-party asset, its author and license |

## Demo games

Each game is a normal BrioJS project (its own `index.html`, ES modules and assets) and opens in the playground with
its full source. All of them render through the WebGL2 backend only.

| Game | Look | Engine features |
| --- | --- | --- |
| `lumen-vigil` | 2D pixel art | sprites as lit GPU quads, sprite-sheet frames in a `BrioShader`, procedural floor shader, 8 point lights, pools of hundreds of monsters, uniform grid collisions |
| `araucaria-run` | 3D low poly | KayKit glTF models, procedural capybara and araucárias, shadows following the camera, fog, AgX tone mapping, sky and ground shaders |
| `prism-stack` | 3D neon glass | `"standard"` shading, neon edges and background as `BrioShader`s, orbiting point lights, runtime material colors, synthesized sounds |

Game URLs accept `?lang=pt`, `?demo=1` (attract mode) and, in Lumen Vigil, `?t=150` (start later in the night).

## How the playground runs code

Projects and files are stored in IndexedDB (`src/ide/db.ts`). The service worker `public/sw.js` serves
`/sandbox/<project>/<run>/<path>` from that database, injecting the `@brio-js/core` import map and
`public/sandbox-bridge.js` (console and error forwarding) into HTML. A new `<run>` id per Run gives the game a fresh
module graph. Nothing leaves the browser.

## Develop

```bash
cd showcase
bun install            # or npm install
bun run dev            # builds the engine from ../src into public/engine/, then starts Vite
bun run build          # engine + manifests + vite build into dist/ (what Vercel runs)
```

`scripts/build-engine.mjs` bundles the engine of this repository (so the site always shows the current commit) and
writes its type declarations for the editor. `scripts/build-manifests.mjs` writes the `project.json` file lists the
playground uses to copy a game or template. `scripts/capture-posters.mjs` renders the gallery posters from each game's
attract mode with the repository's Playwright (run the dev server first).

## Assets and licenses

Credits live in `src/games.ts` and appear on the player and credits pages. Assets that may not be redistributed
(today the BDragon1727 holy spell sheets used by Lumen Vigil) are kept in `public/games/*/assets/vendor/`, which git
ignores: they reach the website only through CLI deploys (`vercel deploy` from the repository root, see
`../.vercelignore`). Without them the game uses plain glowing materials instead. The synthesized sounds of Prism Stack,
the Capibrio illustrations and all code are original work under the repository's MIT license.
