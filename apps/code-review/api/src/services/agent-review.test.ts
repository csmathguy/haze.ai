import { describe, expect, it } from "vitest";
import type { CodeReviewPullRequestDetail } from "@taxes/shared";

import { buildAgentReview } from "./agent-review.js";

const baseDetail: CodeReviewPullRequestDetail = {
  author: {
    isBot: false,
    login: "codex"
  },
  baseRefName: "main",
  body: "## Summary\n- improve review",
  checks: [],
  headSha: "abcdef1234567890",
  headRefName: "feature/no-plan",
  isDraft: false,
  lanes: [
    {
      evidence: [],
      files: [],
      highlights: [],
      id: "validation",
      questions: ["Can this ship?"],
      reviewerGoal: "Decide whether the evidence is enough.",
      summary: "Validation lane",
      title: "Validation"
    }
  ],
  mergeStateStatus: "CLEAN",
  narrative: {
    reviewFocus: [],
    reviewOrder: [],
    risks: [],
    summaryBullets: [],
    validationCommands: [],
    valueSummary: "Improve review walkthrough.",
    whatChangedSections: []
  },
  number: 90,
  reviewDecision: "",
  state: "OPEN",
  stats: {
    commentCount: 0,
    fileCount: 10,
    reviewCount: 0,
    totalAdditions: 20,
    totalDeletions: 4
  },
  title: "Improve review walkthrough",
  trustStatement: "Human review remains the final gate.",
  updatedAt: "2026-03-21T22:30:00.000Z",
  url: "https://github.com/csmathguy/Taxes/pull/90"
};

describe("buildAgentReview", () => {
  it("creates advisory findings from missing planning and validation evidence", () => {
    const review = buildAgentReview(baseDetail, baseDetail.updatedAt);

    expect(review).toEqual({
      findings: [
        expect.objectContaining({
          id: "workflow-missing-plan-link",
          suggestedAction: "follow-up",
          title: "Missing planning lineage"
        }),
        expect.objectContaining({
          id: "testing-missing-validation-commands",
          lens: "testing"
        }),
        expect.objectContaining({
          id: "testing-no-reported-checks",
          lens: "testing"
        }),
        expect.objectContaining({
          id: "readability-large-pr-scope",
          lens: "readability"
        })
      ],
      generatedAt: "2026-03-21T22:30:00.000Z",
      reviewer: "code-review-agent",
      status: "advisory",
      summary: "Advisory findings synthesized from planning linkage, validation evidence, and changed-code risk signals. Human review still decides."
    });
  });

  it("escalates audit failures as a reject recommendation", () => {
    const review = buildAgentReview(
      {
        ...baseDetail,
        auditEvidence: {
          activeAgents: ["codex"],
          artifactCount: 0,
          artifacts: [],
          decisionCount: 0,
          failureCount: 2,
          handoffCount: 0,
          recentRuns: [],
          runCount: 1,
          workflows: ["implementation"],
          workItemId: "PLAN-90"
        },
        linkedPlan: {
          source: "branch",
          url: "http://127.0.0.1:5175/?workItemId=PLAN-90",
          workItemId: "PLAN-90"
        },
        narrative: {
          ...baseDetail.narrative,
          validationCommands: ["npm run typecheck:code-review:web"]
        }
      },
      baseDetail.updatedAt
    );

    expect(review?.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "risk-audit-failures-present",
          suggestedAction: "reject"
        })
      ])
    );
  });
});
