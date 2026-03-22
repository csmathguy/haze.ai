# Workflow Engine — First Run Guide

> Pre-flight checklist, controls, known gaps, and recovery plan for running the
> implementation workflow against a real work item for the first time.

## What's In Place

### Controls Available

| Control | How to use | Effect |
|---|---|---|
| **Cancel** | Fleet Dashboard or Run Detail → Cancel button | Marks run `cancelled`; engine stops dispatching new steps |
| **Pause** | Run Detail → Pause button | Marks run `paused`; engine holds until resumed |
| **Token budget gate** | Automatic at 50 000 tokens | Auto-inserts an approval record and pauses the run |
| **PR review gate** | Phase 5 of implementation workflow | Explicit human-approval step before any merge |
| **Approve / Resume** | Fleet Dashboard → Approve button on paused run | Resumes a paused run past an approval gate |
| **`workflow:watch` CLI** | `npm run workflow:watch -- <runId>` | Tails any live run in real time with stale detection |
| **Step output drawer** | Click any row in the Step Timeline | Full stdout / stderr / tokens per step |
| **Worktree isolation** | Automatic | Agent changes stay in `.worktrees/plan-xxx`; main checkout is never touched directly |

### Implementation Workflow Phases

1. **Phase 1 — Planning check** (condition step): verifies the work item exists and is ready
2. **Phase 2 — Create worktree + capture path** (command steps): creates `.worktrees/plan-xxx` and stores path in `contextJson.worktreePath`
3. **Phase 3 — Implement** (agent step): `claude -p` subprocess runs in the worktree; this is the long-running step
4. **Phase 4 — Guardrails** (parallel steps): lint, typecheck, tests
5. **Phase 5 — Commit + PR review** (commit step + approval gate): opens PR, then pauses for human approval

---

## Known Gaps Before First Run

### 1. Cancel does not kill the running subprocess

The Cancel API sets `status = cancelled` in the database immediately, but the `claude -p`
subprocess that is already executing keeps running until it finishes naturally or hits the
step `timeoutMs` (default 120 seconds). If Phase 3 is mid-execution when you cancel, the
agent can continue writing files and making commits for up to 2 minutes.

**Mitigation:** the default per-step timeout is 120 s, so the maximum drift is bounded.
After cancelling, wait ~2 minutes before inspecting the worktree.

### 2. Approve button is missing from the Run Detail page

The Fleet Dashboard has the Approve button for paused runs. The `WorkflowRunDetailPage`
(the per-run view) only shows Pause and Cancel. If a token budget gate fires while you are
watching the run detail page, you must navigate to the Fleet Dashboard to approve or cancel.

**Workaround:** keep the Fleet Dashboard open in a second tab while a run is active.

**Fix:** add an Approve button to `WorkflowRunDetailPage` when `run.status === "paused"`
and `run.pendingApprovalId` is set. ~20-line addition.

### 3. Worktree re-run collision

If a run fails after Phase 2, `.worktrees/plan-xxx` persists on disk. Starting a new run
against the same work item will fail at Phase 2 because `git worktree add` refuses to
create a worktree at a path that already exists.

**Workaround:** manually remove the stale worktree before retrying:
```bash
git worktree remove .worktrees/plan-xxx --force
```

**Fix:** make `phase-2-create-worktree` idempotent — skip creation if the worktree already
exists (add `--if-not-exists` flag to the `agent:worktree:create` script).

### 4. No resume from middle — failed runs restart from scratch

A failed run stays failed; it cannot be resumed from the step that failed. To retry, start a
completely new workflow run. Phase 1 and Phase 2 will execute again. If the worktree already
exists from the failed run, clean it up first (see gap 3).

### 5. Agent subprocess inherits full environment

`claude -p` is spawned with `process.env`, which includes any GitHub tokens, npm auth, or
other credentials present in the shell. Within the worktree directory the subprocess has no
filesystem sandbox — it could push branches, call external APIs, or install packages.

**Mitigation for first run:** test with a small, well-scoped work item; watch the run live
with `workflow:watch`; be prepared to cancel quickly.

---

## Pre-Flight Checklist

```bash
# 1. Pick a tiny, bounded work item
#    Ideal first candidate: a single-file change, e.g. "Fix lint errors in analytics-service.ts"
#    Avoid anything that touches shared packages, schema, or external services.

# 2. Open the Fleet Dashboard (approval gate UI)
npm run dev:audit:web

# 3. Open a watch terminal before starting the run
npm run workflow:watch -- <runId>
#    (get runId from .agent-session.json after workflow:start, or from the Fleet Dashboard)

# 4. Start the run
# Via UI: Fleet Dashboard → New Run → select "implementation" definition → enter work item ID
# Via CLI: npm run workflow:start implementation "PLAN-XXX: <summary>"
```

---

## Recovery Scenarios

| Scenario | What happens automatically | Your action |
|---|---|---|
| Agent writes bad code | Step completes or 120 s timeout fires → run proceeds or fails | Cancel in Fleet Dashboard; inspect worktree; `git worktree remove .worktrees/plan-xxx --force` to discard |
| Run hangs / subprocess stuck | Step timeout (120 s) fires; step recorded as failed; run → `failed` | Run is already dead; clean up worktree manually |
| Token budget gate fires | Run pauses; approval record created | **Fleet Dashboard** → review progress → Approve to continue or Cancel to abort |
| Phase 5 PR review gate | Run pauses; PR is open on GitHub | Review the PR normally; **Fleet Dashboard** → Approve to close the run |
| Something goes badly wrong | Cancel via UI | Wait up to 120 s for subprocess to die; then `git worktree remove .worktrees/plan-xxx --force` |
| Agent pushed to a branch unexpectedly | Worktree branch has commits on remote | Delete the remote branch: `git push origin --delete feature/plan-xxx` |

### Work Item State After Failure

The planning work item does **not** auto-reset when a run fails. It stays in its current
status in the backlog. To retry:

1. Manually set the work item back to `todo` (via plan CLI or UI).
2. Clean up the stale worktree: `git worktree remove .worktrees/plan-xxx --force`
3. Start a fresh workflow run.

The stale worktree branch persists with any partial commits — inspect it before deleting
to see how far the agent got.

---

## Future Capability Ideas (Not Needed For First Run)

These were identified as valuable before the first real run. Capture here so they are not lost.

### Resume / Restart With Feedback Injection
Allow a failed or cancelled run to be resumed from a specific step, with an optional feedback
string injected into `contextJson` before execution continues. Example use: agent hits a
blocker at Phase 3, human adds `contextJson.feedback = "Do not modify the schema file"`,
then resumes from Phase 3 with that context in scope.

**Rough design:**
- New endpoint: `PATCH /api/workflow/runs/:id/resume` with body `{ fromStepId, feedback? }`
- Sets run status back to `running`, sets `currentStep` to `fromStepId`, optionally merges
  feedback into `contextJson`
- Engine picks up and re-dispatches from that step

### Lead Agent — Delegator / Sub-Agent Question Bus
A top-level "lead" agent orchestrates sub-agents and can field questions from them during
execution. When a sub-agent is uncertain (e.g., "which file should I put this in?") it emits
a structured `question` event instead of guessing. The lead agent sees it, answers using its
broader context, and the sub-agent resumes.

**Rough design:**
- New `question` step type or event type in the engine
- Sub-agent writes `{ type: "question", stepId, text }` to stdout, executor catches it and
  emits a `step.waiting-for-answer` event
- Lead agent (or human fallback) receives it and POSTs an answer to resume
- Keeps decisions traceable in the audit log rather than buried in agent reasoning

### Explicit Input / Output Schema Per Node
Each workflow step should declare its expected `inputKeys` (from contextJson) and
`outputKeys` (what it will add to contextJson). This makes state transitions auditable:
before dispatching a step, the engine validates that all `inputKeys` are present, and after
it validates that all `outputKeys` were written. Any mismatch pauses for human review.

**Rough design:**
- Add `inputKeys?: string[]` and `outputKeys?: string[]` to `BaseStep` schema
- Engine validates before dispatch and after capture-stdout for command steps
- Agent steps validate the `outputSchema` Zod parse result populates the declared keys

---

## Recommended Pre-Run Fixes (Small, High Value)

These two items would make the first real test significantly safer and less manual:

### PLAN item A — Approve button on Run Detail page

Add an Approve button to `WorkflowRunDetailPage` that appears when
`run.status === "paused"` and the run has a pending approval ID. Currently you must
navigate to the Fleet Dashboard to unblock a paused run.

**Files:** `apps/workflow/web/src/app/pages/WorkflowRunDetailPage.tsx`,
`apps/workflow/web/src/app/api.ts`
**Effort:** ~30 lines

### PLAN item B — Idempotent worktree creation

Modify `phase-2-create-worktree` (or the `agent:worktree:create` script) to skip
creation when the worktree directory already exists. This makes retrying a failed
run safe without manual cleanup.

**Files:** `apps/workflow/api/src/definitions/implementation.workflow.ts`,
`tools/agent/worktree-create.ts`
**Effort:** ~10 lines

---

## Monitoring Commands

```bash
# Tail a live run (exits if stale for >10 min)
npm run workflow:watch -- <runId>

# See all active runs with heartbeat streams
npm run audit:progress

# Check the step-by-step audit trail after a run
cat artifacts/audit/YYYY-MM-DD/<runId>/events.ndjson | node -e "
  const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\n');
  lines.forEach(l => { const e = JSON.parse(l); console.log(e.eventType, e.payload); });
"

# Clean up a stale worktree after a failed run
git worktree remove .worktrees/plan-xxx --force
git push origin --delete feature/plan-xxx   # only if a branch was pushed
```
