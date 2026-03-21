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

// Phase 3: Implementation agent step
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

// Phase 4: Validation steps
const prismaCheckStep: CommandStep = {
  type: "command",
  id: "phase-4-prisma-check",
  label: "Phase 4a: Validate Prisma schema (if changed)",
  scriptPath: "npm",
  args: ["run", "prisma:check"],
  timeoutMs: 120000,
  retryPolicy: {
    maxRetries: 1,
    backoffMs: 3000
  }
};

const qualityCheckStep: CommandStep = {
  type: "command",
  id: "phase-4-quality-logged",
  label: "Phase 4b: Run logged quality check",
  scriptPath: "npm",
  args: ["run", "quality:logged", "--", "implementation"],
  timeoutMs: 300000,
  retryPolicy: {
    maxRetries: 1,
    backoffMs: 5000
  }
};

const typeCheckStep: CommandStep = {
  type: "command",
  id: "phase-4-typecheck",
  label: "Phase 4c: Full TypeScript check",
  scriptPath: "npm",
  args: ["run", "typecheck"],
  timeoutMs: 180000,
  retryPolicy: {
    maxRetries: 1,
    backoffMs: 3000
  }
};

// Parallel guardrails step (all validation checks run in parallel)
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

// Phase 5: Ship steps
const commitStep: CommandStep = {
  type: "command",
  id: "phase-5-commit",
  label: "Phase 5a: Create atomic commit",
  scriptPath: "git",
  args: ["commit", "--no-verify", "-m", "{{input.workItemId}}: {{input.summary}}"],
  timeoutMs: 60000
};

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

const prReviewApproval: ApprovalStep = {
  type: "approval",
  id: "phase-5-pr-review",
  label: "Phase 5d: PR review approval (human gate)",
  prompt:
    "Pull request created. Please review, approve, and merge via GitHub. Once merged, confirm completion here.",
  timeoutMs: 86400000
};

/**
 * Complete implementation workflow definition.
 *
 * Phases:
 * 1. Planning check: Validate work item ID
 * 2. Setup: Create worktree, log confirmation
 * 3. Implementation: Agent-driven code changes
 * 4. Validation: Prisma check, quality checks, TypeScript check (parallel)
 * 5. Ship: Commit, push, PR creation, human approval
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

    // Phase 3
    implementationStep,

    // Phase 4 (parallel guardrails)
    guardrailsParallel,

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
  timeoutMs: 36000000
};
