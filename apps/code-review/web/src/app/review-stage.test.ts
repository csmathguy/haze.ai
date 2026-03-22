import { describe, expect, it } from "vitest";
import type { CodeReviewPullRequestDetail } from "@taxes/shared";

import { buildReviewStagePresentation } from "./review-stage.js";

const pullRequest: CodeReviewPullRequestDetail = {
  author: {
    isBot: false,
    login: "codex"
  },
  baseRefName: "main",
  body: "## Summary\n- improve code review ux",
  checks: [],
  headSha: "sha-90-stage",
  headRefName: "feature/plan-90",
  isDraft: false,
  lanes: [
    {
      evidence: [],
      files: [],
      highlights: [],
      id: "context",
      questions: ["What is the work item?"],
      reviewerGoal: "Orient the reviewer.",
      summary: "Context lane",
      title: "Context"
    },
    {
      evidence: [],
      files: [],
      highlights: [],
      id: "validation",
      questions: ["Can this be approved?"],
      reviewerGoal: "Sign off.",
      summary: "Validation lane",
      title: "Validation"
    }
  ],
  linkedPlan: {
    source: "branch",
    url: "http://127.0.0.1:5175/?workItemId=PLAN-90",
    workItemId: "PLAN-90"
  },
  mergeStateStatus: "CLEAN",
  narrative: {
    reviewFocus: [],
    reviewOrder: [],
    risks: [],
    summaryBullets: ["make review clearer"],
    validationCommands: [],
    valueSummary: "Improve the walkthrough experience.",
    whatChangedSections: []
  },
  number: 90,
  reviewDecision: "",
  state: "OPEN",
  stats: {
    commentCount: 0,
    fileCount: 3,
    reviewCount: 0,
    totalAdditions: 50,
    totalDeletions: 10
  },
  title: "Improve code review walkthrough",
  trustStatement: "Human review remains the final gate.",
  updatedAt: "2026-03-22T00:00:00.000Z",
  url: "https://github.com/csmathguy/Taxes/pull/90"
};

describe("buildReviewStagePresentation", () => {
  it("builds context-stage checklist guidance", () => {
    expect(buildReviewStagePresentation(pullRequest, "context")).toEqual({
      checklist: [
        "Confirm the linked work item and why this PR exists now.",
        "Read the recommended review order before opening the raw diff.",
        "Open PLAN-90 if you need deeper planning context."
      ],
      finalDecisionOptions: [],
      intro: "Start by grounding the review in the work item and claimed value before reading file changes."
    });
  });

  it("builds final-stage decision options for validation", () => {
    expect(buildReviewStagePresentation(pullRequest, "validation")).toEqual({
      checklist: [
        "Review unresolved concerns, pending checks, and audit evidence before making a decision.",
        "Decide whether this PR is ready for human approval in GitHub, needs a follow-up item, or should be held.",
        "Capture improvement or refactor ideas so they survive after the review is closed."
      ],
      finalDecisionOptions: [
        {
          description: "The walkthrough and evidence are strong enough for a human reviewer to approve in GitHub.",
          title: "Approve in GitHub"
        },
        {
          description: "The PR is ready to land and the reviewer wants to merge it from this guided review surface.",
          title: "Merge via GitHub"
        },
        {
          description: "The change is directionally good, but you want concrete follow-up work captured before closing the review.",
          title: "Create follow-up work"
        },
        {
          description: "The PR still has unresolved issues or missing evidence and should not advance yet.",
          title: "Hold and request changes"
        }
      ],
      intro: "This is the review-decision stage. Use it to decide how the human review should conclude and what follow-up should survive."
    });
  });
});
