import { describe, expect, it } from "vitest";
import type { CodeReviewPullRequestDetail } from "@taxes/shared";

import { buildReviewBriefPresentation } from "./review-brief-presentation.js";

const pullRequest: CodeReviewPullRequestDetail = {
  author: {
    isBot: false,
    login: "codex"
  },
  baseRefName: "main",
  body: "## Summary\n- add review brief",
  checks: [],
  headRefName: "feature/plan-239",
  headSha: "sha-239-brief",
  isDraft: false,
  lanes: [
    {
      evidence: ["Linked to plan"],
      files: [],
      highlights: ["Review the work item first"],
      id: "context",
      questions: ["What is this PR doing?"],
      reviewerGoal: "Orient the reviewer.",
      summary: "Context lane.",
      title: "Context"
    }
  ],
  linkedPlan: {
    source: "branch",
    url: "http://127.0.0.1:5175/?workItemId=PLAN-239",
    workItemId: "PLAN-239"
  },
  mergeStateStatus: "CLEAN",
  narrative: {
    reviewFocus: ["Check the startup guidance."],
    reviewOrder: ["Context", "Implementation", "Validation"],
    risks: [],
    summaryBullets: ["Guide the reviewer before code inspection"],
    validationCommands: [],
    valueSummary: "Make the review walkthrough easier to start.",
    whatChangedSections: [
      {
        items: ["apps/code-review/web/src/app/components/ReviewStartPanel.tsx"],
        title: "Review start"
      }
    ]
  },
  number: 239,
  planningWorkItem: {
    acceptanceCriteria: {
      completeCount: 1,
      pendingCount: 2,
      totalCount: 3
    },
    acceptanceCriteriaPreview: {
      items: ["Reviewer can understand what this PR is trying to accomplish.", "Reviewer sees the claimed outcome before opening diffs."],
      totalCount: 3
    },
    latestPlanRun: {
      completedStepCount: 1,
      currentStepTitle: "Render the generated review brief",
      mode: "single-agent",
      status: "executing",
      summary: "Guide the reviewer with a minimal start surface.",
      totalStepCount: 4
    },
    priority: "high",
    projectKey: "code-review",
    status: "in-progress",
    summary: "Generate and surface a durable review brief for PR walkthroughs.",
    tasks: {
      completeCount: 1,
      pendingCount: 3,
      totalCount: 4
    },
    taskPreview: {
      items: ["Generate the review brief", "Render a compact opening step", "Keep planning context visible"],
      totalCount: 4
    },
    title: "Agent-assisted pre-review suggestions in PR walkthrough",
    workItemId: "PLAN-239"
  },
  reviewBrief: {
    followUpCandidates: ["Split review brief storage from rendering later."],
    generatedAt: "2026-03-22T03:00:00.000Z",
    inspectFirst: ["Confirm the linked plan and review order."],
    missingEvidence: ["No explicit validation command is attached yet."],
    sourceHeadSha: "sha-239-brief",
    startHere: ["Read the work item summary.", "Confirm the first review checkpoint.", "Inspect the riskiest file next."],
    summary: "Generate a short briefing so the reviewer knows how to start.",
    whatThisPrDoes: ["Adds a generated review brief to the PR detail.", "Uses that brief to guide the opening review experience."]
  },
  reviewDecision: "",
  state: "OPEN",
  stats: {
    commentCount: 0,
    fileCount: 4,
    reviewCount: 0,
    totalAdditions: 80,
    totalDeletions: 12
  },
  title: "Surface generated review brief in the walkthrough",
  trustStatement: "Human review remains the final gate.",
  updatedAt: "2026-03-22T03:00:00.000Z",
  url: "https://github.com/csmathguy/Taxes/pull/239"
};

describe("buildReviewBriefPresentation", () => {
  it("prefers the generated review brief and keeps the start surface focused", () => {
    expect(buildReviewBriefPresentation(pullRequest, "Context")).toEqual({
      checklistSections: [
        {
          items: [
            "Reviewer can understand what this PR is trying to accomplish.",
            "Reviewer sees the claimed outcome before opening diffs."
          ],
          title: "Acceptance criteria (1/3 complete)"
        },
        {
          items: ["Generate the review brief", "Render a compact opening step", "Keep planning context visible"],
          title: "Planned tasks (1/4 complete)"
        }
      ],
      compactStatus: [
        `PR #${pullRequest.number.toString()} is open.`,
        "Review state: under review.",
        "Work item is in-progress.",
        "Current step: Render the generated review brief."
      ],
      inspectFirst: ["Confirm the linked plan and review order."],
      missingEvidence: ["No explicit validation command is attached yet."],
      nextStepTitle: "Context",
      reviewGoal: "Generate and surface a durable review brief for PR walkthroughs.",
      startHere: ["Read the work item summary.", "Confirm the first review checkpoint.", "Inspect the riskiest file next."],
      statusLabel: "Open",
      summary: "Generate a short briefing so the reviewer knows how to start.",
      title: "Agent-assisted pre-review suggestions in PR walkthrough",
      workItemLabel: "PLAN-239",
      whatThisPrDoes: [
        "Adds a generated review brief to the PR detail.",
        "Uses that brief to guide the opening review experience."
      ]
    });
  });
});
