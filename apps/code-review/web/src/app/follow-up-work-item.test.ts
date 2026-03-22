import { describe, expect, it } from "vitest";
import type { CodeReviewPullRequestDetail } from "@taxes/shared";

import { buildFollowUpWorkItemDraft } from "./follow-up-work-item.js";
import type { ReviewNotebookEntry } from "./walkthrough.js";

const pullRequest: CodeReviewPullRequestDetail = {
  author: {
    isBot: false,
    login: "codex"
  },
  baseRefName: "main",
  body: "## Summary\n- improve review flow",
  checks: [],
  headRefName: "feature/plan-90",
  isDraft: false,
  lanes: [
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
    summaryBullets: [],
    validationCommands: [],
    valueSummary: "Improve the walkthrough review flow.",
    whatChangedSections: []
  },
  number: 90,
  planningWorkItem: {
    acceptanceCriteria: {
      completeCount: 1,
      pendingCount: 1,
      totalCount: 2
    },
    priority: "high",
    projectKey: "code-review",
    status: "in-progress",
    summary: "Redesign the PR review page so the walkthrough owns the review flow.",
    tasks: {
      completeCount: 1,
      pendingCount: 3,
      totalCount: 4
    },
    title: "Redesign PR review page: walkthrough-first, actionable stages",
    workItemId: "PLAN-90"
  },
  reviewDecision: "",
  state: "OPEN",
  stats: {
    commentCount: 0,
    fileCount: 3,
    reviewCount: 0,
    totalAdditions: 20,
    totalDeletions: 4
  },
  title: "Improve review walkthrough",
  trustStatement: "Human review remains the final gate.",
  updatedAt: "2026-03-22T00:00:00.000Z",
  url: "https://github.com/csmathguy/Taxes/pull/90"
};

describe("buildFollowUpWorkItemDraft", () => {
  it("returns null when the reviewer has not captured follow-up lines", () => {
    const entry: ReviewNotebookEntry = {
      concerns: "",
      confirmations: "",
      followUps: "   ",
      notes: "",
      status: "confirmed"
    };

    expect(buildFollowUpWorkItemDraft(pullRequest, entry)).toBeNull();
  });

  it("creates a planning draft from final-stage follow-up lines", () => {
    const entry: ReviewNotebookEntry = {
      concerns: "",
      confirmations: "",
      followUps: "Extract final-stage action area\nAdd audit links to overview",
      notes: "",
      status: "needs-follow-up"
    };

    expect(buildFollowUpWorkItemDraft(pullRequest, entry)).toEqual({
      acceptanceCriteria: [
        "The follow-up work identified during PR review is captured as explicit planning work.",
        "The item references the originating pull request so later reviewers can recover the context."
      ],
      blockedByWorkItemIds: [],
      kind: "task",
      priority: "medium",
      projectKey: "code-review",
      summary: "Redesign the PR review page so the walkthrough owns the review flow. Originated from PR #90 review.",
      tasks: ["Extract final-stage action area", "Add audit links to overview"],
      title: "PLAN-90 follow-up: Improve review walkthrough"
    });
  });
});
