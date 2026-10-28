# BrioJS: instructions for AI coding agents

## Authorship (mandatory)

- Never add Claude (or any AI) as author, co-author, or collaborator: no `Co-Authored-By: Claude ...` trailer in
  commits, no "Generated with Claude Code" line or session link in PR descriptions, issues, comments, or releases.
- Commits and pushes use the maintainer's local git identity; GitHub operations use the maintainer's own `gh` login.
- `.claude/settings.json` disables attribution (`attribution.commit = ""`, `attribution.pr = ""`,
  `attribution.sessionUrl = false`); keep it that way.

## Conventions

- Commit messages: `<type>(<scope>): summary` in Portuguese, without emojis.
- Before pushing: `npm run check` (type check, Vitest, build).
- Agent memory and session handoff live in `brio-agent/` (start at `brio-agent/SOUL.md`).
