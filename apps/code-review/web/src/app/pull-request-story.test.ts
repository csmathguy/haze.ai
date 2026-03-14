import { describe, expect, it } from "vitest";
import type { CodeReviewPullRequestDetail } from "@taxes/shared";

import { buildLaneNarrativePresentation, buildPullRequestStory } from "./pull-request-story.js";

const pullRequest: CodeReviewPullRequestDetail = {
  author: {
    isBot: false,
    login: "codex"
  },
  auditEvidence: {
    activeAgents: ["codex"],
    artifactCount: 0,
    decisionCount: 1,
    failureCount: 0,
    handoffCount: 1,
    recentRuns: [
      {
        executionCount: 12,
        failureCount: 0,
        runId: "2026-03-14T180000-000-implementation-abc12345",
        startedAt: "2026-03-14T18:00:00.000Z",
        status: "success",
        workflow: "implementation"
      }
    ],
    runCount: 1,
    workflows: ["implementation"],
    workItemId: "PLAN-65"
  },
  baseRefName: "main",
  body: "## Summary\n- Replace the PR cards with a table\n- Move detail into a drawer",
  checks: [
    {
      conclusion: "SUCCESS",
      name: "lint",
      status: "COMPLETED",
      workflowName: "Quality"
    },
    {
      name: "integration",
      status: "IN_PROGRESS",
      workflowName: "CI"
    }
  ],
  headRefName: "feature/plan-65-code-review-trust-gate",
  isDraft: false,
  lanes: [
    {
      evidence: ["Story-first review", "Story-first review"],
      files: [],
      highlights: ["lead with value", "lead with value"],
      id: "context",
      questions: ["Why does this matter?"],
      reviewerGoal: "Orient the reviewer.",
      summary: "Context",
      title: "Context"
    },
    {
      evidence: ["npm run lint", "npm run lint", "npm run typecheck"],
      files: [],
      highlights: ["npm run lint", "npm run typecheck", "npm run lint"],
      id: "validation",
      questions: ["Do the quality gates match the change?"],
      reviewerGoal: "Inspect the validation signal.",
      summary: "Validation",
      title: "Validation"
    }
  ],
  linkedPlan: {
    source: "branch",
    url: "http://127.0.0.1:5175/?workItemId=PLAN-65",
    workItemId: "PLAN-65"
  },
  mergeStateStatus: "CLEAN",
  narrative: {
    reviewFocus: ["Confirm that the drawer tells the story before the raw diff."],
    reviewOrder: ["Context", "Validation"],
    risks: ["Make sure important detail is still discoverable."],
    summaryBullets: ["Turn the queue into a scan-friendly table", "Move detail into a right-side drawer"],
    validationCommands: ["npm run lint", "npm run lint", "npm run typecheck"],
    valueSummary: "Improve PR review UX.",
    whatChangedSections: [
      {
        items: ["apps/code-review/web/src/app/App.tsx", "apps/code-review/web/src/app/components/PullRequestList.tsx"],
        title: "Review queue and layout"
      }
    ]
  },
  number: 40,
  planningWorkItem: {
    acceptanceCriteria: {
      completeCount: 4,
      pendingCount: 0,
      totalCount: 4
    },
    latestPlanRun: {
      completedStepCount: 2,
      currentStepTitle: "Refine the queue and drawer UX",
      mode: "single-agent",
      status: "executing",
      summary: "Improve the code-review detail surface.",
      totalStepCount: 4
    },
    owner: "codex",
    priority: "high",
    projectKey: "code-review",
    status: "in-progress",
    summary: "Make Code Review Studio the human trust gate.",
    tasks: {
      completeCount: 3,
      pendingCount: 1,
      totalCount: 4
    },
    title: "Trust-gate workspace with planning and audit evidence",
    workItemId: "PLAN-65"
  },
  reviewDecision: "",
  state: "OPEN",
  stats: {
    commentCount: 0,
    fileCount: 5,
    reviewCount: 0,
    totalAdditions: 120,
    totalDeletions: 40
  },
  title: "Refine the code-review queue and drawer UX",
  trustStatement: "Human review remains the final gate.",
  updatedAt: "2026-03-14T18:15:00.000Z",
  url: "https://github.com/csmathguy/Taxes/pull/40"
};

describe("buildPullRequestStory", () => {
  it("prioritizes value, story, and condensed trust signals", () => {
    expect(buildPullRequestStory(pullRequest)).toEqual({
      codebaseStory: ["Review queue and layout: apps/code-review/web/src/app/App.tsx, apps/code-review/web/src/app/components/PullRequestList.tsx"],
      reviewQuestions: [
        "Confirm that the drawer tells the story before the raw diff.",
        "Make sure important detail is still discoverable."
      ],
      trustSignals: [
        "No failing reported checks",
        "1 check still pending",
        "2 reported checks in total",
        "3/4 planned tasks complete",
        "4/4 acceptance criteria cleared"
      ],
      validationCommands: ["npm run lint", "npm run typecheck"],
      validationOverview: ["No failing reported checks", "1 check still pending", "2 reported checks in total"],
      whyItMatters: [
        "Make Code Review Studio the human trust gate.",
        "Turn the queue into a scan-friendly table",
        "Move detail into a right-side drawer"
      ]
    });
  });
});

describe("buildLaneNarrativePresentation", () => {
  it("turns raw validation commands into a reviewer-friendly summary", () => {
    const validationLane = pullRequest.lanes.find((lane) => lane.id === "validation");

    expect(validationLane).toBeDefined();

    expect(buildLaneNarrativePresentation(pullRequest, requireValue(validationLane))).toEqual({
      evidence: ["Quality: success", "CI: in_progress"],
      highlights: [
        "No failing reported checks",
        "1 check still pending",
        "2 reported checks in total",
        "2 explicit validation commands attached to the PR narrative"
      ],
      questions: ["Do the quality gates match the change?"]
    });
  });
});

function requireValue<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("Expected test fixture value to be defined.");
  }

  return value;
}
