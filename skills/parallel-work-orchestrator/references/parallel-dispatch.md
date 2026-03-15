# Parallel Dispatch Reference

## When to Use Parallel Dispatch

Use parallel dispatch when you have two or more work items that:
1. Are in `ready` or `backlog` status in the planning system
2. Have no blocking dependency on each other (`blockedByWorkItemIds` does not include the other)
3. Do not share file ownership (each touches a distinct area of the codebase)

Single sequential dispatch is still correct when:
- One slice adds a shared type that another consumes
- Merge conflicts are likely between slices
- The task is small enough that parallel overhead is not worth it

## Step-by-Step Parallel Dispatch

### Step 1: Create all worktrees (serial)

Worktree creation must be serial since it modifies the git state:

```bash
npm run agent:worktree:create -- --task PLAN-AA --summary "..." --scope tools/
npm run agent:worktree:create -- --task PLAN-BB --summary "..." --scope skills/
```

### Step 2: Update planning status

Mark each work item `in-progress` before dispatching agents:

```bash
node ./node_modules/tsx/dist/cli.mjs tools/planning/plan-cli.ts work-item update \
  --id PLAN-AA --json-file <(echo '{"status":"in-progress"}')
```

### Step 3: Dispatch all implementers in one message (parallel)

In a single Claude Code response, include multiple Agent tool calls — one per slice. Claude Code runs them simultaneously.

Each agent task prompt should include:
- Worktree path to `cd` into
- Work item ID and title
- Exact scope (files and directories the agent may edit)
- `workflow:start`, validation, commit, `pr:sync`, `workflow:end` steps
- Reminder: do NOT merge the PR

### Step 4: Wait for all agents to complete

Claude Code waits for all background agents before proceeding. You will be notified when each completes.

### Step 5: Aggregate results

After all agents report back:
1. List all PR URLs
2. Note any agents that failed or are blocked
3. Update planning status accordingly (`done` for PRs opened, `blocked` for failures)

## Overlap Detection Heuristic

Before dispatching in parallel, verify each slice's scope does not overlap:

- Check `--scope` flags: `tools/agent/` and `tools/planning/` are disjoint
- Check `blockedByWorkItemIds` in each work item's plan
- Check if any slice touches `packages/shared/` or `prisma/schema.prisma` — if so, it is contract-first and must go first sequentially

If overlap is detected, either:
- Merge the two slices into one
- Make one wait for the other (serial dispatch)

## Limitations

- Subagents cannot spawn other subagents — only the main orchestrating thread can dispatch parallel agents
- Each parallel agent works in its own isolated worktree but shares `node_modules` via junction — avoid concurrent `prisma:generate` or `npm install` calls
- Background agents writing to the same audit database (`artifacts/audit/`) is safe because the active-runs registry uses file locking
