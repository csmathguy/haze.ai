import { calculateCompletedAt, stringifyJson } from "./audit-serialization.js";
import type { AuditSyncEvent, AuditSyncExecutionSummary, AuditSyncSummary } from "./audit-sync-contract.js";
import { resolveAuditWorkspacePaths } from "./workspace-paths.js";

export function buildRunCreateInputFromEvent(event: AuditSyncEvent) {
  const workspace = resolveAuditWorkspacePaths(event.cwd);

  return {
    actor: event.actor,
    agentName: event.agentName ?? null,
    artifactCount: 0,
    decisionCount: 0,
    failureCount: 0,
    handoffCount: 0,
    id: event.runId,
    latestEventAt: new Date(event.timestamp),
    planRunId: event.planRunId ?? null,
    planStepId: event.planStepId ?? null,
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

export function buildRunUpdateInputFromEvent(event: AuditSyncEvent) {
  const workspace = resolveAuditWorkspacePaths(event.cwd);

  return compactUpdate({
    actor: event.actor,
    agentName: event.agentName,
    latestEventAt: new Date(event.timestamp),
    planRunId: event.planRunId,
    planStepId: event.planStepId,
    project: event.project,
    repoPath: workspace.repoPath,
    sessionId: event.sessionId,
    status: event.status,
    task: event.task,
    workflow: event.workflow,
    workItemId: event.workItemId,
    worktreePath: workspace.worktreePath
  });
}

export function buildRunCreateInputFromSummary(summary: AuditSyncSummary) {
  const workspace = resolveAuditWorkspacePaths(summary.cwd);

  return {
    ...buildSummaryRunFields(summary, workspace),
    id: summary.runId,
    startedAt: new Date(summary.startedAt)
  };
}

export function buildRunUpdateInputFromSummary(summary: AuditSyncSummary) {
  const workspace = resolveAuditWorkspacePaths(summary.cwd);

  return buildSummaryRunFields(summary, workspace);
}

function buildSummaryRunFields(
  summary: AuditSyncSummary,
  workspace: ReturnType<typeof resolveAuditWorkspacePaths>
) {
  return {
    ...buildSummaryRunCounts(summary),
    completedAt: toNullableDate(summary.completedAt),
    durationMs: summary.durationMs ?? null,
    latestEventAt: new Date(summary.completedAt ?? summary.startedAt),
    ...buildSummaryRunContext(summary, workspace),
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

function buildSummaryRunCounts(summary: AuditSyncSummary) {
  return {
    actor: summary.actor,
    agentName: summary.agentName ?? null,
    artifactCount: summary.artifacts.length,
    decisionCount: summary.decisions.length,
    executionCount: summary.stats.executionCount,
    failedExecutionCount: summary.stats.failedExecutionCount,
    failureCount: summary.failures.length,
    handoffCount: summary.handoffs.length
  };
}

function buildSummaryRunContext(summary: AuditSyncSummary, workspace: ReturnType<typeof resolveAuditWorkspacePaths>) {
  return {
    planRunId: summary.planRunId ?? null,
    planStepId: summary.planStepId ?? null,
    project: summary.project ?? null,
    repoPath: workspace.repoPath ?? null,
    sessionId: summary.sessionId ?? null
  };
}

export async function syncExecutionFromEvent(transaction: {
  auditExecutionRecord: {
    findUnique: (args: { where: { id: string } }) => Promise<{ completedAt: Date | null; startedAt: Date; status: string } | null>;
    upsert: (args: {
      create: ReturnType<typeof buildExecutionCreateInputFromEvent>;
      update: ReturnType<typeof buildExecutionUpdateInputFromEvent>;
      where: { id: string };
    }) => Promise<unknown>;
  };
}, event: AuditSyncEvent): Promise<void> {
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

export function buildEventCreateInput(event: AuditSyncEvent) {
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
    planRunId: toNullable(event.planRunId),
    planStepId: toNullable(event.planStepId),
    project: toNullable(event.project),
    runId: event.runId,
    sessionId: toNullable(event.sessionId),
    status: toNullable(event.status),
    step: toNullable(event.step),
    task: toNullable(event.task),
    timestamp: new Date(event.timestamp),
    workflow: event.workflow,
    workItemId: toNullable(event.workItemId)
  };
}

export function buildEventUpdateInput(event: AuditSyncEvent) {
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
    planRunId: event.planRunId,
    planStepId: event.planStepId,
    project: event.project,
    sessionId: event.sessionId,
    status: event.status,
    step: event.step,
    task: event.task,
    timestamp: new Date(event.timestamp),
    workflow: event.workflow,
    workItemId: event.workItemId
  });
}

export function buildExecutionCreateInput(runId: string, execution: AuditSyncExecutionSummary) {
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

export function buildExecutionUpdateInput(execution: AuditSyncExecutionSummary) {
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
  });
}

function buildExecutionCreateInputFromEvent(input: {
  completedAt: Date | null;
  event: AuditSyncEvent;
  executionId: string;
  startedAt: Date;
  status: string;
}) {
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

function buildExecutionUpdateInputFromEvent(event: AuditSyncEvent, completedAt: Date | null, status: string) {
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
  });
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
