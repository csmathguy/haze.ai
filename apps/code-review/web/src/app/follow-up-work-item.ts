import type { CodeReviewPullRequestDetail, CreateWorkItemDraftInput } from "@taxes/shared";

import type { ReviewNotebookEntry } from "./walkthrough.js";

export function buildFollowUpWorkItemDraft(
  pullRequest: CodeReviewPullRequestDetail,
  entry: ReviewNotebookEntry
): CreateWorkItemDraftInput | null {
  const tasks = entry.followUps
    .split("\n")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (tasks.length === 0) {
    return null;
  }

  const planId = pullRequest.planningWorkItem?.workItemId ?? pullRequest.linkedPlan?.workItemId;
  const prefix = planId === undefined ? "PR follow-up" : `${planId} follow-up`;
  const summarySource = pullRequest.planningWorkItem?.summary ?? pullRequest.narrative.valueSummary;

  return {
    acceptanceCriteria: [
      "The follow-up work identified during PR review is captured as explicit planning work.",
      "The item references the originating pull request so later reviewers can recover the context."
    ],
    blockedByWorkItemIds: [],
    kind: "task",
    priority: "medium",
    projectKey: "code-review",
    summary: `${summarySource} Originated from PR #${pullRequest.number.toString()} review.`,
    tasks,
    title: `${prefix}: ${pullRequest.title}`
  };
}
