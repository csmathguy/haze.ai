import { readFile } from "node:fs/promises";
import * as path from "node:path";

import type { AuditEventRecord, AuditExecutionRecord, AuditFailureInsight, AuditRunDetail } from "@taxes/shared";
import { AuditFailureInsightSchema } from "@taxes/shared";

export async function listAuditFailureInsights(detail: AuditRunDetail): Promise<AuditFailureInsight[]> {
  const coveredExecutionIds = new Set<string>();
  const failureInsights = await Promise.all(detail.failures.map(async (failure) => buildFailureInsight(detail, failure, coveredExecutionIds)));
  const executionInsights = await Promise.all(
    detail.executions
      .filter((execution) => execution.status === "failed" && !coveredExecutionIds.has(execution.executionId))
      .map(async (execution) => buildExecutionInsight(detail, execution))
  );

  return [...failureInsights, ...executionInsights].sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp));
}

async function buildFailureInsight(
  detail: AuditRunDetail,
  failure: AuditRunDetail["failures"][number],
  coveredExecutionIds: Set<string>
): Promise<AuditFailureInsight> {
  const related = resolveRelatedFailureRecords(detail, failure.executionId);

  if (failure.executionId !== undefined) {
    coveredExecutionIds.add(failure.executionId);
  }

  return AuditFailureInsightSchema.parse({
    category: failure.category,
    detail: failure.detail,
    errorMessage: related.errorMessage,
    errorName: related.errorName,
    executionId: failure.executionId,
    executionName: related.executionName,
    insightId: failure.failureId,
    logExcerpt: await readLogExcerpt(detail, related.logFile),
    logFile: related.logFile,
    retryable: failure.retryable,
    severity: failure.severity,
    sourceType: "failure",
    status: failure.status,
    step: related.step,
    summary: failure.summary,
    timestamp: failure.timestamp
  });
}

async function buildExecutionInsight(detail: AuditRunDetail, execution: AuditExecutionRecord): Promise<AuditFailureInsight> {
  const related = resolveRelatedExecutionRecords(detail, execution);

  return AuditFailureInsightSchema.parse({
    errorMessage: related.errorMessage,
    errorName: related.errorName,
    executionId: execution.executionId,
    executionName: execution.name,
    insightId: execution.executionId,
    logExcerpt: await readLogExcerpt(detail, related.logFile),
    logFile: related.logFile,
    sourceType: "execution",
    status: execution.status,
    step: related.step,
    summary: execution.name,
    timestamp: related.timestamp
  });
}

function resolveRelatedFailureRecords(detail: AuditRunDetail, executionId: string | undefined) {
  return toRelatedFailureRecords(findExecution(detail, executionId), findFailedEvent(detail, executionId));
}

function resolveRelatedExecutionRecords(detail: AuditRunDetail, execution: AuditExecutionRecord) {
  const event = findFailedEvent(detail, execution.executionId);

  return {
    errorMessage: firstDefined(execution.errorMessage, event?.errorMessage),
    errorName: firstDefined(execution.errorName, event?.errorName),
    logFile: firstDefined(execution.logFile, event?.logFile),
    step: firstDefined(execution.step, event?.step),
    timestamp: firstDefined(event?.timestamp, execution.completedAt, execution.startedAt)
  };
}

function findExecution(detail: AuditRunDetail, executionId: string | undefined): AuditExecutionRecord | undefined {
  if (executionId === undefined) {
    return undefined;
  }

  return detail.executions.find((execution) => execution.executionId === executionId);
}

function findFailedEvent(detail: AuditRunDetail, executionId: string | undefined): AuditEventRecord | undefined {
  if (executionId === undefined) {
    return undefined;
  }

  return [...detail.events]
    .reverse()
    .find((event) => event.executionId === executionId && (event.status === "failed" || event.errorMessage !== undefined));
}

async function readLogExcerpt(detail: AuditRunDetail, logFile: string | undefined): Promise<string | undefined> {
  const resolvedLogFile = resolveLogFilePath(detail, logFile);

  if (resolvedLogFile === null) {
    return undefined;
  }

  try {
    const content = await readFile(resolvedLogFile, "utf8");
    return toLogExcerpt(content);
  } catch {
    return undefined;
  }
}

function toLogExcerpt(content: string): string | undefined {
  const lines = content
    .split(/\r?\n/u)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return undefined;
  }

  return lines.slice(-12).join("\n");
}

function resolveLogFilePath(detail: AuditRunDetail, logFile: string | undefined): string | null {
  if (logFile === undefined) {
    return null;
  }

  const runDir = path.resolve(detail.run.worktreePath, "artifacts", "audit", getAuditDateSegment(detail.run.runId), detail.run.runId);
  const normalizedLogFile = path.normalize(logFile);

  if (path.isAbsolute(normalizedLogFile)) {
    return isSafeAbsoluteLogFile(detail.run.runId, normalizedLogFile) ? normalizedLogFile : null;
  }

  const resolved = path.resolve(runDir, normalizedLogFile);
  const relativePath = path.relative(runDir, resolved);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath) || !resolved.endsWith(".log")) {
    return null;
  }

  return resolved;
}

function isSafeAbsoluteLogFile(runId: string, logFile: string): boolean {
  const auditSegment = `${path.sep}artifacts${path.sep}audit${path.sep}`;
  return logFile.includes(auditSegment) && logFile.includes(runId) && logFile.endsWith(".log");
}

function getAuditDateSegment(runId: string): string {
  const matchedDate = /^\d{4}-\d{2}-\d{2}/u.exec(runId)?.[0];
  return matchedDate ?? "unknown-date";
}

function toRelatedFailureRecords(execution: AuditExecutionRecord | undefined, event: AuditEventRecord | undefined) {
  return {
    errorMessage: resolveFailureErrorMessage(execution, event),
    errorName: resolveFailureErrorName(execution, event),
    executionName: resolveFailureExecutionName(execution, event),
    logFile: resolveFailureLogFile(execution, event),
    step: resolveFailureStep(execution, event)
  };
}

function firstDefined<T>(...values: (T | undefined)[]): T | undefined {
  return values.find((value) => value !== undefined);
}

function resolveFailureErrorMessage(execution: AuditExecutionRecord | undefined, event: AuditEventRecord | undefined) {
  return firstDefined(execution?.errorMessage, event?.errorMessage);
}

function resolveFailureErrorName(execution: AuditExecutionRecord | undefined, event: AuditEventRecord | undefined) {
  return firstDefined(execution?.errorName, event?.errorName);
}

function resolveFailureExecutionName(execution: AuditExecutionRecord | undefined, event: AuditEventRecord | undefined) {
  return firstDefined(execution?.name, event?.executionName);
}

function resolveFailureLogFile(execution: AuditExecutionRecord | undefined, event: AuditEventRecord | undefined) {
  return firstDefined(execution?.logFile, event?.logFile);
}

function resolveFailureStep(execution: AuditExecutionRecord | undefined, event: AuditEventRecord | undefined) {
  return firstDefined(execution?.step, event?.step);
}
