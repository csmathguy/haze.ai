import type { CodeReviewPullRequestDetail, ReviewLaneId } from "@taxes/shared";

export interface ReviewStageDecisionOption {
  readonly description: string;
  readonly title: string;
}

export interface ReviewStagePresentation {
  readonly checklist: string[];
  readonly finalDecisionOptions: readonly ReviewStageDecisionOption[];
  readonly intro: string;
}

const FINAL_DECISION_OPTIONS: readonly ReviewStageDecisionOption[] = [
  {
    description: "The walkthrough and evidence are strong enough for a human reviewer to approve in GitHub.",
    title: "Approve in GitHub"
  },
  {
    description: "The change is directionally good, but you want concrete follow-up work captured before closing the review.",
    title: "Create follow-up work"
  },
  {
    description: "The PR still has unresolved issues or missing evidence and should not advance yet.",
    title: "Hold and request changes"
  }
] as const;

export function buildReviewStagePresentation(
  pullRequest: CodeReviewPullRequestDetail,
  laneId: ReviewLaneId
): ReviewStagePresentation {
  return {
    checklist: buildChecklist(pullRequest, laneId),
    finalDecisionOptions: laneId === "validation" ? FINAL_DECISION_OPTIONS : [],
    intro: buildIntro(pullRequest, laneId)
  };
}

function buildChecklist(pullRequest: CodeReviewPullRequestDetail, laneId: ReviewLaneId): string[] {
  switch (laneId) {
    case "context":
      return [
        "Confirm the linked work item and why this PR exists now.",
        "Read the recommended review order before opening the raw diff.",
        pullRequest.linkedPlan === undefined ? "Flag the missing plan link before trusting the rest of the review." : `Open ${pullRequest.linkedPlan.workItemId} if you need deeper planning context.`
      ];
    case "risks":
      return [
        "Identify the repository seams where a regression would be expensive.",
        "Check whether the claimed change fits the intended architecture and workflow boundaries.",
        "Decide which files deserve a slower, more skeptical review pass."
      ];
    case "implementation":
      return [
        "Inspect the changed production files in the suggested order instead of scanning the diff flat.",
        "Confirm the code matches the stated value and does not widen scope unexpectedly.",
        "Capture refactors or cleanup ideas that should become follow-up work instead of inflating this PR."
      ];
    case "tests":
      return [
        "Check whether the tests prove the main behavior change and not only the happy path.",
        "Verify that unit, integration, or E2E evidence matches the risk of the touched code.",
        "Record any missing visual confirmation or browser-level coverage you still need."
      ];
    case "docs":
      return [
        "Confirm reviewer-facing docs and contributor guidance still match the implemented change.",
        "Check whether the PR body gives the next reviewer enough context without reopening unrelated files.",
        "Note any documentation follow-up that should happen outside this PR."
      ];
    case "validation":
      return [
        "Review unresolved concerns, pending checks, and audit evidence before making a decision.",
        "Decide whether this PR is ready for human approval in GitHub, needs a follow-up item, or should be held.",
        "Capture improvement or refactor ideas so they survive after the review is closed."
      ];
  }
}

function buildIntro(pullRequest: CodeReviewPullRequestDetail, laneId: ReviewLaneId): string {
  switch (laneId) {
    case "context":
      return pullRequest.planningWorkItem === undefined
        ? "Start by grounding the review in the work item and claimed value before reading file changes."
        : `Start with ${pullRequest.planningWorkItem.workItemId} so the reviewer understands the purpose of the code change.`;
    case "risks":
      return "Slow down on the architecture and workflow seams before trusting the rest of the diff.";
    case "implementation":
      return "Review the changed code only after context and risky seams are clear.";
    case "tests":
      return "Use tests and artifacts to confirm the claimed behavior, not as a substitute for understanding the code.";
    case "docs":
      return "Check whether long-lived guidance still matches what the PR actually does.";
    case "validation":
      return "This is the review-decision stage. Use it to decide how the human review should conclude and what follow-up should survive.";
  }
}
