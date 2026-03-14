import { describe, expect, it } from "vitest";

import type { CodeReviewPullRequestDetail } from "@taxes/shared";

import { buildLaneSections, buildTrustSummary, createReviewNotebook, orderWalkthroughLanes } from "./walkthrough.js";

const pullRequest: CodeReviewPullRequestDetail = {
  author: {
    isBot: false,
    login: "csmathguy"
  },
  baseRefName: "main",
  body: "## Summary\n- Add a walkthrough",
  checks: [],
  headRefName: "feature/plan-32-walkthrough-diff",
  isDraft: false,
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

    expect(ordered.map((lane) => lane.id)).toEqual(["context", "tests", "implementation"]);
  });
});

describe("buildLaneSections", () => {
  it("splits the tests lane into subtype sections", () => {
    expect(buildLaneSections(requireValue(testsLane)).map((section) => section.title)).toEqual(["End-to-end", "Unit"]);
  });
});

describe("buildTrustSummary", () => {
  it("uses notebook status and concerns to summarize reviewer confidence", () => {
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
        status: "needs-follow-up" as const
      },
      implementation: {
        ...notebook.implementation,
        status: "confirmed" as const
      }
    };

    expect(buildTrustSummary(pullRequest, updatedNotebook)).toEqual({
      confidenceLabel: "Needs follow-up",
      confirmedLaneCount: 2,
      remainingRisk: ["Tests: follow-up requested"],
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
