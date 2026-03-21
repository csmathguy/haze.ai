import type { PrismaClient as WorkflowPrismaClient } from "@taxes/db";
import type { WorkflowEvent } from "@taxes/db";

/**
 * Handles github.pull_request.conflict WorkflowEvent by extracting PR metadata
 * and dispatching a conflict-repair workflow run with the PR context.
 */
export class GitHubPrConflictHandler {
  constructor(private readonly workflowDb: WorkflowPrismaClient) {}

  /**
   * Process a GitHub PR conflict event.
   * Extracts PLAN-XXX reference from PR body and creates a conflict-repair workflow run.
   * Returns the workflow run ID if created, or null if no plan reference found.
   */
  async handleEvent(event: WorkflowEvent): Promise<string | null> {
    // Parse the payload
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(event.payload) as Record<string, unknown>;
    } catch (parseError) {
      throw new Error("Failed to parse event payload", { cause: parseError });
    }

    // Extract PR data from the GitHub payload structure
    const prData = this.extractPrData(payload);
    if (!prData) {
      return null;
    }

    // Extract PLAN-XXX reference from the PR body
    const planId = this.extractPlanReference(prData.body);
    if (!planId) {
      return null;
    }

    // Create a conflict-repair workflow run with the PR context
    const runId = await this.createConflictRepairRun(planId, prData);

    // Mark the event as processed
    await this.workflowDb.workflowEvent.update({
      where: { id: event.id },
      data: { processedAt: new Date() }
    });

    return runId;
  }

  private async createConflictRepairRun(
    planId: string,
    prData: {
      number: number;
      title: string;
      body: string;
      headBranch: string;
      baseBranch: string;
      headSha: string;
      baseSha: string;
      htmlUrl: string;
    }
  ): Promise<string> {
    // Create a workflow run for the conflict-repair workflow
    const run = await this.workflowDb.workflowRun.create({
      data: {
        definitionName: "conflict-repair",
        version: "1.0.0",
        status: "pending",
        correlationId: `conflict-${planId}-${prData.number}`,
        contextJson: JSON.stringify({
          workItemId: planId,
          prNumber: prData.number,
          prTitle: prData.title,
          headBranch: prData.headBranch,
          baseBranch: prData.baseBranch,
          headSha: prData.headSha,
          baseSha: prData.baseSha,
          prUrl: prData.htmlUrl,
          prBody: prData.body
        })
      }
    });

    return run.id;
  }

  private extractPrData(payload: Record<string, unknown>): {
    number: number;
    title: string;
    body: string;
    headBranch: string;
    baseBranch: string;
    headSha: string;
    baseSha: string;
    htmlUrl: string;
  } | null {
    // GitHub webhook payload structure for pull_request events
    const pr = payload.pull_request as Record<string, unknown> | undefined;
    if (!pr) {
      return null;
    }

    const number = pr.number as number | undefined;
    const title = pr.title as string | undefined;
    const body = (pr.body as string | null | undefined) ?? "";
    const htmlUrl = pr.html_url as string | undefined;

    const head = pr.head as Record<string, unknown> | undefined;
    const headBranch = (head?.ref as string | undefined) ?? "";
    const headSha = (head?.sha as string | undefined) ?? "";

    const base = pr.base as Record<string, unknown> | undefined;
    const baseBranch = (base?.ref as string | undefined) ?? "";
    const baseSha = (base?.sha as string | undefined) ?? "";

    if (!number || !title || !headBranch || !baseBranch || !headSha || !baseSha || !htmlUrl) {
      return null;
    }

    return {
      number,
      title,
      body,
      headBranch,
      baseBranch,
      headSha,
      baseSha,
      htmlUrl
    };
  }

  /**
   * Extract PLAN-XXX reference from text.
   * Returns the work item ID (e.g., "PLAN-167") or null if not found.
   */
  private extractPlanReference(text: string): string | null {
    const pattern = /PLAN-(\d+)/i;
    const match = pattern.exec(text);

    if (match && match[1]) {
      return `PLAN-${match[1]}`;
    }

    return null;
  }
}
