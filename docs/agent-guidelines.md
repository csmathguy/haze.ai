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

## Current Worktree Gap

- Fresh worktrees may not have their own `node_modules` tree, so git hooks and `npm run` wrappers can fail even when the shared root install exists.
- Until the repo grows a worktree bootstrap or shared-toolchain wrapper for hooks, run the equivalent validation commands manually and record that limitation in the nearest workflow doc when it blocks normal execution.

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
