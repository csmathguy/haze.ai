import { getPrismaClient as getPlanningPrismaClient, createWorkItem } from "@taxes/plan-api";
import type { CreateWorkItemDraftInput } from "@taxes/shared";

export interface CreateFollowUpOptions {
  runId: string;
  runContextJson: Record<string, unknown>;
  failedStepId?: string;
  failureReason?: string;
  planningDatabaseUrl?: string;
}

/**
 * Creates a follow-up work item in the planning backlog when a workflow run fails permanently.
 * Extracts context from the failed run and creates a "Fix failed run for PLAN-XXX" item.
 */
export async function createFollowUpWorkItemForFailedRun(
  options: CreateFollowUpOptions
): Promise<void> {
  const { runId, runContextJson, failedStepId, failureReason, planningDatabaseUrl } = options;
  try {
    // Skip if no planning database URL is provided
    if (!planningDatabaseUrl) {
      console.warn(
        `No planning database URL provided, skipping follow-up item creation for run ${runId}`
      );
      return;
    }

    // Extract workItemId from context
    const workItemId = extractWorkItemId(runContextJson);
    if (!workItemId) {
      // No linked work item — skip follow-up creation per acceptance criteria
      return;
    }

    // Check if a follow-up item already exists to prevent duplicates
    const existingFollowUp = await checkForExistingFollowUp(workItemId, planningDatabaseUrl);
    if (existingFollowUp) {
      // Follow-up already exists — skip
      return;
    }

    // Build and create the follow-up work item
    const followUpInput = buildFollowUpWorkItem({ workItemId, runId, failedStepId, failureReason, runContextJson });
    await createWorkItem(followUpInput, { databaseUrl: planningDatabaseUrl });
  } catch (error) {
    // Log but don't throw — follow-up creation is fire-and-forget so a failed run
    // doesn't cause a second failure
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(
      `Failed to create follow-up work item for run ${runId}: ${errorMsg}`
    );
  }
}

/**
 * Extracts the work item ID from the run context.
 * Checks multiple possible locations: input.workItemId and direct workItemId property.
 */
function extractWorkItemId(
  runContextJson: Record<string, unknown>
): string | undefined {
  // Try input.workItemId first (from startRun with input)
  const input = runContextJson.input as Record<string, unknown> | undefined;
  if (input && typeof input.workItemId === "string") {
    return input.workItemId;
  }

  // Try direct workItemId property
  if (typeof runContextJson.workItemId === "string") {
    return runContextJson.workItemId;
  }

  return undefined;
}

/**
 * Checks if a follow-up item for this work item already exists.
 * Deduplication pattern: look for items with title matching "Fix failed run for PLAN-XXX"
 */
async function checkForExistingFollowUp(
  workItemId: string,
  planningDatabaseUrl: string
): Promise<boolean> {
  try {
    const planningDb = await getPlanningPrismaClient(planningDatabaseUrl);
    try {
      // Search for existing follow-up items with matching title pattern
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
      const existingItem = await (planningDb as any).planWorkItem.findFirst({
        where: {
          title: {
            contains: `Fix failed run for ${workItemId}`
          }
        }
      });
      return existingItem !== null;
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      await (planningDb as any).$disconnect();
    }
  } catch (error) {
    // If we can't check for duplicates, log and allow creation (fail open)
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.warn(
      `Could not check for existing follow-up item for ${workItemId}: ${errorMsg}`
    );
    return false;
  }
}

interface BuildFollowUpOptions {
  workItemId: string;
  runId: string;
  failedStepId: string | undefined;
  failureReason: string | undefined;
  runContextJson: Record<string, unknown>;
}

/**
 * Builds the follow-up work item input based on the failed run context.
 */
function buildFollowUpWorkItem(options: BuildFollowUpOptions): CreateWorkItemDraftInput {
  const { workItemId, runId, failedStepId, failureReason, runContextJson } = options;
  const stepName = failedStepId ?? "unknown step";

  // Build the follow-up title
  const title = `Fix failed run for ${workItemId}: ${stepName}`;

  // Build the summary with context
  const summaryParts: string[] = [
    `Workflow run ${runId} failed during execution.`,
    `Original work item: ${workItemId}.`,
    `Failed step: ${stepName}.`
  ];

  if (failureReason) {
    summaryParts.push(`Error: ${failureReason}`);
  }

  // Add any error details from context if available
  const errorContext = runContextJson.error as Record<string, unknown> | undefined;
  const errorMessage = typeof errorContext?.message === "string" ? errorContext.message : undefined;
  if (errorMessage) {
    summaryParts.push(`Details: ${errorMessage}`);
  }

  const summary = summaryParts.join(" ");

  // Return the work item input
  return {
    title,
    summary,
    kind: "task",
    priority: "high",
    projectKey: "workflow",
    tasks: [
      "Investigate the workflow failure cause",
      "Determine if the original workflow can be retried",
      "Fix the underlying issue if needed"
    ],
    acceptanceCriteria: [
      "The original workflow run completes successfully after retry or fix"
    ],
    blockedByWorkItemIds: []
  };
}
