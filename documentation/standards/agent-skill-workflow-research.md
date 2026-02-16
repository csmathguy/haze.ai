# Agent Skill Workflow Research Notes

Last updated: 2026-02-16

## Objective
Define a deterministic task-delivery workflow built from Codex skills and supporting scripts.

## Key findings (online research)
1. Anthropic Agent Skills are self-contained capability bundles in folders with a required `SKILL.md` and optional scripts/resources. This supports modular "sub-skill" composition for lifecycle steps.
Source: https://docs.anthropic.com/en/docs/agents-and-tools/agent-skills/overview

2. OpenAI Codex supports project-scoped skills under `.agents/skills` and instruction layering through `AGENTS.md`, enabling repo-local workflow enforcement.
Source: https://developers.openai.com/codex/skills

3. OpenAI Codex instruction hierarchy explicitly supports AGENTS.md at repo and subdirectory levels, which is suitable for enforcing stage gates and verification policy.
Source: https://developers.openai.com/codex/agents

4. GitHub CLI supports deterministic, non-interactive PR creation (`gh pr create --base --head --title --body-file/--fill`), which can be scripted for repeatable handoff.
Source: https://cli.github.com/manual/gh_pr_create

## Recommended codebase setup
- Keep lifecycle orchestration in one master skill (`workflow-task-lifecycle`).
- Keep each stage action as a focused sub-skill:
  - start/planning,
  - awaiting-human,
  - verify+commit+PR,
  - status transitions,
  - artifact attachment.
- Use helper scripts for deterministic operations:
  - canonical id suggestion (`scripts/next-task-id.ps1`),
  - verify+PR creation (`scripts/create-pr.ps1`).
- Keep stage artifacts in task metadata until first-class fields are introduced.

## Pending implementation tasks
- Backend-native canonical id generation (`T-#####`).
- First-class `agentPlan` field in task schema/API.
- Task detail view with questionnaire thread and human response controls.
- Drag-and-drop lane transitions with validation.
- Architecting status introduction.
