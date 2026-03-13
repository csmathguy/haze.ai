# Execution Lifecycle

Use this as the ordered workflow for agent-driven implementation work in this repository.

## Required Sequence

1. Create or refine the planning work item first.
   - The item should have a title, summary, project, status, acceptance criteria, and implementation tasks.
   - Leave it in `planning` while the scope is still being shaped.
   - Move it to `ready` only when another agent could start without needing missing context from chat.

2. Create a dedicated worktree before implementation starts.
   - Use one worktree per owned slice or work item.
   - Prefer `npm run agent:worktree:create -- ...` when the work is part of a parallel effort.
   - Do not let several agents implement unrelated work in the same checkout.

3. Start the audited implementation workflow inside that worktree.

```bash
node tools/runtime/run-npm.cjs run workflow:start implementation "<summary>"
```

4. Immediately update the planning item when active execution begins.
   - Set `owner` to the current agent.
   - Store the active implementation workflow run ID.
   - Set status to `in-progress`.

5. Keep the planning record current while the work is happening.
   - Add newly discovered tasks or acceptance criteria instead of keeping them only in notes.
   - Update task and criterion statuses as work is completed or verified.
   - Move the item to `blocked` as soon as a real blocker exists.
   - Create a separate follow-up item when new work does not belong in the current scope.

6. Publish branch-ready work before calling the workflow complete.
   - Commit in atomic steps.
   - Push the branch and create or update the PR.
   - Do not merge the PR from an agent workflow.

7. Finish in a truthful end state.
   - `done` when the implementation and validation are complete and the PR is up.
   - `blocked` when progress stopped on an external dependency.
   - `planning` when the scope changed enough that the item needs reshaping.

## Status Expectations

- `backlog`: not yet shaped enough for active planning
- `planning`: being decomposed, researched, or re-scoped
- `ready`: scoped well enough to pull into execution
- `in-progress`: an agent is actively working the item in a worktree
- `blocked`: active work cannot continue truthfully
- `done`: implementation and validation are complete for the current slice

## Why This Exists

This sequence keeps planning, execution, worktree isolation, and audit linkage synchronized. The goal is to prevent hidden work, stale status, and multi-agent collisions caused by implementing from chat or memory alone.
