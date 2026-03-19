# Model Selection Strategy

## Scope

This document covers model tier selection for agents working in this repository. The strategy applies to Claude Code (Anthropic CLI), Codex CLI, and any future multi-agent frameworks. Decisions as of March 15, 2026.

## The 4-Tier Model System

The tiering system balances capability with cost. Each tier has a recommended Anthropic model and OpenAI equivalent.

| Tier | Anthropic Model | OpenAI Model | Input Cost | Output Cost | Best For |
|------|-----------------|--------------|-----------|------------|----------|
| **T0** | Ollama/local | (local) | free | free | *Not yet working* — future: deterministic tasks, no external deps |
| **T1** | `claude-haiku-4-5-20251001` | `gpt-4o-mini` | $1/M tokens | $5/M tokens | File search, triage, research, summarization, read-only knowledge ops |
| **T2** | `claude-sonnet-4-6` | `gpt-4o` | $3/M tokens | $15/M tokens | Code review, code changes, design reasoning, implementation, structured generation |
| **T3** | `claude-opus-4-6` | `gpt-4` | $5/M tokens | $25/M tokens | Orchestration, architecture decisions, complex multi-step reasoning, work decomposition |

Cost reference: Anthropic pricing as of 2026-03-15. OpenAI pricing varies; see their current docs.

## Task-Type Routing Table

Route tasks to the cheapest tier that can succeed. If a task fails twice at a tier, escalate to the next tier up.

### Tier 1 (Haiku/gpt-4o-mini) — Read-Only, Deterministic, Summarization

Use T1 for tasks where the agent reads existing information, applies simple logic, and produces summaries or structured output without complex reasoning.

- **File search and pattern matching**: Find files by name or content pattern, extract line numbers and surrounding context
- **Research and web fetch**: Summarize web pages, extract facts from articles, verify recency of docs
- **Knowledge store operations**: Read or write flat knowledge entries, update local memory without reasoning
- **Audit logging**: Write structured events, record decisions, produce formatted logs
- **Startup commands**: Execute deterministic environment commands, report health endpoints
- **Simple triage**: Classify an issue into buckets, assign to a work item category
- **Testing and linting output**: Parse test failures or lint reports, format for a review summary

**Subagent recommendation**: Use `CLAUDE_CODE_SUBAGENT_MODEL=claude-haiku-4-5-20251001` when delegating these tasks to keep costs low.

### Tier 2 (Sonnet/gpt-4o) — Reasoning, Code Changes, Design

Use T2 for tasks requiring moderate architectural reasoning, code modification, design tradeoffs, or structured generation.

- **Code review**: Assess a diff for architecture, privacy, and quality concerns; this tier handles complex reasoning about design patterns
- **Implementation work**: Write new features, refactor code, add tests; Sonnet handles real-time reasoning about edge cases
- **UI/UX design**: Layout decisions, form accessibility, charting choices, MUI theming; T2 can reason through design tradeoffs
- **Documentation writing**: Create tutorials, how-to guides, or architecture explanations with narrative flow
- **Planning decomposition**: Break a feature into work items, define acceptance criteria, sequence steps
- **Visualization**: Choose diagram types, reason through visual hierarchy, produce Mermaid or Graphviz
- **Workflow retrospectives**: Analyze audit logs, synthesize findings, propose improvements

**Subagent recommendation**: T2 is the default for substantial work. Reserve this tier for tasks that need real reasoning.

### Tier 3 (Opus/gpt-4 or Opus-preview) — Complex Orchestration

Use T3 for tasks requiring deep multi-step reasoning, complex tradeoff analysis, or orchestrating multiple agents.

- **Parallel work orchestration**: Decompose a large feature into slices, plan seam ownership, order dependencies, avoid merge conflicts
- **Major architecture decisions**: Evaluate multiple design approaches, assess trade-offs, set long-term direction
- **Complex multi-agent workflows**: Route work across agents, detect blockers, replan if assumptions break
- **Research with synthesis**: Compare multiple contradicting sources, resolve ambiguity, make recommendations with caveats
- **High-stakes reviews**: Approve major refactors or security changes where missing a detail has high cost

**Subagent recommendation**: Reserve Opus for tasks where the reasoning complexity justifies the 2-3x cost over Sonnet.

## Escalation Policy

1. Start with the recommended tier for the task type.
2. If the task **fails once**, retry within the same tier (the failure might be transient).
3. If the task **fails twice**, escalate to the next tier up.
4. If a task requires context beyond the model's window, use `/compact` in Claude Code to reduce context size before retrying at the same tier.
5. If a task succeeds at a higher tier than recommended, record the success and consider whether the task type recommendation should shift.

**Example**: A code review attempt at T2 fails to catch a subtle pattern. Retry at T2 with a focused prompt. If it fails again, escalate to T3.

## CLI Routing

### Claude Code (Anthropic)

Claude Code's skill system supports model selection through environment variables and skill-level annotations:

- **Subagent tasks**: Set `CLAUDE_CODE_SUBAGENT_MODEL` to route subagent work to a cheaper tier:
  ```bash
  CLAUDE_CODE_SUBAGENT_MODEL=claude-haiku-4-5-20251001 claude
  ```
- **Main agent task**: Claude Code uses the user's specified model (or account default). For local cost control, agents can explicitly invoke cheaper subagents for exploration.
- **Skill annotations**: Each skill in `skills/*/SKILL.md` has a comment near the top describing its recommended tier. See the skill for task-specific guidance.

### Codex CLI (OpenAI)

Codex CLI uses OpenAI models and has similar environment variable support. Codex will eventually support Tier 0 (local models) through Ollama integration.

#### Codex Agent Profile Mapping

Codex uses custom agent profiles stored in `.codex/agents/*.toml` to provide feature parity with Claude Code subagents. Each profile declares model choice, reasoning effort, and sandbox mode:

| Agent Profile | Role | Model | Tier | Task Type |
|---------------|------|-------|------|-----------|
| **explorer.toml** | Read-only codebase search | gpt-4o-mini | T1 | File pattern matching, triage, understanding file structure |
| **reviewer.toml** | Code review, diff analysis | gpt-4o-mini | T2 | Architecture checks, privacy validation, quality gates, PR readiness |
| **research.toml** | External research, citations | gpt-4o-mini | T1 | Web fetch, source summarization, dated citations, tax law verification |
| **implementer.toml** | Code changes and refactors | gpt-4o | T2 | Feature implementation, test-driven development, module design |

**Configuration location**: `.codex/config.toml` at the repository root. Global settings for max_threads (4), max_depth (3), default model (gpt-4o-mini), and sandbox rules apply to all profiles unless overridden.

**Usage**: Invoke Codex agents using the `--agent` flag or let Codex auto-select based on task type. Each profile includes examples and constraints in the TOML frontmatter.

### Choosing Between CLIs

- Use **Claude Code** when you want the maximum capability for complex reasoning (access to Opus).
- Use **Codex CLI** when you need OpenAI's set of models or when you have a local setup preference.
- Both CLIs respect the same skill structure and AGENTS.md instructions.

## Context Minimization Principle

Tier cost scales with both model price and context length. To use cheaper tiers effectively, pass only the minimal context needed.

### Tier 1 (Haiku) Context Expectations

- 1–2 specific files or code snippets (under 2KB)
- One focused question or search pattern
- Existing reference docs that the task depends on
- Do not pass: large codebases, multi-file diffs, complex architectural context

### Tier 2 (Sonnet) Context Expectations

- Full context for a bounded feature or package (up to 50KB)
- Related diffs, test files, and architecture docs
- Prior conversation history needed to understand the task
- Can digest multi-file changes and moderate tradeoff discussions

### Tier 3 (Opus) Context Expectations

- Entire repository context if needed (can safely handle 100KB+)
- Full audit trails, retrospective artifacts, and prior workflow data
- Permission to reason across multiple work items and long-term decisions

## Integration with the Skill System

Each skill in `skills/*/SKILL.md` declares its recommended tier as a comment in the body:

```markdown
---
name: research-agent
---

<!-- Recommended model tier: T1 (Haiku) — read-only research, web fetch, summarization -->

# Research Agent
...
```

When invoking a skill:

1. Read the tier comment to understand the cost-benefit.
2. If you have context beyond what that tier usually handles, consider escalating.
3. If the task fails at the recommended tier, follow the escalation policy.

Skills are designed to work within their recommended tier when given appropriately scoped tasks. Do not default to T3 just because it is "more capable" — the point of tiering is to match capability to cost.

## Example Workflows

### Task: Fix a bug with code changes

1. Start: use `implementation-workflow` skill (T2 recommended).
2. Read: the closest `docs/` file (use T1 subagent if context is large).
3. Implement: keep the scope tight so T2 can reason through test-driven changes.
4. Review: if the diff is complex, escalate review to T3 (parallel architecture questions).

### Task: Plan a large feature across multiple agents

1. Start: use `planning-workflow` skill (T2 recommended).
2. Orchestrate: if decomposition is non-obvious, escalate to `parallel-work-orchestrator` (T3 recommended).
3. Execute: each implementer uses `parallel-work-implementer` inside its worktree (T2 for implementation, T1 for status updates).

### Task: Research a tax law change and decide on implementation

1. Start: use `research-agent` skill (T1 recommended).
2. Fetch and summarize external sources (T1 can do this).
3. If contradictions arise or judgment calls are needed, escalate to T3 to synthesize and decide.
4. Write the implementation plan (T2).

## Monitoring and Iteration

The tier system is not static. When you notice patterns like:

- "T1 always fails for X task type" → the task type should move to T2
- "T3 always succeeds for Y task type, T2 rarely does" → consider moving Y to T3
- "A T2 task consistently costs less than expected" → consider if the task is truly T2 or if T1 with better prompting would work

Record these observations in the knowledge base or planning backlog so the system improves over time.
