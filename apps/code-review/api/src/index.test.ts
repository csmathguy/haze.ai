import { describe, expect, it } from "vitest";
import { z } from "zod";

import { CodeReviewPullRequestDetailSchema, CodeReviewWorkspaceSchema } from "@taxes/shared";

import { buildApp } from "./app.js";

const fakeService = {
  getWorkspace() {
    return Promise.resolve({
      generatedAt: "2026-03-14T03:30:00.000Z",
      localOnly: true as const,
      pullRequests: [
        {
          author: {
            isBot: false,
            login: "csmathguy",
            name: "Zachary Hayes"
          },
          baseRefName: "main",
          headRefName: "feature/plan-53-local-env-runner",
          isDraft: false,
          linkedPlan: {
            source: "branch" as const,
            url: "http://127.0.0.1:5175/?workItemId=PLAN-53",
            workItemId: "PLAN-53"
          },
          number: 25,
          reviewDecision: "",
          state: "MERGED" as const,
          title: "Add a main-checkout environment runner",
          updatedAt: "2026-03-14T02:59:48.000Z",
          url: "https://github.com/csmathguy/Taxes/pull/25"
        }
      ],
      purpose: "Review pull requests from this repository.",
      repository: {
        name: "Taxes",
        owner: "csmathguy",
        url: "https://github.com/csmathguy/Taxes"
      },
      showingRecentFallback: true,
      title: "Code Review Studio",
      trustStatement: "Human review stays in control."
    });
  },
  getPullRequestDetail() {
    return Promise.resolve({
      author: {
        isBot: false,
        login: "csmathguy",
        name: "Zachary Hayes"
      },
      baseRefName: "main",
      body: "## Summary\n- Adds a local runner",
      checks: [
        {
          conclusion: "SUCCESS",
          name: "typecheck",
          status: "COMPLETED",
          workflowName: "CI"
        }
      ],
      headRefName: "feature/plan-53-local-env-runner",
      isDraft: false,
      linkedPlan: {
        source: "branch" as const,
        url: "http://127.0.0.1:5175/?workItemId=PLAN-53",
        workItemId: "PLAN-53"
      },
      lanes: [
        {
          evidence: ["Adds a local runner"],
          files: [],
          highlights: ["workflow: 2 files"],
          id: "context" as const,
          questions: ["What changed?"],
          reviewerGoal: "Orient the review.",
          summary: "Context first.",
          title: "Context"
        },
        {
          evidence: ["No tests detected"],
          files: [],
          highlights: ["No test files were classified from the changed paths."],
          id: "tests" as const,
          questions: ["Are tests enough?"],
          reviewerGoal: "Inspect proof.",
          summary: "Tests lane.",
          title: "Tests"
        },
        {
          evidence: ["tools: 2 files"],
          files: [],
          highlights: ["tooling: 2 files"],
          id: "implementation" as const,
          questions: ["Is the code coherent?"],
          reviewerGoal: "Inspect implementation.",
          summary: "Implementation lane.",
          title: "Implementation"
        },
        {
          evidence: ["typecheck: success"],
          files: [],
          highlights: ["npm run typecheck"],
          id: "validation" as const,
          questions: ["Did validation run?"],
          reviewerGoal: "Inspect checks.",
          summary: "Validation lane.",
          title: "Validation"
        },
        {
          evidence: ["Tooling changes can affect every workflow."],
          files: [],
          highlights: ["tools/runtime/run-npm.cjs (+20 / -0)"],
          id: "risks" as const,
          questions: ["What could break?"],
          reviewerGoal: "Inspect risk seams.",
          summary: "Risk lane.",
          title: "Risks"
        }
      ],
      mergeStateStatus: "UNKNOWN",
      narrative: {
        reviewFocus: ["Check the local workflow impact."],
        reviewOrder: ["Context", "Implementation"],
        risks: ["Tooling changes can affect every workflow."],
        summaryBullets: ["Adds a local runner"],
        validationCommands: ["npm run typecheck"],
        valueSummary: "Adds a local runner",
        whatChangedSections: [
          {
            items: ["tools/agent/dev-environment.ts"],
            title: "Tooling and automation"
          }
        ]
      },
      number: 25,
      reviewDecision: "",
      state: "MERGED" as const,
      stats: {
        commentCount: 0,
        fileCount: 2,
        reviewCount: 0,
        totalAdditions: 30,
        totalDeletions: 0
      },
      title: "Add a main-checkout environment runner",
      trustStatement: "Human review remains the final gate.",
      updatedAt: "2026-03-14T02:59:48.000Z",
      url: "https://github.com/csmathguy/Taxes/pull/25"
    });
  }
};

describe("code review app", () => {
  it("exposes a local-only health endpoint", async () => {
    const app = await buildApp({ codeReviewService: fakeService });
    const response = await app.inject({
      method: "GET",
      url: "/api/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      localOnly: true,
      service: "code-review",
      status: "ok"
    });

    await app.close();
  });

  it("returns a pull-request-backed code review workspace", async () => {
    const app = await buildApp({ codeReviewService: fakeService });
    const response = await app.inject({
      method: "GET",
      url: "/api/code-review/workspace"
    });
    const payload = z.object({ workspace: CodeReviewWorkspaceSchema }).parse(response.json());

    expect(response.statusCode).toBe(200);
    expect(payload.workspace.pullRequests[0]?.number).toBe(25);
    expect(payload.workspace.repository.owner).toBe("csmathguy");

    await app.close();
  });

  it("returns the requested pull request detail", async () => {
    const app = await buildApp({ codeReviewService: fakeService });
    const response = await app.inject({
      method: "GET",
      url: "/api/code-review/pull-requests/25"
    });
    const payload = z.object({ pullRequest: CodeReviewPullRequestDetailSchema }).parse(response.json());

    expect(response.statusCode).toBe(200);
    expect(payload.pullRequest.number).toBe(25);
    expect(payload.pullRequest.lanes.some((lane) => lane.id === "validation")).toBe(true);

    await app.close();
  });
});
