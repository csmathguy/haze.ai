import { getPrismaClient } from "@taxes/db";

export interface WorkflowEventGateway {
  createCodeReviewReviewSubmittedEvent(input: {
    readonly action: "approve" | "request-changes";
    readonly comment: string;
    readonly pullRequestNumber: number;
    readonly repository: { readonly name: string; readonly owner: string; readonly url: string };
    readonly submittedAt: string;
    readonly headSha?: string;
    readonly reviewId?: number;
    readonly workItemId?: string;
  }): Promise<{ readonly eventId: string }>;
}

export class DirectWorkflowEventGateway implements WorkflowEventGateway {
  constructor(private readonly databaseUrl: string) {}

  async createCodeReviewReviewSubmittedEvent(input: {
    readonly action: "approve" | "request-changes";
    readonly comment: string;
    readonly pullRequestNumber: number;
    readonly repository: { readonly name: string; readonly owner: string; readonly url: string };
    readonly submittedAt: string;
    readonly headSha?: string;
    readonly reviewId?: number;
    readonly workItemId?: string;
  }): Promise<{ readonly eventId: string }> {
    const prisma = await getPrismaClient(this.databaseUrl);
    const event = await prisma.workflowEvent.create({
      data: {
        correlationId: input.workItemId ?? `pr-${input.pullRequestNumber.toString()}`,
        metadata: JSON.stringify({
          submittedAt: input.submittedAt
        }),
        payload: JSON.stringify(input),
        source: "code-review",
        type: "code-review.pull-request.review-submitted"
      }
    });

    return {
      eventId: event.id
    };
  }
}
