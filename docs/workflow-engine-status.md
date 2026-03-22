# Workflow Engine — Status & Path Forward

> Written: 2026-03-22. Both the gateway (port 3000) and workflow API (port 3181) are stopped.
> The other agent is finishing frontend changes on `main`. Once that PR is merged, this document
> outlines the clean-up and remaining work needed before the engine can autonomously run an
> end-to-end implementation cycle.

---

## What The Engine Is Supposed To Do

Run the `implementation` workflow definition end-to-end:

```
phase-1: Check planning item exists (condition)
phase-1b: Gather context pack (work item + git diff)
phase-2: Create dedicated git worktree (--force to recreate stale ones)
phase-2: Heartbeat + capture worktree path
phase-3: Agent implements the task (outputs JSON: filesChanged, testsAdded, refactoringApplied, summary)
phase-4: Sequential validation: prisma:check → typecheck → lint
phase-5: git add -A → git commit → git push → pr:sync → approval gate
```

---

## What Is Working

| Component | Status | Notes |
|-----------|--------|-------|
| WorkflowEngine (pure state machine) | ✅ | Handles sequential, condition, parallel, approval steps |
| WorkflowWorker (polling loop) | ✅ | Processes events, advances state, persists to SQLite |
| CommandStepExecutor | ✅ | Runs npm/git/node scripts, captures stdout, interpolates `{{ctx}}` vars |
| ConditionStepExecutor | ✅ | Evaluates JS predicates, routes to true/false branch |
| ContextPackExecutor | ✅ | Gathers work item + git diff into contextJson |
| AgentStepExecutor (spawn + stream-json) | ✅ | Spawns `claude.cmd` on Windows, reads stream-json lines |
| Sequential validation steps | ✅ | prisma:check → typecheck → lint replace old parallel guardrails |
| `git add -A` stage step | ✅ | Added before commit so agent file writes are staged |
| `--force` worktree creation | ✅ | Forces destruction and recreation of stale worktrees |
| Agent output → contextJson merge | ✅ | `filesChanged`, `summary` etc. flow into downstream steps |
| Retry error injection | ✅ | Previous failure reason passed to next agent attempt |
| Diagnostic stdout capture on parse failure | ✅ | Last 20 stdout lines + stderr included in error message |
| Definition upsert on startup | ✅ | `register-definitions.ts` now updates existing definitions on each restart |

---

## What Is Still Broken / Incomplete

### 1. Agent outputs conversational text instead of JSON

**Root cause:** The Claude Code subagent runs in the worktree, reads `git log`, sees commits from
infrastructure work (merged from main), and concludes "the task looks done" — then asks a
clarifying question in plain text instead of implementing and outputting JSON.

**Partial fix applied:** Removed `gitDiff` from context sent to agent; added explicit system
prompt rule that "existing commits are NOT your task." This has NOT been tested end-to-end yet.

**Remaining risk:** The agent may still produce plain-text output for other reasons (e.g., if
it decides no changes are needed, or if its output schema validation fails at the Claude layer).

**Needed:**
- Verify the prompt change actually causes the agent to implement and output JSON.
- Consider adding `--output-format stream-json` flag explicitly to the `claude` CLI invocation
  (confirm the flag name from `claude --help`).

### 2. CLI subprocess exits with code 1 (latest failure)

The second run (`cmn29wrqz000g1suzrpe9x5pa`) failed with `CLI subprocess exited with code 1`.
The full stderr was not captured in this session. This may indicate:
- The `claude.cmd` invocation itself errored (auth, rate limit, network)
- The `--output-format stream-json` flag is wrong or not supported
- A permission or PATH issue in the spawned environment

**Needed:** Capture and log the full stderr from the subprocess. Check `agent-step-stream-parser.ts`
to confirm the CLI invocation flags match what `claude --help` documents.

### 3. No validation feedback loop

When `phase-4-typecheck` or `phase-4-lint` fails, the run currently marks itself failed and stops.
It does NOT send the validation errors back to the agent for a retry.

**Needed (future work):**
- After a validation step fails, capture the stderr/stdout.
- Store it in contextJson under a key like `validation_errors`.
- Route back to `phase-3-implement` with the errors injected into the agent's previous-error section.
- This requires adding a condition step after each validation step.

### 4. `feature/plan-268` branch is stale

The `.worktrees/plan-268` worktree exists and its `feature/plan-268` branch has infrastructure
commits (merged from main). It has no PLAN-268 implementation.

**Needed before next run:**
- Either delete the worktree and branch so `--force` recreates it fresh, OR
- Confirm `--force` in `phase-2-create-worktree` destroys and rebuilds from the latest main.

### 5. Multiple duplicate step run records

The database has duplicate `phase-1-check-planning-item` and other step run records from the
same logical run. This is a worker event-processing bug — the worker replays events from the
DB on restart, re-executing already-completed steps. Not blocking for MVP but causes confusion.

**Needed:** Add idempotency check in the worker: skip executing a step if a completed step-run
record already exists for that step in this run.

### 6. Gateway / Workflow API start-up reliability

`gateway:restart` kills port 3000 but the child process it spawns fails silently if
`@esbuild/win32-x64` is missing (optional npm dependency was not installed).

**Fixed in this session:** `@esbuild/win32-x64` was installed manually. But this is not
committed/tracked in `package.json` properly — it was installed at runtime, not as a proper
package.json optional dependency.

**Needed:** Verify `package.json` has `@esbuild/win32-x64` under `optionalDependencies`, or
document the install step in `CLAUDE.md`.

---

## Commits Made This Session (all on `main`)

| Commit | Description |
|--------|-------------|
| `636163a` | Streamline validation (sequential), force worktree recreate, add git-add step |
| `d0fac27` | Store retry error in context + inject into next agent attempt |
| `237efe0` | Improve agent prompt and JSON extraction from stream output |
| `82d8373` | Merge main and fix shared lint regression |
| `001a747` | Fix stream-json parsing for claude CLI output format |
| `8f5862c` | Fix agent CLI spawn on Windows + skill name lookup |
| `c9f9919` | Fix merge conflict duplicate functions in workflow-step-advance |
| `00f58eb` | Fix all lint errors in agent-step-executor (parseCli extraction etc.) |
| `8590d4f` | Clarify task context in agent prompt + definition upsert on startup |

---

## Files Changed This Session

```
apps/workflow/api/src/definitions/implementation.workflow.ts    # sequential validation, --force, git-add step
apps/workflow/api/src/definitions/implementation.workflow.test.ts
apps/workflow/api/src/executor/agent-step-executor.ts           # prompt clarity, parseCli, ZodType import
apps/workflow/api/src/executor/agent-step-executor.test.ts      # runtimeKind fix to avoid subprocess timeout
apps/workflow/api/src/executor/agent-step-stream-parser.ts      # stream-json parsing for claude CLI format
apps/workflow/api/src/executor/command-executor.ts              # stdout capture improvements
apps/workflow/api/src/executor/interpolate-context.ts           # NEW: extracted from step-execution-handler
apps/workflow/api/src/executor/step-execution-handler.ts        # mergeAgentOutputIntoContext
apps/workflow/api/src/seed/register-definitions.ts             # upsert on startup
apps/workflow/api/src/app.ts
packages/shared/src/workflow-step-advance.ts                    # deduped after merge conflict
tools/agent/gateway-restart.ts                                  # gateway restart utility
package.json
```

---

## Path Forward (in order)

1. **Merge the other agent's PR** (frontend changes) and pull to main.

2. **Create a single clean PR** from the session's `main` commits (they are all on `main` already).
   Actually all commits went directly to `main` during this debugging phase — a PR may not be
   needed unless the team wants a review boundary. Consider tagging the HEAD commit as a milestone.

3. **Fix the CLI exit-code-1 failure.** Start the workflow API, trigger a run, and read the full
   stderr to understand why `claude.cmd` exits with code 1. Common causes:
   - Wrong flags passed to `claude` CLI (check `claude --help` for `--output-format` flag name)
   - `ANTHROPIC_API_KEY` not set in the spawned subprocess environment
   - Network/auth issue

4. **Verify the agent outputs JSON.** Once the exit-code-1 is fixed, watch the agent's stdout
   to confirm it outputs a `{"type":"result","result":"..."}` line with valid JSON matching the
   output schema.

5. **Test a full end-to-end run** on a simple work item (not PLAN-268 which has a stale worktree).
   Use a new PLAN-XXX item with a small, self-contained task.

6. **Implement the validation feedback loop** (items 3 from broken list above) once basic end-to-end works.

7. **Fix the duplicate step-run record bug** (item 5).

8. **Wire up GitHub webhook** handling so the workflow engine knows when a PR has no merge conflicts
   and GitHub Actions pass — enabling the approval gate to auto-advance on CI green.

---

## How To Start The Engine For The Next Session

```bash
# From main checkout root
npm run repo:health              # check for issues

# Start the workflow API (runs on port 3181)
cd apps/workflow/api
node ../../../node_modules/tsx/dist/cli.mjs src/index.ts

# In another terminal: start the gateway (proxies port 3000 → 3181)
# (the user's existing dev environment script handles this)

# Trigger a run via the API
curl -X POST http://localhost:3181/api/workflow/runs \
  -H "Content-Type: application/json" \
  -d '{"definitionName":"implementation","input":{"workItemId":"PLAN-XXX","summary":"..."}}'
```
