# Contributing to BrioJS

Thank you for helping improve BrioJS. This guide covers the setup, the checks every change must pass and the
conventions the codebase follows. The detailed engineering conventions live in
[`.keystone/standards.md`](./.keystone/standards.md).

## Setup

```sh
git clone https://github.com/glgreg/brio-js.git
cd brio-js
npm install
```

The published package supports Node 18 and later, but the development toolchain (Vitest and jsdom) needs
**Node 22 or later**. CI runs on Node 22 and 24.

## Checks

Run the full check before every push:

```sh
npm run check      # type check, Vitest, build (the same steps as CI)
npm run test:watch # Vitest in watch mode while you work
```

Browser behavior is covered by end-to-end tests with Playwright:

```sh
npm run test:e2e         # builds the package, serves the repository and runs the examples in Chromium
npm run test:e2e:update  # updates the golden screenshots after an intended visual change
```

Run the end-to-end tests whenever a change affects rendering, input or the examples, and commit updated golden
screenshots together with the change that explains them.

## Branches and Pull Requests

- `main` holds released code; `develop` integrates finished work.
- Work on a feature branch (`feat/*`, `fix/*`, `chore/*`) created from `develop` and open the pull request against
  `develop`. `develop` is merged into `main` for releases.
- A pull request describes the context, the impact analysis (affected stones and public API changes) and the test
  evidence. The pull request template lists the items.

## Commit Messages

```text
<type>(<scope>): <short summary>
```

- English, imperative mood, no emojis, e.g. `feat(math): add seeded deterministic BrioRandom (xoshiro128**)`.
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.
- The scope is optional and names the affected module, matching a stone id when one exists (`core`, `math`,
  `cameras`, `rendering`, `examples`, ...).
- One logical change per commit.

## Engineering Rules

- **Zero runtime dependencies.** `package.json` has no `dependencies`; rendering, math, physics, audio and
  serialization are implemented in the engine ([ADR 0001](./docs/adr/0001-zero-dependency-multi-backend-renderer.md)).
  Development dependencies are fine when they are justified.
- **No allocations in the game loop.** Code that runs every frame reuses arrays, vectors and scratch objects instead
  of creating closures, object literals or temporary arrays; hot paths use dense arrays and module-level comparators.
- **Ubiquitous language.** [`GLOSSARY.md`](./GLOSSARY.md) defines the canonical names for the domain (`BrioAtlas`,
  `trigger`, `BrioConsole`, ...). Use them in code, docs and discussions, and never add semantic aliases for the
  terms it lists under _Avoid_.
- **TSDoc on every public symbol.** Every exported class, method, function, interface, type and property has TSDoc
  with `@param`, `@returns`, `@default` and `@example` where they apply. Comments explain _why_, not _how_.
- **Formatting.** Prettier with the repository configuration (`.prettierrc`: 4 spaces, width 100, semicolons).
- **Tests.** Logic-dense code (ECS, math, serialization, loaders, collision) has unit tests in `tests/`, mirroring
  `src/` by module. A bug fix comes with a test that reproduces the bug.

## Changelog

Every user-visible change (new API, behavior change, bug fix, deprecation) gets an entry under `## [Unreleased]` in
[`CHANGELOG.md`](./CHANGELOG.md), in the matching `Added`, `Changed`, `Fixed` or `Removed` section. Internal
refactors and test-only changes do not need one.

## Architecture Context (Keystone)

The architecture is described by Keystone ([`.keystone/protocol.md`](./.keystone/protocol.md)):

- `.keystone/architecture.md` is the system map and the index of stones.
- A stone is a `.stone.<id>.md` file next to the code it governs (for example `src/ecs/.stone.ecs.md`). It records
  why the module exists, its invariants, contracts and anti-patterns.
- Read the stone of a module before changing it. When a change alters behavior, contracts, dependencies or decisions,
  update the affected stone in the same pull request.
- Architecture decisions go to [`docs/adr/`](./docs/adr/); planned work lives in [`docs/ROADMAP.md`](./docs/ROADMAP.md)
  and the detailed checklist in [`TODO.md`](./TODO.md).

Useful commands (run from the repository root):

```sh
node .keystone/bin/keystone.js stone search <terms>  # find the stone that governs an area
node .keystone/bin/keystone.js stone show <id>       # a stone, its relations and impact set
node .keystone/bin/keystone.js stone doctor          # integrity audit; resolve errors before opening a PR
```

## Reporting Issues

Use the issue templates on GitHub. A bug report needs the BrioJS version, the browser and operating system, the
render backend (`game.renderBackend`), the preset (`2d`, `3d` or hybrid) and a minimal reproduction.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](./LICENSE.txt).
