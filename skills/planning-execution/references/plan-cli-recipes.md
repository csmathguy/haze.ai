# Plan CLI Recipes

Use these commands from the repo root. They operate directly against the planning database in the user profile, so they work across worktrees without starting the API server.

## Read The Workspace

```bash
npm run plan:cli -- workspace get
```

## Get The Next Actionable Item

Across all projects:

```bash
npm run plan:cli -- work-item next
```

Within one project:

```bash
npm run plan:cli -- work-item next --project-key planning
```

## Update A Work Item

Example payload:

```json
{
  "status": "in-progress",
  "owner": "codex",
  "auditWorkflowRunId": "2026-03-13T000000-000-implementation-example",
  "taskAdditions": [
    "Document the migration impact"
  ],
  "acceptanceCriteriaAdditions": [
    "Existing planning data migrates safely"
  ]
}
```

Command:

```bash
npm run plan:cli -- work-item update --id PLAN-12 --json-file .tmp/planning-update.json
```

## Update Task And Criterion State

```bash
npm run plan:cli -- task set-status --work-item-id PLAN-12 --task-id <task-id> --status done
npm run plan:cli -- criterion set-status --work-item-id PLAN-12 --criterion-id <criterion-id> --status passed
```

## Seed The MVP Backlog

```bash
npm run plan:seed:mvp
```

This seeds the first planning-focused future work, including Kanban, claim or lease workflow, and audit linkage follow-ups.
