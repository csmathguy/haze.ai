import type { Prisma } from "@prisma/client";

import { calculateCompletedAt, stringifyJson } from "./audit-serialization.js";
import type { AuditSyncEvent, AuditSyncExecutionSummary, AuditSyncSummary } from "./audit-sync-contract.js";
import { resolveAuditWorkspacePaths } from "./workspace-paths.js";

export function buildRunCreateInputFromEvent(event: AuditSyncEvent): Prisma.AuditRunCreateInput {
  const workspace = resolveAuditWorkspacePaths(event.cwd);

  return {
    actor: event.actor,
    agentName: event.agentName ?? null,
    artifactCount: 0,
    decisionCount: 0,
    failureCount: 0,
    id: event.runId,
    latestEventAt: new Date(event.timestamp),
    project: event.project ?? null,
    repoPath: workspace.repoPath ?? null,
    sessionId: event.sessionId ?? null,
    startedAt: new Date(event.timestamp),
    status: event.status ?? "running",
    task: event.task ?? null,
    workflow: event.workflow,
    workItemId: event.workItemId ?? null,
    worktreePath: workspace.worktreePath
  };
}

export function buildRunUpdateInputFromEvent(event: AuditSyncEvent): Prisma.AuditRunUpdateInput {
  const workspace = resolveAuditWorkspacePaths(event.cwd);

  return compactUpdate({
    actor: event.actor,
    agentName: event.agentName,
    latestEventAt: new Date(event.timestamp),
    project: event.project,
    repoPath: workspace.repoPath,
    sessionId: event.sessionId,
    status: event.status,
    task: event.task,
    workflow: event.workflow,
    workItemId: event.workItemId,
    worktreePath: workspace.worktreePath
  }) as Prisma.AuditRunUpdateInput;
}

export function buildRunCreateInputFromSummary(summary: AuditSyncSummary): Prisma.AuditRunCreateInput {
  const workspace = resolveAuditWorkspacePaths(summary.cwd);

  return {
    actor: summary.actor,
    agentName: summary.agentName ?? null,
    artifactCount: summary.artifacts.length,
    completedAt: toNullableDate(summary.completedAt),
    decisionCount: summary.decisions.length,
    durationMs: summary.durationMs ?? null,
    executionCount: summary.stats.executionCount,
    failedExecutionCount: summary.stats.failedExecutionCount,
    failureCount: summary.failures.length,
    id: summary.runId,
    latestEventAt: new Date(summary.completedAt ?? summary.startedAt),
    project: summary.project ?? null,
    repoPath: workspace.repoPath ?? null,
    sessionId: summary.sessionId ?? null,
    startedAt: new Date(summary.startedAt),
    statsByKindJson: JSON.stringify(summary.stats.byKind),
    statsByStatusJson: JSON.stringify(summary.stats.byStatus),
    status: summary.status,
    summaryJson: JSON.stringify(summary),
    task: summary.task ?? null,
    workflow: summary.workflow,
    workItemId: summary.workItemId ?? null,
    worktreePath: workspace.worktreePath
  };
}

export function buildRunUpdateInputFromSummary(summary: AuditSyncSummary): Prisma.AuditRunUpdateInput {
  const workspace = resolveAuditWorkspacePaths(summary.cwd);

  return {
    actor: summary.actor,
    agentName: summary.agentName ?? null,
    artifactCount: summary.artifacts.length,
    completedAt: toNullableDate(summary.completedAt),
    decisionCount: summary.decisions.length,
    durationMs: summary.durationMs ?? null,
    executionCount: summary.stats.executionCount,
    failedExecutionCount: summary.stats.failedExecutionCount,
    failureCount: summary.failures.length,
    latestEventAt: new Date(summary.completedAt ?? summary.startedAt),
    project: summary.project ?? null,
    repoPath: workspace.repoPath ?? null,
    sessionId: summary.sessionId ?? null,
    statsByKindJson: JSON.stringify(summary.stats.byKind),
    statsByStatusJson: JSON.stringify(summary.stats.byStatus),
    status: summary.status,
    summaryJson: JSON.stringify(summary),
    task: summary.task ?? null,
    workflow: summary.workflow,
    workItemId: summary.workItemId ?? null,
    worktreePath: workspace.worktreePath
  };
}

export async function syncExecutionFromEvent(
  transaction: Prisma.TransactionClient,
  event: AuditSyncEvent
): Promise<void> {
  if (event.executionId === undefined) {
    return;
  }

  const existing = await transaction.auditExecutionRecord.findUnique({
    where: {
      id: event.executionId
    }
  });
  const startedAt = existing?.startedAt ?? new Date(event.timestamp);
  const completedAt = resolveCompletedAt(event, existing?.completedAt ?? null);
  const status = event.status ?? existing?.status ?? "running";

  await transaction.auditExecutionRecord.upsert({
    create: buildExecutionCreateInputFromEvent({
      completedAt,
      event,
      executionId: event.executionId,
      startedAt,
      status
    }),
    update: buildExecutionUpdateInputFromEvent(event, completedAt, status),
    where: {
      id: event.executionId
    }
  });
}

export function buildEventCreateInput(event: AuditSyncEvent): Prisma.AuditEventRecordUncheckedCreateInput {
  return {
    actor: event.actor,
    agentName: toNullable(event.agentName),
    commandJson: stringifyJson(event.command),
    cwd: event.cwd,
    durationMs: toNullable(event.durationMs),
    errorMessage: toNullable(event.errorMessage),
    errorName: toNullable(event.errorName),
    eventType: event.eventType,
    executionId: toNullable(event.executionId),
    executionKind: toNullable(event.executionKind),
    executionName: toNullable(event.executionName),
    exitCode: toNullable(event.exitCode),
    id: event.eventId,
    logFile: toNullable(event.logFile),
    metadataJson: stringifyJson(event.metadata),
    parentExecutionId: toNullable(event.parentExecutionId),
    project: toNullable(event.project),
    runId: event.runId,
    sessionId: toNullable(event.sessionId),
    status: toNullable(event.status),
    step: toNullable(event.step),
    task: toNullable(event.task),
    timestamp: new Date(event.timestamp),
    workflow: event.workflow
    ,
    workItemId: toNullable(event.workItemId)
  };
}

export function buildEventUpdateInput(event: AuditSyncEvent): Prisma.AuditEventRecordUncheckedUpdateInput {
  return compactUpdate({
    actor: event.actor,
    agentName: event.agentName,
    commandJson: optionalJson(event.command),
    cwd: event.cwd,
    durationMs: event.durationMs,
    errorMessage: event.errorMessage,
    errorName: event.errorName,
    eventType: event.eventType,
    executionId: event.executionId,
    executionKind: event.executionKind,
    executionName: event.executionName,
    exitCode: event.exitCode,
    logFile: event.logFile,
    metadataJson: optionalJson(event.metadata),
    parentExecutionId: event.parentExecutionId,
    project: event.project,
    sessionId: event.sessionId,
    status: event.status,
    step: event.step,
    task: event.task,
    timestamp: new Date(event.timestamp),
    workflow: event.workflow,
    workItemId: event.workItemId
  }) as Prisma.AuditEventRecordUncheckedUpdateInput;
}

export function buildExecutionCreateInput(
  runId: string,
  execution: AuditSyncExecutionSummary
): Prisma.AuditExecutionRecordUncheckedCreateInput {
  return {
    commandJson: stringifyJson(execution.command),
    completedAt: calculateCompletedAt(execution.startedAt, execution.durationMs, execution.status),
    durationMs: execution.durationMs,
    errorMessage: execution.errorMessage ?? null,
    errorName: execution.errorName ?? null,
    exitCode: execution.exitCode ?? null,
    id: execution.executionId,
    kind: execution.kind,
    logFile: execution.logFile ?? null,
    metadataJson: stringifyJson(execution.metadata),
    name: execution.name,
    parentExecutionId: execution.parentExecutionId ?? null,
    runId,
    startedAt: new Date(execution.startedAt),
    status: execution.status,
    step: execution.step ?? null
  };
}

export function buildExecutionUpdateInput(
  execution: AuditSyncExecutionSummary
): Prisma.AuditExecutionRecordUncheckedUpdateInput {
  return compactUpdate({
    commandJson: optionalJson(execution.command),
    completedAt: calculateCompletedAt(execution.startedAt, execution.durationMs, execution.status),
    durationMs: execution.durationMs,
    errorMessage: execution.errorMessage,
    errorName: execution.errorName,
    exitCode: execution.exitCode,
    kind: execution.kind,
    logFile: execution.logFile,
    metadataJson: optionalJson(execution.metadata),
    name: execution.name,
    parentExecutionId: execution.parentExecutionId,
    startedAt: new Date(execution.startedAt),
    status: execution.status,
    step: execution.step
  }) as Prisma.AuditExecutionRecordUncheckedUpdateInput;
}

function buildExecutionCreateInputFromEvent(
  input: {
    completedAt: Date | null;
    event: AuditSyncEvent;
    executionId: string;
    startedAt: Date;
    status: string;
  }
): Prisma.AuditExecutionRecordUncheckedCreateInput {
  const { completedAt, event, executionId, startedAt, status } = input;

  return {
    commandJson: stringifyJson(event.command),
    completedAt,
    durationMs: toNullable(event.durationMs),
    errorMessage: toNullable(event.errorMessage),
    errorName: toNullable(event.errorName),
    exitCode: toNullable(event.exitCode),
    id: executionId,
    kind: event.executionKind ?? "operation",
    logFile: toNullable(event.logFile),
    metadataJson: stringifyJson(event.metadata),
    name: event.executionName ?? event.step ?? executionId,
    parentExecutionId: toNullable(event.parentExecutionId),
    runId: event.runId,
    startedAt,
    status,
    step: toNullable(event.step)
  };
}

function buildExecutionUpdateInputFromEvent(
  event: AuditSyncEvent,
  completedAt: Date | null,
  status: string
): Prisma.AuditExecutionRecordUncheckedUpdateInput {
  return compactUpdate({
    commandJson: optionalJson(event.command),
    completedAt,
    durationMs: event.durationMs,
    errorMessage: event.errorMessage,
    errorName: event.errorName,
    exitCode: event.exitCode,
    kind: event.executionKind,
    logFile: event.logFile,
    metadataJson: optionalJson(event.metadata),
    name: event.executionName ?? event.step,
    parentExecutionId: event.parentExecutionId,
    status,
    step: event.step
  }) as Prisma.AuditExecutionRecordUncheckedUpdateInput;
}

function compactUpdate(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

function optionalJson(value: unknown): string | undefined {
  return stringifyJson(value) ?? undefined;
}

function resolveCompletedAt(event: AuditSyncEvent, existingCompletedAt: Date | null): Date | null {
  return event.eventType === "execution-end" ? new Date(event.timestamp) : existingCompletedAt;
}

function toNullableDate(value: string | undefined): Date | null {
  return value === undefined ? null : new Date(value);
}

function toNullable<T>(value: T | undefined): T | null {
  return value ?? null;
}
