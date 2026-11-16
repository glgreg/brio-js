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

The TCC final presentation is on 2026-11-13. Start every session at `docs/plans/TCC_FINAL_SPRINT.md`, the current plan: it holds the context, calendar, order of work and environment notes, and it overrides older plans.

## Keystone

This project uses Keystone for architectural context. Before planning or changing code, read `.keystone/protocol.md` and follow it.
