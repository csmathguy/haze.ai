import { describe, expect, it } from "vitest";

import type { CodeReviewPullRequestDetail } from "@taxes/shared";

import { buildLaneSections, buildTrustSummary, createReviewNotebook, orderWalkthroughLanes } from "./walkthrough.js";

const pullRequest: CodeReviewPullRequestDetail = {
  author: {
    isBot: false,
    login: "csmathguy"
  },
  auditEvidence: {
    activeAgents: ["codex"],
    artifactCount: 0,
    artifacts: [],
    decisionCount: 0,
    failureCount: 0,
    handoffCount: 0,
    recentRuns: [
      {
        executionCount: 4,
        failureCount: 0,
        runId: "2026-03-14T173000-000-implementation-abcd1234",
        startedAt: "2026-03-14T17:30:00.000Z",
        status: "success",
        workflow: "implementation"
      }
    ],
    runCount: 1,
    workflows: ["implementation"],
    workItemId: "PLAN-32"
  },
  baseRefName: "main",
  body: "## Summary\n- Add a walkthrough",
  checks: [],
  headSha: "sha-32-walkthrough",
  headRefName: "feature/plan-32-walkthrough-diff",
  isDraft: false,
  linkedPlan: {
    source: "branch",
    url: "http://127.0.0.1:5175/?workItemId=PLAN-32",
    workItemId: "PLAN-32"
  },
  lanes: [
    {
      evidence: ["Narrative summary"],
      files: [],
      highlights: ["Start here"],
      id: "context",
      questions: ["What changed?"],
      reviewerGoal: "Orient the review.",
      summary: "Context lane.",
      title: "Context"
    },
    {
      evidence: ["End-to-end: 1 file"],
      files: [
        {
          additions: 10,
          areaLabel: "code-review",
          changeType: "added",
          deletions: 0,
          explanation: {
            rationale: "This test proves the whole path.",
            reviewFocus: ["Check the assertion flow."],
            summary: "Added end-to-end coverage."
          },
          laneId: "tests",
          path: "apps/code-review/web/e2e/review.spec.ts",
          tags: ["test", "e2e", "web"]
        },
        {
          additions: 4,
          areaLabel: "code-review",
          changeType: "modified",
          deletions: 1,
          explanation: {
            rationale: "This test covers the module seam.",
            reviewFocus: ["Check unit assertions."],
            summary: "Modified unit coverage."
          },
          laneId: "tests",
          path: "apps/code-review/web/src/app/App.test.tsx",
          tags: ["test", "unit", "web"]
        }
      ],
      highlights: ["End-to-end: 1 file", "Unit: 1 file"],
      id: "tests",
      questions: ["Are tests enough?"],
      reviewerGoal: "Inspect proof.",
      summary: "Tests lane.",
      title: "Tests"
    },
    {
      evidence: ["Implementation file"],
      files: [],
      highlights: ["web: 1 file"],
      id: "implementation",
      questions: ["Is the implementation coherent?"],
      reviewerGoal: "Inspect implementation.",
      summary: "Implementation lane.",
      title: "Implementation"
    }
  ],
  mergeStateStatus: "CLEAN",
  narrative: {
    reviewFocus: ["Confirm the walkthrough flow."],
    reviewOrder: ["Context", "Tests", "Implementation"],
    risks: ["No unusual risk."],
    summaryBullets: ["Add a walkthrough", "Keep review state visible"],
    validationCommands: [],
    valueSummary: "Add a walkthrough",
    whatChangedSections: []
  },
  number: 32,
  planningWorkItem: {
    acceptanceCriteria: {
      completeCount: 1,
      pendingCount: 0,
      totalCount: 1
    },
    acceptanceCriteriaPreview: {
      items: ["Reviewer can walk the PR in a guided order."],
      totalCount: 1
    },
    latestPlanRun: {
      completedStepCount: 1,
      currentStepTitle: "Implement the walkthrough",
      mode: "single-agent",
      status: "executing",
      summary: "Build the walkthrough trust gate.",
      totalStepCount: 2
    },
    owner: "codex",
    priority: "high",
    projectKey: "code-review",
    status: "in-progress",
    summary: "Add an interactive walkthrough.",
    tasks: {
      completeCount: 1,
      pendingCount: 1,
      totalCount: 2
    },
    taskPreview: {
      items: ["Add walkthrough lane ordering", "Keep review trust visible"],
      totalCount: 2
    },
    title: "Interactive walkthrough and trust confirmation flow",
    workItemId: "PLAN-32"
  },
  reviewDecision: "",
  state: "OPEN",
  stats: {
    commentCount: 0,
    fileCount: 2,
    reviewCount: 0,
    totalAdditions: 14,
    totalDeletions: 1
  },
  title: "Add a walkthrough",
  trustStatement: "Human review remains the gate.",
  updatedAt: "2026-03-14T17:30:00.000Z",
  url: "https://github.com/csmathguy/Taxes/pull/32"
};

const contextLane = pullRequest.lanes[0];
const testsLane = pullRequest.lanes[1];
const implementationLane = pullRequest.lanes[2];

describe("orderWalkthroughLanes", () => {
  it("uses the intended review order rather than incoming array order", () => {
    expect(contextLane).toBeDefined();
    expect(testsLane).toBeDefined();
    expect(implementationLane).toBeDefined();

    const ordered = orderWalkthroughLanes([implementationLane, testsLane, contextLane].filter(isDefined));

    expect(ordered.map((lane) => lane.id)).toEqual(["context", "implementation", "tests"]);
  });
});

describe("buildLaneSections", () => {
  it("splits the tests lane into subtype sections", () => {
    expect(buildLaneSections(requireValue(testsLane)).map((section) => section.title)).toEqual(["End-to-end", "Unit"]);
  });
});

describe("buildTrustSummary", () => {
  it("combines notebook progress with planning and audit evidence", () => {
    const notebook = createReviewNotebook(pullRequest.lanes);
    const updatedNotebook = {
      ...notebook,
      context: {
        ...notebook.context,
        status: "confirmed" as const
      },
      tests: {
        ...notebook.tests,
        concerns: "Need one more negative-path assertion.",
        followUps: "Create refactor work item for flaky selector handling.",
        status: "needs-follow-up" as const
      },
      implementation: {
        ...notebook.implementation,
        status: "confirmed" as const
      }
    };

    expect(buildTrustSummary(pullRequest, updatedNotebook)).toEqual({
      confirmedLaneCount: 2,
      evidenceCheckpoints: [
        {
          detail: "2 of 3 walkthrough checkpoints confirmed",
          label: "Review coverage",
          status: "attention"
        },
        {
          detail: "PLAN-32 is in-progress",
          label: "Planning context",
          status: "complete"
        },
        {
          detail: "1 linked run",
          label: "Audit lineage",
          status: "complete"
        },
        {
          detail: "No reported checks",
          label: "Validation signals",
          status: "pending"
        },
        {
          detail: "clean",
          label: "Merge posture",
          status: "complete"
        }
      ],
      followUpQueue: [
        "Tests: follow-up requested",
        "Tests: Create refactor work item for flaky selector handling.",
        "No reported checks were attached to this pull request."
      ],
      statusLabel: "Hold before decision",
      statusTone: "warning",
      valueSummary: ["Add a walkthrough", "Keep review state visible"]
    });
  });
});

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function requireValue<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("Expected test fixture value to be defined.");
  }

  return value;
}
