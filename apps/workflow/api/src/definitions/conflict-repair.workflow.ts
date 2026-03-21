import { z } from "zod";
import type {
  WorkflowDefinition,
  CommandStep,
  AgentStep,
  ApprovalStep
} from "@taxes/shared";

/**
 * Conflict repair workflow definition (TypeScript-native format).
 *
 * This workflow resolves merge conflicts in PRs by:
 * 1. Loading the work item context and analyzing conflicting files
 * 2. Dispatching a repair agent to resolve conflicts and push a fix
 * 3. Waiting for human approval if automatic resolution fails
 *
 * All steps are defined as TypeScript objects with proper type safety.
 * The workflow is registered in the workflow engine registry at startup.
 */

// Input schema for the conflict-repair workflow
const conflictRepairInputSchema = z.object({
  workItemId: z.string().min(1).describe("Planning work item ID (e.g., PLAN-216)"),
  prNumber: z.number().int().positive().describe("GitHub PR number"),
  prTitle: z.string().min(1).describe("PR title"),
  headBranch: z.string().min(1).describe("Feature branch name"),
  baseBranch: z.string().min(1).describe("Base branch name (usually main)"),
  headSha: z.string().min(1).describe("Feature branch commit SHA"),
  baseSha: z.string().min(1).describe("Base branch commit SHA"),
  prUrl: z.string().url().describe("GitHub PR URL"),
  prBody: z.string().describe("PR description/body")
});

// Step 1: Context pack agent - gathers work item details, PR diff, and conflict info
const contextPackStep: AgentStep = {
  type: "agent",
  id: "step-1-context-pack",
  label: "Step 1: Pack conflict context from work item and PR",
  agentId: "conflict-context-packer",
  model: "claude-sonnet-4.6-20250514",
  providerFamily: "anthropic",
  runtimeKind: "claude-code-subagent",
  skillIds: ["conflict-repair-workflow"],
  outputSchema: z.object({
    workItemSummary: z.string().describe("Work item summary and acceptance criteria"),
    conflictingFiles: z.array(z.string()).describe("List of files with conflicts"),
    conflictDetails: z.string().describe("Analysis of conflict types and patterns"),
    contextJson: z.record(z.unknown()).describe("Packed context for repair agent")
  }),
  timeoutMs: 600000
};

// Step 2: Repair agent - resolves conflicts and pushes fix commit
const repairAgentStep: AgentStep = {
  type: "agent",
  id: "step-2-repair-agent",
  label: "Step 2: Repair conflicts and push resolution commit",
  agentId: "conflict-repairer",
  model: "claude-sonnet-4.6-20250514",
  providerFamily: "anthropic",
  runtimeKind: "claude-code-subagent",
  skillIds: ["conflict-repair-workflow"],
  outputSchema: z.object({
    resolved: z.boolean().describe("Whether conflicts were successfully resolved"),
    resolutionStrategy: z.string().describe("Strategy used to resolve conflicts"),
    commitSha: z.string().optional().describe("SHA of the resolution commit"),
    needsHumanReview: z.boolean().default(false).describe("Whether human review is needed"),
    summary: z.string().describe("Summary of repair actions taken")
  }),
  timeoutMs: 1800000
};

// Step 3: Approval gate - waits for human approval if repair was incomplete
const approvalGate: ApprovalStep = {
  type: "approval",
  id: "step-3-approval",
  label: "Step 3: Manual conflict resolution approval (if needed)",
  prompt:
    "Automatic conflict resolution completed but may need review. Please verify the conflict resolution on the feature branch {{input.headBranch}} ({{input.prUrl}}) and approve to complete the workflow.",
  timeoutMs: 86400000
};

/**
 * Complete conflict-repair workflow definition.
 *
 * Steps:
 * 1. Context pack: Load work item details and analyze conflicts
 * 2. Repair agent: Resolve conflicts and push fix
 * 3. Approval: Human review gate (conditional, only if repair needed approval)
 */
export const conflictRepairWorkflow: WorkflowDefinition = {
  name: "conflict-repair",
  version: "1.0.0",
  triggers: ["github.pull_request.conflict"],
  inputSchema: conflictRepairInputSchema,
  steps: [
    // Step 1: Context pack
    contextPackStep,

    // Step 2: Repair agent
    repairAgentStep,

    // Step 3: Approval (conditional, only if needsHumanReview is true in context)
    approvalGate
  ],
  retryPolicy: {
    maxRetries: 1,
    backoffMs: 5000
  },
  timeoutMs: 3600000
};
