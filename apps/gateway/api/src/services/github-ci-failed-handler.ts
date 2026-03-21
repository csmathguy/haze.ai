import type { PrismaClient } from "@taxes/db";
import { getPrismaClient as getPlanningPrismaClient } from "@taxes/plan-api";

interface PlanningDb {
  planWorkItem: {
    findUnique: (params: { where: { id: string } }) => Promise<{ id: string } | null>;
  };
  $disconnect: () => Promise<void>;
}

/**
 * Handles github.ci.failed events by extracting the PR number, correlating it
 * to a planning work item via PLAN-XXX in the PR body, and emitting a
 * github.ci.failed WorkflowEvent with structured failure context.
 */
export class GitHubCiFailedHandler {
  constructor(
    private readonly workflowDb: PrismaClient,
    private readonly planningDatabaseUrl?: string
  ) {}

  /**
   * Process a GitHub CI failure event.
   * Correlates the PR to a planning work item via PLAN-XXX in PR body.
   * Emits a github.ci.failed event with { prNumber, jobName, logsUrl, workItemId }.
   * Silently ignores failures for PRs not linked to a work item.
   */
  async handleEvent(
    prNumber: number,
    jobName: string,
    logsUrl: string,
    rawPayload: string
  ): Promise<void> {
    // Extract the PR body from the GitHub payload
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawPayload) as Record<string, unknown>;
    } catch (parseError) {
      throw new Error("Failed to parse event payload", { cause: parseError });
    }

    // Extract PR body to find PLAN-XXX references
    const prBody = this.extractPrBody(payload);
    if (!prBody) {
      // No PR body — silently ignore
      return;
    }

    // Extract PLAN-XXX reference from PR body
    const workItemId = this.extractPlanReference(prBody);
    if (!workItemId) {
      // No PLAN-XXX in PR body — silently ignore
      return;
    }

    // Verify the work item exists in the planning database
    const planningDb = (await getPlanningPrismaClient(this.planningDatabaseUrl)) as unknown as PlanningDb;
    try {
      const workItem = await planningDb.planWorkItem.findUnique({
        where: { id: workItemId }
      });

      if (!workItem) {
        // Work item not found — silently ignore
        return;
      }

      // Emit the github.ci.failed event
      await this.emitCiFailedEvent(
        prNumber,
        jobName,
        logsUrl,
        workItemId
      );
    } finally {
      await planningDb.$disconnect();
    }
  }

  private async emitCiFailedEvent(
    prNumber: number,
    jobName: string,
    logsUrl: string,
    workItemId: string
  ): Promise<void> {
    // For now, extract failed steps as empty array (will be populated by PLAN-219)
    const failedSteps: string[] = [];

    const eventPayload = {
      prNumber,
      jobName,
      logsUrl,
      failedSteps,
      workItemId
    };

    await this.workflowDb.workflowEvent.create({
      data: {
        type: "github.ci.failed",
        source: "github",
        correlationId: `pr-${prNumber}`,
        payload: JSON.stringify(eventPayload)
      }
    });
  }

  private extractPrBody(payload: Record<string, unknown>): string | null {
    // GitHub webhook payload structure for pull_request, workflow_run, and check_run events
    // For pull_request events: payload.pull_request.body
    // For workflow_run/check_run events: the payload contains the full GitHub action context
    // but we need to fetch the PR body separately (not directly in the payload)
    // For now, extract from pull_request if available
    const pr = payload.pull_request as Record<string, unknown> | undefined;
    if (pr) {
      const body = pr.body as string | null | undefined;
      return body ?? null;
    }

    // For workflow_run and check_run, the PR body is not included in the webhook payload
    // This means we cannot extract work item IDs from those events without additional API calls
    // Return null to indicate PR body is not available
    return null;
  }

  /**
   * Extract the first PLAN-XXX reference from text.
   * Returns the work item ID (e.g., "PLAN-167") or undefined if not found.
   */
  private extractPlanReference(text: string): string | undefined {
    const pattern = /PLAN-(\d+)/i;
    const match = pattern.exec(text);

    if (match && match[1]) {
      return `PLAN-${match[1]}`;
    }

    return undefined;
  }
}
