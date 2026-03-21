# Memory Architecture Brief

## Purpose

Define the memory contract for agents in this repository so they can:

- retain stable user and household preferences over time
- keep task state small and token-efficient
- preserve historical auditability without loading stale context by default
- support multiple agent roles with different default memory bundles

## Design Goals

- improve software decisions through reusable project memory
- improve user alignment through durable preferences and values
- keep the default context small
- keep memory changes auditable and reviewable
- support human review for conflicts and sensitive updates

## Memory Tiers

### Short-Term

Use for live workflow state only.

Examples:

- current branch or worktree state
- current task and plan step
- latest validation results
- active instructions for the current workflow

Rules:

- expires or compacts automatically
- should not be treated as durable memory
- may be preserved in audit history after the fact

### Medium-Term

Use for knowledge that is likely to be reused soon.

Examples:

- project research and recent decisions
- recurring software preferences
- recently reactivated archived memories
- workflow retrospectives

Rules:

- searchable and updateable
- scoped by project, user, household, and agent role
- can be promoted from archive when repeated references justify it

### Long-Term

Use for stable identity and preference memory.

Examples:

- values and principles
- communication style
- software-building preferences
- household roles and family preferences

Rules:

- durable and privacy-sensitive
- requires provenance and review metadata
- changes should be explicit and visible

### Archive

Use for historical reference and low-value detail.

Examples:

- old branch/worktree states
- outdated task context
- historical research that is no longer active

Rules:

- keep searchable
- do not load by default
- can be reactivated if repeatedly referenced

## Agent Default Bundles

### Main Orchestrator

Load by default:

- values and principles
- communication style
- team coordination knowledge
- workflow initiation and handoff rules
- current high-level project priorities

### Coding Agent

Load by default:

- software stack preferences
- repository conventions
- relevant project memory
- current task scope

### Memory Agent

Load by default:

- memory workflow rules
- metadata schema
- promotion and conflict rules
- review queue state

### Other Specialists

Load only the memories needed for the task.

## Metadata Requirements

Each memory record should capture:

- namespace
- tier
- source type
- provenance or source reference
- confidence
- review state
- actor or agent attribution
- created and updated timestamps
- reactivation history

## Write Workflow

1. Agent identifies a memory opportunity.
2. Memory agent or workflow classifies the item.
3. The system assigns tier and metadata.
4. The memory is written or updated.
5. Conflicts or sensitive items enter review.
6. Repeated references can promote archive to medium-term.

## Retrieval Workflow

1. Identify agent role and current task.
2. Load the smallest useful default bundle.
3. Expand only when the task needs more context.
4. Prefer metadata filters plus association-based search.
5. Avoid loading full history when a compact summary is enough.

## Open Questions

- exact promotion thresholds for archive-to-medium-term
- when human review is mandatory versus optional
- how many memories should be shared across agent roles by default
- how to represent relationship links visually in the UI

