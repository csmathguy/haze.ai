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

### Compaction Preservation Note

When auto-compacting, always preserve:
- The full list of modified files in the current session
- Any test or validation commands that were run and their results
- The active workflow name and ID (e.g., `2026-03-14T...-implementation-...`)
- The current work item ID (e.g., `PLAN-62`)

### Session Resume

Use `claude --continue` to resume the most recent session, or `claude --resume <session-id>`
to resume a specific past session. Useful when context was lost mid-workflow.
