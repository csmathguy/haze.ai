import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { syncAuditEvent, syncAuditSummary } from "../../../apps/audit/api/src/services/audit-store.js";

export const AUDIT_ROOT = path.resolve("artifacts", "audit");

export type AuditExecutionKind = "command" | "hook" | "operation" | "skill" | "tool" | "validation";
export type WorkflowStatus = "failed" | "running" | "skipped" | "success";
export type AuditMetadataValue =
  | AuditMetadata
  | AuditMetadataValue[]
  | boolean
  | null
  | number
  | string;

export interface AuditMetadata {
  [key: string]: AuditMetadataValue;
}

export interface AuditPaths {
  eventsPath: string;
  logsDir: string;
  runDir: string;
  summaryPath: string;
}

export interface AuditEvent {
  actor: string;
  command?: string[];
  cwd: string;
  durationMs?: number;
  errorMessage?: string;
  errorName?: string;
  eventId: string;
  eventType:
    | "execution-end"
    | "execution-start"
    | "workflow-end"
    | "workflow-note"
    | "workflow-start";
  executionId?: string;
  executionKind?: AuditExecutionKind;
  executionName?: string;
  exitCode?: number;
  logFile?: string;
  metadata?: AuditMetadata;
  parentExecutionId?: string;
  runId: string;
  status?: WorkflowStatus;
  step?: string;
  task?: string;
  timestamp: string;
  workflow: string;
}

export interface AuditSummary {
  actor: string;
  completedAt?: string;
  cwd: string;
  durationMs?: number;
  executions: AuditExecutionSummary[];
  runId: string;
  startedAt: string;
  stats: AuditSummaryStats;
  status: WorkflowStatus;
  steps: AuditStepSummary[];
  task?: string;
  workflow: string;
}

export interface AuditExecutionSummary {
  command?: string[];
  durationMs: number;
  errorMessage?: string;
  errorName?: string;
  executionId: string;
  exitCode?: number;
  kind: AuditExecutionKind;
  logFile?: string;
  metadata?: AuditMetadata;
  name: string;
  parentExecutionId?: string;
  startedAt: string;
  status: WorkflowStatus;
  step?: string;
}

export interface AuditStepSummary {
  command: string[];
  durationMs: number;
  exitCode: number;
  logFile: string;
  startedAt: string;
  status: WorkflowStatus;
  step: string;
}

export interface AuditSummaryStats {
  byKind: Partial<Record<AuditExecutionKind, number>>;
  byStatus: Partial<Record<WorkflowStatus, number>>;
  executionCount: number;
  failedExecutionCount: number;
}

export function createRunId(workflow: string, now: Date = new Date()): string {
  const stamp = formatLocalRunTimestamp(now);
  return `${stamp}-${slugify(workflow)}-${randomUUID().slice(0, 8)}`;
}

export function getAuditDateSegment(runId: string): string {
  const matchedDate = /^\d{4}-\d{2}-\d{2}/u.exec(runId)?.[0];
  return matchedDate ?? formatLocalDate(new Date());
}

export function createWorkflowSummary(runId: string, workflow: string, task?: string): AuditSummary {
  return {
    actor: detectActor(),
    cwd: process.cwd(),
    executions: [],
    runId,
    startedAt: new Date().toISOString(),
    stats: createEmptySummaryStats(),
    status: "running",
    steps: [],
    workflow,
    ...(task === undefined ? {} : { task })
  };
}

export function createEmptySummaryStats(): AuditSummaryStats {
  return {
    byKind: {},
    byStatus: {},
    executionCount: 0,
    failedExecutionCount: 0
  };
}

export type { ActiveExecutionRecord } from "./audit-active-runs.js";
export {
  clearActiveExecution,
  clearActiveRun,
  getActiveExecution,
  getActiveRunId,
  setActiveExecution,
  setActiveRun
} from "./audit-active-runs.js";

export function slugify(value: string): string {
  const characters = value.trim().toLowerCase().split("");
  let compact = "";
  let previousWasDash = false;

  for (const character of characters) {
    const isLetter = character >= "a" && character <= "z";
    const isDigit = character >= "0" && character <= "9";

    if (isLetter || isDigit) {
      compact += character;
      previousWasDash = false;
      continue;
    }

    if (!previousWasDash && compact.length > 0) {
      compact += "-";
      previousWasDash = true;
    }
  }

  const normalized = compact.endsWith("-") ? compact.slice(0, -1) : compact;
  return normalized.slice(0, 40) || "workflow";
}

export async function ensureAuditPaths(runId: string): Promise<AuditPaths> {
  const dateDir = path.join(AUDIT_ROOT, getAuditDateSegment(runId));
  const runDir = path.join(dateDir, runId);
  const logsDir = path.join(runDir, "logs");

  await mkdir(logsDir, { recursive: true });

  return {
    eventsPath: path.join(runDir, "events.ndjson"),
    logsDir,
    runDir,
    summaryPath: path.join(runDir, "summary.json")
  };
}

export async function appendAuditEvent(paths: AuditPaths, event: AuditEvent): Promise<void> {
  await mkdir(path.dirname(paths.eventsPath), { recursive: true });
  await writeFile(paths.eventsPath, `${JSON.stringify(event)}\n`, { flag: "a" });
  await syncAuditEventSafely(event);
}

export async function readSummary(paths: AuditPaths): Promise<AuditSummary | null> {
  try {
    const contents = await readFile(paths.summaryPath, "utf8");
    return normalizeSummary(JSON.parse(contents) as Partial<AuditSummary>);
  } catch (error) {
    if (isMissingFile(error)) {
      return null;
    }

    throw error;
  }
}

export async function writeSummary(paths: AuditPaths, summary: AuditSummary): Promise<void> {
  await mkdir(path.dirname(paths.summaryPath), { recursive: true });
  await writeFile(paths.summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  await syncAuditSummarySafely(summary);
}

export function appendExecutionSummary(summary: AuditSummary, execution: AuditExecutionSummary): void {
  summary.executions.push(execution);
  summary.stats.executionCount += 1;
  summary.stats.byKind[execution.kind] = (summary.stats.byKind[execution.kind] ?? 0) + 1;
  summary.stats.byStatus[execution.status] = (summary.stats.byStatus[execution.status] ?? 0) + 1;

  if (execution.status === "failed") {
    summary.stats.failedExecutionCount += 1;
  }

  if (isCommandExecutionSummary(execution)) {
    summary.steps.push({
      command: execution.command,
      durationMs: execution.durationMs,
      exitCode: execution.exitCode,
      logFile: execution.logFile,
      startedAt: execution.startedAt,
      status: execution.status,
      step: execution.step
    });
  }
}

function normalizeSummary(summary: Partial<AuditSummary>): AuditSummary {
  const executions = summary.executions ?? [];

  return {
    actor: summary.actor ?? detectActor(),
    cwd: summary.cwd ?? process.cwd(),
    executions,
    runId: summary.runId ?? createRunId("workflow"),
    startedAt: summary.startedAt ?? new Date().toISOString(),
    stats: summarizeExecutions(executions),
    status: summary.status ?? "running",
    steps: summary.steps ?? [],
    workflow: summary.workflow ?? "workflow",
    ...getOptionalSummaryFields(summary)
  };
}

export function createEvent(
  runId: string,
  workflow: string,
  eventType: AuditEvent["eventType"],
  fields: Partial<Omit<AuditEvent, "actor" | "cwd" | "eventId" | "eventType" | "runId" | "timestamp" | "workflow">> = {}
): AuditEvent {
  return {
    actor: detectActor(),
    cwd: process.cwd(),
    eventId: randomUUID(),
    eventType,
    runId,
    timestamp: new Date().toISOString(),
    workflow,
    ...fields
  };
}

function detectActor(): string {
  return process.env.CODEX_AGENT_NAME ?? process.env.USERNAME ?? process.env.USER ?? os.userInfo().username;
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function formatLocalRunTimestamp(value: Date): string {
  return `${formatLocalDate(value)}T${pad(value.getHours())}${pad(value.getMinutes())}${pad(value.getSeconds())}-${padMilliseconds(value.getMilliseconds())}`;
}

function formatLocalDate(value: Date): string {
  return `${value.getFullYear().toString()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

function padMilliseconds(value: number): string {
  return value.toString().padStart(3, "0");
}

function isCommandExecutionSummary(execution: AuditExecutionSummary): execution is AuditExecutionSummary &
  Required<Pick<AuditExecutionSummary, "command" | "exitCode" | "logFile" | "step">> {
  return (
    execution.kind === "command" &&
    execution.command !== undefined &&
    execution.exitCode !== undefined &&
    execution.logFile !== undefined &&
    execution.step !== undefined
  );
}

function summarizeExecutions(executions: AuditExecutionSummary[]): AuditSummaryStats {
  const stats = createEmptySummaryStats();

  for (const execution of executions) {
    stats.executionCount += 1;
    stats.byKind[execution.kind] = (stats.byKind[execution.kind] ?? 0) + 1;
    stats.byStatus[execution.status] = (stats.byStatus[execution.status] ?? 0) + 1;

    if (execution.status === "failed") {
      stats.failedExecutionCount += 1;
    }
  }

  return stats;
}

function getOptionalSummaryFields(summary: Partial<AuditSummary>): Partial<AuditSummary> {
  return {
    ...(summary.completedAt === undefined ? {} : { completedAt: summary.completedAt }),
    ...(summary.durationMs === undefined ? {} : { durationMs: summary.durationMs }),
    ...(summary.task === undefined ? {} : { task: summary.task })
  };
}

const reportedSyncFailures = new Set<string>();

async function syncAuditEventSafely(event: AuditEvent): Promise<void> {
  try {
    await syncAuditEvent(
      event,
      process.env.AUDIT_DATABASE_URL === undefined ? {} : { databaseUrl: process.env.AUDIT_DATABASE_URL }
    );
  } catch (error) {
    reportAuditSyncFailure("event", error);
  }
}

async function syncAuditSummarySafely(summary: AuditSummary): Promise<void> {
  try {
    await syncAuditSummary(
      summary,
      process.env.AUDIT_DATABASE_URL === undefined ? {} : { databaseUrl: process.env.AUDIT_DATABASE_URL }
    );
  } catch (error) {
    reportAuditSyncFailure("summary", error);
  }
}

function reportAuditSyncFailure(kind: "event" | "summary", error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const cacheKey = `${kind}:${message}`;

  if (reportedSyncFailures.has(cacheKey)) {
    return;
  }

  reportedSyncFailures.add(cacheKey);
  process.stderr.write(`Audit ${kind} DB sync failed; file artifacts were still written. ${message}\n`);
}
