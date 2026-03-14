import type { CodeReviewPullRequestState, CodeReviewPullRequestSummary, ReviewLane } from "@taxes/shared";

export function countPullRequestsByState(
  pullRequests: CodeReviewPullRequestSummary[],
  state: CodeReviewPullRequestState
): number {
  return pullRequests.filter((pullRequest) => pullRequest.state === state).length;
}

export function formatPullRequestState(state: CodeReviewPullRequestState, isDraft: boolean): string {
  if (isDraft) {
    return "Draft";
  }

  switch (state) {
    case "OPEN":
      return "Open";
    case "MERGED":
      return "Merged";
    case "CLOSED":
      return "Closed";
  }
}

export function summarizeLaneEvidence(lane: ReviewLane): string {
  return `${lane.files.length.toString()} files | ${lane.evidence.length.toString()} evidence`;
}
