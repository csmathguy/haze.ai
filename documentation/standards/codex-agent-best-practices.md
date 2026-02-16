# Codex and Agent Workflow Best Practices

Last updated: 2026-02-16

## Source-backed practices we are adopting

1. Keep tasks well scoped and issue-like.
Rationale: OpenAI recommends giving Codex work items scoped like practical engineering tasks and prompt structure similar to a GitHub issue.

2. Use `AGENTS.md` for persistent repo-specific instructions.
Rationale: OpenAI explicitly recommends `AGENTS.md` to capture conventions, dependencies, and operational context.

3. Prefer multi-agent workflows with explicit handoffs and typed boundaries.
Rationale: Agents SDK and Agent Builder guidance emphasizes workflows composed of specialized agents, tools, and typed connections.

4. Evaluate continuously, not only at release time.
Rationale: OpenAI evaluation guidance recommends eval-driven development and continuous evaluation using traces, datasets, graders, and eval runs.

5. Treat safety as a first-class engineering concern.
Rationale: OpenAI safety guidance for agents highlights prompt injection risk, structured outputs, tool approvals, guardrails, and human approval for risky operations.

6. Log traces and use them for regression detection.
Rationale: Trace grading is recommended for diagnosing where workflows fail and validating improvements over time.

7. Keep tool execution controlled and sandboxed.
Rationale: OpenAI local shell/tool docs emphasize strict control over what commands can run.

## Repository workflow policy
- All changes must follow TDD where practical: failing test -> implementation -> refactor -> verify.
- No task is complete unless `npm run verify` passes.
- Feature work must update task docs and acceptance criteria.
- High-risk tool actions require explicit approval and audit logs.

## OpenAI sources
- https://openai.com/business/guides-and-resources/how-openai-uses-codex/
- https://platform.openai.com/docs/guides/agents-sdk/
- https://platform.openai.com/docs/guides/agent-builder
- https://platform.openai.com/docs/guides/agent-builder-safety
- https://platform.openai.com/docs/guides/evaluation-best-practices
- https://platform.openai.com/docs/guides/agent-evals
- https://platform.openai.com/docs/guides/trace-grading
- https://platform.openai.com/docs/guides/tools-local-shell
- https://platform.openai.com/docs/docs-mcp
