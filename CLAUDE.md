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

Use the `CLAUDE_CODE_SUBAGENT_MODEL` environment variable to route subagents to a cheaper
model when the subagent task is research or file exploration rather than reasoning:

```bash
# Route subagents to Haiku when running exploration subagents
CLAUDE_CODE_SUBAGENT_MODEL=claude-haiku-4-5-20251001 claude
```

### Context Management

- Use Plan Mode (`Ctrl+Shift+P`) before multi-file changes to read without writing.
- Use `/compact <instructions>` with explicit preservation instructions when context is large:
  `/compact preserve the full list of modified files and any test commands that were run`
- Use `/btw` for side questions that should not accumulate in the main context.
- Use `context: fork` in skill frontmatter for explorations that should stay isolated.

### Worktree Creation

Always create worktrees via `npm run agent:worktree:create` (not raw `git worktree add`).
The script links `node_modules` from the main checkout into the new worktree automatically,
so pre-commit hooks and npm scripts work immediately without a separate install step.

### Compaction Preservation Note

When auto-compacting, always preserve:
- The full list of modified files in the current session
- Any test or validation commands that were run and their results
- The active workflow name and ID (e.g., `2026-03-14T...-implementation-...`)
- The current work item ID (e.g., `PLAN-62`)

### Session Resume

Use `claude --continue` to resume the most recent session, or `claude --resume <session-id>`
to resume a specific past session. Useful when context was lost mid-workflow.

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

```bash
# From the worktree
git log HEAD..origin/main --oneline -- packages/
```

- **Output is empty** → packages are in sync. Skip to step 3.
- **One or more commits listed** → your branch is missing shared package changes. Merge main:

  ```bash
  git merge origin/main
  ```

  Re-run the failing test. This resolves schema version mismatches caused by the
  junction-linked `node_modules` loading a newer schema than your branch expects.

**Step 3 — Run with `--pool forks` to eliminate module cache sharing**

The worktree shares `node_modules` with the main checkout via a directory junction.
Vitest's default thread pool can load the same module from two different resolved paths
(the worktree path and the junction path), causing false cache misses.

```bash
npx vitest run --pool=forks --reporter=verbose <test-file>
```

- **Passes** → the pre-commit hook now passes `--pool forks` automatically (PLAN-66).
  If you need to run `quality:changed` manually, pass `--pool forks`:

  ```bash
  npm run quality:changed -- --pool forks <files...>
  ```

- **Still fails** → the test has a genuine defect. Read the stack trace and fix the bug.

**Why pre-commit passing does not guarantee worktree correctness**

Before PLAN-66, the pre-commit hook ran `quality:changed` from the **main checkout** using
staged file paths. Tests passed against main's file versions, not the worktree's. A broken
test in the worktree could pass pre-commit while failing on push. After PLAN-66 the hook
runs from the worktree CWD with `--pool forks`, so the staged versions are what is tested.
