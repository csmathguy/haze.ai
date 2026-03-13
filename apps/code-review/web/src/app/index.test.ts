import { describe, expect, it } from "vitest";

import { groupRoadmapItems, summarizeLaneEvidence } from "./index.js";

describe("groupRoadmapItems", () => {
  it("groups roadmap items by stage", () => {
    const grouped = groupRoadmapItems([
      {
        dependencies: [],
        id: "mvp",
        outcome: "MVP exists.",
        stage: "mvp",
        summary: "Scaffold the app.",
        title: "MVP"
      },
      {
        dependencies: [],
        id: "later",
        outcome: "Motivation is careful.",
        stage: "later",
        summary: "Prototype motivation.",
        title: "Motivation"
      }
    ]);

    expect(grouped.mvp).toHaveLength(1);
    expect(grouped.later).toHaveLength(1);
    expect(grouped.next).toEqual([]);
  });
});

describe("summarizeLaneEvidence", () => {
  it("turns lane detail into scan-friendly card copy", () => {
    expect(
      summarizeLaneEvidence({
        evidence: ["Changed tests", "Coverage notes"],
        id: "tests",
        questions: ["Is the behavior covered?"],
        reviewerGoal: "Keep proof visible.",
        summary: "Tests",
        title: "Tests"
      })
    ).toBe("2 evidence | 1 questions");
  });
});
