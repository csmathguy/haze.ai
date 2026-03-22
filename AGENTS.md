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
0. **Run `npm run repo:health` at the start of every session.** This takes 5 seconds and surfaces dirty main checkout, broken junctions, migration conflicts, and packages drift before they cause expensive push failures. Fix any critical issues (✗) before proceeding.
1. Ensure the work belongs to a planning project in the local plan system. Create the project first when no suitable project exists yet.
2. Create or refine the planning work item for the task before implementation starts.
3. Create a dedicated git worktree for the owned slice and do the implementation inside that worktree, not in the shared checkout.
4. Read the relevant docs in `docs/` before making non-trivial changes.
5. Work in red-green-refactor order for behavior changes whenever practical.
6. For substantial implementation work, start an audited workflow with `npm run workflow:start implementation "<summary>"`. The command writes `.agent-session.json` at the repo root with the workflow name and run ID so subsequent commands pick up context automatically.
   After workflow start, log a heartbeat to confirm the session is live: `npm run agent:heartbeat -- --message 'workflow started'`
7. When the work maps to planning entities, pass `--project`, `--work-item-id`, `--plan-run-id`, and `--plan-step-id` to `workflow:start` so audit runs can be traced back to plan lineage.
8. For multi-step agent work inside an active workflow, log explicit skill, tool, hook, or operation spans with `npm run execution:start -- --kind <skill|tool|hook|operation|validation> --name <label>` and close them with `npm run execution:end -- --execution-id <id> --status success|failed`. The `--workflow` flag is optional when `.agent-session.json` is present.
   Log heartbeats at each major milestone with `npm run agent:heartbeat -- --message '<progress note>'` so parallel orchestrators can tail live progress via `npm run audit:progress`.
   **Minimum heartbeat cadence:** start, after each file modified, after tests pass, after PR opens, before workflow:end. A run with no mid-session heartbeats is non-compliant.
9. When work moves from one agent to another, record it with `npm run audit:handoff -- --workflow <name> --source-agent <from> --target-agent <to> --summary "<handoff>" --status pending|accepted|completed|blocked`.
10. Use `npm run dev:audit:api` and `npm run dev:audit:web` when you need the live shared audit monitor while agents are running.
11. For Prisma schema changes, edit `prisma/schema.prisma`, create a checked-in migration with `npm run prisma:migrate:dev -- --name <change-name>`, and never hand-edit older migration folders unless explicitly instructed.
12. Regenerate and validate Prisma after schema changes with `npm run prisma:check`.
13. Before finishing, run the strongest available validation for the touched area:
   - Pre-push sanity check: `npm run quality:preflight` (typecheck + lint only, ~30s) — run this before pushing to catch failures fast
   - Fast iteration: `npm run quality:changed -- <files...>` or let the git `pre-commit` hook run `npm run quality:changed:staged`
   - Database changes: `npm run prisma:check` and `npm run prisma:migrate:deploy`
   - Full compile checks with `npm run typecheck`
   - Full ESLint with `npm run lint`
   - Frontend styling changes: `npm run stylelint`
   - Full tests with `npm test` or architecture-only tests with `npm run test:arch`
   - Use `npm run quality:logged -- implementation` when you want a single audited full guardrail run
14. When the task produces branch-ready changes, make atomic commits, push the branch, and create or update the pull request before claiming the work is done. Use `node tools/runtime/run-npm.cjs run pr:sync -- --summary "<what changed>" --value "<why it matters>" --privacy-confirmed [--work-item-id <PLAN-XXX>]`. The optional `--work-item-id` flag auto-closes the linked work item via the planning CLI after a successful push.
15. Agents must not merge pull requests. PR merge is a human-controlled action that happens after review, and this repository will later route that decision through the `code-review` project workflow.
16. Close audited work with `npm run workflow:end implementation success` or `failed`. Successful implementation workflows are not done until the worktree is clean and the branch has an open PR when commits exist.
17. If a command is not available yet, note the gap and update the nearest documentation or scaffold so the repo moves toward that standard.

## Worktree Habits

These three habits prevent the most common sources of wasted tokens and CI failures when working in worktrees:

1. **Always merge main before starting CI fix work.**
   When a PR has CI failures caused by code that was merged to main after your branch was cut, merge
   `origin/main` into your worktree branch first. This syncs shared package types and avoids chasing
   phantom type errors:
   ```bash
   npm run db:check-migrations   # detect untracked migration conflicts before merging
   git merge origin/main
   npm run prisma:generate
   ```

2. **Use `--no-verify` on pure merge commits.**
   When resolving merge conflicts, the resulting merge commit is not your authored code — it is a
   structural git operation. The pre-commit hook now auto-detects merge commits and skips the quality
   check, but if you ever need to force it manually:
   ```bash
   git commit --no-verify -m "Merge origin/main"
   ```
   The pre-push gate catches real issues before the branch lands on CI.

3. **Run targeted tests locally before committing when fixing test failures.**
   Before committing a test fix, confirm it actually passes in the worktree environment:
   ```bash
   npx vitest run --reporter=verbose <test-file>
   ```
   `vitest.config.ts` sets `pool: "forks"` as the default so the junction module-cache issue
   is handled automatically. This costs seconds locally vs. minutes of CI round-trip time.

4. **Run `worktree:ensure-junction` when node_modules feels broken.**
   If tsx is missing, Prisma client errors appear, or module resolution behaves oddly, run:
   ```bash
   npm run worktree:ensure-junction
   ```
   This verifies the junction health, repairs it if needed, and re-generates the Prisma client.

5. **Run `repo:health` when starting any session — it catches everything at once.**
   ```bash
   npm run repo:health
   ```
   ✗ Critical issues must be fixed before proceeding. ⚠ Warnings should be reviewed before pushing.

## Context Management

Long-running agent sessions accumulate context and can burn tokens unnecessarily. Use mandatory
`/compact` checkpoints to prune accumulated information while preserving critical task state.

**Three mandatory `/compact` checkpoints:**

1. **After each merged PR** — Once a branch is merged or a PR is closed, compact to drop the diff context:
   ```
   /compact preserve: active workflow ID, current work-item ID, list of completed work items
   ```

2. **After each major investigation or diagnosis** — After exploring filesystem, reading docs, or debugging:
   ```
   /compact preserve: findings summary, decision made, active workflow ID, active work-item ID
   ```

3. **Before starting a new work item** — When moving from one task to another:
   ```
   /compact preserve: previous work-item ID, PR number if created, active workflow ID
   ```

**Preservation list template** — Always include these when using `/compact`:
- **Modified files list** — the exact file paths changed in this session (use `git status` output)
- **Test or validation commands run** — the npm commands and their results (pass/fail)
- **Active workflow ID** — from `.agent-session.json` (format: `2026-03-19T...-implementation-...`)
- **Current work-item ID** — the PLAN-XXX being actively worked on
- **Branch and PR info** — the current branch name and PR URL if applicable

These four elements are load-bearing for resuming interrupted work. Everything else—file contents,
commit history, exploration paths—can be reconstructed from git and the codebase.

**Session resume anchor (mandatory when continuing a mid-workflow session):**

When a session resumes after compaction or interruption, do this before any code work:
```bash
cat .agent-session.json                                         # recover workflow name + run ID
npm run agent:heartbeat -- --message "session resumed"          # signal the run is live
git status                                                      # confirm which files were in flight
```
A session that resumes without a heartbeat will show a silent gap in `audit:progress` and produce
an empty retrospective even if the implementation succeeds.

**Retrospective fill-in (required before `workflow:end`):**

Before calling `npm run workflow:end`, fill in the retrospective sections in the file written by
`workflow:start`. The file is at `artifacts/retrospectives/YYYY-MM-DD/<run-id>.md`. At minimum:
- **Outcome** — what was delivered and whether it matched the plan
- **What Went Well** — concrete wins backed by the audit trail
- **What Didn't Go Well** — process gaps, late lint catches, missing context
- **Future Tasks To Consider** — follow-on work surfaced during implementation

An empty retrospective means the audit trail has no institutional memory for that run.

- Keep a strict separation between app surfaces under `apps/*/web`, `apps/*/api`, and `packages/shared`.
- Keep a strict separation between web and api layers, including nested app domains such as `apps/audit/web` and `apps/audit/api`.
- `packages/shared` must stay framework-light and hold reusable domain types, schemas, and pure helpers.
- UI components should not parse raw tax documents directly. Extraction belongs behind backend application services.
- External document conversion or OCR tools must sit behind adapters so they can be swapped without rewriting business logic.
- Treat `prisma/schema.prisma` as the backend persistence contract. Keep raw uploaded files on disk, and keep structured metadata in SQLite through Prisma-backed services.
- Treat each product web app's `apps/<product>/web/src/theme/` directory as the frontend styling contract. For the current tax app, that is `apps/taxes/web/src/theme/`.
- Prefer composition over inheritance. Apply SOLID, DRY, and KISS without adding abstractions before there is a second real use case.

## Orchestrator Supervision

When acting as an orchestrator dispatching sub-agents to worktrees, use `workflow:watch` to tail
their progress in real time rather than waiting passively:

```bash
# Tail a sub-agent's run with default settings (stale after 10m, poll every 3s)
npm run workflow:watch -- <runId>

# Tighten the stale threshold when the task should be fast
npm run workflow:watch -- <runId> --stale-after 5

# Read runId from the sub-agent's .agent-session.json after worktree:start
cat /path/to/worktree/.agent-session.json | node -e "process.stdin|>JSON.parse|>r=>console.log(r.runId)"
```

**What to watch for:**

| Output | Meaning | Action |
|--------|---------|--------|
| `→ skill/tool: ...` | Normal step progress | Continue monitoring |
| `♥ heartbeat: ...` | Agent is alive | No action needed |
| `⚑ APPROVAL GATE` (yellow) | Human decision required | Review and unblock |
| No output for >10m | Stale — watcher exits non-zero | Investigate, resume, or abort |
| `workflow ended — status: failed` | Run failed | Check artifacts/audit/YYYY-MM-DD/<runId>/ |

**Checking for active runs without a known runId:**

```bash
npm run audit:progress   # shows all active heartbeat streams
```

**Verifying sub-agent process compliance:**

A well-behaved sub-agent should produce these events in order:
1. `workflow-start` — after `npm run workflow:start`
2. `artifact-recorded` (kind: heartbeat) — after `npm run agent:heartbeat`
3. `execution-start` / `execution-end` pairs — for each tracked step
4. `workflow-end` (status: success) — after `npm run workflow:end ... success`

If a sub-agent skips `workflow:start` or never produces heartbeats, check `.agent-session.json`
in the worktree. A missing session file means the agent did not follow the required workflow.

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

`--merge-main` is on by default. Every new worktree automatically fetches `origin` and merges
`origin/main` immediately after creation. This keeps branches fresh and avoids schema version
mismatch warnings. Pass `--no-merge-main` to skip when the merge is not desired.

```bash
npm run agent:worktree:create -- --task PLAN-XX --summary "..." --scope tools/
npm run agent:worktree:create -- --task PLAN-XX --summary "..." --no-merge-main
```
