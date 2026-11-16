# BrioJS: instructions for AI coding agents

## Authorship (mandatory)

- Never add Claude (or any AI) as author, co-author, or collaborator: no `Co-Authored-By: Claude ...` trailer in
  commits, no "Generated with Claude Code" line or session link in PR descriptions, issues, comments, or releases.
- Commits and pushes use the maintainer's local git identity; GitHub operations use the maintainer's own `gh` login.
- `.claude/settings.json` disables attribution (`attribution.commit = ""`, `attribution.pr = ""`,
  `attribution.sessionUrl = false`); keep it that way.

## Conventions

- Commit messages: `<type>(<scope>): summary` in English, without emojis. Pull requests and all new project text
  are written in English too.
- Before pushing: `npm run check` (type check, Vitest, build).

## Setup limitations

When the environment has a limitation or pending setup (a missing runtime, dependency, credential or permission), tell the user what is missing and what it blocks. Do not rewrite the project structure, scripts or tooling to work around it.

## Current focus

The TCC was presented on 2026-11-13 and its sprint is closed. Start every session at `docs/plans/GAME_LIFECYCLE_PLAN.md`, the current plan: it holds the order of work, the session rules and the work packages, and it overrides older plans. Its evidence and the maintainers' decisions (DL-01 to DL-10) are in `docs/architecture/GAME_LIFECYCLE_STUDY.md`. Do not start a package whose decision is still open there.

Work follows `branch -> develop -> main`. The `tcc` branch holds the academic artifacts and is frozen once `main` has been merged into it one last time: do not base work on it, and merge into it only when a maintainer asks.

## Keystone

This project uses Keystone for architectural context. Before planning or changing code, read `.keystone/protocol.md` and follow it.
