import type { CodeReviewAgentFinding, CodeReviewAgentReview } from "@taxes/shared";

export interface AgentReviewPresentationGroup {
  readonly actionLabel: string;
  readonly items: {
    readonly confidenceLabel: string;
    readonly lensLabel: string;
    readonly summary: string;
    readonly title: string;
  }[];
  readonly title: string;
}

export interface AgentReviewPresentation {
  readonly groups: AgentReviewPresentationGroup[];
  readonly nextAction: string;
  readonly summary: string;
}

export function buildAgentReviewPresentation(review: CodeReviewAgentReview): AgentReviewPresentation {
  const groupedFindings = {
    acceptNow: review.findings.filter((finding) => finding.suggestedAction === "accept-now"),
    followUp: review.findings.filter((finding) => finding.suggestedAction === "follow-up"),
    reject: review.findings.filter((finding) => finding.suggestedAction === "reject")
  };

  return {
    groups: [
      buildGroup("Can stay in this PR", "Accept for this PR", groupedFindings.acceptNow),
      buildGroup("Capture as follow-up", "Approve as follow-up", groupedFindings.followUp),
      buildGroup("Needs a hold or change", "Reject for now", groupedFindings.reject)
    ].filter((group) => group.items.length > 0),
    nextAction: buildNextAction(groupedFindings),
    summary: review.summary
  };
}

function buildGroup(title: string, actionLabel: string, findings: CodeReviewAgentFinding[]): AgentReviewPresentationGroup {
  return {
    actionLabel,
    items: findings.map((finding) => ({
      confidenceLabel: `${finding.confidence} confidence`,
      lensLabel: finding.lens,
      summary: finding.summary,
      title: finding.title
    })),
    title
  };
}

function buildNextAction(groupedFindings: {
  readonly acceptNow: CodeReviewAgentFinding[];
  readonly followUp: CodeReviewAgentFinding[];
  readonly reject: CodeReviewAgentFinding[];
}): string {
  if (groupedFindings.reject.length > 0) {
    return "Hold the review until the reject-now findings are understood or resolved.";
  }

  if (groupedFindings.followUp.length > 0) {
    return "The change looks directionally acceptable, but capture the suggested follow-up work before closing review.";
  }

  return "No blocking agent findings were raised. Finish the human review and decide in GitHub.";
}
