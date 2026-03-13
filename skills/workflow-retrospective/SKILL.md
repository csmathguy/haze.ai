---
name: workflow-retrospective
description: Use this skill when asked to write a retrospective, postmortem, workflow debrief, or improvement review for work in this repository. Apply it when an agent should inspect audit artifacts, identify what went well, what went poorly, recurring blockers, and concrete follow-up actions, then write the result under artifacts/retrospectives.
---

# Workflow Retrospective

## Overview

Use this skill to turn a completed workflow run into an evidence-backed retrospective artifact. Ground observations in `artifacts/audit/`, keep the tone blameless, and finish with concrete follow-up actions.

## Workflow

1. Identify the completed audit `runId` to review.
2. Generate the retrospective scaffold with `npm run workflow:retro -- <run-id>`.
3. Read `references/retrospective-principles.md`.
4. Review the generated artifact, `summary.json`, `events.ndjson`, and only the logs needed to explain failed or slow steps.
5. Replace placeholder bullets with concise findings about wins, misses, recurring impediments, and improvements that would have shortened time-to-answer.
6. Add one to five follow-up actions with clear owners, due dates, and evidence.

## Key Rules

- Keep the retrospective blameless. Critique workflow design, tooling, sequencing, and missing context rather than people.
- Use audit evidence before intuition. If the logs do not support a claim, label it as an inference.
- Do not copy sensitive document contents, account numbers, addresses, or other raw tax data into the retrospective.
- Prefer a small number of concrete actions over a long wish list.
- If the same blocker appears across multiple runs, call it out as a recurring theme and propose a structural fix.

## Pull More Context

- Read `docs/agent-observability.md` when you need the audit file layout or command wrappers.
- Read `references/retrospective-principles.md` when deciding how to frame findings and actions.
