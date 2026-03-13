import type {
  AuditEventRecord,
  AuditExecutionRecord,
  AuditRunOverview,
  AuditStatsSnapshot
} from "@taxes/shared";
import {
  AuditEventRecordSchema,
  AuditExecutionRecordSchema,
  AuditRunOverviewSchema
} from "@taxes/shared";

export function mapRunOverview(run: {
  actor: string;
  completedAt: Date | null;
  durationMs: number | null;
  executionCount: number;
  failedExecutionCount: number;
  id: string;
  latestEventAt: Date | null;
  repoPath: string | null;
  startedAt: Date;
  statsByKindJson: string | null;
  statsByStatusJson: string | null;
  status: string;
  task: string | null;
  workflow: string;
  worktreePath: string;
}): AuditRunOverview {
  return AuditRunOverviewSchema.parse({
    actor: run.actor,
    completedAt: run.completedAt?.toISOString(),
    durationMs: run.durationMs ?? undefined,
    executionCount: run.executionCount,
    failedExecutionCount: run.failedExecutionCount,
    latestEventAt: run.latestEventAt?.toISOString(),
    repoPath: run.repoPath ?? undefined,
    runId: run.id,
    startedAt: run.startedAt.toISOString(),
    stats: parseStats(run.statsByKindJson, run.statsByStatusJson, run.executionCount, run.failedExecutionCount),
    status: run.status,
    task: run.task ?? undefined,
    workflow: run.workflow,
    worktreePath: run.worktreePath
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
  parentExecutionId: string | null;
  runId: string;
  status: string | null;
  step: string | null;
  task: string | null;
  timestamp: Date;
  workflow: string;
}): AuditEventRecord {
  return AuditEventRecordSchema.parse({
    actor: record.actor,
    cwd: record.cwd,
    eventId: record.id,
    eventType: record.eventType,
    runId: record.runId,
    timestamp: record.timestamp.toISOString(),
    workflow: record.workflow,
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
