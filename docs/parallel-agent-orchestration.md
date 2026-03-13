# Parallel Agent Orchestration

## Goal

Let multiple coding agents work on this repository at the same time without turning integration into a conflict-recovery exercise.

## External Patterns To Reuse

- Codex supports repo instructions, focused skills, and multi-agent delegation. Use those primitives instead of inventing a second orchestration layer.
- The `agents.md` pattern keeps instructions small and local. Put broad rules in the root file, then narrow context with closer `AGENTS.md` files and focused skills.
- Anthropic's subagent guidance matches the same operating model: design specialized agents, give them bounded responsibilities, and isolate parallel work with git worktrees.
- Git documents worktrees as linked working trees that share the same object database. That is the right primitive for parallel local slices because each agent gets its own checkout and branch.
- GitHub merge queues reduce integration breaks by validating changes against the latest target-branch state before merge. Use them when many slices land concurrently.

## Repo Operating Model

1. Ensure the work belongs to a planning project. Create the project first when no suitable project exists yet.
2. Create or refine the planning work item before code work starts.
3. Create one orchestration slice for planning and contract decisions.
4. Split implementation into small branches with one owned boundary each.
5. Give each slice its own worktree under `.worktrees/<task-id>`.
6. Put a local brief in `.codex-local/parallel-task.md` inside that worktree.
7. Do the implementation inside that dedicated worktree, not in the shared checkout.
8. As the slice starts, update the planning item with owner, workflow ID, and `in-progress` status.
9. Merge contract-first slices before downstream API or web slices.
10. Re-run validation in each worktree before handoff.

The helper command for step 3 is:

```bash
npm run agent:worktree:create -- --task review-web-threading --summary "Thread review data into web UI" --scope apps/web/src/features/review --depends-on shared-review-contract
```

## Slice Design Rules

- Prefer one primary boundary per slice: `apps/api`, `apps/web`, `packages/shared`, `tools`, `docs`, or `prisma`.
- Treat `packages/shared`, `prisma/schema.prisma`, and root config files as contract-first work. Those slices should land before consumer slices.
- Avoid slices that edit both `apps/api` and `apps/web` unless the same agent owns a narrow typed handoff end to end.
- Prefer additive changes over broad rewrites: new files, adapters, routes, or feature folders conflict less than sweeping edits to shared files.
- Keep validation aligned with the owned surface. The worktree helper derives default guardrails, but the orchestrator can add stricter checks per slice.

## Conflict Management

- Use worktrees, not multiple agents in the same checkout.
- Reserve shared seams explicitly: Prisma schema, shared package exports, root config, and major docs.
- If several slices need the same seam, create a dedicated seam-owner slice first and make the others depend on it.
- Rebase or merge from contract-first slices before touching their consumers.
- Keep PRs or merge units small and linear when possible. If several slices are intentionally dependent, stack them instead of flattening them into one large branch.

## GitHub Integration

- Enable branch protection or rulesets that require the `quality` check.
- Turn on merge queue when parallel branch traffic is high enough that "update branch" churn becomes a bottleneck.
- Prefer stacked pull requests for dependent slices and separate pull requests for independent slices.

## Agent Roles

- `parallel-work-orchestrator`
  - plans slices, reserves shared seams, and creates worktrees
- `parallel-work-implementer`
  - executes one scoped slice inside its assigned worktree
- `workflow-audit`
  - records the audited command trail for substantial implementation work

## Recommended Sequence

1. Use `$planning-workflow` to create or refine the work item first.
2. Use `$parallel-work-orchestrator`.
3. Create the contract-first slices first.
4. Start one worktree per implementation slice.
5. Use `$planning-execution` and `$parallel-work-implementer` inside each worktree.
6. Update status as work starts, blocks, or finishes instead of leaving progress in chat only.
7. Run `npm run quality:changed -- <files...>` during iteration or `npm run quality:logged -- implementation` before integration.
