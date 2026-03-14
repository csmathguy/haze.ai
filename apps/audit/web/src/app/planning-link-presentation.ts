import type { AuditRunOverview, AuditWorkItemTimeline } from "@taxes/shared";

export interface PlanningLinkSummary {
  detail: string;
  metrics: string[];
  title: string;
}

export function summarizePlanningLink(run: AuditRunOverview, timeline: AuditWorkItemTimeline | null): PlanningLinkSummary {
  if (run.workItemId === undefined && run.planRunId === undefined && run.planStepId === undefined) {
    return {
      detail: "This run was not explicitly linked to a planning record.",
      metrics: ["No work item", "No plan run", "No plan step"],
      title: "Unlinked execution"
    };
  }

  const title = run.workItemId === undefined ? "Planning metadata attached" : `Linked to ${run.workItemId}`;
  const detail =
    timeline === null
      ? "This run carries planning metadata, but there is no loaded cross-run lineage summary yet."
      : `This work item spans ${timeline.summary.runCount.toString()} linked runs across ${timeline.summary.workflows.length.toString()} workflows.`;

  return {
    detail,
    metrics: [
      run.workItemId ?? "No work item",
      run.planRunId ?? "No plan run",
      run.planStepId ?? "No plan step",
      ...(timeline === null ? [] : [`${timeline.summary.failureCount.toString()} failures`, `${timeline.summary.executionCount.toString()} executions`])
    ],
    title
  };
}
