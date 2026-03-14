import type { CodeReviewPullRequestDetail, CodeReviewPullRequestSummary, CodeReviewRepository } from "@taxes/shared";

import type { GitHubPullRequestDetail, GitHubPullRequestListEntry, GitHubRepositoryRef } from "../adapters/github-cli.js";
import { buildReviewLanes, classifyFiles, createTrustStatement } from "./pull-request-lanes.js";
import { extractPlanContext, parseNarrative } from "./pull-request-parser.js";

export function toRepository(repository: GitHubRepositoryRef): CodeReviewRepository {
  return repository;
}

export function toPullRequestSummary(pullRequest: GitHubPullRequestListEntry): CodeReviewPullRequestSummary {
  const linkedPlan = extractPlanContext(pullRequest.headRefName, "");

  return {
    author: toActor(pullRequest.author),
    baseRefName: pullRequest.baseRefName,
    headRefName: pullRequest.headRefName,
    isDraft: pullRequest.isDraft,
    ...(linkedPlan === undefined ? {} : { linkedPlan }),
    number: pullRequest.number,
    reviewDecision: pullRequest.reviewDecision,
    state: pullRequest.state,
    title: pullRequest.title,
    updatedAt: pullRequest.updatedAt,
    url: pullRequest.url
  };
}

export function toPullRequestDetail(
  pullRequest: GitHubPullRequestDetail,
  repository: CodeReviewRepository
): CodeReviewPullRequestDetail {
  const narrative = parseNarrative(pullRequest.body, pullRequest.title);
  const linkedPlan = extractPlanContext(pullRequest.headRefName, pullRequest.body);
  const classifiedFiles = classifyFiles(pullRequest.files);

  return {
    author: toActor(pullRequest.author),
    baseRefName: pullRequest.baseRefName,
    body: pullRequest.body,
    checks: pullRequest.statusCheckRollup.map((check) => ({
      ...(check.completedAt === undefined ? {} : { completedAt: check.completedAt }),
      ...(check.conclusion === undefined ? {} : { conclusion: check.conclusion }),
      ...(check.detailsUrl === undefined ? {} : { detailsUrl: check.detailsUrl }),
      name: check.name,
      ...(check.startedAt === undefined ? {} : { startedAt: check.startedAt }),
      status: check.status,
      ...(check.workflowName === undefined ? {} : { workflowName: check.workflowName })
    })),
    headRefName: pullRequest.headRefName,
    isDraft: pullRequest.isDraft,
    ...(linkedPlan === undefined ? {} : { linkedPlan }),
    lanes: buildReviewLanes(classifiedFiles, narrative, pullRequest.statusCheckRollup),
    mergeStateStatus: pullRequest.mergeStateStatus,
    narrative,
    number: pullRequest.number,
    reviewDecision: pullRequest.reviewDecision,
    state: pullRequest.state,
    stats: {
      commentCount: pullRequest.comments.length,
      fileCount: pullRequest.files.length,
      reviewCount: pullRequest.reviews.length,
      totalAdditions: pullRequest.files.reduce((sum, file) => sum + file.additions, 0),
      totalDeletions: pullRequest.files.reduce((sum, file) => sum + file.deletions, 0)
    },
    title: pullRequest.title,
    trustStatement: createTrustStatement(repository, classifiedFiles),
    updatedAt: pullRequest.updatedAt,
    url: pullRequest.url
  };
}

export { extractPlanContext, parseNarrative } from "./pull-request-parser.js";

function toActor(actor: GitHubPullRequestListEntry["author"]) {
  return {
    isBot: actor.is_bot,
    login: actor.login,
    ...(actor.name === undefined ? {} : { name: actor.name })
  };
}
