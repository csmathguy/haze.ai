import { describe, expect, it } from "vitest";

import type { AuditRunOverview, AuditWorkItemTimeline } from "@taxes/shared";

import { summarizePlanningLink } from "./planning-link-presentation.js";

const baseRun: AuditRunOverview = {
  actor: "codex",
  artifactCount: 0,
  decisionCount: 0,
  executionCount: 4,
  failedExecutionCount: 0,
  failureCount: 0,
  handoffCount: 0,
  runId: "run-1",
  startedAt: "2026-03-14T17:00:00.000Z",
  stats: {
    byKind: {},
    byStatus: {},
    executionCount: 4,
    failedExecutionCount: 0
  },
  status: "success",
  workflow: "implementation",
  worktreePath: "C:/repo/.worktrees/plan-59"
};

describe("planning link presentation", () => {
  it("describes unlinked runs clearly", () => {
    expect(summarizePlanningLink(baseRun, null)).toEqual({
      detail: "This run was not explicitly linked to a planning record.",
      metrics: ["No work item", "No plan run", "No plan step"],
      title: "Unlinked execution"
    });
  });

  it("summarizes linked work-item lineage when timeline data exists", () => {
    const timeline: AuditWorkItemTimeline = {
      artifacts: [],
      decisions: [],
      events: [],
      failures: [],
      handoffs: [],
      runs: [],
      summary: {
        activeAgents: ["codex"],
        artifactCount: 0,
        decisionCount: 1,
        executionCount: 9,
        failureCount: 2,
        handoffCount: 0,
        latestEventAt: "2026-03-14T17:05:00.000Z",
        runCount: 3,
        workflows: ["implementation", "pre-push"]
      },
      workItemId: "PLAN-59"
    };

    expect(
      summarizePlanningLink(
        {
          ...baseRun,
          planRunId: "plan-run-1",
          planStepId: "plan-step-1",
          workItemId: "PLAN-59"
        },
        timeline
      )
    ).toEqual({
      detail: "This work item spans 3 linked runs across 2 workflows.",
      metrics: ["PLAN-59", "plan-run-1", "plan-step-1", "2 failures", "9 executions"],
      title: "Linked to PLAN-59"
    });
  });
});
