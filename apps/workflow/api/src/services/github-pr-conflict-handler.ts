import type { PrismaClient as WorkflowPrismaClient } from "@taxes/db";
import type { WorkflowEvent } from "@taxes/db";

function extractBranchData(obj: Record<string, unknown> | undefined): { ref: string; sha: string } {
  return {
    ref: (obj?.ref as string | undefined) ?? "",
    sha: (obj?.sha as string | undefined) ?? ""
  };
}

function parsePrFields(pr: Record<string, unknown>): {
  number: number; title: string; body: string; headBranch: string;
  baseBranch: string; headSha: string; baseSha: string; htmlUrl: string;
} | null {
  const number = pr.number as number | undefined;
  const title = pr.title as string | undefined;
  const htmlUrl = pr.html_url as string | undefined;
  if (!number || !title || !htmlUrl) return null;
  const head = extractBranchData(pr.head as Record<string, unknown> | undefined);
  const base = extractBranchData(pr.base as Record<string, unknown> | undefined);
  return {
    number, title, htmlUrl,
    body: (pr.body as string | null | undefined) ?? "",
    headBranch: head.ref, headSha: head.sha,
    baseBranch: base.ref, baseSha: base.sha
  };
}

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
    // Look up the registered conflict-repair definition to get its DB id
    const definition = await this.workflowDb.workflowDefinition.findFirst({
      where: { name: "conflict-repair", status: "active" }
    });
    // Create a workflow run for the conflict-repair workflow
    const run = await this.workflowDb.workflowRun.create({
      data: {
        definitionId: definition?.id ?? "conflict-repair",
        definitionName: "conflict-repair",
        version: "1.0.0",
        status: "pending",
        correlationId: `conflict-${planId}-${String(prData.number)}`,
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
    const pr = payload.pull_request as Record<string, unknown> | undefined;
    if (!pr) return null;
    return parsePrFields(pr);
  }

  /**
   * Extract PLAN-XXX reference from text.
   * Returns the work item ID (e.g., "PLAN-167") or null if not found.
   */
  private extractPlanReference(text: string): string | null {
    const pattern = /PLAN-(\d+)/i;
    const match = pattern.exec(text);

    if (match?.[1]) {
      return `PLAN-${match[1]}`;
    }

    return null;
  }
}
