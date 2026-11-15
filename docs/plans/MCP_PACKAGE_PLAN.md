# MCP Package Plan: `@brio-js/mcp`

Status: **Proposed** (2026-11-15). Implementation study and work packages for the MCP server as a separate npm package. It builds on [`MCP_GAME_AUTHORING.md`](../architecture/MCP_GAME_AUTHORING.md) (state of the art, tool catalog draft, security model) and [ADR 0006](../adr/0006-mcp-agentic-game-authoring.md), and changes three points of them, listed in section 2. Track M of [`GAME_LIFECYCLE_PLAN.md`](./GAME_LIFECYCLE_PLAN.md); its session rules apply.

## 1. Requirement

The maintainer's requirement, restated:

- The engine stays on npm as `@brio-js/core`. The MCP server is a separate package, `@brio-js/mcp`.
- It must work **out of the box with core as soon as it is installed**: no glue code in the game, no manual version matching, no configuration beyond registering the server in the agent client.

What "out of the box" has to mean in practice, as acceptance criteria for the whole track:

1. In a project that depends on `@brio-js/core`, `npm install --save-dev @brio-js/mcp` followed by `npx brio-mcp init` leaves a working server entry for the common agent clients. No other step.
2. The server uses **the copy of core installed in the project**, so the documentation, types, schemas and runtime behavior it reports are those of the version the game really uses.
3. A game runs under the server without any import of the MCP package in game code.
4. An incompatible pair of versions fails at start with one message that names both versions and the fix.
5. A production build of the game contains no byte of the MCP package.

## 2. What changes from the earlier study

| Earlier text | Finding on 2026-11-15 | Change |
| --- | --- | --- |
| "v2 was still flagged beta in parts of the docs" | The SDK site calls v2 "the stable release line implementing the 2026-07-28 spec"; the registry lists `@modelcontextprotocol/server` 2.4.0, Apache-2.0, Node 20 or newer, with `zod` `^4.2.0` as a dependency | Build on v2. Pin the minor version and re-read the migration page at implementation time |
| Two packages, `@brio-js/mcp` and `@brio-js/devtools` | The bridge and the server must agree on a wire protocol; two packages add a third version to keep in step with core | One package. The browser bridge is an entry point of `@brio-js/mcp`; core keeps only a small hook (section 4). Decision DL-07 |
| "Headless-capable core (`PlatformAdapter` `"headless"`)" | `PlatformAdapter` detects a headless host, but `BrioGame` requires an `HTMLElement` container (`src/game/BrioGame.ts:563`) and drives itself with `requestAnimationFrame`. The unit tests run under jsdom. Core cannot run in plain Node today | A headless mode is engine work, package M-02 |
| Phase 1 screenshots "from the headless Canvas2D backend" | Node has no Canvas2D without a native dependency | Headless runs give state, not pixels. Pixels come from a browser through the bridge, section 6 |
| Protocol summary | Confirmed against the [2026-07-28 changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog), with three nuances: deterministic `tools/list` order is a SHOULD; schemas may use any JSON Schema 2020-12 keyword (a loosening, with `$ref` resolution rules); Roots, Sampling and Logging are deprecated but "remain fully functional during the deprecation window" | No design change. `ping`, `logging/setLevel` and `notifications/roots/list_changed` are removed outright, and the HTTP+SSE transport is deprecated |
| MCP Apps (`io.modelcontextprotocol/ui`) as the most valuable extension | Not found in the specification changelog, the draft changelog or the SDK pages read for this plan | Stays the last package (M-08). Verify its status and client support before starting |

The draft changelog shows no released revision after 2026-07-28.

## 3. Package layout

Decision DL-07. Recommendation: **the same repository, a self-contained package folder**, following the precedent of `showcase/` (its own `package.json` and lockfile, built against the engine of this repository, outside the npm package of core).

```text
packages/
  mcp/
    package.json          name "@brio-js/mcp", "type": "module", bin "brio-mcp", engines node >= 20
    src/
      cli.ts              brio-mcp (stdio server), brio-mcp init, brio-mcp doctor
      server/             catalog, profiles, tools/, resources/, prompts/
      project/            project discovery, core resolution, filesystem guard
      runtime/headless/   runs a game on the headless mode of core
      bridge/host.ts      loopback server the browser bridge connects to
      bridge/client.ts    browser entry, exported as "@brio-js/mcp/bridge" (no dependencies)
      bridge/protocol.ts  message types and protocol version, shared by host and client
    skill/brio-game-dev/SKILL.md
    templates/            project scaffold used by brio_project_create
    tests/
  react/                  @brio-js/react (package U-04), same pattern
```

Why not npm workspaces at the repository root: the root is itself the published package `@brio-js/core`. A workspace setup would make the root `npm ci` install tooling dependencies into the engine's development tree and lockfile, and would change the engine's CI and release workflow. The `showcase/` pattern keeps core untouched, which also respects the rule in `CLAUDE.md` against restructuring the project. The MCP package links core in development with `"@brio-js/core": "file:../.."` as a dev dependency.

Why not a separate repository: the bridge protocol, the introspection data and the scene schema change together with core, and one pull request should be able to change both sides with one CI run.

Package metadata:

| Field | Value | Reason |
| --- | --- | --- |
| `peerDependencies` | `"@brio-js/core": ">=0.3.0 <1.0.0"` (the first version with the hook of M-02) | The server uses the project's copy, never its own |
| `dependencies` | `@modelcontextprotocol/server` (Apache-2.0), `zod` 4, a WebSocket server library after a license and size check | Allowed for tooling after decision DL-06. None of them reaches a game bundle |
| `optionalDependencies` or optional peer | A browser automation library for unattended screenshots (M-07) | Not needed for the interactive path |
| `exports` | `"."` (server API), `"./bridge"` (browser), `"./vite"` (optional dev plugin) | The bridge is importable only by tools, never by game code |
| `license` | MIT | Same as core |
| Release | Its own workflow, triggered by a version change in `packages/mcp/package.json`, with provenance, like `release.yml` | Versions are independent of core |

## 4. How it connects to core

Three contact points, all owned and versioned by core, so the MCP package depends only on public, documented surface.

### 4.1 Project resolution

At start the server finds the project root (the `--project` argument, or the nearest `package.json` above the working directory) and resolves `@brio-js/core` **from that root**. From the resolved package it reads:

- `package.json`: the version, checked against the supported range.
- `dist/index.d.ts` and `GLOSSARY.md`: already shipped.
- **New files shipped by core** (package M-02): `dist/meta/api.json`, a compact index of public symbols (name, kind, signature, summary, example) generated from TypeDoc's JSON output at build time, and `dist/meta/scene.schema.json` once scene documents exist (C-06). They are data files that nothing imports, so they add install size and no bundle size.

This is what makes acceptance criterion 2 true: documentation resources are served from the installed version, not from a copy frozen inside the MCP package.

### 4.2 The devtools hook

Core gains one line of behavior, following the pattern browser devtools use for UI frameworks: when a game is constructed, it announces itself to a global hook if one exists.

```ts
// Inside BrioGame, once, after construction. No import, no cost when the hook is absent.
(globalThis as BrioDevtoolsGlobal).__BRIO_DEVTOOLS_HOOK__?.attach(game);
```

- The hook is installed by the bridge script **before** game code runs. It receives the game, reads `game.introspection` (section 4.3) and opens the connection to the server.
- Game code never imports the bridge, so a production bundle cannot contain it (criterion 5). The check itself is a property read.
- The bridge script reaches the page in one of three ways, none of which edits the game: the server's own static server injects a script tag into HTML responses when it serves the project; a browser launched by the server gets it as an init script; projects with a Vite dev server can add the optional `@brio-js/mcp/vite` plugin.
- The hook's TypeScript interface and a `BRIO_DEVTOOLS_PROTOCOL` number live in core. The bridge sends that number in its first message, and the server refuses a different major version with the message of criterion 4.

### 4.3 The agent surface of core

The server calls only these, all of which are useful without MCP as well (tests, tools, the playground):

| Surface | Package | State today |
| --- | --- | --- |
| `game.step(dt)`, seeded `game.random`, checkpoints | Exists | `src/game/BrioGame.ts:1660` |
| `game.renderStats` | Exists, compositor counters only | Backend counters arrive with R-01 |
| `game.introspection`: scenes, layers, cameras, lights, objects with transform and components, assets, state stores, input map, as plain serializable data, with a version number | M-02 | Missing |
| Headless mode: a game without canvas or animation frame, advanced only by `step()` | M-02 | Missing |
| `game.input.inject()`, `record()`, `replay()` | X-05 | Missing |
| `game.captureFrame()` | X-01 | Missing |
| Scene documents and their schema | C-06 | Missing |
| `BrioSerializer.diff(a, b)` per entity | M-02 | Missing |

Introspection runs on demand, outside the frame, so it may allocate. It must never hand out live buffers: values are copied.

## 5. Protocol and SDK notes

From the [2026-07-28 changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog), the [SDK v2 site](https://ts.sdk.modelcontextprotocol.io/v2/) and its [migration page](https://ts.sdk.modelcontextprotocol.io/v2/migration/support-2026-07-28), read on 2026-11-15. Re-read them when implementing; the migration page was only partly readable in this study.

- **Stateless.** There is no `initialize` handshake and no protocol session; each request carries the protocol version and client capabilities in `_meta`, and `server/discover` is mandatory. Consequence, unchanged from the earlier study: a running game is addressed by a `gameId` minted by the server and passed as a tool argument. The server process keeps the map from `gameId` to runtime; a `gameId` that no longer exists returns a structured error that tells the agent to call `brio_game_run` again.
- **Server construction.** With the SDK, a stdio server is started with `serveStdio(() => buildServer())` from `@modelcontextprotocol/server/stdio`, and tools are registered with `server.registerTool(name, { description, inputSchema }, handler)` using Zod 4 schemas. The factory may be called per request, so **game state must live outside the server object**, in a module-level registry.
- **Opt-in.** The migration page states that nothing in v2 uses the 2026-07-28 wire format by default; `serveStdio` is the entry point that serves it. Whether it also serves older clients by default was not confirmed; test with one older client before release.
- **Lists.** Return tools in a deterministic order (a SHOULD), and set `ttlMs` and `cacheScope` on list results. A stable catalog also keeps prompt caches warm.
- **Long operations** use the tasks extension (`io.modelcontextprotocol/tasks`): the changelog moves tasks out of core, with polling through `tasks/get` and a new `tasks/update`.
- **Confirmation** of destructive operations uses Multi Round-Trip Requests: the tool returns an `input_required` result and the client retries with the answer.
- **Not used**: Roots, Sampling and Logging (deprecated). The project directory is configuration; logs go to stderr.
- **Live data** (console lines, stats) is exposed as resources that clients follow through `subscriptions/listen`, and every such resource also has a polling tool, because client support for subscriptions varies.

## 6. Running games: three modes

| Mode | What runs | Gives | Needs | Use |
| --- | --- | --- | --- | --- |
| Headless | The game's entry module inside the server's Node process, on core's headless mode | State, stats, checkpoints, deterministic steps; no pixels, no audio | M-02, and a project entry that exports a factory (`export function createGame(options)`), which the scaffold provides | Fast logic checks and tests |
| Browser, interactive | The project served on loopback and opened in the user's browser, with the bridge injected | Everything, including screenshots through `game.captureFrame()` over the bridge and real input | M-06, X-01, X-05 | The normal loop: the user and the agent look at the same game |
| Browser, unattended | A headless browser launched by the server | The same as interactive, without a person | M-07 and the optional automation dependency | CI, visual regression, playtest suites |

Headless mode cannot run arbitrary projects: game code that touches the DOM fails there. The server reports that plainly and suggests browser mode. Browser mode is the general path; headless mode is the fast path for projects that follow the scaffold.

A tool call that times out is never re-sent automatically, because the game may still be executing it (lesson recorded in the earlier study). Every bridge request has an id, a deadline and at-most-once semantics.

## 7. Tool catalog

The draft of `MCP_GAME_AUTHORING.md` section 3.3 stands: names `brio_<domain>_<verb>`, annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`), an `outputSchema` on every tool, and profiles. Refinements:

| Profile | Contents | Limit |
| --- | --- | --- |
| `read` (default) | Project info, documentation search, asset and scene listing, inspection of a running game, stats, screenshot | At most 12 tools |
| `author` | `read` plus scene document patching, entity and prefab tools, asset import, build, test | At most 30 |
| `play` | `read` plus run, stop, pause, step, input, checkpoints, playtests | At most 30 |
| `full` | Everything, including `brio_game_eval` | Explicit flag only |

- The profile is chosen by a server argument (`--profile`), recorded in the client configuration that `brio-mcp init` writes. The earlier study cites a measurement of about 3,000 tokens for a small catalog against about 60,000 for a full one; a test in this package measures the serialized size of each profile's `tools/list` and fails above a budget.
- **Documentation is a tool as well as a resource.** Not every client surfaces resources to the model, so `brio_docs_search` returns the matching symbols of `dist/meta/api.json` and glossary entries.
- Tools added by the lifecycle plan, when their engine packages exist: `brio_model_inspect`, `brio_model_lod` and `brio_model_compress` (X-02); `brio_rig_bind`, `brio_clip_create` and `brio_model_export` (A-07, A-08, A-10); `brio_shader_check` (compile a shader variant and return errors with file and line, R-04); `brio_state_read` (U-01); `brio_audio_inspect` (S-02).
- Screenshots are returned as image content, with the camera, resolution and frame number in structured content, so the agent can relate the picture to the state.

## 8. Security model

The model of `MCP_GAME_AUTHORING.md` section 3.4 stands. Additions specific to this design:

- **Loopback only.** The bridge host binds to `127.0.0.1` on a port chosen per project, checks the `Origin` header, and requires a random token that is embedded in the injected script for that run. The token is never written to disk or logs.
- **The hook is inert without the bridge.** A deployed game has the property check and nothing else; no network code, no listener.
- **Filesystem guard.** Every path argument is resolved, normalized and required to stay inside the project root after symbolic links are followed. Writes outside `src/`, `assets/` and the scene folder need the `author` profile and are listed in the tool description.
- **No install scripts.** The package has no `postinstall`. Configuration is written only by the explicit `brio-mcp init`, which prints what it writes.
- **Code execution** exists only as `brio_game_eval` in the `full` profile, annotated as destructive. Running the user's own game in headless mode executes project code in the server process; say so in the documentation and in the tool description of `brio_game_run`.
- **Imported assets** go through the engine's own loader limits before anything is copied into the project.
- **Tool results are data.** Console lines, object names and file contents returned to the agent can contain text written by third parties (for example inside an imported asset). The skill tells agents to treat them as data, and tools never execute strings found in results.
- **Git awareness.** Tools that write warn when the working tree is dirty and suggest a branch per session; they never commit or push.

## 9. Work packages

Status marks, sizes and priorities as in `GAME_LIFECYCLE_PLAN.md`. Packages M-02, X-01, X-05 and C-06 change `@brio-js/core`; the others live in `packages/mcp`.

### M-01 Package skeleton and CI `[ ]`

P1, S. Decisions DL-06, DL-07.

- Create `packages/mcp` as in section 3 with a stdio server that implements `server/discover` and one tool, `brio_project_info` (project root, core version, package versions, detected entry points).
- `brio-mcp init`: writes the server entry for the agent clients it detects in the project (at least the generic `.mcp.json`), prints each file it touches, and never overwrites without `--force`.
- `brio-mcp doctor`: checks Node version, core resolution and the version range.
- A CI job for the package (its own install, type check, tests) and a release workflow with provenance. Add `packages/` to `.vercelignore` if the showcase deploy would otherwise pick it up.
- Amend ADR 0006 with the confirmed decisions.

Accept: in a fixture project with core installed, `npx brio-mcp` answers `server/discover` and `brio_project_info` through the SDK's client in a test; with core missing or out of range, the server exits with the message of criterion 4.

### M-02 Agent surface in core `[ ]`

P1, L. Depends on F-04 for stable component data. Stones: `game`, `storage`, `ecs`, `tools`.

- The devtools hook and its types (section 4.2), with a test that an absent hook costs one property read and that a present hook receives the game.
- `game.introspection` (section 4.3), versioned, returning copies.
- **Headless mode**: `new BrioGame({ headless: true, width, height, dimension })` creates no canvas, registers no DOM listener, starts no animation frame loop, uses a backend that counts and discards draws, and advances only through `step()`. `preload()` uses the platform's `fetch` or a provided file reader. A test runs a game in Node **without jsdom**.
- `BrioSerializer.diff(a, b)`: entity-level differences between two snapshots.
- `dist/meta/api.json` generated in the build from TypeDoc JSON, and listed in the package content check of CI.

Accept: the Node-without-jsdom test steps a game 600 times and its snapshot equals the same run under jsdom; `npm pack --dry-run` lists the metadata file; bundle size of a 2D game changes by less than the hook's few bytes.

### M-03 Read profile `[ ]`

P1, M. Depends on M-01, M-02.

- Resources: `brio://docs/glossary`, `brio://docs/api/{symbol}`, `brio://docs/guide/{topic}`, `brio://docs/adr/{n}` when the project has them, `brio://schema/scene` when available. All served from the project's copy of core.
- Tools: `brio_docs_search`, `brio_asset_list`, `brio_asset_inspect` (uses the engine's loaders and reports triangles, materials, bones, clips, warnings), `brio_scene_list`.
- The token budget test of section 7.

Accept: an agent client can answer "which options does `BrioMaterial` accept" from the installed version; the `read` catalog stays under its budget.

### M-04 Headless runtime `[ ]`

P1, M. Depends on M-02.

- `brio_game_run` (mode `headless`) loads the project's factory entry, returns a `gameId`; `brio_game_step`, `brio_game_stats`, `brio_scene_inspect`, `brio_entity_inspect`, `brio_checkpoint_create`, `brio_checkpoint_restore`, `brio_checkpoint_diff`, `brio_game_stop`.
- The game registry lives at module level; games are stopped when the process ends and after an idle time.
- A project that cannot run headless gets a structured error with the first failing call and the suggestion to use browser mode.

Accept: a recorded sequence of tool calls against the scaffold project produces identical snapshots on two runs.

### M-05 Authoring tools `[ ]`

P1, L. Depends on M-03, C-06. Decision DL-10.

- `brio_project_create` from `templates/` (2D, 3D, hybrid), including an agent instructions file and the factory entry.
- `brio_scene_read`, `brio_scene_create`, `brio_scene_patch` (JSON Patch validated against the scene schema before writing), `brio_scene_delete` (confirmation through an `input_required` result), `brio_entity_add`, `brio_entity_update`, `brio_entity_remove`, `brio_prefab_create`.
- `brio_asset_import` with validation, `brio_project_build`, `brio_project_test` (failures as structured content).
- The filesystem guard of section 8, with tests for traversal and symbolic links.

Accept: an agent builds the star-catcher example from an empty folder using only tools; an invalid patch changes nothing on disk.

### M-06 Browser bridge `[ ]`

P1, L. Depends on M-02, X-01, X-05.

- `bridge/protocol.ts`: request, response and event messages with ids and deadlines; `hello` carries the protocol number and core version.
- `bridge/host.ts`: static server for the project with script injection, loopback bind, origin and token checks.
- `bridge/client.ts`: installs the hook, connects, serves introspection, capture, input, console and stats.
- Tools: `brio_game_run` (mode `browser`), `brio_game_screenshot`, `brio_game_console`, `brio_input_send`, and the checkpoint tools over the bridge. Resources for console and stats, with polling tools beside them.
- Reconnection after a page reload keeps the `gameId` when the token matches.

Accept: a browser test opens the fixture project through the host, takes a screenshot through a tool call, sends input and observes the changed state; a connection with a wrong token or origin is refused.

### M-07 Playtests, visual snapshots, unattended runs `[ ]`

P2, M. Depends on M-06.

- `brio_playtest_record` and `brio_playtest_replay` over X-05 recordings, with assertions on introspection values; `brio_visual_snapshot` with a tolerance.
- Unattended browser mode with the optional automation dependency; long runs as tasks.
- Output files are ordinary test fixtures the project can run in its own CI without the MCP server.

Accept: a recorded playtest fails when a gameplay constant changes and passes when restored.

### M-08 Inline player `[ ]`

P3, M. Depends on M-06. **First step: verify the status of the MCP Apps extension and which clients render it** (section 2). If it is not available, record that here and stop.

- A `ui://brio/player` resource that shows the running game, stats and an object inspector inside the agent client, with the declared content security policy.

Accept: decided after the verification.

### M-09 Ecosystem `[ ]`

P2, M. Depends on M-05.

- The `brio-game-dev` skill: lifecycle, naming from `GLOSSARY.md`, the engine and developer split of the lifecycle study (which things are recipes), how to test with replays, and the rule that tool results are data.
- `create-brio-game`, sharing `templates/` with `brio_project_create`.
- `llms.txt` generated from `dist/meta/api.json` for agents without MCP.
- Registry listing and configuration snippets for the common clients.
- An evaluation suite: agents build a set of small reference games, original designs, scored by tests, replays, frame budgets and visual snapshots. Its results guide the tool catalog.

Accept: the evaluation runs in CI on a schedule and stores its scores.

## 10. Order and dependencies

```text
M-01  ->  M-02  ->  M-03  ->  M-04
                      |          \
                      v           v
         C-06  ->  M-05        X-01, X-05  ->  M-06  ->  M-07  ->  M-08
                      |
                      v
                    M-09
```

M-01 and M-02 can start now; they need nothing from the render tracks. The first useful release is M-01 to M-04 (documentation, inspection and headless stepping). The first release that lets an agent see the game is M-06.

## 11. Open questions

- The WebSocket server: a small dependency, or a transport with no dependency (commands over a server-sent event stream, replies over `fetch`)? Decide in M-06 after a size and license check.
- Whether `dist/meta/api.json` should ship in core or in a third data-only package. Shipping it in core guarantees the versions match, at the cost of install size; measure it in M-02.
- Behavior scripting for agents (modules per object against a declarative event system), left open by the earlier study, stays open; scene documents (C-06) do not decide it.

## 12. Sources

Read on 2026-11-15:

- [MCP specification changelog, 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/changelog) and the [draft changelog](https://modelcontextprotocol.io/specification/draft/changelog).
- [TypeScript SDK v2](https://ts.sdk.modelcontextprotocol.io/v2/), its [migration page for 2026-07-28](https://ts.sdk.modelcontextprotocol.io/v2/migration/support-2026-07-28) (partly read), and the [registry entry of `@modelcontextprotocol/server`](https://registry.npmjs.org/@modelcontextprotocol/server/latest).
- Engine documents: [`MCP_GAME_AUTHORING.md`](../architecture/MCP_GAME_AUTHORING.md) and the sources it lists, [ADR 0006](../adr/0006-mcp-agentic-game-authoring.md), [ADR 0001](../adr/0001-zero-dependency-multi-backend-renderer.md), `TODO.md` section 10.
