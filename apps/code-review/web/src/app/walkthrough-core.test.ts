import { describe, expect, it } from "vitest";
import type { ReviewLane } from "@taxes/shared";

import { getWalkthroughStageCopy, orderWalkthroughLanes } from "./walkthrough-core.js";

const lanes: ReviewLane[] = [
  {
    evidence: [],
    files: [],
    highlights: [],
    id: "validation",
    questions: ["Can the reviewer sign off?"],
    reviewerGoal: "Sign off.",
    summary: "Validation lane",
    title: "Validation"
  },
  {
    evidence: [],
    files: [],
    highlights: [],
    id: "implementation",
    questions: ["What code changed?"],
    reviewerGoal: "Inspect code.",
    summary: "Implementation lane",
    title: "Implementation"
  },
  {
    evidence: [],
    files: [],
    highlights: [],
    id: "context",
    questions: ["Why does it matter?"],
    reviewerGoal: "Orient review.",
    summary: "Context lane",
    title: "Context"
  },
  {
    evidence: [],
    files: [],
    highlights: [],
    id: "docs",
    questions: ["Do docs match?"],
    reviewerGoal: "Check docs.",
    summary: "Docs lane",
    title: "Docs"
  },
  {
    evidence: [],
    files: [],
    highlights: [],
    id: "tests",
    questions: ["Are tests convincing?"],
    reviewerGoal: "Check tests.",
    summary: "Tests lane",
    title: "Tests"
  },
  {
    evidence: [],
    files: [],
    highlights: [],
    id: "risks",
    questions: ["Where should the reviewer slow down?"],
    reviewerGoal: "Check risks.",
    summary: "Risk lane",
    title: "Risks"
  }
];

describe("orderWalkthroughLanes", () => {
  it("uses the walkthrough-first review order with validation as the final decision stage", () => {
    expect(orderWalkthroughLanes(lanes).map((lane) => lane.id)).toEqual([
      "context",
      "risks",
      "implementation",
      "tests",
      "docs",
      "validation"
    ]);
  });
});

describe("getWalkthroughStageCopy", () => {
  it("maps validation to the final sign-off stage label", () => {
    expect(getWalkthroughStageCopy("validation")).toEqual({
      eyebrow: "Stage 6",
      title: "Sign off or capture follow-up"
    });
  });
});
