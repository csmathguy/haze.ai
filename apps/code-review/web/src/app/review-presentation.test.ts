import { describe, expect, it } from "vitest";
import type { CodeReviewPullRequestDetail } from "@taxes/shared";

import { buildReviewOverviewPresentation } from "./review-presentation.js";

const pullRequest: CodeReviewPullRequestDetail = {
  author: {
    isBot: false,
    login: "codex"
  },
  auditEvidence: {
    activeAgents: ["codex"],
    artifactCount: 1,
    decisionCount: 1,
    failureCount: 0,
    handoffCount: 1,
    recentRuns: [],
    runCount: 1,
    workflows: ["implementation"],
    workItemId: "PLAN-90"
  },
  baseRefName: "main",
  body: "## Summary\n- redesign walkthrough",
  checks: [],
  headSha: "sha-90-presentation",
  headRefName: "feature/plan-90",
  isDraft: false,
  lanes: [
    {
      evidence: ["plan context"],
      files: [],
      highlights: ["context first"],
      id: "context",
      questions: ["What is the work item?"],
      reviewerGoal: "Orient the review.",
      summary: "Context lane.",
      title: "Context"
    }
  ],
  linkedPlan: {
    source: "branch",
    url: "http://127.0.0.1:5175/?workItemId=PLAN-90",
    workItemId: "PLAN-90"
  },
  mergeStateStatus: "CLEAN",
  narrative: {
    reviewFocus: ["Check architecture fit."],
    reviewOrder: ["Context", "Implementation", "Tests", "Docs", "Sign-off"],
    risks: ["Review queue should not dominate the page."],
    summaryBullets: ["Make the walkthrough the main canvas", "Keep the queue as navigation"],
    validationCommands: [],
    valueSummary: "Make Code Review Studio teach and guide human review better.",
    whatChangedSections: [
      {
        items: ["apps/code-review/web/src/app/App.tsx", "apps/code-review/web/src/app/components/PullRequestOverviewPanel.tsx"],
        title: "Review shell"
      }
    ]
  },
  number: 90,
  planningWorkItem: {
    acceptanceCriteria: {
      completeCount: 2,
      pendingCount: 3,
      totalCount: 5
    },
    acceptanceCriteriaPreview: {
      items: ["Reviewer can start with work-item context."],
      totalCount: 5
    },
    latestPlanRun: {
      completedStepCount: 1,
      currentStepTitle: "Refine walkthrough-first layout",
      mode: "single-agent",
      status: "executing",
      summary: "Improve the PR detail experience.",
      totalStepCount: 4
    },
    owner: "codex",
    priority: "high",
    projectKey: "code-review",
    status: "in-progress",
    summary: "Redesign the PR review page so the walkthrough owns the review flow.",
    tasks: {
      completeCount: 1,
      pendingCount: 4,
      totalCount: 5
    },
    taskPreview: {
      items: ["Show the work item summary", "Keep the review order visible"],
      totalCount: 5
    },
    title: "Redesign PR review page: walkthrough-first, actionable stages",
    workItemId: "PLAN-90"
  },
  reviewDecision: "",
  state: "OPEN",
  stats: {
    commentCount: 0,
    fileCount: 7,
    reviewCount: 0,
    totalAdditions: 140,
    totalDeletions: 38
  },
  title: "Redesign PR review page",
  trustStatement: "Human review remains the final gate.",
  updatedAt: "2026-03-22T00:00:00.000Z",
  url: "https://github.com/csmathguy/Taxes/pull/90"
};

describe("buildReviewOverviewPresentation", () => {
  it("builds a work-item-first overview for the walkthrough surface", () => {
    expect(buildReviewOverviewPresentation(pullRequest)).toEqual({
      detailSections: [
        {
          items: [
            "Redesign PR review page: walkthrough-first, actionable stages",
            "Redesign the PR review page so the walkthrough owns the review flow.",
            "Status: in-progress",
            "1/5 tasks complete",
            "2/5 acceptance criteria complete",
            "Current step: Refine walkthrough-first layout"
          ],
          title: "Work Item Context"
        },
        {
          items: [
            "Review shell: apps/code-review/web/src/app/App.tsx, apps/code-review/web/src/app/components/PullRequestOverviewPanel.tsx"
          ],
          title: "Code Areas To Review"
        },
        {
          items: ["Context", "Implementation", "Tests", "Docs", "Sign-off"],
          title: "Recommended Review Order"
        }
      ],
      heroEyebrow: "PLAN-90 | PR #90 | Open",
      heroSummary: [
        "Make Code Review Studio teach and guide human review better.",
        "Make the walkthrough the main canvas",
        "Keep the queue as navigation"
      ],
      heroTitle: "Redesign the PR review page so the walkthrough owns the review flow.",
      metaChips: ["7 files", "+140 / -38", "Merge: clean", "PLAN-90"],
      primaryActions: [
        {
          description: "Confirm the linked work item, review order, and code areas before reading the diff.",
          title: "Start with context"
        },
        {
          description: "Use the staged walkthrough to review risks, tests, implementation, docs, and sign-off in order.",
          title: "Walk the PR"
        },
        {
          description: "Record follow-ups or improvement ideas instead of losing them in chat or comments.",
          title: "Capture improvements"
        }
      ]
    });
  });
});
