# Agent Guidelines

## Repo-Level Pattern

Use `AGENTS.md` for always-on rules that every coding agent should follow in this repository:

- local-only privacy constraints
- architecture boundaries
- required validation workflow
- PR publication without agent-driven merge
- workflow audit expectations
- documentation update expectations

Keep it short enough that an agent can apply it on every turn without loading unnecessary detail.

## Nested Agent Files

Use nested `AGENTS.md` files for local context where the rules differ by area:

- `apps/taxes/api/AGENTS.md`
- `apps/taxes/web/AGENTS.md`
- `apps/plan/api/AGENTS.md`
- `apps/plan/web/AGENTS.md`
- `packages/shared/AGENTS.md`
- `tools/AGENTS.md`

This follows the pattern described by `agents.md`: the nearest applicable file should add local guidance instead of bloating the root file.

## Project Skills

This repository defines eleven local skills:

- `implementation-workflow`
  - use for implementation, refactor, testing, and architecture changes
- `planning-workflow`
  - use for backlog creation, work decomposition, acceptance criteria capture, and audit-linked planning
- `ui-design-workflow`
  - use for frontend layout, forms, tables, charts, and MUI usage
- `visualization-workflow`
  - use for reusable diagrams, PR change visuals, workflow monitoring visuals, and renderer selection across apps
- `workflow-audit`
  - use for audited workflow start/end logging and deterministic guardrail execution
- `parallel-work-orchestrator`
  - use for slicing work across multiple agents and managed worktrees
- `parallel-work-implementer`
  - use for carrying one bounded slice through implementation and handoff
- `research-agent`
  - use for external research, source comparison, documentation drafting input, and tax-law research planning
- `knowledge-agent`
  - use for reading, writing, and synchronizing the local knowledge and long-term memory store
- `local-development-environment`
  - use for starting named repository web and API environments from the main checkout
- `workflow-retrospective`
  - use for audit-backed retrospectives, workflow debriefs, and follow-up action capture under `artifacts/retrospectives`

Each skill keeps the core workflow in `SKILL.md` and pushes extra detail into `references/` so the agent only loads more context when needed.

## Skill Design Rules

- Keep `SKILL.md` focused on trigger conditions, workflow, and a few critical decisions.
- Put long checklists and detailed standards in `references/`.
- Prefer project-specific guardrails over generic advice the model already knows.
- Add `agents/openai.yaml` so the skill is discoverable in tools that support UI metadata.

## Curated Skills Worth Watching

The current curated catalog includes `figma` and `figma-implement-design`. Those are relevant reference points for future design workflows, but they are not installed here because this project does not yet depend on Figma assets.

## Public Patterns Worth Reusing

- keep skills focused and composable rather than turning one skill into a full playbook
- keep `SKILL.md` short and move detail into `references/`
- wrap repeatable command sequences in scripts instead of relying on the model to reproduce them from memory
- prefer structured logs over free-form notes when you want auditability
- use a dedicated research skill when guidance must be dated, source-ranked, or converted into repeatable repo standards
- durable research should be looked up in and written back to the knowledge base, not left only in docs or chat
- future ideas, deferred work, and follow-up recommendations should become planning work items instead of remaining only in chat, docs, or knowledge entries
- keep merge authority with humans even when agents prepare the branch, commits, and pull request

## AGENTS.md vs CLAUDE.md Compatibility

`AGENTS.md` is the cross-tool standard (Claude Code, OpenAI Codex, Cursor, GitHub Copilot,
Gemini CLI, Aider, and others). Use it as the single source of truth for all agents.

`CLAUDE.md` is Claude Code-exclusive. When both files exist at the same directory level,
Claude Code prefers `CLAUDE.md`. Use it only for Claude Code-specific features:

- `@path/to/file` import syntax to pull in sub-documents without bloating `AGENTS.md`
- Claude Code subagent routing notes (`.claude/agents/`)
- Claude Code hook configuration references (`.claude/settings.json.example`)
- Session resume and context compaction instructions

The project root `CLAUDE.md` imports `AGENTS.md` via `@AGENTS.md` so Claude Code loads
both files without duplication. Do not repeat content between the two files.

### Compatibility Rules

- Put all workflow, architecture, and privacy rules in `AGENTS.md` only.
- Put Claude Code-exclusive feature docs in `CLAUDE.md` only.
- Never add a `CLAUDE.md` unless there is Claude Code-exclusive content to add.
- Nested directories that have `AGENTS.md` do not need a `CLAUDE.md` unless those
  directories also have Claude Code-specific overrides.

## Custom Subagents

Claude Code subagents live in `.claude/agents/`. Each is a Markdown file with YAML
frontmatter controlling model, tools, and context isolation. Key fields:

```yaml
---
name: subagent-name
description: When to invoke and what it returns — Claude reads this to auto-select
tools: Read, Grep, Glob, Bash
model: sonnet
context: fork   # isolated context window; main thread only receives the summary
---
```

Subagents run in isolated context windows so verbose output (test logs, large diffs, web
fetch results) does not accumulate in the main conversation. Use them for:
- Code review passes that would otherwise flood the main context
- Research fetch tasks where raw source HTML is irrelevant to the main task
- Exploration passes (finding files, counting lines) where the answer is a number, not a log

Subagents cannot spawn other subagents. Only the main orchestrating thread can invoke them.

## Worktree Creation

Always create worktrees via the repo script rather than raw `git worktree add`:

```bash
npm run agent:worktree:create -- --task <task-id> --summary "<summary>" --scope <scope> [--base <ref>]
```

The script calls `git worktree add` and then creates a directory junction (Windows) or
symlink (other platforms) from `<worktree>/node_modules` to the main checkout's
`node_modules`. This means pre-commit hooks, `npm run` scripts, and `tsx`-based tools all
work inside the worktree without a separate `npm install`.

If `node_modules` does not yet exist in the main checkout when the worktree is created,
the script will warn and skip the link. Run `npm install` in the main checkout and
re-link manually with:

```bash
# Windows
mklink /J <worktree>\node_modules <main-checkout>\node_modules

# Unix
ln -s <main-checkout>/node_modules <worktree>/node_modules
```

## Worktree Test Failure Diagnosis

When a test passes in the main checkout but fails in a worktree, diagnose with these three
steps before spending time on other hypotheses (test ordering, module duplication, etc.).

**Step 1** — Run the test from the main checkout.

```bash
cd <main-checkout>
npx vitest run --reporter=verbose <test-file>
```

Passes → environment issue in the worktree. Go to step 2.
Fails → test is broken in `main` too. Fix there first.

**Step 2** — Check if your branch is behind `main` on workspace packages.

```bash
git log HEAD..origin/main --oneline -- packages/
```

Any output → merge `main` into your branch:

```bash
git merge origin/main
```

This resolves schema version mismatches where the junction-linked `node_modules` loads a
newer schema than your branch's code expects (e.g. silent Zod parse failures, null returns
from cache reads). The worktree creation script now warns about this automatically (PLAN-67).

**Step 3** — Run with `--pool forks` to isolate module caches.

```bash
npx vitest run --pool=forks --reporter=verbose <test-file>
```

Passes → `node_modules` junction was causing vitest to load the same module from two paths.
The pre-commit hook now passes `--pool forks` automatically in worktrees (PLAN-66).

See `CLAUDE.md > Troubleshooting > Worktree test failure diagnosis` for the full decision
tree with commands and branch conditions.

## Planning CLI

`tools/planning/plan-cli.ts` is the local planning CLI. Run commands via:

```bash
node tools/runtime/run-npm.cjs run plan:cli -- <group> <action> [flags]
```

Key commands for querying work items:

- `work-item list --project <key>` — list all work items for a project as JSON
- `work-item list --project <key> --status <status>` — filter by status (`backlog`, `planning`, `ready`, `in-progress`, `blocked`, `done`, `archived`)
- `work-item get <PLAN-XX>` — fetch full work item detail as JSON, including acceptance criteria, tasks, and plan runs
- `work-item get --id <PLAN-XX>` — legacy-compatible flag form of the same lookup

Invoking an unknown command prints all valid command keys before exiting with code 1.

## Fast Changed-File Validation

Use the scoped preflight when you want lint and TypeScript feedback without waiting on tests:

```bash
npm run quality:lint-only -- <files...>
```

The command computes the same changed-file plan as `quality:changed`, runs `prisma:check`
first when needed, then runs ESLint and only the affected typecheck scopes. `quality:changed`
uses this preflight automatically before stylelint and vitest, so the git `pre-commit` hook
benefits as well.

## Execution Lifecycle

The repository workflow should stay explicit in this order:

1. Ensure the work belongs to a planning project. Create the project first when no suitable project exists yet.
2. Create or refine the planning work item inside that project.
3. Create a dedicated worktree for the owned slice and do the implementation there, not in the shared checkout.
4. Start the audited implementation workflow inside that worktree.
5. Update the planning item to `in-progress` with the current owner and workflow run ID.
6. Keep tasks, criteria, and status current while work is active.
7. Persist newly discovered future work as separate work items before closing the current task.
8. Publish the branch and PR before calling implementation complete.
9. End in a truthful state such as `done`, `blocked`, or back to `planning`.
