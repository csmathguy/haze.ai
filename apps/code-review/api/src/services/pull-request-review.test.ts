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
  it("classifies changed files into review lanes and extracts a linked plan item from the branch name", () => {
    const detail = toPullRequestDetail(
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
            path: "apps/code-review/web/src/app/App.tsx"
          },
          {
            additions: 10,
            deletions: 0,
            path: "apps/code-review/web/src/app/App.test.tsx"
          },
          {
            additions: 8,
            deletions: 0,
            path: ".github/workflows/ci.yml"
          },
          {
            additions: 6,
            deletions: 0,
            path: "docs/code-review-mvp.md"
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

    expect(detail.linkedPlan?.workItemId).toBe("PLAN-29");
    expect(detail.lanes.map((lane) => lane.id)).toEqual(["context", "risks", "tests", "implementation", "validation", "docs"]);
    expect(detail.lanes.find((lane) => lane.id === "tests")?.files[0]?.path).toContain("App.test.tsx");
    expect(detail.lanes.find((lane) => lane.id === "validation")?.evidence).toContain("typecheck: success");
    expect(detail.lanes.find((lane) => lane.id === "risks")?.files[0]?.path).toBe(".github/workflows/ci.yml");
    expect(detail.lanes.find((lane) => lane.id === "docs")?.files[0]?.path).toBe("docs/code-review-mvp.md");
  });
});
