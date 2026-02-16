# Codex Agent Skills Standard

Last updated: 2026-02-16

## Purpose
Establish a skills-first operating model for Codex in this repository so repeated workflows are deterministic, auditable, and low-friction.

## Source model
- Primary task system of record: `apps/backend/data/tasks/tasks.json`.
- Do not store active task plans in `documentation/tasks`.
- Treat runtime task and audit data as environment-local artifacts.

## Skill architecture (Codex-optimized)
- Keep reusable skills under `.agents/skills/<skill-name>/SKILL.md`.
- Use concise YAML frontmatter with `name` and `description` as the trigger surface.
- Keep SKILL bodies procedural and short; move large references to `references/`.
- Prefer deterministic command patterns over long natural-language instructions.
- Include explicit validation steps in each skill (read-back, status checks, API response checks).

## Trigger and scope rules
- Use a skill whenever the user request matches a repeated workflow (task CRUD, release checks, audits, documentation transforms).
- Keep one skill focused on one workflow boundary.
- Avoid overloading one skill with unrelated operations.

## Backend task skills baseline
- `backend-add-task`: create a task using `POST /tasks` and verify it appears in `GET /tasks`.
- `backend-update-task`: patch a task using `PATCH /tasks/:id` and verify status/fields via `GET /tasks/:id`.
- `backend-next-task`: claim next task from `ready` by highest priority with random tie-break; selected task moves to `planning`.
- `backend-transition-task-status`: move tasks between workflow statuses with explicit transition notes.
- `workflow-stage-artifact`: attach stage-specific evidence artifacts into task metadata.

## Reliability and safety requirements
- Read required inputs first (title, status, dependencies, due date, tags).
- Validate dependency IDs exist before submit.
- Fail fast on non-2xx responses and report exact HTTP status and endpoint.
- Never mutate or delete unrelated tasks while performing one task operation.

## Operational conventions
- Assume backend base URL is `http://localhost:3001` unless overridden.
- Make the base URL configurable via environment variable in commands.
- Log exact commands executed and summarize resulting task IDs/field changes.
- Use stage artifacts on every major handoff:
  `planningArtifact`, `reviewArtifact`, `verificationArtifact`, `awaitingHumanArtifact`.

## Iteration workflow
1. Start with one deterministic skill for one repeated operation.
2. Use it in real work.
3. Capture failure modes and edge cases.
4. Update SKILL instructions and add validation checks.
5. Repeat and keep the skill concise.

## Cross-platform alignment notes
- Anthropic Agent Skills and OpenAI Codex Skills both rely on concise triggers, progressive disclosure, and reusable procedural context.
- For Codex specifically, optimize for shell-executable steps, narrow scope, and minimal context bloat.
