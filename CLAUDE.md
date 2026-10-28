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

## Keystone

This project uses Keystone for architectural context. Before planning or changing code, read `.keystone/protocol.md` and follow it.
