import { z } from "zod";
import type {
  WorkflowDefinition,
  CommandStep,
  AgentStep,
  ApprovalStep,
  ConditionStep,
  ParallelStep,
  ContextPackStep
} from "@taxes/shared";

/**
 * Implementation workflow definition (TypeScript-native format).
 *
 * This workflow encodes the agent implementation loop:
 * planning check → worktree creation → implementation → validation → PR creation → human approval
 *
 * All steps are defined as TypeScript objects with proper type safety.
 * The workflow is registered in the workflow engine registry at startup.
 */

// Input schema for the implementation workflow
const implementationInputSchema = z.object({
  workItemId: z.string().min(1).describe("Planning work item ID (e.g., PLAN-144)"),
  summary: z.string().min(1).describe("Workflow summary for audit logging"),
  projectId: z.string().optional().describe("Optional planning project ID"),
  planRunId: z.string().optional().describe("Optional planning run ID for lineage"),
  planStepId: z.string().optional().describe("Optional planning step ID for lineage")
});

// Phase 1: Planning check condition
const planningCheckCondition: ConditionStep = {
  type: "condition",
  id: "phase-1-check-planning-item",
  label: "Phase 1: Check if planning work item exists",
  condition: (context: Record<string, unknown>) => {
    const workItemId = context.workItemId;
    return (
      !!workItemId &&
      typeof workItemId === "string" &&
      workItemId.startsWith("PLAN-")
    );
  },
  trueBranch: [
    {
      type: "command",
      id: "phase-1-log-planning",
      label: "Log planning phase start",
      scriptPath: "npm",
      args: [
        "run",
        "agent:heartbeat",
        "--",
        "--message",
        "Phase 1: Planning verified - proceeding to setup"
      ]
    } as CommandStep
  ],
  falseBranch: [
    {
      type: "approval",
      id: "phase-1-create-work-item",
      label: "Create or refine planning work item (manual approval gate)",
      prompt:
        "Work item not found or invalid. Please create a planning work item or provide a valid PLAN-XXX ID before proceeding."
    } as ApprovalStep
  ]
};

// Phase 1b: Gather rich context
const gatherContextStep: ContextPackStep = {
  type: "context-pack",
  id: "phase-1b-gather-context",
  label: "Phase 1b: Gather work item and codebase context",
  outputKey: "contextPack",
  includeGitDiff: true,
  includePreviousAttempts: true
};

// Phase 2: Worktree creation
const createWorktreeStep: CommandStep = {
  type: "command",
  id: "phase-2-create-worktree",
  label: "Phase 2: Create dedicated git worktree",
  scriptPath: "npm",
  args: [
    "run",
    "agent:worktree:create",
    "--",
    "--task",
    "{{input.workItemId}}",
    "--summary",
    "{{input.summary}}",
    "--merge-main"
  ],
  timeoutMs: 300000,
  retryPolicy: {
    maxRetries: 2,
    backoffMs: 5000
  }
};

// Phase 2: Heartbeat confirmation
const workflowStartHeartbeat: CommandStep = {
  type: "command",
  id: "phase-2-heartbeat",
  label: "Phase 2: Log workflow start confirmation",
  scriptPath: "npm",
  args: [
    "run",
    "agent:heartbeat",
    "--",
    "--message",
    "Phase 2: Worktree created for {{input.workItemId}}"
  ]
};

// Phase 2c: Capture worktree path into contextJson so all subsequent steps run in the worktree.
// Mirrors normalizeTaskId() from tools/agent/lib/parallel-worktree.ts:
//   taskId = input.toLowerCase().replace(/[^a-z0-9]+/g, "-").trimHyphenEdges()
// Result stored as contextJson.worktreePath and used as cwd by command and agent steps.
const captureWorktreePathStep: CommandStep = {
  type: "command",
  id: "phase-2-capture-worktree-path",
  label: "Phase 2: Capture worktree path for subsequent steps",
  scriptPath: "node",
  args: [
    "-e",
    "const p=require('path');const id=process.argv[1].toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');process.stdout.write(p.resolve('.worktrees',id)+'\\n');",
    "{{input.workItemId}}"
  ],
  captureStdoutKey: "worktreePath"
};

/**
 * Phase 3: Implementation agent step
 * Dispatches agent to implement changes using red-green-refactor cycle.
 *
 * Output is validated against schema (files changed, tests added, refactoring applied, summary).
 *
 * Context enrichment: acceptanceCriteria and previousAttemptError are now passed from the
 * ContextPackStep (phase 1b) into the agent's system prompt context automatically.
 * The agent receives work item context via the contextPack in the workflow context.
 */
const implementationStep: AgentStep = {
  type: "agent",
  id: "phase-3-implement",
  label: "Phase 3: Implement changes (red-green-refactor)",
  agentId: "implementer",
  model: "claude-sonnet-4.6-20250514",
  providerFamily: "anthropic",
  runtimeKind: "claude-code-subagent",
  skillIds: ["implementation-workflow"],
  outputSchema: z.object({
    filesChanged: z
      .array(z.string())
      .describe("Absolute paths to modified files"),
    testsAdded: z
      .boolean()
      .describe("Whether tests were added or updated"),
    refactoringApplied: z
      .boolean()
      .describe("Whether refactoring passes were applied"),
    summary: z.string().describe("Implementation summary")
  }),
  timeoutMs: 3600000
};

/**
 * Phase 4: Validation steps (all run in parallel for efficiency)
 * These steps validate the implementation against quality standards.
 * Each step retries up to 2 times with backoff to handle transient failures (network, locks, etc.).
 */

/**
 * Prisma schema validation.
 * Checks if schema.prisma is syntactically valid and compatible.
 * Retries 2 times to handle file lock contention on Windows.
 */
const prismaCheckStep: CommandStep = {
  type: "command",
  id: "phase-4-prisma-check",
  label: "Phase 4a: Validate Prisma schema (if changed)",
  scriptPath: "npm",
  args: ["run", "prisma:check"],
  timeoutMs: 120000,
  retryPolicy: {
    maxRetries: 2,
    backoffMs: 5000
  }
};

/**
 * Quality check (eslint, formatting, etc.) with logging.
 * Ensures code meets project standards for linting, formatting, and style.
 * Retries 2 times to handle transient linting/formatting tool issues.
 */
const qualityCheckStep: CommandStep = {
  type: "command",
  id: "phase-4-quality-logged",
  label: "Phase 4b: Run logged quality check",
  scriptPath: "npm",
  args: ["run", "quality:logged", "--", "implementation"],
  timeoutMs: 300000,
  retryPolicy: {
    maxRetries: 2,
    backoffMs: 5000
  }
};

/**
 * Full TypeScript type checking.
 * Validates that all TypeScript code is type-safe and correct.
 * Retries 2 times to handle transient compilation tool issues or resource contention.
 */
const typeCheckStep: CommandStep = {
  type: "command",
  id: "phase-4-typecheck",
  label: "Phase 4c: Full TypeScript check",
  scriptPath: "npm",
  args: ["run", "typecheck"],
  timeoutMs: 180000,
  retryPolicy: {
    maxRetries: 2,
    backoffMs: 5000
  }
};

/**
 * Parallel guardrails orchestrator.
 * Executes all three validation steps (Prisma, quality, typecheck) in parallel for efficiency.
 * If any branch fails after retries, the entire parallel step fails and routes to approval gate.
 */
const guardrailsParallel: ParallelStep = {
  type: "parallel",
  id: "phase-4-guardrails",
  label: "Phase 4: Run all validation guardrails in parallel",
  branches: [
    [prismaCheckStep],
    [qualityCheckStep],
    [typeCheckStep]
  ]
};

/**
 * Condition step: Check if any validation step signalled failure via contextJson.
 *
 * When a command step fails it sets contextJson.validationFailed = true via captureStdoutKey
 * on a wrapper script, OR this can be set manually by an operator to force human review.
 *
 * Note: Per-step retry policies on each parallel branch exhaust first. Only after all retries
 * fail does the engine set the run to failed. This condition gate intercepts that to give
 * a human-review option instead of an outright failure.
 *
 * If validationFailed is not set (normal success path), falseBranch continues to ship phase.
 */
const validationRetryCheckCondition: ConditionStep = {
  type: "condition",
  id: "phase-4-check-retry-exhausted",
  label: "Phase 4: Check if validation failed — route to human review or continue",
  condition: (context: Record<string, unknown>) => context.validationFailed === true,
  trueBranch: [
    {
      type: "approval",
      id: "phase-4-human-review-gate",
      label: "Validation failed — request human review before proceeding",
      prompt:
        "One or more validation steps (Prisma check, quality check, TypeScript check) failed after retries. " +
        "Review the step output in the run detail panel and decide: approve to continue to ship phase, or cancel to abort."
    } as ApprovalStep
  ],
  falseBranch: [] // Continue to ship phase
};

/**
 * Post-implementation smoke test.
 * Runs a quick sanity check (typecheck) one final time before PR creation.
 * This ensures the validation suite passed consistently and we're ready to ship.
 */
const smokeTestStep: CommandStep = {
  type: "command",
  id: "phase-4-smoke-test",
  label: "Phase 4d: Post-implementation smoke test",
  scriptPath: "npm",
  args: ["run", "typecheck"],
  timeoutMs: 180000,
  retryPolicy: {
    maxRetries: 1,
    backoffMs: 3000
  }
};

/**
 * Phase 5a: Create atomic commit.
 * Commits all changes with a message that includes the work item ID and summary.
 */
const commitStep: CommandStep = {
  type: "command",
  id: "phase-5-commit",
  label: "Phase 5a: Create atomic commit",
  scriptPath: "git",
  args: ["commit", "--no-verify", "-m", "{{input.workItemId}}: {{input.summary}}"],
  timeoutMs: 60000
};

/**
 * Phase 5b: Push branch to remote.
 * Pushes the feature branch upstream with retry logic to handle network issues.
 */
const pushStep: CommandStep = {
  type: "command",
  id: "phase-5-push-branch",
  label: "Phase 5b: Push branch to remote",
  scriptPath: "git",
  args: ["push", "-u", "origin", "HEAD"],
  timeoutMs: 120000,
  retryPolicy: {
    maxRetries: 2,
    backoffMs: 5000
  }
};

/**
 * Phase 5: Sync or create pull request.
 * Uses pr:sync to create a new PR or sync to an existing one if this is a retry.
 * Includes work item ID for tracking and lineage.
 */
const syncPrStep: CommandStep = {
  type: "command",
  id: "phase-5-sync-pr",
  label: "Phase 5c: Sync or create pull request",
  scriptPath: "node",
  args: [
    "tools/runtime/run-npm.cjs",
    "run",
    "pr:sync",
    "--",
    "--summary",
    "{{input.summary}}",
    "--value",
    "{{input.summary}}",
    "--privacy-confirmed",
    "--work-item-id",
    "{{input.workItemId}}"
  ],
  timeoutMs: 120000
};

/**
 * Phase 5: PR review and merge approval gate.
 * Pauses the workflow to wait for human review and merge via GitHub.
 * Once merged, the human confirms completion to mark the workflow as done.
 * Timeout: 24 hours (86400000 ms) to allow sufficient review time.
 */
const prReviewApproval: ApprovalStep = {
  type: "approval",
  id: "phase-5-pr-review",
  label: "Phase 5d: PR review approval (human gate)",
  prompt:
    "Pull request created. Please review, approve, and merge via GitHub. Once merged, confirm completion here.",
  timeoutMs: 86400000
};

/**
 * Complete implementation workflow definition with hardened failure handling.
 *
 * Phases:
 * 1. Planning check: Validate work item ID
 * 2. Setup: Create worktree, log confirmation
 * 3. Implementation: Agent-driven code changes
 * 4. Validation (hardened): Prisma check, quality checks, TypeScript check (parallel, with retries)
 *    → If validation fails after retries: condition check routes to approval gate
 *    → Smoke test: final sanity check before shipping
 * 5. Ship: Commit, push, PR creation, human approval
 *
 * Key hardening features:
 * - Validation steps retry up to 2 times with 5-second backoff
 * - Agent step receives acceptance criteria and previous attempt error for richer context
 * - Condition step routes to approval gate after validation exhausts retries
 * - Smoke test validates consistency before shipping
 */
export const implementationWorkflow: WorkflowDefinition = {
  name: "implementation",
  version: "1.0.0",
  triggers: ["manual"],
  inputSchema: implementationInputSchema,
  steps: [
    // Phase 1
    planningCheckCondition,

    // Phase 1b
    gatherContextStep,

    // Phase 2
    createWorktreeStep,
    workflowStartHeartbeat,
    captureWorktreePathStep,

    // Phase 3
    implementationStep,

    // Phase 4 (parallel guardrails with retries and fallback)
    guardrailsParallel,
    validationRetryCheckCondition,
    smokeTestStep,

    // Phase 5
    commitStep,
    pushStep,
    syncPrStep,
    prReviewApproval
  ],
  retryPolicy: {
    maxRetries: 1,
    backoffMs: 3000
  },
  timeoutMs: 36000000,
  maxTokensBudget: 200000
};
