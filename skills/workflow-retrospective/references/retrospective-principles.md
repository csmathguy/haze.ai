# Retrospective Principles

## Use Evidence First

- Start from `summary.json`, `events.ndjson`, and the smallest set of logs needed to explain failures, retries, or long-running steps.
- Separate facts from interpretation. Phrase unsupported conclusions as inferences.
- Prefer patterns over isolated anecdotes, especially when a failure was recovered later in the same run.

## Keep It Blameless

- Describe system behavior, missing guardrails, sequencing mistakes, or unclear prompts instead of attributing fault to people.
- Focus on how the workflow can be made easier to repeat correctly.

## Answer The Core Questions

- What outcome did the run achieve?
- What helped the task move efficiently?
- What slowed it down or caused rework?
- Which blockers are recurring rather than one-off?
- What changes to tooling, docs, structure, or validation would have made the answer arrive sooner?
- Which future tasks or experiments does the retrospective justify?

## Make Improvement Actionable

- End with one to five actions, not a vague backlog.
- Give each action an owner and due date.
- Tie each action back to evidence from the audit trail or retrospective narrative.

## Good Signals To Look For

- repeated command failures before green validation
- long delays between workflow start and the first validating command
- reruns of the same guardrails after late feedback
- missing workflow notes during long stretches of work
- missing scripts or docs that forced manual reconstruction
- validation gaps that surfaced only at the end of the run
