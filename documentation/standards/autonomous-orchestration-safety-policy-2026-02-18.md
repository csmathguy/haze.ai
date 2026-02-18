# Autonomous Orchestration Safety Guardrails and Sandbox Policy (T-00110)

- Date: 2026-02-18
- Status: Draft
- Depends on:
  - `documentation/standards/autonomous-orchestration-adr-2026-02-18.md`
  - `documentation/standards/autonomous-orchestration-action-engine-2026-02-18.md`

## Purpose
Define v1 safety constraints for autonomous orchestration, including:
- command/tool approval policy
- sandbox execution model
- escalation and human override boundaries

## V1 Safety Principles
1. Deny-by-default:
- Autonomous actions execute only through explicit allowlisted commands/tools.
2. Least privilege:
- Sandbox mode and command scope should be the minimum needed for current stage action.
3. Explicit escalation:
- Any high-risk or out-of-policy action must transition to `awaiting_human`.
4. Full auditability:
- Every blocked, escalated, approved, and executed action must be traceable.

## Risk Classes
### Low risk
- Read-only repository inspection (`rg`, `git status`, metadata reads).
- Safe local validation commands already used in workflow (`npm run lint`, `npm run typecheck`, `npm run test` variants, `npm run build`).

### Medium risk
- Controlled file edits inside repository workspace.
- Branch-local git operations (`git add`, `git commit`, `git push` in task branch).

### High risk
- Destructive git or file operations (`git reset --hard`, broad file deletion).
- External network operations outside approved development workflow.
- Secrets/env mutation with security impact.
- Any command outside allowlist.

## Command and Tool Approval Policy
## Allowed by default (v1)
- `npm` subcommands required by repository verification
- `git` non-destructive branch/commit/push flow
- repository scripts under `scripts/`
- file search/read utilities (`rg`, `Get-Content`, `Select-String`)

## Conditionally allowed
- Actions requiring broader system/network effect only if:
  - action has explicit task acceptance alignment
  - action is represented in transition note
  - audit payload captures rationale

## Blocked by default
- Destructive git commands
- Arbitrary shell commands not in allowlist
- Any command touching paths outside workspace without explicit human approval

## Escalation Policy
Trigger escalation to `awaiting_human` when:
- requested action is high risk
- command/tool is not in allowlist
- policy confidence is low or classification is ambiguous
- retries exhausted for policy-relevant action

Escalation artifact requirements (`metadata.awaitingHumanArtifact`):
- concrete question
- 2-3 options with recommended default
- risk summary and requested decision

## Sandbox Model (v1)
### Runtime mode
- Primary runtime: Codex CLI wrapper in backend worker (from ADR).
- Execution defaults to workspace-scoped permissions and strict command/tool filtering.

### Sandbox boundaries
- Filesystem:
  - read/write only inside repository workspace
- Network:
  - allowed only for approved dev workflow operations (for example package/PR automation)
- Process:
  - short-lived command execution with timeout

### Timeouts and retries
- Command timeout defaults:
  - short ops: 30s
  - verification gates: repository defaults
- Transient failure retries:
  - bounded and recorded; no unbounded retry loops

## Enforcement Points
1. Pre-dispatch policy check:
- classify action by risk and allowlist membership.
2. Dispatch guard:
- reject blocked command/tool before execution.
3. Post-dispatch audit:
- record result, policy class, and decision path.
4. Transition guard:
- force `awaiting_human` on blocked/escalated paths.

## Audit Requirements
Each action record should include:
- task id and canonical task id
- stage/status context
- command/tool identifier
- policy decision (`allow`, `deny`, `escalate`)
- risk class
- actor and timestamp
- correlation ids linking to workflow runtime history

## Acceptance Criteria Mapping
1. Safety guardrails documented:
- Covered by principles, risk classes, enforcement points.
2. Tool approval policy documented:
- Covered by allow/conditional/block sections.
3. Sandbox model defined:
- Covered by runtime mode, boundaries, timeouts/retries.

## Follow-up Implementation Targets
- `T-00116`: enforce provider-level policy injection and tool/model constraints.
- `T-00101`: map hook triggers to policy gates and escalation redirects.
- `T-00113`: align recovery/resume rules with safety state and escalation outcomes.
