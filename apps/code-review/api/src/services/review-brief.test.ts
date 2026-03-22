import { describe, expect, it } from "vitest";
import type { CodeReviewPullRequestDetail } from "@taxes/shared";

import { buildReviewBrief } from "./review-brief.js";

const baseDetail: CodeReviewPullRequestDetail = {
  author: {
    isBot: false,
    login: "codex"
  },
  baseRefName: "main",
  body: "## Summary\n- Improve code review",
  checks: [],
  headRefName: "feature/plan-239",
  headSha: "abcdef1234567890",
  isDraft: false,
  lanes: [
    {
      evidence: [],
      files: [],
      highlights: ["packages/shared/src/code-review.ts: shared contract changed"],
      id: "risks",
      questions: ["What could break?"],
      reviewerGoal: "Inspect risky seams.",
      summary: "Risks lane",
      title: "Risks"
    },
    {
      evidence: [],
      files: [
        {
          additions: 12,
          areaLabel: "code-review",
          changeType: "modified",
          deletions: 1,
          explanation: {
            rationale: "This is the main contract seam for the review payload.",
            reviewFocus: ["Check compatibility."],
            summary: "Updates the shared review contract."
          },
          laneId: "implementation",
          path: "packages/shared/src/code-review.ts",
          tags: ["shared"]
        }
      ],
      highlights: ["shared: 1 file"],
      id: "implementation",
      questions: ["Does the code match the goal?"],
      reviewerGoal: "Inspect implementation.",
      summary: "Implementation lane",
      title: "Implementation"
    },
    {
      evidence: [],
      files: [],
      highlights: [],
      id: "tests",
      questions: ["Are tests enough?"],
      reviewerGoal: "Inspect proof.",
      summary: "Tests lane",
      title: "Tests"
    }
  ],
  mergeStateStatus: "CLEAN",
  narrative: {
    reviewFocus: ["Check the contract and downstream usage."],
    reviewOrder: ["Context", "Risks", "Implementation"],
    risks: ["Contract changes can break the web or API payload shape."],
    summaryBullets: ["Add a durable review-brief contract.", "Prepare the API for persisted advisory briefing data."],
    validationCommands: [],
    valueSummary: "Add a durable review-brief contract for code review.",
    whatChangedSections: []
  },
  number: 239,
  planningWorkItem: {
    acceptanceCriteria: {
      completeCount: 0,
      pendingCount: 3,
      totalCount: 3
    },
    acceptanceCriteriaPreview: {
      items: ["Review brief is generated for the current PR.", "Opening step explains how to begin the review."],
      totalCount: 3
    },
    priority: "high",
    projectKey: "code-review",
    status: "in-progress",
    summary: "Build a durable agent-generated review briefing pipeline.",
    tasks: {
      completeCount: 0,
      pendingCount: 8,
      totalCount: 8
    },
    taskPreview: {
      items: ["Generate review brief", "Persist by head SHA", "Render in the opening step"],
      totalCount: 8
    },
    title: "Agent-assisted pre-review suggestions in PR walkthrough",
    workItemId: "PLAN-239"
  },
  reviewDecision: "",
  state: "OPEN",
  stats: {
    commentCount: 0,
    fileCount: 9,
    reviewCount: 0,
    totalAdditions: 40,
    totalDeletions: 5
  },
  title: "Add review brief pipeline",
  trustStatement: "Human review remains the final gate.",
  updatedAt: "2026-03-22T03:20:00.000Z",
  url: "https://github.com/csmathguy/Haze.ai/pull/239",
  agentReview: {
    findings: [
      {
        confidence: "medium",
        evidence: ["No explicit validation commands were found."],
        id: "testing-missing-validation-commands",
        lens: "testing",
        rationale: "Reviewers need visible evidence.",
        suggestedAction: "follow-up",
        summary: "Add explicit validation evidence to the walkthrough.",
        title: "Validation evidence is thin"
      }
    ],
    generatedAt: "2026-03-22T03:20:00.000Z",
    reviewer: "code-review-agent",
    status: "advisory",
    summary: "Advisory findings."
  }
};

describe("buildReviewBrief", () => {
  it("builds a reviewer-facing brief from the enriched pull request detail", () => {
    const brief = buildReviewBrief(baseDetail, "2026-03-22T03:25:00.000Z");

    expect(brief.generatedAt).toBe("2026-03-22T03:25:00.000Z");
    expect(brief.sourceHeadSha).toBe("abcdef1234567890");
    expect(brief.summary).toBe("PLAN-239 drives this PR: Agent-assisted pre-review suggestions in PR walkthrough");
    expect(brief.whatThisPrDoes).toEqual([
      "Add a durable review-brief contract.",
      "Prepare the API for persisted advisory briefing data."
    ]);
    expect(brief.followUpCandidates).toContain("Add explicit validation evidence to the walkthrough.");
    expect(brief.followUpCandidates).toContain("Consider whether this PR should be decomposed or whether refactor follow-up work should be created.");
    expect(brief.inspectFirst).toContain("packages/shared/src/code-review.ts: shared contract changed");
    expect(brief.inspectFirst).toContain("packages/shared/src/code-review.ts: Updates the shared review contract.");
    expect(brief.missingEvidence).toContain("No explicit validation commands are attached to the PR narrative.");
    expect(brief.missingEvidence).toContain("No reported checks are attached to this PR detail yet.");
    expect(brief.missingEvidence).toContain("No changed test files were classified for this PR.");
    expect(brief.startHere).toContain("Anchor this review to a planning item before trusting the walkthrough.");
    expect(brief.startHere).toContain("Follow the guided review order starting with Context.");
    expect(brief.startHere).toContain(
      "Keep the advisory findings separate from approval. The strongest current signal is: Validation evidence is thin."
    );
  });
});
