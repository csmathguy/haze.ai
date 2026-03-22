import { describe, expect, it } from "vitest";
import type { CodeReviewAgentReview } from "@taxes/shared";

import { buildAgentReviewPresentation } from "./agent-review-presentation.js";

const review: CodeReviewAgentReview = {
  findings: [
    {
      confidence: "medium",
      evidence: ["Implementation logic is small and contained."],
      id: "finding-1",
      lens: "workflow",
      rationale: "The change fits the current workflow.",
      suggestedAction: "accept-now",
      summary: "The implementation can stay in the current PR.",
      title: "Workflow fit"
    },
    {
      confidence: "medium",
      evidence: ["A refactor path is visible but not required for approval."],
      id: "finding-2",
      lens: "readability",
      rationale: "The code can ship, but cleanup work is worth tracking.",
      suggestedAction: "follow-up",
      summary: "Consider extracting duplicated presentation logic later.",
      title: "Refactor opportunity"
    },
    {
      confidence: "high",
      evidence: ["No validation command was attached for the risky path."],
      id: "finding-3",
      lens: "testing",
      rationale: "The reviewer lacks enough evidence to approve safely.",
      suggestedAction: "reject",
      summary: "Missing validation for the highest-risk path.",
      title: "Validation gap"
    }
  ],
  generatedAt: "2026-03-22T04:00:00.000Z",
  reviewer: "agent-review",
  status: "advisory",
  summary: "The advisory pass found one blocking issue and one follow-up candidate."
};

describe("buildAgentReviewPresentation", () => {
  it("groups findings by reviewer action and derives the next human step", () => {
    expect(buildAgentReviewPresentation(review)).toEqual({
      groups: [
        {
          actionLabel: "Accept for this PR",
          items: [
            {
              confidenceLabel: "medium confidence",
              lensLabel: "workflow",
              summary: "The implementation can stay in the current PR.",
              title: "Workflow fit"
            }
          ],
          title: "Can stay in this PR"
        },
        {
          actionLabel: "Approve as follow-up",
          items: [
            {
              confidenceLabel: "medium confidence",
              lensLabel: "readability",
              summary: "Consider extracting duplicated presentation logic later.",
              title: "Refactor opportunity"
            }
          ],
          title: "Capture as follow-up"
        },
        {
          actionLabel: "Reject for now",
          items: [
            {
              confidenceLabel: "high confidence",
              lensLabel: "testing",
              summary: "Missing validation for the highest-risk path.",
              title: "Validation gap"
            }
          ],
          title: "Needs a hold or change"
        }
      ],
      nextAction: "Hold the review until the reject-now findings are understood or resolved.",
      summary: "The advisory pass found one blocking issue and one follow-up candidate."
    });
  });
});
