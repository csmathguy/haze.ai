import type { CodeReviewPullRequestDetail, CodeReviewWorkspace } from "@taxes/shared";

import { GitHubCliPullRequestGateway, type GitHubPullRequestGateway } from "../adapters/github-cli.js";
import { toPullRequestDetail, toPullRequestSummary, toRepository } from "./pull-request-review.js";

export interface CodeReviewService {
  getPullRequestDetail(pullRequestNumber: number): Promise<CodeReviewPullRequestDetail>;
  getWorkspace(): Promise<CodeReviewWorkspace>;
}

export function createCodeReviewService(gateway: GitHubPullRequestGateway = new GitHubCliPullRequestGateway()): CodeReviewService {
  return {
    getPullRequestDetail: async (pullRequestNumber) => {
      const [repository, pullRequest] = await Promise.all([gateway.getRepository(), gateway.getPullRequest(pullRequestNumber)]);

      return toPullRequestDetail(pullRequest, toRepository(repository));
    },
    getWorkspace: async () => {
      const [repository, pullRequests] = await Promise.all([gateway.getRepository(), gateway.listPullRequests()]);
      const normalizedRepository = toRepository(repository);
      const orderedPullRequests = [...pullRequests].sort(comparePullRequests);

      return {
        generatedAt: new Date().toISOString(),
        localOnly: true,
        pullRequests: orderedPullRequests.map((pullRequest) => toPullRequestSummary(pullRequest)),
        purpose:
          "Review pull requests from this repository in a deterministic order that highlights value, changed boundaries, tests, validation, and merge readiness.",
        repository: normalizedRepository,
        showingRecentFallback: orderedPullRequests.every((pullRequest) => pullRequest.state !== "OPEN"),
        title: "Code Review Studio",
        trustStatement: "Human review remains the confirmation step. The app should explain the pull request and surface evidence before approval or merge."
      };
    }
  };
}

function comparePullRequests(left: { state: string; updatedAt: string }, right: { state: string; updatedAt: string }): number {
  return getStateRank(left.state) - getStateRank(right.state) || Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
}

function getStateRank(state: string): number {
  switch (state) {
    case "OPEN":
      return 0;
    case "MERGED":
      return 1;
    default:
      return 2;
  }
}
