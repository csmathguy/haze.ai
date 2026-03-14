import { describe, expect, it } from "vitest";

import type { CodeReviewNarrative } from "@taxes/shared";

import { buildReviewLanes, classifyFiles } from "./pull-request-lanes.js";

const narrative: CodeReviewNarrative = {
  reviewFocus: ["Check the mixed code and test seams."],
  reviewOrder: ["Context", "Risks", "Tests", "Implementation", "Validation", "Docs"],
  risks: ["Shared tooling and dependency changes can affect every local workflow."],
  summaryBullets: ["Tighten the code-review workflow."],
  validationCommands: ["npm run test", "npm run playwright:test"],
  valueSummary: "Tighten the code-review workflow.",
  whatChangedSections: [
    {
      items: ["apps/code-review/api/src/services/pull-request-lanes.ts"],
      title: "Lane classification"
    }
  ]
};

describe("classifyFiles", () => {
  it("splits documentation away from executable review lanes", () => {
    const files = classifyFiles([
      {
        additions: 10,
        deletions: 0,
        path: "docs/code-review-mvp.md",
        status: "modified"
      },
      {
        additions: 5,
        deletions: 1,
        path: "apps/code-review/web/src/app/App.tsx",
        status: "modified"
      }
    ]);

    expect(files.find((file) => file.path === "docs/code-review-mvp.md")?.laneId).toBe("docs");
    expect(files.find((file) => file.path === "apps/code-review/web/src/app/App.tsx")?.laneId).toBe("implementation");
    expect(files.find((file) => file.path === "apps/code-review/web/src/app/App.tsx")?.explanation.summary).toContain("implementation seam");
  });
});

describe("buildReviewLanes", () => {
  it("orders risky files first and isolates test subtypes in the tests lane", () => {
    const files = classifyFiles([
      {
        additions: 20,
        deletions: 0,
        path: "apps/code-review/web/src/app/App.test.tsx",
        status: "modified"
      },
      {
        additions: 30,
        deletions: 2,
        path: "apps/code-review/api/src/integration/pull-request.test.ts",
        status: "modified"
      },
      {
        additions: 14,
        deletions: 0,
        path: "apps/code-review/web/e2e/review.spec.ts",
        status: "added"
      },
      {
        additions: 12,
        deletions: 1,
        path: "package.json",
        status: "modified"
      },
      {
        additions: 15,
        deletions: 4,
        path: "tools/agent/dev-environment.ts",
        status: "modified"
      },
      {
        additions: 8,
        deletions: 0,
        path: ".github/workflows/ci.yml",
        status: "modified"
      }
    ]);

    const lanes = buildReviewLanes(files, narrative, []);
    const testsLane = lanes.find((lane) => lane.id === "tests");
    const risksLane = lanes.find((lane) => lane.id === "risks");

    expect(lanes.map((lane) => lane.id)).toEqual(["context", "risks", "tests", "implementation", "validation", "docs"]);
    expect(testsLane?.highlights).toEqual(["End-to-end: 1 file", "Integration: 1 file", "Unit: 1 file"]);
    expect(testsLane?.files.map((file) => file.path)).toEqual([
      "apps/code-review/web/e2e/review.spec.ts",
      "apps/code-review/api/src/integration/pull-request.test.ts",
      "apps/code-review/web/src/app/App.test.tsx"
    ]);
    expect(risksLane?.files.map((file) => file.path)).toEqual([
      "package.json",
      ".github/workflows/ci.yml",
      "tools/agent/dev-environment.ts"
    ]);
  });
});
