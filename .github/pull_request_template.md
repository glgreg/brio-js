## Context

<!-- What does this change do, and why? Link the issue it resolves, if any (e.g. "Closes #12"). -->

## Impact analysis

<!--
- Affected stones (`node .keystone/bin/keystone.js stone show <id>` lists the impact set).
- Public API changes: added, changed or removed symbols, and whether any change is breaking.
- Performance: does the change touch the game loop or a hot path? Confirm it adds no per-frame allocations.
-->

## Test evidence

<!-- New or updated tests, browsers and backends checked by hand, screenshots for visual changes. -->

## Checklist

- [ ] `npm run check` passes locally (type check, Vitest, build)
- [ ] `npm run test:e2e` passes if rendering, input or the examples changed (golden screenshots updated with
      `npm run test:e2e:update` only for intended visual changes)
- [ ] `CHANGELOG.md` has an entry under `[Unreleased]` for user-visible changes
- [ ] Affected stones are updated and `node .keystone/bin/keystone.js stone doctor` reports no errors
- [ ] New public symbols have TSDoc and use the canonical names from `GLOSSARY.md`
