import type { PrismaClient } from "@taxes/db";
import type { WorkflowDefinitionCreateInput } from "../services/workflow-definition-service.js";
import { createDefinition } from "../services/workflow-definition-service.js";

/**
 * Implementation workflow definition.
 *
 * This workflow encodes the manual agent implementation loop documented in AGENTS.md.
 * It guides agents through planning, setup, implementation, validation, and shipping phases.
 *
 * The workflow is triggered manually by an agent or automation system and progresses
 * through deterministic commands and agent-driven tasks.
 *
 * Since definitionJson is stored as JSON, we use Record<string, unknown> for the structure
 * and avoid complex TypeScript types that can't be serialized.
 */
const IMPLEMENTATION_WORKFLOW: WorkflowDefinitionCreateInput = {
  name: "implementation",
  version: "1.0.0",
  description:
    "Agent-driven implementation workflow: planning → worktree setup → implementation → validation → ship",
  triggers: ["manual"],
  definitionJson: {
    // Workflow metadata
    name: "implementation",
    version: "1.0.0",
    triggers: ["manual"],
    // Input schema enforces required fields for the workflow
    inputSchema: {
      type: "object",
      properties: {
        workItemId: {
          type: "string",
          description: "Planning work item ID (e.g., PLAN-144)"
        },
        summary: {
          type: "string",
          description: "Workflow summary for audit logging"
        },
        projectId: {
          type: "string",
          description: "Optional planning project ID"
        },
        planRunId: {
          type: "string",
          description: "Optional planning run ID for lineage"
        },
        planStepId: {
          type: "string",
          description: "Optional planning step ID for lineage"
        }
      },
      required: ["workItemId", "summary"]
    },
    steps: [
      // ========================================================================
      // PHASE 1: PLANNING
      // ========================================================================

      {
        type: "condition",
        id: "phase-1-check-planning-item",
        label: "Phase 1: Check if planning work item exists",
        condition: (context: Record<string, unknown>) => {
          // Check if workItemId is provided and valid
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
          }
        ],
        falseBranch: [
          {
            type: "approval",
            id: "phase-1-create-work-item",
            label:
              "Create or refine planning work item (manual approval gate)",
            prompt:
              "Work item not found or invalid. Please create a planning work item or provide a valid PLAN-XXX ID before proceeding."
          }
        ]
      },

      // ========================================================================
      // PHASE 2: SETUP (Worktree + Audit Workflow Start)
      // ========================================================================

      {
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
      },

      {
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
      },

      // ========================================================================
      // PHASE 3: IMPLEMENTATION (Red-Green-Refactor)
      // ========================================================================

      {
        type: "agent",
        id: "phase-3-implement",
        label: "Phase 3: Implement changes (red-green-refactor)",
        agentId: "implementer",
        model: "claude-sonnet-4.6-20250514",
        providerFamily: "anthropic",
        runtimeKind: "claude-code-subagent",
        skillIds: ["implementation-workflow"],
        outputSchema: {
          type: "object",
          properties: {
            filesChanged: {
              type: "array",
              items: { type: "string" },
              description: "Absolute paths to modified files"
            },
            testsAdded: {
              type: "boolean",
              description: "Whether tests were added or updated"
            },
            refactoringApplied: {
              type: "boolean",
              description: "Whether refactoring passes were applied"
            },
            summary: {
              type: "string",
              description: "Implementation summary"
            }
          }
        },
        timeoutMs: 3600000
      },

      // ========================================================================
      // PHASE 4: VALIDATION (Deterministic Checks)
      // ========================================================================

      {
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
      },

      {
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
      },

      {
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
      },

      // ========================================================================
      // PHASE 5: SHIP (Commit, Push, PR, Workflow End)
      // ========================================================================

      {
        type: "command",
        id: "phase-5-commit",
        label: "Phase 5a: Create atomic commit",
        scriptPath: "git",
        args: ["commit", "--no-verify", "-m", "{{input.workItemId}}: {{input.summary}}"],
        timeoutMs: 60000
      },

      {
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
      },

      {
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
      },

      {
        type: "approval",
        id: "phase-5-pr-review",
        label: "Phase 5d: PR review approval (human gate)",
        prompt:
          "Pull request created. Please review, approve, and merge via GitHub. Once merged, confirm completion here.",
        timeoutMs: 86400000
      }
    ],
    // Default retry policy for all steps (can be overridden per step)
    retryPolicy: {
      maxRetries: 1,
      backoffMs: 3000
    },
    // Workflow-level timeout (10 hours for a complete implementation cycle)
    timeoutMs: 36000000
  }
};

/**
 * Seeds the implementation workflow definition into the database.
 * This is an idempotent operation—it creates the definition only if it doesn't exist.
 */
export async function seedImplementationWorkflow(
  prisma: PrismaClient
): Promise<void> {
  const existing = await prisma.workflowDefinition.findFirst({
    where: {
      name: IMPLEMENTATION_WORKFLOW.name,
      version: IMPLEMENTATION_WORKFLOW.version
    }
  });

  if (existing) {
    console.warn(
      `Implementation workflow ${IMPLEMENTATION_WORKFLOW.name}@${IMPLEMENTATION_WORKFLOW.version} already exists`
    );
    return;
  }

  console.warn(
    `Seeding implementation workflow ${IMPLEMENTATION_WORKFLOW.name}@${IMPLEMENTATION_WORKFLOW.version}...`
  );
  await createDefinition(prisma, IMPLEMENTATION_WORKFLOW);
  console.warn("Implementation workflow seeded successfully.");
}
