import { CodeReviewReviewActionRequestSchema } from "@taxes/shared";
import { z } from "zod";
import type { FastifyInstance } from "fastify";

import type { CodeReviewService } from "../services/workspace.js";

const PullRequestParamsSchema = z.object({
  pullRequestNumber: z.coerce.number().int().positive()
});

export function registerWorkspaceRoutes(app: FastifyInstance, service: CodeReviewService): void {
  app.get("/api/code-review/workspace", async () => ({
    workspace: await service.getWorkspace()
  }));

  app.get("/api/code-review/pull-requests/:pullRequestNumber", async (request) => {
    const params = PullRequestParamsSchema.parse(request.params);

    return {
      pullRequest: await service.getPullRequestDetail(params.pullRequestNumber)
    };
  });

  app.post("/api/code-review/pull-requests/:pullRequestNumber/review-actions", async (request) => {
    const params = PullRequestParamsSchema.parse(request.params);
    const body = CodeReviewReviewActionRequestSchema.parse(request.body);

    return {
      result: await service.submitReviewAction(params.pullRequestNumber, body)
    };
  });
}
