# Claude Code Context — Taxes Repository

> This file is read by Claude Code (Anthropic's CLI). For cross-tool context readable by
> Claude Code, OpenAI Codex, Cursor, and others, see `AGENTS.md`.
> When both files exist, Claude Code prefers this file. Use this file for Claude Code-
> exclusive features; keep shared rules in `AGENTS.md`.

## Import Index

@AGENTS.md

## Claude Code-Specific Features

### Skills

Project skills live in `skills/` at the repository root. Each skill has a `SKILL.md` with
frontmatter that controls auto-invocation. Invoke them with `/skill-name` or let Claude Code
auto-invoke based on the description field.

Key skills:
- `/implementation-workflow` — all code changes, refactors, tests, build tooling
- `/planning-workflow` — backlog creation, work decomposition, acceptance criteria
- `/research-agent` — external research, source comparison, dated citations
- `/knowledge-agent` — read, write, synchronize the local knowledge store
- `/workflow-audit` — audited workflow start/end logging, guardrail execution
- `/parallel-work-orchestrator` — slice work across multiple agents and worktrees
- `/parallel-work-implementer` — carry one bounded slice inside its own worktree
- `/ui-design-workflow` — frontend layout, forms, charts, MUI theming
- `/visualization-workflow` — diagrams, PR visuals, workflow monitoring
- `/local-development-environment` — start web and API environments from main checkout
- `/workflow-retrospective` — audit-backed retrospectives, follow-up action capture

### Subagents

Custom subagents live in `.claude/agents/`. They run in isolated context windows and
are invoked via the Agent tool. Use them for focused tasks that should not accumulate
context in the main conversation.

Available subagents:
- `code-reviewer` — review diffs for architecture, privacy, and quality concerns
- `research` — fetch and summarize external docs with dated citations

### Hooks

Recommended hooks are documented in `.claude/settings.json.example`. To activate, copy to
`.claude/settings.json`. Hooks run linting and formatting automatically after edits.

### Model Routing

This repository uses a 4-tier model selection system to balance agent capability with token cost.
Read `docs/model-selection-strategy.md` for the full definitions, task-type routing table, and
escalation policy. In brief:

- **Tier 1** (Haiku): read-only research, file search, knowledge ops, logging — cheap and fast
- **Tier 2** (Sonnet): code changes, code review, design, implementation — the standard reasoning tier
- **Tier 3** (Opus): orchestration, architecture decisions, complex multi-step decomposition — use when T2 fails twice
- **Tier 0**: future local models via Ollama (not yet working)

To route Claude Code subagents to a cheaper tier for exploration tasks, use the environment variable:

```bash
# Route subagents to Haiku when running exploration subagents
CLAUDE_CODE_SUBAGENT_MODEL=claude-haiku-4-5-20251001 claude
```

Each skill in `skills/*/SKILL.md` declares its recommended tier with a comment near the top.

### Context Management

- Use Plan Mode (`Ctrl+Shift+P`) before multi-file changes to read without writing.
- Use `/compact <instructions>` with explicit preservation instructions when context is large.
  See **Context Management** in `AGENTS.md` for mandatory checkpoint timing and preservation list template.
- Use `/btw` for side questions that should not accumulate in the main context.
- Use `context: fork` in skill frontmatter for explorations that should stay isolated.

### Worktree Creation

Always create worktrees via `npm run agent:worktree:create` (not raw `git worktree add`).
The script links `node_modules` from the main checkout into the new worktree automatically,
so pre-commit hooks and npm scripts work immediately without a separate install step.

**Windows junction repair (when node_modules is missing or broken):**

`cmd /c mklink /J` silently fails when invoked through bash on Windows. Use `npm run worktree:ensure-junction`
instead — it calls Node's `fs.symlinkSync(..., "junction")` which works without admin rights and without
needing PowerShell. Run this at the start of any worktree session where the junction may be stale:

```bash
npm run worktree:ensure-junction
```

The script verifies the junction, repairs it if needed, and runs `prisma:generate` so the Prisma client exists.

### Compaction Preservation Note

When auto-compacting, always preserve:
- The full list of modified files in the current session
- Any test or validation commands that were run and their results
- The active workflow name and ID (e.g., `2026-03-14T...-implementation-...`)
- The current work item ID (e.g., `PLAN-62`)

### Session Resume

Use `claude --continue` to resume the most recent session, or `claude --resume <session-id>`
to resume a specific past session. Useful when context was lost mid-workflow.

**When resuming a session mid-workflow, always re-anchor immediately:**

1. Read `.agent-session.json` to recover the active workflow name and run ID.
2. Log a heartbeat to signal the session is live again:
   ```bash
   npm run agent:heartbeat -- --message "session resumed"
   ```
3. Check `git status` to confirm which files were modified before context was lost.
4. Continue from the last incomplete step — do not restart from scratch.

Skipping this anchor means the run will show no heartbeats in `audit:progress` and the
retrospective will be empty even on a successful run.

## Troubleshooting

### Worktree test failure diagnosis

A test that passes on `main` but fails in a worktree almost always has one of three causes.
Work through these steps in order — most failures resolve at step 1 or 2.

**Step 1 — Confirm the failure is environment-specific**

Run the exact failing test from the main checkout:

```bash
cd C:/Users/csmat/source/repos/Taxes   # or wherever the main checkout lives
npx vitest run --reporter=verbose <test-file>
```

- **Passes** → the failure is worktree-environment-specific. Continue to step 2.
- **Fails** → the test is broken in `main` too. Fix the test in `main`, then merge into your worktree branch.

**Step 2 — Check if your branch is behind main on workspace packages**

The pre-push quality gate (PLAN-162) enforces that `packages/` is in sync with `origin/main` before you push.
If you see an error message during a push, your branch has missed package updates. Merge main:

```bash
# From the worktree
git merge origin/main
```

This resolves schema version mismatches caused by the junction-linked `node_modules` loading a newer schema
than your branch expects. After merging, retry the push — the gate will pass once packages are current.

**Step 3 — Confirm the test is genuinely failing, not a stale cache artifact**

`vitest.config.ts` sets `pool: "forks"` as the default (PLAN-238), so the module-cache sharing
issue that previously required `--pool forks` is eliminated. If tests still fail after step 2,
the failure is a genuine defect — read the stack trace and fix the bug.

```bash
npx vitest run --reporter=verbose <test-file>
```

### Module resolves to wrong version in worktree

TypeCheck or imports fail with errors like "Property X does not exist in type Y" or "Module not found" when your worktree was created before a recent main branch merge that updated shared packages.

**Root cause:** The worktree shares `node_modules` with the main checkout via a directory junction.
When main has been updated with new fields in Prisma schemas or package exports, the worktree's
source code imports may reference types that don't exist yet in the junction-linked module.

**Fix:** Merge origin/main into your worktree branch to sync shared package sources:

```bash
# From the worktree
git merge origin/main
npm run prisma:generate
npm run typecheck
```

This resyncs the worktree's local `packages/` source with main's latest types. The junction
automatically resolves those updated sources for the next import.

**If the error persists after merge:** Run the merge from the main checkout directly:

```bash
cd C:/Users/csmat/source/repos/Taxes
npm run prisma:generate
npm run typecheck
```

If typecheck passes in main but still fails in the worktree, the failure is environment-specific.
See the **Worktree test failure diagnosis** section above (Step 3: run with `--pool forks`).
