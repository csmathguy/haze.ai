# Autonomous Orchestration Research (2026-02-18)

## Scope
Evaluate viable implementation paths for autonomous task orchestration in this repository:
- Codex CLI orchestration
- Codex SDK orchestration
- OpenAI API orchestration (Responses + tools + optional Agents SDK)

## Source-backed findings
1. Codex CLI supports non-interactive automation with machine-readable event output.
   - `codex exec --json` emits JSONL events (`thread.started`, `turn.*`, `item.*`, `error`).
   - Supports least-privilege automation modes and explicit sandbox settings.
   - Supports output schema shaping and resume flows.
2. Codex SDK exists as a TypeScript server-side library.
   - Installable via `npm install @openai/codex-sdk`.
   - Supports thread lifecycle control and repeated `run()` calls for continuity.
3. OpenAI API supports shell tool execution and background mode.
   - Shell tool can run in hosted containers or local runtime.
   - Background mode supports async execution with polling semantics.
4. Agents SDK guidance explicitly targets agentic applications with tools, specialization, and tracing.
5. Codex guidance supports layered instruction files and reusable skills:
   - `AGENTS.md` instruction layering.
   - skill folders with `SKILL.md`.

## Option comparison
### Option A: Codex CLI-first worker orchestration
- Best for: fastest pilot and low integration overhead.
- Strengths:
  - Immediate non-interactive execution (`codex exec`).
  - JSONL events are script-friendly.
  - Aligns with current script-heavy workflow.
- Risks:
  - Process orchestration complexity (retry/resume/state persistence).
  - Strict credential + sandbox governance required.

### Option B: Codex SDK orchestration in backend worker
- Best for: more structured runtime control after pilot.
- Strengths:
  - Programmatic thread control in TypeScript.
  - Better embedding into backend orchestration services.
- Risks:
  - More implementation effort than CLI wrapper.
  - Requires abstraction to avoid lock-in.

### Option C: OpenAI API-native orchestration (Responses + tools + optional Agents SDK)
- Best for: long-term production architecture.
- Strengths:
  - Native tool ecosystem (shell, MCP, background mode, tracing/evals).
  - Strong path for observability and durable async workflows.
- Risks:
  - Highest initial architecture effort.
  - Requires explicit contracts for stage handoffs and safety gates.

## Recommendation
Adopt a phased hybrid strategy:
1. Pilot autonomy with Codex CLI wrapper and strict guardrails.
2. Finalize contracts, triggers, safety policy, and observability.
3. Migrate core execution layer toward API-native orchestration once reliability checkpoints pass.

## Approved decisions (locked)
- Phase-1 runtime: Codex CLI wrapper in backend worker.
- Initial worker topology: in-process backend worker.
- Human-in-loop gates for v1: planning clarification and pre-merge review only.
- Autonomy scope for v1: planner, architect, tester (developer/reviewer/retro automation follows in later phases).
- Safety policy for v1: strict command/tool allow-list with explicit escalation on risky actions.
- Concurrency for v1: single-task serial execution.
- Modularity principle: all runtime/model/provider integrations must be behind a stable abstraction layer to allow future API-native and multi-provider plug-and-play without workflow rewrites.

## Planned execution order (dependency-informed)
1. `T-00097` Research Codex CLI/SDK/API options
2. `T-00098` ADR for runtime/model stack
3. `T-00099` Multi-agent role contracts + artifact schema
4. `T-00100` Orchestrator action engine semantics
5. `T-00110` Safety guardrails and sandbox policy
6. `T-00101` Hook-to-trigger mapping and guardrails
7. `T-00109` Agent communication and context packaging
8. `T-00116` Invocation abstraction layer
9. `T-00102` Planner design
10. `T-00103` Architect-review design
11. `T-00104` Tester design
12. `T-00111` Observability design
13. `T-00113` Checkpoint/recovery design
14. `T-00115` Worker skeleton implementation
15. `T-00123` Hook dispatcher implementation
16. `T-00117` Planner implementation
17. `T-00118` Architect implementation
18. `T-00119` Tester implementation
19. `T-00105` Developer-agent design
20. `T-00120` Developer implementation
21. `T-00106` Review-agent design
22. `T-00121` Review implementation
23. `T-00107` Human checkpoint UX design
24. `T-00124` Operator command center implementation
25. `T-00108` Retrospective-agent design
26. `T-00122` Retrospective implementation
27. `T-00112` Evaluation harness design
28. `T-00114` Rollout plan and autonomy levels

## References
- https://developers.openai.com/codex/noninteractive
- https://developers.openai.com/codex/sdk
- https://developers.openai.com/codex/guides/agents-md
- https://developers.openai.com/codex/skills
- https://developers.openai.com/api/docs/guides/tools-shell
- https://developers.openai.com/api/docs/guides/background
- https://developers.openai.com/api/docs/guides/agents-sdk
