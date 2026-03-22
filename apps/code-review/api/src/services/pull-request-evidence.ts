import type {
  AuditArtifactRecord,
  AuditWorkItemTimeline,
  CodeReviewAuditEvidence,
  CodeReviewEvidenceArtifact,
  CodeReviewEvidenceArtifactKind,
  CodeReviewEvidenceCategory,
  CodeReviewLinkedWorkItem,
  CodeReviewPlanContext,
  WorkItem
} from "@taxes/shared";

export function toPlanningWorkItem(linkedPlan: CodeReviewPlanContext, workItem: WorkItem): CodeReviewLinkedWorkItem {
  const latestPlanRun = [...workItem.planRuns].sort(compareUpdatedAtDescending)[0];

  return {
    acceptanceCriteria: summarizeCompletion(
      workItem.acceptanceCriteria,
      (criterion) => criterion.status === "passed"
    ),
    acceptanceCriteriaPreview: summarizePreview(workItem.acceptanceCriteria.map((criterion) => criterion.title)),
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
    taskPreview: summarizePreview(workItem.tasks.map((task) => task.title)),
    title: workItem.title,
    workItemId: linkedPlan.workItemId
  };
}

export function toAuditEvidence(timeline: AuditWorkItemTimeline): CodeReviewAuditEvidence {
  return {
    activeAgents: timeline.summary.activeAgents,
    artifactCount: timeline.summary.artifactCount,
    artifacts: timeline.artifacts.map(toEvidenceArtifact),
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

function toEvidenceArtifact(artifact: AuditArtifactRecord): CodeReviewEvidenceArtifact {
  const evidenceText = [
    artifact.artifactType,
    artifact.label,
    artifact.path,
    artifact.uri,
    stringifyMetadata(artifact.metadata)
  ]
    .filter((value) => typeof value === "string" && value.length > 0)
    .join(" ")
    .toLowerCase();
  const kind = classifyArtifactKind(evidenceText);
  const category = classifyEvidenceCategory(evidenceText, kind);

  return {
    category,
    ...(artifact.uri === undefined ? {} : { href: artifact.uri }),
    kind,
    label: artifact.label,
    ...(artifact.path === undefined ? {} : { location: artifact.path }),
    status: artifact.status,
    timestamp: artifact.timestamp
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

function summarizePreview(values: string[]) {
  return {
    items: values.slice(0, 3),
    totalCount: values.length
  };
}

function classifyArtifactKind(value: string): CodeReviewEvidenceArtifactKind {
  if (matchesAny(value, ["screenshot", ".png", ".jpg", ".jpeg", ".webp", "snapshot"])) {
    return "screenshot";
  }

  if (matchesAny(value, ["trace", ".zip"])) {
    return "trace";
  }

  if (matchesAny(value, ["coverage", "lcov", "istanbul"])) {
    return "coverage";
  }

  if (matchesAny(value, ["html-report", "html report", "playwright-report"])) {
    return "html-report";
  }

  if (matchesAny(value, ["report"])) {
    return "report";
  }

  return "other";
}

function classifyEvidenceCategory(value: string, kind: CodeReviewEvidenceArtifactKind): CodeReviewEvidenceCategory {
  if (kind === "screenshot") {
    return "visual";
  }

  if (matchesAny(value, ["integration"])) {
    return "integration";
  }

  if (matchesAny(value, ["playwright", "browser", "e2e", "end-to-end", "cypress", "trace"])) {
    return "browser";
  }

  if (matchesAny(value, ["visual", "snapshot", "screenshot"])) {
    return "visual";
  }

  if (matchesAny(value, ["unit", "vitest", "jest"])) {
    return "unit";
  }

  return "general";
}

function compareUpdatedAtDescending(left: { updatedAt: string }, right: { updatedAt: string }): number {
  return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
}

function matchesAny(value: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => value.includes(pattern));
}

function stringifyMetadata(metadata: AuditArtifactRecord["metadata"]): string {
  if (metadata === undefined) {
    return "";
  }

  return Object.values(metadata)
    .flatMap((value) => flattenMetadataValue(value))
    .join(" ");
}

function flattenMetadataValue(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => flattenMetadataValue(entry));
  }

  if (value !== null && typeof value === "object") {
    return Object.values(value).flatMap((entry) => flattenMetadataValue(entry));
  }

  return [];
}
