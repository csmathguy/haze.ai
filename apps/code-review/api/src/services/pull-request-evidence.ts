import type { AuditWorkItemTimeline, CodeReviewAuditEvidence, CodeReviewLinkedWorkItem, CodeReviewPlanContext, WorkItem } from "@taxes/shared";

export function toPlanningWorkItem(linkedPlan: CodeReviewPlanContext, workItem: WorkItem): CodeReviewLinkedWorkItem {
  const latestPlanRun = [...workItem.planRuns].sort(compareUpdatedAtDescending)[0];

  return {
    acceptanceCriteria: summarizeCompletion(
      workItem.acceptanceCriteria,
      (criterion) => criterion.status === "passed"
    ),
    ...(latestPlanRun === undefined
      ? {}
      : {
          latestPlanRun: {
            completedStepCount: latestPlanRun.steps.filter((step) => step.status === "done").length,
            ...(latestPlanRun.steps.find((step) => step.status !== "done")?.title === undefined
              ? {}
              : {
                  currentStepTitle: latestPlanRun.steps.find((step) => step.status !== "done")?.title
                }),
            mode: latestPlanRun.mode,
            status: latestPlanRun.status,
            summary: latestPlanRun.summary,
            totalStepCount: latestPlanRun.steps.length
          }
        }),
    ...(workItem.owner === undefined ? {} : { owner: workItem.owner }),
    priority: workItem.priority,
    projectKey: workItem.projectKey,
    status: workItem.status,
    summary: workItem.summary,
    ...(workItem.targetIteration === undefined ? {} : { targetIteration: workItem.targetIteration }),
    tasks: summarizeCompletion(
      workItem.tasks,
      (task) => task.status === "done"
    ),
    title: workItem.title,
    workItemId: linkedPlan.workItemId
  };
}

export function toAuditEvidence(timeline: AuditWorkItemTimeline): CodeReviewAuditEvidence {
  return {
    activeAgents: timeline.summary.activeAgents,
    artifactCount: timeline.summary.artifactCount,
    decisionCount: timeline.summary.decisionCount,
    failureCount: timeline.summary.failureCount,
    handoffCount: timeline.summary.handoffCount,
    ...(timeline.summary.latestEventAt === undefined ? {} : { latestEventAt: timeline.summary.latestEventAt }),
    recentRuns: [...timeline.runs]
      .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))
      .slice(0, 3)
      .map((run) => ({
        durationMs: run.durationMs,
        executionCount: run.executionCount,
        failureCount: run.failureCount,
        latestEventAt: run.latestEventAt,
        runId: run.runId,
        startedAt: run.startedAt,
        status: run.status,
        workflow: run.workflow
      })),
    runCount: timeline.summary.runCount,
    workflows: timeline.summary.workflows,
    workItemId: timeline.workItemId
  };
}

function summarizeCompletion<TValue>(values: TValue[], isComplete: (value: TValue) => boolean) {
  const completeCount = values.filter(isComplete).length;

  return {
    completeCount,
    pendingCount: values.length - completeCount,
    totalCount: values.length
  };
}

function compareUpdatedAtDescending(left: { updatedAt: string }, right: { updatedAt: string }): number {
  return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
}
