# BrioJS MCP: Agentic Game Authoring (Study and Proposed Design)

Status: **Study / Proposed** (2026-10-20). Nothing in this document is implemented yet. The tracked work items are in [TODO.md section 10](../../TODO.md). The decision record is [ADR-0006](../adr/0006-mcp-agentic-game-authoring.md).

## 1. Goal

Make BrioJS the engine an AI agent can use end-to-end to **create, run, inspect, test, and iterate on games**. The agent can be Claude Code, Claude Desktop, Codex, Cursor, VS Code / Copilot, Gemini CLI, or any other MCP-capable platform. The agent must be able to:

1. Scaffold a project and its scenes from a prompt.
2. Add and edit content: objects, sprites, models, layers, cameras, input, audio, physics.
3. Run the game, observe it (screenshots, console, ECS state, frame stats), and drive it (inputs, time control, checkpoints).
4. Validate the result with deterministic checks (unit tests, visual snapshots, replayed input).
5. Do all of this without hand-written glue for every engine feature.

BrioJS has structural advantages that most engines adding MCP retrofit later:

- **Binary ECS snapshots** (ADR-0005) give cheap, exact state capture and restore for agent experiments. The agent can try a change, measure it, and roll back.
- **Strict Ubiquitous Language** (ADR-0004, `GLOSSARY.md`) maps directly to tool names and schemas.
- **ACO-grade JSDoc** across the public API can be turned into MCP resources and tool descriptions automatically.
- **Headless-capable core** (`PlatformAdapter` `"headless"`) allows simulation without a browser, for fast CI-style tool calls.

## 2. State of the Art (October 2026)

### 2.1. MCP protocol: revision 2026-07-28

The current specification is [2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/changelog), the largest revision since launch. Changes that shape the BrioJS design:

| Change                                                                                                                                        | Consequence for BrioJS                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stateless protocol**: no `initialize` handshake. Version and capabilities travel in each request's `_meta`. `server/discover` is mandatory. | Tools must not rely on connection state. A running game is addressed by an explicit, server-minted **handle** (`sessionId` / `gameId`) passed as an ordinary tool argument (SEP-2567). |
| **No protocol sessions** on Streamable HTTP (`Mcp-Session-Id` removed); new `Mcp-Method` / `Mcp-Name` headers.                                | One server process can serve several agents and several running games. Routing uses handles.                                                                                           |
| **`subscriptions/listen`** replaces GET streams and `resources/subscribe`.                                                                    | Live data (console lines, frame stats, entity changes) is exposed as subscribable resources (`brio://game/{id}/console`).                                                              |
| **Tasks moved to an extension** (`io.modelcontextprotocol/tasks`), polled with `tasks/get` and fed with `tasks/update`.                       | Long operations (asset import, builds, playtest runs, visual regression suites) return task handles instead of blocking a tool call.                                                   |
| **Multi Round-Trip Requests (MRTR)**: elicitation and similar requests are returned as `input_required` results and answered on retry.        | Destructive or ambiguous operations (delete scene, overwrite asset) ask for confirmation through MRTR elicitation.                                                                     |
| **Roots, Sampling, and Logging deprecated.**                                                                                                  | The project directory is passed as a tool argument or server configuration, not through Roots. Logs go to stderr or OpenTelemetry. The server never calls back into the LLM.           |
| **Full JSON Schema 2020-12** for `inputSchema` / `outputSchema`; `structuredContent` can be any JSON.                                         | Tool schemas can be generated from the TypeScript types (`BrioGameConfig`, `BrioMaterialOptions`, ...) without flattening.                                                             |
| **Deterministic `tools/list` order**, with `ttlMs` / `cacheScope` on list results.                                                            | Keep the tool catalog stable and sorted, which improves client caching and LLM prompt-cache hits.                                                                                      |

**SDK:** the official TypeScript SDK v2 (`@modelcontextprotocol/server`, `@modelcontextprotocol/client`) supports 2026-07-28. Serving it requires an explicit opt-in, and v2 was still flagged beta in parts of the docs. Before implementing, verify the current `latest` npm dist-tag ([SDK docs](https://ts.sdk.modelcontextprotocol.io/v2/), [migration guide](https://ts.sdk.modelcontextprotocol.io/v2/migration/support-2026-07-28)).

### 2.2. MCP Apps (`io.modelcontextprotocol/ui`)

[SEP-1865](https://modelcontextprotocol.io/seps/1865-mcp-apps-interactive-user-interfaces-for-mcp) lets a server ship interactive HTML UIs (`ui://` resources, `text/html;profile=mcp-app`). Hosts render them in a mandatory sandboxed iframe, and they talk to the host over MCP JSON-RPC. External origins must be declared in `_meta.ui.csp.resourceDomains`.

For BrioJS this is the **most valuable extension**. A tool such as `brio_game_run` can return a `ui://brio/player` resource that renders the running game **inline inside the agent's chat**, with a live canvas, FPS, and an entity inspector. The user and the agent then look at the same running game.

### 2.3. Game engine MCP servers in the wild

| Project                                                                           | Architecture                                                                                                                                                                                                                             | Lessons                                                                                                                            |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Unity MCP (CoplayDev, IvanMurzak)                                                 | Editor plugin plus external MCP server. IvanMurzak's version exposes 100+ tools through reflection and supports runtime agents inside built games.                                                                                       | Reflection-generated tools scale coverage, but large catalogs cost context.                                                        |
| [GameDev-MCP-Server](https://github.com/IvanMurzak/GameDev-MCP-Server)            | Engine-agnostic MCP host (stdio or Streamable HTTP) bridged over SignalR to Unity, Godot, and Unreal plugins. Tools are supplied dynamically by the connected plugin. Loopback bind, origin validation, deterministic per-project ports. | Split **protocol host** from **engine bridge**. Never re-send a timed-out tool call, because the engine may still be executing it. |
| Godot MCP (Coding-Solo, GoPeak, Godot MCP Pro)                                    | Ranges from 14 tools (run project, read debug output) to 80-190 tools (LSP, debugger, screenshots).                                                                                                                                      | Run, observe, and debug is the minimum useful loop. Screenshots are essential.                                                     |
| Blender MCP                                                                       | Addon socket server plus MCP server. Produces assets (glTF) that game engines import.                                                                                                                                                    | Asset creation can stay in a separate server. BrioJS should consume glTF from it, not duplicate it.                                |
| [threejs-devtools-mcp](https://lobehub.com/mcp/dmitriygolub-threejs-devtools-mcp) | Injects a bridge script into the page, hooks `__THREE_DEVTOOLS__`, and talks over WebSocket. Tools for scene inspection, screenshots, and console logs. Headless mode for CI.                                                            | The closest analogue to BrioJS (web runtime). Tools die when the tab closes, so a headless fallback is needed.                     |

Common best practices ([guide](https://www.strayspark.studio/blog/mcp-server-game-development-complete-guide-2026)):

- **Curated tool profiles.** A small default set (read-only first), with role-based profiles in version control. One guide measured about 3K tokens for a catalog mode versus about 60K for a full tool set.
- **Visual feedback.** Agents cannot see the viewport, so tools must return screenshots as image content.
- **Long operations go async**, and timeouts must be explicit.
- **Safety.** Mark destructive tools (`destructiveHint`), keep them out of auto-approve, and work on a git branch per agent session. Treat arbitrary code execution tools like SSH access.
- **Agents are weak at design and art direction.** Tools should make mechanical work cheap and leave creative judgment to the user.

### 2.4. Complementary agent standards

- **Agent Skills (`SKILL.md`)**: an open standard ([agentskills.io](https://agentskills.io), December 2025), adopted by about 40 clients (Claude Code, Codex, Cursor, Gemini CLI, Copilot, VS Code, ...). A skill teaches workflows and conventions, while MCP gives capabilities. BrioJS should ship a **`brio-game-dev` skill** alongside the MCP server, covering how to structure a BrioJS game, the lifecycle (`preload -> load -> update`), and the naming conventions from `GLOSSARY.md`.
- **`AGENTS.md` / `llms.txt`**: a static agent entry point in generated projects, and an `llms.txt` index of the TypeDoc output for agents without MCP.

## 3. Proposed Architecture

```
 Agent platform (Claude Code, Codex, Cursor, ...)
        |  MCP 2026-07-28 (stdio | Streamable HTTP)
        v
 @brio-js/mcp  (Node process: protocol host)
   |-- Project tools (filesystem, scaffold, assets, build, tests)  <- no game needed
   |-- Headless runtime (BrioGame on PlatformAdapter "headless")    <- fast simulation and snapshots
   |-- Bridge server (WebSocket, loopback only, per-game token)
        |
        v
 Browser / Electron runtime: page running BrioGame + @brio-js/devtools bridge
   (screenshots, console, ECS inspection, input injection, time control)
```

### 3.1. Packages

| Package               | Responsibility                                                                                                                                                                                                                                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@brio-js/mcp`        | MCP server: tool and resource catalog, project operations, headless runtime, bridge server, MCP Apps UI resources.                                                                                                                                                                                             |
| `@brio-js/devtools`   | Small runtime bridge (tree-shaken out of production builds), activated by `BrioGame({ devtools: true })` or by a `?brio-devtools=<token>` URL. It connects to the bridge over WebSocket and exposes inspection and control hooks. Similar to `__THREE_DEVTOOLS__`, but scoped to the BrioJS ECS and lifecycle. |
| `brio-game-dev` skill | `SKILL.md` with workflows: new game, add a scene, import a glTF, add a HUD, write tests, run visual regression.                                                                                                                                                                                                |
| `create-brio-game`    | Project scaffolder, also used by `brio_project_create`. It writes `AGENTS.md`, `.mcp.json`, and a test setup.                                                                                                                                                                                                  |

### 3.2. Engine-side prerequisites

These are engine features the MCP depends on, tracked separately in TODO section 10.1:

1. **Declarative scene format**: a JSON scene and prefab schema (`BrioSceneDocument`) that can be loaded, saved, and diffed. Agents edit data far more reliably than imperative code. The schema comes from the same TypeScript types as the public API.
2. **Stable entity addressing**: names plus generational handles (already in the ECS), exposed as `brio://game/{id}/entity/{name}`.
3. **Deterministic stepping**: `game.step(dt)` with a fixed timestep and a seeded RNG (`BrioRandom`), so replayed inputs produce identical snapshots. This is needed for reliable agent tests.
4. **Introspection API**: list components and values per entity, list registered assets, layers, cameras, and scenes, and read frame stats (`renderStats`, backend, draw calls).
5. **Input injection**: synthetic keyboard, mouse, touch, and gamepad events routed through `BrioKeyboard` and the other input classes, not through DOM events, for headless parity.
6. **Offscreen capture**: `game.captureFrame(): Promise<Blob>` on every backend (Canvas2D `convertToBlob`, WebGL2 read-back, WebGPU texture copy).
7. **Hot reload of scene documents and assets** without losing ECS state, where possible.

### 3.3. Tool catalog (draft)

Names follow `brio_<domain>_<verb>`. They are sorted deterministically and grouped into **profiles**: `read` (default), `author`, `play`, `full`. Every tool declares `readOnlyHint` / `destructiveHint` / `idempotentHint` annotations and an `outputSchema`.

| Domain             | Tools                                                                                                                                                                                              | Profile       |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Project            | `brio_project_create`, `brio_project_info`, `brio_project_build`, `brio_project_test` (Vitest, returns failures as structured content)                                                             | author / read |
| Scene documents    | `brio_scene_list`, `brio_scene_read`, `brio_scene_create`, `brio_scene_patch` (JSON Patch on a `BrioSceneDocument`, validated against the schema), `brio_scene_delete` (MRTR confirmation)         | read / author |
| Entities           | `brio_entity_add`, `brio_entity_update`, `brio_entity_remove`, `brio_prefab_create`                                                                                                                | author        |
| Assets             | `brio_asset_list`, `brio_asset_import` (glTF, PNG, audio; validates and reports the triangle count, textures, and warnings from `BrioModel.warnings`), `brio_asset_inspect`                        | author / read |
| Runtime: lifecycle | `brio_game_run` (headless or browser; returns a `gameId` and a `ui://brio/player` MCP App), `brio_game_stop`, `brio_game_pause`, `brio_game_step` (N fixed steps)                                  | play          |
| Runtime: observe   | `brio_game_screenshot` (image content, optional camera or viewport), `brio_game_console` (filtered lines), `brio_game_stats` (fps, frame ms, backend, draw calls, entities), `brio_entity_inspect` | read          |
| Runtime: drive     | `brio_input_send` (key, mouse, touch, or gamepad sequences with timing), `brio_game_eval` (opt-in only, `full` profile, treated as code execution)                                                 | play / full   |
| State              | `brio_checkpoint_create`, `brio_checkpoint_restore`, `brio_checkpoint_diff` (entity-level diff of two binary snapshots)                                                                            | play          |
| Testing            | `brio_playtest_record`, `brio_playtest_replay` (deterministic input replay plus assertions), `brio_visual_snapshot` (golden image comparison with a tolerance; long runs use the tasks extension)  | play          |
| Docs               | Resources rather than tools: `brio://docs/glossary`, `brio://docs/api/{symbol}` (from TypeDoc JSON), `brio://docs/adr/{n}`, `brio://schema/scene`                                                  | read          |

**Resources** (subscribable through `subscriptions/listen`): `brio://game/{id}/console`, `brio://game/{id}/stats`, `brio://game/{id}/entities`, `brio://project/scenes`.

**Prompts**: `new-game` (genre, 2D/3D, controls), `add-mechanic`, `debug-performance`, `port-from-spritesheet`.

### 3.4. Security model

- Loopback-only bind by default. Streamable HTTP validates the `Origin` header. The browser bridge uses a per-game random token, as the reference servers do.
- No arbitrary code execution by default. `brio_game_eval` exists only in the `full` profile and is annotated as destructive.
- Filesystem tools are restricted to the project directory passed in configuration (Roots is deprecated). Paths are normalized to block traversal.
- Destructive operations use MRTR confirmation, and the project is git-aware: warn when the working tree is dirty and suggest a branch per agent session.
- Asset import validates sizes and formats. glTF parsing has resource limits (buffer sizes, image dimensions) against hostile files.
- Observability goes through OpenTelemetry trace context in `_meta`, not MCP Logging (deprecated).

### 3.5. Agent workflow example

1. `brio_project_create { name, dimension: "3d" }`, which scaffolds the files plus `AGENTS.md` and `.mcp.json`.
2. `brio_asset_import { path: "hero.glb" }`, which reports 3 meshes, 3 textures, and doubleSided materials.
3. `brio_scene_patch` adds a camera, a light, and a hero entity.
4. `brio_game_run { mode: "browser" }` returns a `gameId`, and the MCP App renders the game in the chat.
5. `brio_game_screenshot` lets the agent check the result visually. `brio_game_stats` reports 60 fps on webgl2.
6. `brio_input_send` (walk right for 2 s) followed by `brio_entity_inspect hero` checks that the position changed.
7. `brio_playtest_record` saves this as a regression test, and `brio_project_test` passes in CI.

## 4. Phased Plan

1. **Phase 0, engine prerequisites**: scene document schema, deterministic `step`, introspection, input injection, and frame capture (section 3.2).
2. **Phase 1, read-only MCP (stdio)**: docs resources, project info, headless `run`/`step`/`stats`/`inspect`, and screenshots from the headless Canvas2D backend.
3. **Phase 2, authoring**: scene and entity patch tools, asset import, project build and test, profiles, MRTR confirmations.
4. **Phase 3, live runtime**: the `@brio-js/devtools` bridge, browser `run`, input injection, console and stats subscriptions, checkpoints and diffs.
5. **Phase 4, MCP Apps and tasks**: the inline `ui://brio/player`, visual regression and playtest suites as tasks, and Streamable HTTP deployment.
6. **Phase 5, ecosystem**: the `brio-game-dev` skill, `create-brio-game`, listing in MCP registries, and an evaluation suite (agent builds N reference games and is scored on tests passing).

## 5. Open Questions

- Should scene documents become the primary authoring format, with code only for behaviour scripts, or stay optional?
- Behaviour scripting for agents: TypeScript modules per entity (`behaviours/*.ts`) versus a constrained declarative event system (closer to the Scratch/GDevelop audience in the project philosophy).
- Headless rendering fidelity: is a headless Canvas2D screenshot enough, or should Phase 1 already drive a headless Chromium for WebGL2/WebGPU screenshots?
- Distribution: a single `@brio-js/mcp` npm package launched with `npx`, versus a standalone binary.

## Sources

- [MCP 2026-07-28 changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog) and [release post](https://blog.modelcontextprotocol.io/posts/2026-07-28/)
- [SEP-1865 MCP Apps](https://modelcontextprotocol.io/seps/1865-mcp-apps-interactive-user-interfaces-for-mcp)
- [MCP TypeScript SDK v2](https://ts.sdk.modelcontextprotocol.io/v2/)
- [GameDev-MCP-Server](https://github.com/IvanMurzak/GameDev-MCP-Server)
- [Game engine MCP servers overview](https://dev.to/grove_chatforest/game-engine-3d-development-mcp-servers-unity-unreal-godot-roblox-phaser-and-more-4kk3)
- [MCP server for game development guide](https://www.strayspark.studio/blog/mcp-server-game-development-complete-guide-2026)
- [threejs-devtools-mcp](https://lobehub.com/mcp/dmitriygolub-threejs-devtools-mcp)
- [Agent Skills adoption](https://noqta.tn/en/news/skill-md-open-standard-30-ai-coding-tools-adoption-2026)
