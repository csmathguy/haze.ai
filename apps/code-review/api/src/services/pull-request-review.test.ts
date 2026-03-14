import { describe, expect, it } from "vitest";

import { parseNarrative, toPullRequestDetail } from "./pull-request-review.js";

describe("parseNarrative", () => {
  it("extracts PR template sections into structured review content", () => {
    const narrative = parseNarrative(
      `## Summary

- Add a local dev runner
- Reduce the friction of starting apps

## What Changed

### Tooling and automation
- package.json
- tools/agent/dev-environment.ts

## Review Order

1. Tooling and automation

## Review Focus

- Confirm the command surface matches the docs

## Risks

- Tooling changes can block local development

## Validation

- [x] \`npm run typecheck\`

Commands run:

- \`npm run typecheck\`
`,
      "Add a local dev runner"
    );

    expect(narrative.summaryBullets).toEqual(["Add a local dev runner", "Reduce the friction of starting apps"]);
    expect(narrative.whatChangedSections[0]?.title).toBe("Tooling and automation");
    expect(narrative.validationCommands).toContain("npm run typecheck");
  });
});

describe("toPullRequestDetail", () => {
  it("extracts a linked plan item from the branch name and preserves review lane order", () => {
    const detail = createPullRequestDetail();

    expect(detail.linkedPlan?.workItemId).toBe("PLAN-29");
    expect(detail.lanes.map((lane) => lane.id)).toEqual(["context", "risks", "tests", "implementation", "validation", "docs"]);
  });

  it("includes patches in the classified test lane", () => {
    const detail = createPullRequestDetail();
    const testsLane = findLane(detail, "tests");

    expect(testsLane?.files[0]?.path).toContain("App.test.tsx");
    expect(testsLane?.files[0]?.patch).toContain("+test");
  });

  it("includes rationale and evidence inside implementation and validation lanes", () => {
    const detail = createPullRequestDetail();
    const implementationLane = findLane(detail, "implementation");
    const validationLane = findLane(detail, "validation");

    expect(implementationLane?.files[0]?.explanation.summary).toContain("implementation seam");
    expect(validationLane?.evidence).toContain("typecheck: success");
  });

  it("routes risky workflow changes and docs into the expected lanes", () => {
    const detail = createPullRequestDetail();
    const risksLane = findLane(detail, "risks");
    const docsLane = findLane(detail, "docs");

    expect(risksLane?.files[0]?.path).toBe(".github/workflows/ci.yml");
    expect(docsLane?.files[0]?.path).toBe("docs/code-review-mvp.md");
  });
});

function createPullRequestDetail() {
  return toPullRequestDetail(
    {
      author: {
        is_bot: false,
        login: "csmathguy",
        name: "Zachary Hayes"
      },
      baseRefName: "main",
      body: "## Summary\n- Add a PR-backed review surface",
      comments: [],
      files: [
        {
          additions: 20,
          deletions: 2,
          path: "apps/code-review/web/src/app/App.tsx",
          patch: "@@ -1 +1 @@\n-old\n+new",
          status: "modified"
        },
        {
          additions: 10,
          deletions: 0,
          path: "apps/code-review/web/src/app/App.test.tsx",
          patch: "@@ -0,0 +1,10 @@\n+test",
          status: "added"
        },
        {
          additions: 8,
          deletions: 0,
          path: ".github/workflows/ci.yml",
          patch: "@@ -1 +1 @@\n-old\n+new",
          status: "modified"
        },
        {
          additions: 6,
          deletions: 0,
          path: "docs/code-review-mvp.md",
          patch: "@@ -1 +1 @@\n-old\n+new",
          status: "modified"
        }
      ],
      headRefName: "feature/plan-29-pr-workspace",
      isDraft: false,
      mergeStateStatus: "CLEAN",
      number: 29,
      reviewDecision: "",
      reviews: [],
      state: "OPEN",
      statusCheckRollup: [
        {
          conclusion: "SUCCESS",
          name: "typecheck",
          status: "COMPLETED",
          workflowName: "CI"
        }
      ],
      title: "Add a PR-backed review surface",
      updatedAt: "2026-03-14T03:45:00.000Z",
      url: "https://github.com/csmathguy/Taxes/pull/29"
    },
    {
      name: "Taxes",
      owner: "csmathguy",
      url: "https://github.com/csmathguy/Taxes"
    }
  );
}

function findLane(detail: ReturnType<typeof createPullRequestDetail>, laneId: ReturnType<typeof createPullRequestDetail>["lanes"][number]["id"]) {
  return detail.lanes.find((lane) => lane.id === laneId);
}
