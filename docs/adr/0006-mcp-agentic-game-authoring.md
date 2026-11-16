# MCP Server and Runtime Bridge for Agentic Game Authoring

Status: **Proposed** (2026-10-20)

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
