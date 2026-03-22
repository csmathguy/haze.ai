import { getPrismaClient as getPlanningPrismaClient, createWorkItem } from "@taxes/plan-api";
import type { CreateWorkItemDraftInput } from "@taxes/shared";

export interface CreateFollowUpWorkItemOptions {
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
  options: CreateFollowUpWorkItemOptions
): Promise<void> {
  const { runId, runContextJson, failedStepId, failureReason, planningDatabaseUrl } = options;
  try {
    if (!planningDatabaseUrl) {
      console.warn(
        `No planning database URL provided, skipping follow-up item creation for run ${runId}`
      );
      return;
    }

    const workItemId = extractWorkItemId(runContextJson);
    if (!workItemId) {
      return;
    }

    const existingFollowUp = await checkForExistingFollowUp(workItemId, planningDatabaseUrl);
    if (existingFollowUp) {
      return;
    }

    const followUpInput = buildFollowUpWorkItem({ workItemId, runId, failedStepId, failureReason, runContextJson });

    await createWorkItem(followUpInput, { databaseUrl: planningDatabaseUrl });
  } catch (error) {
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      const existingItem = await (planningDb as any).planWorkItem.findFirst({
        where: { title: { contains: `Fix failed run for ${workItemId}` } }
      });
      return existingItem !== null;
    } finally {
      await (planningDb as Record<string, unknown>).$disconnect();
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.warn(
      `Could not check for existing follow-up item for ${workItemId}: ${errorMsg}`
    );
    return false;
  }
}

export interface BuildFollowUpWorkItemOptions {
  workItemId: string;
  runId: string;
  failedStepId?: string;
  failureReason?: string;
  runContextJson: Record<string, unknown>;
}

function buildFollowUpWorkItem(
  opts: BuildFollowUpWorkItemOptions
): CreateWorkItemDraftInput {
  const { workItemId, runId, failedStepId, failureReason, runContextJson } = opts;
  const stepName = failedStepId ?? "unknown step";

  const title = `Fix failed run for ${workItemId}: ${stepName}`;

  const summaryParts: string[] = [
    `Workflow run ${runId} failed during execution.`,
    `Original work item: ${workItemId}.`,
    `Failed step: ${stepName}.`
  ];

  if (failureReason) {
    summaryParts.push(`Error: ${failureReason}`);
  }

  const errorContext = runContextJson.error as Record<string, unknown> | undefined;
  if (errorContext) {
    const message = typeof errorContext.message === "string" ? errorContext.message : undefined;
    if (message) {
      summaryParts.push(`Details: ${message}`);
    }
  }

  const summary = summaryParts.join(" ");

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
