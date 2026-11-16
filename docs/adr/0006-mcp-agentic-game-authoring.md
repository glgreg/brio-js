# MCP Server and Runtime Bridge for Agentic Game Authoring

Status: **Accepted** (2026-11-16, with the update below). Proposed on 2026-10-20.

BrioJS will ship a first-party Model Context Protocol server (`@brio-js/mcp`) targeting MCP revision 2026-07-28. It will be paired with a small runtime bridge (`@brio-js/devtools`) and an Agent Skill (`brio-game-dev`), so that agent platforms can create, run, observe, drive, and test BrioJS games. The full study is in [MCP_GAME_AUTHORING.md](../architecture/MCP_GAME_AUTHORING.md).

## Considered Options

- **No first-party integration (agents edit code and read docs)**: Zero cost, but agents cannot see or run the game. Iteration relies on the user describing what they see, which wastes the binary snapshots and introspection the engine already has.
- **Single in-page MCP server (browser only)**: Simple, but every capability dies with the tab. There is no project or filesystem tooling and no headless CI, and browsers cannot host stdio servers.
- **Node MCP host + headless runtime + WebSocket bridge to live games (chosen)**: Mirrors the split proven by Unity, Godot, and Unreal servers (protocol host separated from the engine bridge). Project tools and headless simulation work without a browser. Live games add screenshots, input injection, and inline MCP Apps.

## Consequences

- The engine must gain agent-facing prerequisites before the server is useful: a declarative scene document schema, deterministic fixed-step simulation with a seeded RNG, an introspection API, input injection independent of the DOM, and frame capture on every backend.
- The protocol is stateless (no handshake, no protocol sessions), so running games are addressed by explicit server-minted handles passed as tool arguments.
- Tool catalogs are curated and profile-based (`read`, `author`, `play`, `full`) to bound context usage. Destructive tools require confirmation through Multi Round-Trip Requests, and code-execution tools are opt-in only.
- Deprecated MCP features (Roots, Sampling, Logging) are not used. Long operations use the tasks extension, and the inline game view uses the MCP Apps extension.
- `@brio-js/devtools` must be tree-shaken out of production builds so the zero-dependency runtime footprint (ADR-0001) is preserved.

## Update (2026-11-16): one package, first-class, simple to install

Confirmed by the maintainer (decisions DL-06 and DL-07 of [`GAME_LIFECYCLE_STUDY.md`](../architecture/GAME_LIFECYCLE_STUDY.md)). The implementation plan is [`MCP_PACKAGE_PLAN.md`](../plans/MCP_PACKAGE_PLAN.md).

- **The MCP server is a first-class feature of BrioJS.** It lives outside `@brio-js/core` only to keep the engine package small. Installing it must stay simple: one package, one `init` command, no glue code in the game.
- **One package instead of two.** The browser bridge ships inside `@brio-js/mcp` as an entry point (`@brio-js/mcp/bridge`), replacing the separate `@brio-js/devtools` package named above. Core keeps a small hook that announces a game to the bridge when one is present, plus the agent surface the server calls (introspection, headless mode, input injection, frame capture). A production build of a game contains nothing of the MCP package.
- **The server uses the copy of core installed in the project**, declared as a peer dependency, so the documentation, types and schemas it serves match the version the game uses.
- **Zero runtime dependencies is a rule of `@brio-js/core`** (ADR 0001). `@brio-js/mcp` is a Node tool and has ordinary dependencies, starting with the MCP TypeScript SDK.
- **Layout**: the same repository, in `packages/mcp`, as a self-contained package folder with its own `package.json`, lockfile, CI job and release workflow, like `showcase/`. No npm workspaces at the root.
- Two statements above need a correction found by the later study: core cannot run in plain Node yet (a headless mode is planned engine work), and headless runs return state, not screenshots.
