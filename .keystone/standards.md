# Engineering Standards

## 1. Version Control

### Branches

- `main` holds released code; `develop` integrates finished work; work happens on `feat/*`, `fix/*`, `chore/*`
  branches merged into `develop` through pull requests, and `develop` is merged into `main` for releases.
- `tcc` is reserved for academic artifacts; `refactor` is the historical rewrite branch.

### Commit Messages

- **Format**: `<type>(<scope>): <short summary>`, scope optional, summary in English, imperative mood, no emojis
  (e.g. `feat(math): add seeded deterministic BrioRandom (xoshiro128**)`).
- **Language**: commits, pull requests and every new text in the repository (code, comments, docs, stones) are
  written in English. History up to 2026-10-28 and `TODO.md` are in Portuguese and are translated only when touched.
- **Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.
- **Scope**: the affected module, matching a stone id when one exists (`core`, `math`, `cameras`, `release`,
  `examples`, ...).
- Commits are atomic: one logical change each.
- No AI authorship: no `Co-Authored-By` trailers or "Generated with" lines in commits, PRs, issues or releases
  (see `CLAUDE.md` and `.claude/settings.json`).

### Pull Requests

- A concise summary of the change and its motivation.
- A link to the issue or ticket when one exists.
- Impact analysis: affected stones (`keystone stone show <id>` lists the impact set) and public API changes, which
  also go into `CHANGELOG.md`.
- Test evidence: `npm run check` (typecheck, Vitest, build) passes locally before every push; CI repeats it on
  Node 22 and 24.

## 2. Code Conventions

- **Naming**: public classes are prefixed `Brio` and use PascalCase; methods and properties use camelCase; asset and
  object identifiers follow `spr_`, `obj_`, `mesh_`, `mat_` style prefixes in examples. Canonical names come from
  `GLOSSARY.md` (`trigger`, never `sensor`; `BrioAtlas`, never `BrioSpriteAtlas`; `BrioConsole`, never `BrioLogger`).
- **Formatting**: Prettier (`.prettierrc`: 4 spaces, width 100, semicolons).
- **Types**: strict TypeScript; template literal types, discriminated unions and generics where they improve
  autocompletion.
- **Performance**: zero allocation in the game loop; dense arrays and module-level comparators in hot paths.
- **Paths**: relative references (`./`, `../`) in code and docs, never machine-local absolute paths.
- No emojis in code or documentation.

## 3. Testing

- Vitest + jsdom; `tests/` mirrors `src/` by module.
- Logic-dense code (ECS, math, serialization, loaders, collision) has unit tests; regressions get a test that
  reproduces them (e.g. mesh winding for every primitive).
- Browser behavior is checked with the `examples/` projects (WebGL2 and `?backend=canvas2d`); `game.pause()` plus
  `game.step(1/60)` makes automated browser checks deterministic.
- The package content is validated with `npm pack --dry-run` in CI.

## 4. Documentation

- Every public class, method, function, interface, type and property has TSDoc (`@param`, `@returns`, `@default`,
  `@example`), so editors and agents see usage inline.
- Comments explain *why*, not *how*.
- Architecture decisions go to `docs/adr/`; module invariants live in stones; user-facing changes go to
  `CHANGELOG.md`; known issues and plans to `docs/ROADMAP.md`.
