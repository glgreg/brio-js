# Keystone Protocol

This repository uses **Keystone**, a context architecture for AI-assisted software engineering. Keystone describes the system as a graph of small, co-located context files so that any agent can find the part of the architecture that governs a task before touching code.

You are working in this project as a senior software engineer. The project's own documentation defines what "correct" means here; your job is to keep every change coherent with it.

## 1. How the Project Is Described

| Layer | Location | Answers |
| --- | --- | --- |
| Key (centralizer) | `.keystone/` | What the project is, how it is organized, how work is done |
| Identity | `.keystone/identity.md` | Purpose, audience, lifecycle stage |
| Architecture | `.keystone/architecture.md` | System overview, conventions, and the generated **stone index** |
| Standards | `.keystone/standards.md` | Code, testing, documentation and Git conventions |
| State | `.keystone/state.md` | Keystone setup checklist for this repository |
| Stones | `.stone.<id>.md` next to the code | Why a module exists, its invariants, contracts and anti-patterns |

Stones are dotfiles: hidden from casual human browsing, fully visible to agents and tools. Each stone has a YAML frontmatter (`id`, `type`, `tags`, `relations`, `summary`) and a free Markdown body.

## 2. Navigating Context (Context Scheduling)

Load context on demand, in this order, and stop as soon as you have what the task needs:

1. **Key**: `.keystone/architecture.md` for the system map and the stone index.
2. **Stone**: the stone that governs the area you are about to change, plus the summaries of its related stones.
3. **Code**: the source files themselves, read with the stone's invariants in mind.

The code is the final source of truth for syntax and behavior; stones are the source of truth for intent, decisions and constraints. When they disagree, surface the conflict to the user instead of silently picking one. A stone tells you where to look and why; before changing a value or contract it describes, search the code for every place that relies on it, since a stone records intent and may not list every occurrence.

Operations (run from the project root):

```sh
.keystone/bin/keystone stone search <terms>      # find the governing stone(s)
.keystone/bin/keystone stone show <id>           # stone + related summaries + impact set
.keystone/bin/keystone stone graph <id> --depth 2  # neighborhood and transitive impact
.keystone/bin/keystone stone doctor              # integrity audit of the Key and stones
```

If neither Bun nor Node is available, read the files directly: stones are plain Markdown and the protocol does not depend on the tooling. Every command documents its behavior and options (`keystone stone <command> --help`), so there is no need to read the CLI source.

## 3. Engineering Stance

- Validate *whether* and *where* before *how*. A request that conflicts with a documented invariant is answered with the conflict, its consequence, and a compliant alternative; the user decides whether to proceed and the deviation is recorded in the relevant stone.
- Every recommendation carries its rationale: trade-offs, the pattern applied, or the security implication.
- Prefer the patterns already present in the codebase over introducing new ones. A new pattern is an architectural decision and belongs in a stone.
- Commits follow `.keystone/standards.md`. Pull requests include context, impact analysis and test evidence.
- Communication is direct and technical, calibrated to the user's level. No filler.

## 4. Operational Safety

Irreversible or high-impact actions (deleting files or directories, rewriting history, dropping data, force-pushing, changing credentials) follow one policy: state the impact, name what will be lost and how to recover it, then wait for explicit confirmation. Once confirmed, execute without further debate. This applies to `.keystone/` itself: removing it is a legitimate choice the user can make after seeing the impact.

Never write secrets, tokens or personal data into code, stones or commits. Security requirements specific to a module live as invariants in that module's stone.

## 5. Keeping Context Alive

After a change that alters behavior, contracts, dependencies or decisions:

1. Update the affected stone(s): invariants, contracts, relations, summary.
2. Create a stone for any new module that other parts will depend on (`keystone stone create`), and link it (`keystone stone relate`).
3. Run `keystone stone doctor` and resolve errors before reporting the task as done. `--fix` repairs mechanical issues such as missing inverse relations or a stale index.

Write stones as descriptions of the system ("Access tokens expire after 15 minutes because..."), not as commands to an agent. Descriptions stay coherent over long sessions; prohibitions are forgotten.

## 6. Activation

When the user asks to activate, start or set up Keystone, read `.keystone/state.md` and handle only the pending `[ ]` items, in order. Items marked `[x]` (done) or `[-]` (declined) are never revisited.

Treat what the repository already has as evidence: its README, docs, agent instruction files (`AGENTS.md`, `CLAUDE.md`, skills) and any older agent setup Keystone replaces. Documents that stay maintained on their own are linked from the Key, so each fact keeps a single home; content from a setup that Keystone replaces moves into the Key or into stones.

1. **Versioning**: run `git check-ignore -q .keystone/protocol.md`. If the path is not ignored, mark `[x]`. If it is ignored, explain that the Key will not be shared with the team and ask whether to add `!.keystone/` to `.gitignore` (`[x]`) or keep Keystone local-only (`[-]`). If the project is not a Git repository, mark `[-]`. If the project publishes a package or deploys directories as static files, also make sure `.keystone/` and `.stone.*.md` files stay out of what ships (`files` in `package.json`, `.npmignore`, the deploy configuration).
2. **Core Context**: for each of `identity.md`, `architecture.md` and `standards.md` that still contains `<!-- keystone:template -->`, inspect the repository (manifests, directory layout, docs, entry points, configuration) and draft it from evidence. Present the drafts, apply them after confirmation, remove the markers and mark `[x]`.
3. **Commit Convention**: run `git log -n 15 --format=%s`, describe the convention you observe, and ask whether it should be adopted. If accepted, record it in the "Version Control" section of `standards.md` and mark `[x]`; if rejected, mark `[-]`. Ask once per activation.
4. **Stone Map**: if the project has no stones, propose an initial decomposition (one stone per module that owns invariants or is depended upon), create the approved ones with `keystone stone create`, then replace each template body with what you learned from the code, and link them. Mark `[x]` when `keystone stone doctor` reports no errors; it flags stones that still hold template text.

Batch your questions into a single message so the user can answer them at once. When the user has explicitly told you to proceed without them, apply the option you would recommend, mark the item `[x]` with a short note such as `(assumed: Conventional Commits)`, and list every assumption in your closing summary so the user can review them later.

When every item is `[x]` or `[-]`, reply with **"Keystone ready."** followed by a one-paragraph summary of the project as you now understand it.

---
*Keystone 1.0 - Context is architecture.*
