import { describe, expect, it } from "vitest";

import {
  countPullRequestsByState,
  formatPullRequestNextAction,
  formatPullRequestState,
  formatPullRequestStatusDetail,
  summarizeLaneEvidence
} from "./index.js";

describe("countPullRequestsByState", () => {
  it("counts pull requests by state", () => {
    expect(
      countPullRequestsByState(
        [
          {
            author: {
              isBot: false,
              login: "csmathguy"
            },
            baseRefName: "main",
            headRefName: "feature/plan-29-pr-workspace",
            isDraft: false,
            number: 29,
            reviewDecision: "",
            state: "OPEN",
            title: "PR workspace",
            updatedAt: "2026-03-14T03:30:00.000Z",
            url: "https://github.com/csmathguy/Taxes/pull/29"
          },
          {
            author: {
              isBot: false,
              login: "csmathguy"
            },
            baseRefName: "main",
            headRefName: "feature/plan-53-local-env-runner",
            isDraft: false,
            number: 25,
            reviewDecision: "",
            state: "MERGED",
            title: "Env runner",
            updatedAt: "2026-03-14T02:59:48.000Z",
            url: "https://github.com/csmathguy/Taxes/pull/25"
          }
        ],
        "OPEN"
      )
    ).toBe(1);
  });
});

describe("formatPullRequestState", () => {
  it("renders human-readable state labels", () => {
    expect(formatPullRequestState("OPEN", false)).toBe("Open");
    expect(formatPullRequestState("MERGED", false)).toBe("Merged");
    expect(formatPullRequestState("CLOSED", true)).toBe("Draft");
  });
});

describe("formatPullRequestStatusDetail", () => {
  it("returns scan-friendly status detail", () => {
    expect(formatPullRequestStatusDetail("OPEN", false)).toBe("Active review thread");
    expect(formatPullRequestStatusDetail("MERGED", false)).toBe("Merged to base branch");
    expect(formatPullRequestStatusDetail("CLOSED", false)).toBe("Closed without merge");
    expect(formatPullRequestStatusDetail("OPEN", true)).toBe("Waiting for review readiness");
  });
});

describe("formatPullRequestNextAction", () => {
  it("returns the next action the reviewer should take", () => {
    expect(formatPullRequestNextAction("OPEN", false)).toBe("Open this PR to continue the guided review.");
    expect(formatPullRequestNextAction("MERGED", false)).toBe("Review is complete. Open only if you need to revisit what shipped.");
    expect(formatPullRequestNextAction("CLOSED", false)).toBe("Open only if you need to understand why this PR was closed.");
    expect(formatPullRequestNextAction("OPEN", true)).toBe("Wait for the author to mark this ready before doing a full review.");
  });
});

describe("summarizeLaneEvidence", () => {
  it("turns lane detail into scan-friendly card copy", () => {
    expect(
      summarizeLaneEvidence({
        evidence: ["Changed tests", "Coverage notes"],
        files: [
          {
            additions: 3,
            areaLabel: "code-review",
            changeType: "modified",
            deletions: 1,
            explanation: {
              rationale: "Tests changed.",
              reviewFocus: ["Inspect the assertions."],
              summary: "Modified unit coverage."
            },
            laneId: "tests",
            path: "apps/code-review/web/src/app/App.test.tsx",
            tags: ["test", "unit", "web"]
          }
        ],
        highlights: ["unit: 1 file"],
        id: "tests",
        questions: ["Is the behavior covered?"],
        reviewerGoal: "Keep proof visible.",
        summary: "Tests",
        title: "Tests"
      })
    ).toBe("1 file | 2 evidence");
  });
});
