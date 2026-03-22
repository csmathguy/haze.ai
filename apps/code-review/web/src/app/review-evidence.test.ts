import { describe, expect, it } from "vitest";
import type { CodeReviewPullRequestDetail } from "@taxes/shared";

import { buildReviewEvidencePresentation } from "./review-evidence.js";

const pullRequest: CodeReviewPullRequestDetail = {
  auditEvidence: {
    activeAgents: ["codex", "reviewer"],
    artifactCount: 2,
    artifacts: [
      {
        category: "browser",
        href: "https://example.test/playwright-report/index.html",
        kind: "html-report",
        label: "Playwright HTML report",
        status: "created",
        timestamp: "2026-03-21T22:28:00.000Z"
      },
      {
        category: "visual",
        kind: "screenshot",
        label: "Dashboard screenshot",
        location: "artifacts/e2e/dashboard.png",
        status: "created",
        timestamp: "2026-03-21T22:29:00.000Z"
      }
    ],
    decisionCount: 1,
    failureCount: 0,
    handoffCount: 1,
    latestEventAt: "2026-03-21T22:30:00.000Z",
    recentRuns: [
      {
        durationMs: 15000,
        executionCount: 4,
        failureCount: 0,
        latestEventAt: "2026-03-21T22:30:00.000Z",
        runId: "run-1",
        startedAt: "2026-03-21T22:00:00.000Z",
        status: "success",
        workflow: "implementation"
      }
    ],
    runCount: 1,
    workflows: ["implementation"],
    workItemId: "PLAN-90"
  },
  author: {
    isBot: false,
    login: "codex"
  },
  baseRefName: "main",
  body: "PR body",
  checks: [
    {
      conclusion: "SUCCESS",
      detailsUrl: "https://github.com/csmathguy/Taxes/actions/runs/1",
      name: "lint",
      status: "COMPLETED",
      workflowName: "CI"
    }
  ],
  headSha: "sha-90-evidence",
  headRefName: "feature/plan-90",
  isDraft: false,
  lanes: [
    {
      evidence: [],
      files: [],
      highlights: [],
      id: "validation",
      questions: ["Can this ship?"],
      reviewerGoal: "Decide whether the evidence is enough.",
      summary: "Validation lane",
      title: "Validation"
    }
  ],
  linkedPlan: {
    source: "branch",
    url: "http://127.0.0.1:5175/?workItemId=PLAN-90",
    workItemId: "PLAN-90"
  },
  mergeStateStatus: "CLEAN",
  number: 90,
  narrative: {
    reviewFocus: [],
    reviewOrder: [],
    risks: [],
    summaryBullets: [],
    validationCommands: ["npm run lint", "npm run lint", "npm run typecheck:code-review:web"],
    valueSummary: "Improve PR walkthrough review.",
    whatChangedSections: []
  },
  planningWorkItem: {
    acceptanceCriteria: {
      completeCount: 1,
      pendingCount: 1,
      totalCount: 2
    },
    acceptanceCriteriaPreview: {
      items: ["Validation evidence is visible in the final stage."],
      totalCount: 2
    },
    priority: "high",
    projectKey: "code-review",
    status: "in-progress",
    summary: "Improve review UX",
    tasks: {
      completeCount: 1,
      pendingCount: 2,
      totalCount: 3
    },
    taskPreview: {
      items: ["Summarize checks", "Show audit lineage"],
      totalCount: 3
    },
    title: "Improve review UX",
    workItemId: "PLAN-90"
  },
  reviewBrief: {
    followUpCandidates: [],
    generatedAt: "2026-03-21T22:30:00.000Z",
    inspectFirst: ["Check the browser evidence before approving."],
    missingEvidence: ["No browser-level validation evidence is attached yet."],
    sourceHeadSha: "sha-90-evidence",
    startHere: ["Confirm the PR goal."],
    summary: "Review validation evidence.",
    whatThisPrDoes: ["Improves review evidence."]
  },
  reviewDecision: "",
  state: "OPEN",
  stats: {
    commentCount: 0,
    fileCount: 3,
    reviewCount: 0,
    totalAdditions: 20,
    totalDeletions: 4
  },
  title: "Improve review walkthrough",
  trustStatement: "Human review remains the final gate.",
  updatedAt: "2026-03-21T22:30:00.000Z",
  url: "https://github.com/csmathguy/Taxes/pull/90"
};

describe("buildReviewEvidencePresentation", () => {
  it("builds compact evidence summaries and detail sections from PR evidence", () => {
    expect(buildReviewEvidencePresentation(pullRequest)).toEqual({
      summaries: [
        {
          detail: "No unit-test evidence is attached yet.",
          label: "Unit tests",
          status: "missing"
        },
        {
          detail: "No integration evidence is attached yet.",
          label: "Integration",
          status: "missing"
        },
        {
          detail: "1 artifact",
          label: "Browser or E2E",
          status: "available"
        },
        {
          detail: "1 artifact",
          label: "Visual proof",
          status: "available"
        }
      ],
      sections: [
        {
          items: [
            "Playwright HTML report: html report | created",
            "Dashboard screenshot: screenshot | created | artifacts/e2e/dashboard.png"
          ],
          links: [
            {
              href: "https://example.test/playwright-report/index.html",
              label: "Open Playwright HTML report"
            }
          ],
          title: "Artifacts and reports"
        },
        {
          items: ["CI: success"],
          links: [{ href: "https://github.com/csmathguy/Taxes/actions/runs/1", label: "Open CI" }],
          title: "Reported checks"
        },
        {
          items: ["npm run lint", "npm run typecheck:code-review:web"],
          title: "Validation commands"
        },
        {
          items: [
            "1 linked audit runs",
            "1 recorded handoffs",
            "0 recorded audit failures",
            "Active agents: codex, reviewer",
            "Latest run: implementation (success)"
          ],
          title: "Audit lineage"
        },
        {
          items: ["No browser-level validation evidence is attached yet."],
          title: "Missing proof to resolve"
        }
      ]
    });
  });
});
