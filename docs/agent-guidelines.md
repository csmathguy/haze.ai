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

## Current Worktree Gap

- Fresh worktrees may not have their own `node_modules` tree, so git hooks and `npm run` wrappers can fail even when the shared root install exists.
- Until the repo grows a worktree bootstrap or shared-toolchain wrapper for hooks, run npm scripts from the main checkout while doing file work in the worktree, and record that limitation in the nearest workflow doc when it blocks normal execution.

## Execution Lifecycle

The repository workflow should stay explicit in this order:

1. Ensure the work belongs to a planning project. Create the project first when no suitable project exists yet.
2. Create or refine the planning work item inside that project.
3. Create a dedicated worktree for the owned slice and do the implementation there, not in the shared checkout.
4. Start the audited implementation workflow inside that worktree.
5. Update the planning item to `in-progress` with the current owner and workflow run ID.
6. Keep tasks, criteria, and status current while work is active.
7. Publish the branch and PR before calling implementation complete.
8. End in a truthful state such as `done`, `blocked`, or back to `planning`.
