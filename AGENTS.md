# Taxes Repository Instructions

## Scope
- This repository is for a local-only tax workflow application.
- Treat all tax documents, extracted fields, and generated filings as sensitive data.
- Do not introduce runtime dependencies that send tax data to third-party hosted services.

## Project Skills
- Use `skills/implementation-workflow` for code changes, refactors, tests, build tooling, or architecture work.
- Use `skills/planning-workflow` when scoping backlog items, tracking acceptance criteria, or associating planned work with audit workflow IDs.
- Use `skills/ui-design-workflow` for frontend UX, component design, charting, layout, accessibility, or MUI theming work.
- Use `skills/workflow-audit` when a task needs explicit workflow start/end logging, audited command execution, or a reviewable command trail.
- Use `skills/parallel-work-orchestrator` when work should be split into multiple agents or worktrees.
- Use `skills/parallel-work-implementer` when an agent is executing one bounded slice inside its own worktree.
- Use `skills/research-agent` when a task needs external research, source comparison, documentation best-practice review, or tax-law research planning with dated citations.
- Use `skills/knowledge-agent` when an agent needs to read, write, or synchronize the local knowledge and long-term memory store.

## Required Workflow
1. Ensure the work belongs to a planning project in the local plan system. Create the project first when no suitable project exists yet.
2. Create or refine the planning work item for the task before implementation starts.
3. Create a dedicated git worktree for the owned slice and do the implementation inside that worktree, not in the shared checkout.
4. Read the relevant docs in `docs/` before making non-trivial changes.
5. Work in red-green-refactor order for behavior changes whenever practical.
6. For substantial implementation work, start an audited workflow with `npm run workflow:start implementation "<summary>"`. The command writes `.agent-session.json` at the repo root with the workflow name and run ID so subsequent commands pick up context automatically.
7. When the work maps to planning entities, pass `--project`, `--work-item-id`, `--plan-run-id`, and `--plan-step-id` to `workflow:start` so audit runs can be traced back to plan lineage.
8. For multi-step agent work inside an active workflow, log explicit skill, tool, hook, or operation spans with `npm run execution:start -- --kind <skill|tool|hook|operation|validation> --name <label>` and close them with `npm run execution:end -- --execution-id <id> --status success|failed`. The `--workflow` flag is optional when `.agent-session.json` is present.
9. When work moves from one agent to another, record it with `npm run audit:handoff -- --workflow <name> --source-agent <from> --target-agent <to> --summary "<handoff>" --status pending|accepted|completed|blocked`.
10. Use `npm run dev:audit:api` and `npm run dev:audit:web` when you need the live shared audit monitor while agents are running.
11. For Prisma schema changes, edit `prisma/schema.prisma`, create a checked-in migration with `npm run prisma:migrate:dev -- --name <change-name>`, and never hand-edit older migration folders unless explicitly instructed.
12. Regenerate and validate Prisma after schema changes with `npm run prisma:check`.
13. Before finishing, run the strongest available validation for the touched area:
   - Fast iteration: `npm run quality:changed -- <files...>` or let the git `pre-commit` hook run `npm run quality:changed:staged`
   - Database changes: `npm run prisma:check` and `npm run prisma:migrate:deploy`
   - Full compile checks with `npm run typecheck`
   - Full ESLint with `npm run lint`
   - Frontend styling changes: `npm run stylelint`
   - Full tests with `npm test` or architecture-only tests with `npm run test:arch`
   - Use `npm run quality:logged -- implementation` when you want a single audited full guardrail run
14. When the task produces branch-ready changes, make atomic commits, push the branch, and create or update the pull request before claiming the work is done. Use `node tools/runtime/run-npm.cjs run pr:sync -- --summary "<what changed>" --value "<why it matters>" --privacy-confirmed`.
15. Agents must not merge pull requests. PR merge is a human-controlled action that happens after review, and this repository will later route that decision through the `code-review` project workflow.
16. Close audited work with `npm run workflow:end implementation success` or `failed`. Successful implementation workflows are not done until the worktree is clean and the branch has an open PR when commits exist.
17. If a command is not available yet, note the gap and update the nearest documentation or scaffold so the repo moves toward that standard.

## Architecture Rules
- Keep a strict separation between app surfaces under `apps/*/web`, `apps/*/api`, and `packages/shared`.
- Keep a strict separation between web and api layers, including nested app domains such as `apps/audit/web` and `apps/audit/api`.
- `packages/shared` must stay framework-light and hold reusable domain types, schemas, and pure helpers.
- UI components should not parse raw tax documents directly. Extraction belongs behind backend application services.
- External document conversion or OCR tools must sit behind adapters so they can be swapped without rewriting business logic.
- Treat `prisma/schema.prisma` as the backend persistence contract. Keep raw uploaded files on disk, and keep structured metadata in SQLite through Prisma-backed services.
- Treat each product web app's `apps/<product>/web/src/theme/` directory as the frontend styling contract. For the current tax app, that is `apps/taxes/web/src/theme/`.
- Prefer composition over inheritance. Apply SOLID, DRY, and KISS without adding abstractions before there is a second real use case.

## Privacy And Security
- Never commit raw tax documents, generated filings, or local extracted data.
- Redact or avoid logging SSNs, EINs, bank numbers, addresses, or full document contents.
- Default to offline-capable libraries and local storage paths outside the repository for private files.
- Treat the shared audit database under the user profile as local sensitive operational data.

## Documentation
- Use `docs/documentation-standards.md` when writing or restructuring long-lived docs or skill references.
- Keep `docs/research-sources.md` current when adding or replacing major stack guidance.
- Update the closest architecture or workflow doc when implementation decisions change.
- Keep `.nvmrc` and `package.json` engine versions aligned with the validated local toolchain.

## Claude Code-Specific Context

> This section applies when the agent is Claude Code (Anthropic CLI). OpenAI Codex and other
> tools ignore it gracefully. For the full Claude Code context file with @path imports and
> feature details, see `CLAUDE.md` at the project root.

### Subagents

Custom subagents are defined in `.claude/agents/`. They run in isolated context windows and
are invoked via the Agent tool. Use them to keep focused work out of the main context:
- `code-reviewer` — diff review against architecture, privacy, and quality rules
- `research` — dated, source-ranked external research with citation discipline

### Hooks

Copy `.claude/settings.json.example` to `.claude/settings.json` to activate PostToolUse
linting hooks and pre-approved npm permissions. This avoids repeated approval prompts for
safe commands and keeps formatting automatic.

### Worktree Creation

Always create worktrees via `npm run agent:worktree:create` rather than raw `git worktree add`.
The script creates the git worktree and then links `node_modules` from the main checkout into
the worktree so pre-commit hooks and npm scripts work without a separate install step.

Pass `--merge-main` to automatically fetch `origin` and merge `origin/main` into the new branch
immediately after creation. This keeps the branch fresh and avoids schema version mismatch
warnings that arise when shared packages have diverged. Merge conflicts are reported as a
non-fatal warning so the agent can resolve them manually without aborting the creation step.

```bash
npm run agent:worktree:create -- --task PLAN-XX --summary "..." --scope tools/ --merge-main
```
