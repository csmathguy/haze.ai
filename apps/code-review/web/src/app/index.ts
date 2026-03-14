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
  return `${formatCount(lane.files.length, "file")} | ${formatCount(lane.evidence.length, "evidence", "evidence")}`;
}

function formatCount(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toString()} ${count === 1 ? singular : plural}`;
}
