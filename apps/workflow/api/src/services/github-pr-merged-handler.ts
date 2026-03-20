import type { PrismaClient as WorkflowPrismaClient } from "@taxes/db";
import { getPrismaClient as getPlanningPrismaClient } from "@taxes/plan-api";
import type { WorkflowEvent } from "@taxes/db";

interface PlanningDb {
  planWorkItem: {
    updateMany: (params: { where: { id: string }; data: { status: string; updatedAt: Date } }) => Promise<{ count: number }>;
  };
  $disconnect: () => Promise<void>;
}

/**
 * Handles github.pull_request.merged WorkflowEvent by extracting PLAN-XXX references
 * from the PR body and marking those work items as done.
 */
export class GitHubPrMergedHandler {
  constructor(
    private readonly workflowDb: WorkflowPrismaClient,
    private readonly planningDatabaseUrl?: string
  ) {}

  /**
   * Process a GitHub PR merged event.
   * Extracts PLAN-XXX references from PR body and marks them as done.
   * Returns the count of work items updated.
   */
  async handleEvent(event: WorkflowEvent): Promise<number> {
    // Parse the payload
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(event.payload) as Record<string, unknown>;
    } catch (parseError) {
      throw new Error("Failed to parse event payload", { cause: parseError });
    }

    // Extract PR body from the GitHub payload structure
    const prBody = this.extractPrBody(payload);
    if (!prBody) {
      return 0;
    }

    // Extract PLAN-XXX references from the PR body
    const planReferences = this.extractPlanReferences(prBody);
    if (planReferences.length === 0) {
      return 0;
    }

    // Get planning client
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const planningDb = (await getPlanningPrismaClient(this.planningDatabaseUrl)) as PlanningDb;
    try {
      // Update each work item to done status
      const updatedCount = await this.updateWorkItems(planningDb, planReferences);

      // Mark the event as processed
      await this.workflowDb.workflowEvent.update({
        where: { id: event.id },
        data: { processedAt: new Date() }
      });

      return updatedCount;
    } finally {
      await planningDb.$disconnect();
    }
  }

  private async updateWorkItems(
    planningDb: PlanningDb,
    planReferences: string[]
  ): Promise<number> {
    let updatedCount = 0;
    for (const planRef of planReferences) {
      try {
        const updateResult = await planningDb.planWorkItem.updateMany({
          where: { id: planRef },
          data: { status: "done", updatedAt: new Date() }
        });
        if (updateResult.count > 0) {
          updatedCount++;
        }
      } catch (error) {
        // Silently ignore if work item not found or already done
        // (as per acceptance criteria: "Work item not found or already done is a no-op")
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.warn(`Could not update work item ${planRef}: ${errorMsg}`);
      }
    }
    return updatedCount;
  }

  private extractPrBody(payload: Record<string, unknown>): string | null {
    // GitHub webhook payload structure for pull_request events
    // payload.pull_request.body contains the PR description
    const pr = payload.pull_request as Record<string, unknown> | undefined;
    if (!pr) {
      return null;
    }

    const body = pr.body as string | null | undefined;
    return body ?? null;
  }

  /**
   * Extract all PLAN-XXX references from text.
   * Returns array of work item IDs (e.g., ["PLAN-167", "PLAN-166"])
   */
  private extractPlanReferences(text: string): string[] {
    const pattern = /PLAN-(\d+)/g;
    const matches: string[] = [];
    let match: RegExpExecArray | null = pattern.exec(text);

    while (match !== null) {
      const planId = match[1];
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      matches.push(`PLAN-${planId}`);
      match = pattern.exec(text);
    }

    // Remove duplicates
    return Array.from(new Set(matches));
  }
}
