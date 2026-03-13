import type {
  AuditAnalyticsBreakdownEntry,
  AuditArtifactRecord,
  AuditDecisionRecord,
  AuditEventRecord,
  AuditExecutionRecord,
  AuditFailureRecord,
  AuditHandoffRecord,
  AuditRunOverview,
  AuditStatsSnapshot
} from "@taxes/shared";
import {
  AuditArtifactRecordSchema,
  AuditDecisionRecordSchema,
  AuditEventRecordSchema,
  AuditExecutionRecordSchema,
  AuditFailureRecordSchema,
  AuditHandoffRecordSchema,
  AuditRunOverviewSchema,
} from "@taxes/shared";

export function mapRunOverview(run: {
  actor: string;
  agentName: string | null;
  artifactCount: number;
  completedAt: Date | null;
  decisionCount: number;
  durationMs: number | null;
  executionCount: number;
  failedExecutionCount: number;
  failureCount: number;
  handoffCount: number;
  id: string;
  latestEventAt: Date | null;
  planRunId: string | null;
  planStepId: string | null;
  project: string | null;
  repoPath: string | null;
  sessionId: string | null;
  startedAt: Date;
  statsByKindJson: string | null;
  statsByStatusJson: string | null;
  status: string;
  task: string | null;
  workflow: string;
  workItemId: string | null;
  worktreePath: string;
}): AuditRunOverview {
  return AuditRunOverviewSchema.parse({
    actor: run.actor,
    artifactCount: run.artifactCount,
    decisionCount: run.decisionCount,
    executionCount: run.executionCount,
    failedExecutionCount: run.failedExecutionCount,
    failureCount: run.failureCount,
    handoffCount: run.handoffCount,
    runId: run.id,
    startedAt: run.startedAt.toISOString(),
    stats: parseStats(run.statsByKindJson, run.statsByStatusJson, run.executionCount, run.failedExecutionCount),
    status: run.status,
    workflow: run.workflow,
    worktreePath: run.worktreePath,
    ...compactObject({
      agentName: toUndefined(run.agentName),
      completedAt: run.completedAt?.toISOString(),
      durationMs: toUndefined(run.durationMs),
      latestEventAt: run.latestEventAt?.toISOString(),
      planRunId: toUndefined(run.planRunId),
      planStepId: toUndefined(run.planStepId),
      project: toUndefined(run.project),
      repoPath: toUndefined(run.repoPath),
      sessionId: toUndefined(run.sessionId),
      task: toUndefined(run.task),
      workItemId: toUndefined(run.workItemId)
    })
  });
}

export function mapExecutionRecord(record: {
  commandJson: string | null;
  completedAt: Date | null;
  durationMs: number | null;
  errorMessage: string | null;
  errorName: string | null;
  exitCode: number | null;
  id: string;
  kind: string;
  logFile: string | null;
  metadataJson: string | null;
  name: string;
  parentExecutionId: string | null;
  startedAt: Date;
  status: string;
  step: string | null;
}): AuditExecutionRecord {
  return AuditExecutionRecordSchema.parse({
    command: parseJsonArray(record.commandJson),
    completedAt: record.completedAt?.toISOString(),
    durationMs: record.durationMs ?? undefined,
    errorMessage: record.errorMessage ?? undefined,
    errorName: record.errorName ?? undefined,
    executionId: record.id,
    exitCode: record.exitCode ?? undefined,
    kind: record.kind,
    logFile: record.logFile ?? undefined,
    metadata: parseJsonObject(record.metadataJson),
    name: record.name,
    parentExecutionId: record.parentExecutionId ?? undefined,
    startedAt: record.startedAt.toISOString(),
    status: record.status,
    step: record.step ?? undefined
  });
}

export function mapEventRecord(record: {
  actor: string;
  agentName: string | null;
  commandJson: string | null;
  cwd: string;
  durationMs: number | null;
  errorMessage: string | null;
  errorName: string | null;
  eventType: string;
  executionId: string | null;
  executionKind: string | null;
  executionName: string | null;
  exitCode: number | null;
  id: string;
  logFile: string | null;
  metadataJson: string | null;
  planRunId: string | null;
  planStepId: string | null;
  parentExecutionId: string | null;
  project: string | null;
  runId: string;
  sessionId: string | null;
  status: string | null;
  step: string | null;
  task: string | null;
  timestamp: Date;
  workflow: string;
  workItemId: string | null;
}): AuditEventRecord {
  return AuditEventRecordSchema.parse({
    actor: record.actor,
    agentName: record.agentName ?? undefined,
    cwd: record.cwd,
    eventId: record.id,
    eventType: record.eventType,
    planRunId: record.planRunId ?? undefined,
    planStepId: record.planStepId ?? undefined,
    project: record.project ?? undefined,
    runId: record.runId,
    sessionId: record.sessionId ?? undefined,
    timestamp: record.timestamp.toISOString(),
    workflow: record.workflow,
    workItemId: record.workItemId ?? undefined,
    ...compactObject({
      command: parseJsonArray(record.commandJson),
      durationMs: toUndefined(record.durationMs),
      errorMessage: toUndefined(record.errorMessage),
      errorName: toUndefined(record.errorName),
      executionId: toUndefined(record.executionId),
      executionKind: toUndefined(record.executionKind),
      executionName: toUndefined(record.executionName),
      exitCode: toUndefined(record.exitCode),
      logFile: toUndefined(record.logFile),
      metadata: parseJsonObject(record.metadataJson),
      parentExecutionId: toUndefined(record.parentExecutionId),
      status: toUndefined(record.status),
      step: toUndefined(record.step),
      task: toUndefined(record.task)
    })
  });
}

export function mapDecisionRecord(record: {
  category: string;
  executionId: string | null;
  id: string;
  metadataJson: string | null;
  optionsJson: string | null;
  rationale: string | null;
  runId: string;
  selectedOption: string | null;
  summary: string;
  timestamp: Date;
}): AuditDecisionRecord {
  return AuditDecisionRecordSchema.parse({
    category: record.category,
    decisionId: record.id,
    executionId: record.executionId ?? undefined,
    metadata: parseJsonObject(record.metadataJson),
    options: parseJsonArray(record.optionsJson),
    rationale: record.rationale ?? undefined,
    runId: record.runId,
    selectedOption: record.selectedOption ?? undefined,
    summary: record.summary,
    timestamp: record.timestamp.toISOString()
  });
}

export function mapArtifactRecord(record: {
  artifactType: string;
  executionId: string | null;
  id: string;
  label: string;
  metadataJson: string | null;
  path: string | null;
  runId: string;
  status: string;
  timestamp: Date;
  uri: string | null;
}): AuditArtifactRecord {
  return AuditArtifactRecordSchema.parse({
    artifactId: record.id,
    artifactType: record.artifactType,
    executionId: record.executionId ?? undefined,
    label: record.label,
    metadata: parseJsonObject(record.metadataJson),
    path: record.path ?? undefined,
    runId: record.runId,
    status: record.status,
    timestamp: record.timestamp.toISOString(),
    uri: record.uri ?? undefined
  });
}

export function mapFailureRecord(record: {
  category: string;
  detail: string | null;
  executionId: string | null;
  id: string;
  metadataJson: string | null;
  retryable: boolean;
  runId: string;
  severity: string;
  status: string;
  summary: string;
  timestamp: Date;
}): AuditFailureRecord {
  return AuditFailureRecordSchema.parse({
    category: record.category,
    detail: record.detail ?? undefined,
    executionId: record.executionId ?? undefined,
    failureId: record.id,
    metadata: parseJsonObject(record.metadataJson),
    retryable: record.retryable,
    runId: record.runId,
    severity: record.severity,
    status: record.status,
    summary: record.summary,
    timestamp: record.timestamp.toISOString()
  });
}

export function mapHandoffRecord(record: {
  artifactIdsJson: string | null;
  detail: string | null;
  executionId: string | null;
  id: string;
  metadataJson: string | null;
  planRunId: string | null;
  planStepId: string | null;
  runId: string;
  sourceAgent: string;
  status: string;
  summary: string;
  targetAgent: string;
  timestamp: Date;
  workItemId: string | null;
}): AuditHandoffRecord {
  return AuditHandoffRecordSchema.parse({
    artifactIds: parseJsonArray(record.artifactIdsJson),
    detail: record.detail ?? undefined,
    executionId: record.executionId ?? undefined,
    handoffId: record.id,
    metadata: parseJsonObject(record.metadataJson),
    planRunId: record.planRunId ?? undefined,
    planStepId: record.planStepId ?? undefined,
    runId: record.runId,
    sourceAgent: record.sourceAgent,
    status: record.status,
    summary: record.summary,
    targetAgent: record.targetAgent,
    timestamp: record.timestamp.toISOString(),
    workItemId: record.workItemId ?? undefined
  });
}

export function mapAnalyticsBreakdownEntry(key: string, count: number): AuditAnalyticsBreakdownEntry {
  return {
    count,
    key
  };
}

export function calculateCompletedAt(startedAt: string, durationMs: number, status: string): Date | null {
  if (status === "running") {
    return null;
  }

  return new Date(Date.parse(startedAt) + durationMs);
}

export function stringifyJson(value: unknown): string | null {
  if (value === undefined) {
    return null;
  }

  return JSON.stringify(value);
}

function parseJsonArray(value: string | null): string[] | undefined {
  if (value === null) {
    return undefined;
  }

  return JSON.parse(value) as string[];
}

function parseJsonObject(value: string | null): Record<string, unknown> | undefined {
  if (value === null) {
    return undefined;
  }

  return JSON.parse(value) as Record<string, unknown>;
}

function parseStats(
  byKindJson: string | null,
  byStatusJson: string | null,
  executionCount: number,
  failedExecutionCount: number
): AuditStatsSnapshot {
  return {
    byKind: byKindJson === null ? {} : (JSON.parse(byKindJson) as Record<string, number>),
    byStatus: byStatusJson === null ? {} : (JSON.parse(byStatusJson) as Record<string, number>),
    executionCount,
    failedExecutionCount
  };
}

function compactObject<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

function toUndefined<T>(value: T | null): T | undefined {
  return value ?? undefined;
}
