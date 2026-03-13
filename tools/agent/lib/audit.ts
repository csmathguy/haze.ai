import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { syncAuditEventSafely, syncAuditSummarySafely } from "./audit-db-sync.js";
import { compactAuditContextFields } from "./audit-context.js";
import {
  appendArtifactSummary as appendArtifactRecord,
  appendDecisionSummary as appendDecisionRecord,
  appendFailureSummary as appendFailureRecord,
  appendHandoffSummary as appendHandoffRecord,
  type AuditArtifactSummary,
  type AuditDecisionSummary,
  type AuditFailureSummary,
  type AuditHandoffSummary
} from "./audit-records.js";
import { createRunId, getAuditDateSegment } from "./audit-run-id.js";

export { createRunId, getAuditDateSegment, slugify } from "./audit-run-id.js";
export const AUDIT_ROOT = path.resolve("artifacts", "audit");
export type AuditExecutionKind = "command" | "hook" | "operation" | "skill" | "tool" | "validation";
export type WorkflowStatus = "failed" | "running" | "skipped" | "success";
export type AuditMetadataValue = AuditMetadata | AuditMetadataValue[] | boolean | null | number | string;
export interface AuditMetadata {
  [key: string]: AuditMetadataValue;
}
export interface AuditRunContextFields {
  agentName?: string;
  planRunId?: string;
  planStepId?: string;
  project?: string;
  sessionId?: string;
  workItemId?: string;
}
export interface AuditPaths { eventsPath: string; logsDir: string; runDir: string; summaryPath: string; }
export interface AuditEvent {
  actor: string;
  agentName?: string;
  command?: string[];
  cwd: string;
  durationMs?: number;
  errorMessage?: string;
  errorName?: string;
  eventId: string;
  eventType:
    | "artifact-recorded"
    | "decision-recorded"
    | "execution-end"
    | "execution-start"
    | "failure-recorded"
    | "handoff-recorded"
    | "workflow-end"
    | "workflow-note"
    | "workflow-start";
  executionId?: string;
  executionKind?: AuditExecutionKind;
  executionName?: string;
  exitCode?: number;
  logFile?: string;
  metadata?: AuditMetadata;
  planRunId?: string;
  planStepId?: string;
  parentExecutionId?: string;
  project?: string;
  runId: string;
  sessionId?: string;
  status?: WorkflowStatus;
  step?: string;
  task?: string;
  timestamp: string;
  workflow: string;
  workItemId?: string;
}
export interface AuditSummary {
  actor: string;
  agentName?: string;
  artifacts: AuditArtifactSummary[];
  completedAt?: string;
  cwd: string;
  decisions: AuditDecisionSummary[];
  durationMs?: number;
  executions: AuditExecutionSummary[];
  failures: AuditFailureSummary[];
  handoffs: AuditHandoffSummary[];
  runId: string;
  planRunId?: string;
  planStepId?: string;
  project?: string;
  sessionId?: string;
  startedAt: string;
  stats: AuditSummaryStats;
  status: WorkflowStatus;
  steps: AuditStepSummary[];
  task?: string;
  workflow: string;
  workItemId?: string;
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
  byKind: Partial<Record<AuditExecutionKind, number>>; byStatus: Partial<Record<WorkflowStatus, number>>;
  executionCount: number; failedExecutionCount: number;
}
export function createWorkflowSummary(
  runId: string,
  workflow: string,
  task?: string,
  contextOverride: AuditRunContextFields = {}
): AuditSummary {
  const context = {
    ...resolveAuditRunContextFields(),
    ...toContextRecord(contextOverride)
  };

  return {
    actor: detectActor(),
    artifacts: [],
    cwd: process.cwd(),
    decisions: [],
    executions: [],
    failures: [],
    handoffs: [],
    runId,
    startedAt: new Date().toISOString(),
    stats: createEmptySummaryStats(),
    status: "running",
    steps: [],
    workflow,
    ...context,
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

export function appendDecisionSummary(summary: AuditSummary, decision: AuditDecisionSummary): void {
  summary.decisions = appendDecisionRecord(summary.decisions, decision);
}

export function appendArtifactSummary(summary: AuditSummary, artifact: AuditArtifactSummary): void {
  summary.artifacts = appendArtifactRecord(summary.artifacts, artifact);
}

export function appendFailureSummary(summary: AuditSummary, failure: AuditFailureSummary): void {
  summary.failures = appendFailureRecord(summary.failures, failure);
}

export function appendHandoffSummary(summary: AuditSummary, handoff: AuditHandoffSummary): void {
  summary.handoffs = appendHandoffRecord(summary.handoffs, handoff);
}

function normalizeSummary(summary: Partial<AuditSummary>): AuditSummary {
  return {
    ...getNormalizedCollections(summary),
    ...getNormalizedSummaryBase(summary),
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

export function getEventContextFields(summary: AuditSummary): AuditRunContextFields {
  return compactAuditContextFields({
    agentName: summary.agentName,
    planRunId: summary.planRunId,
    planStepId: summary.planStepId,
    project: summary.project,
    sessionId: summary.sessionId,
    workItemId: summary.workItemId
  });
}

function detectActor(): string {
  return process.env.CODEX_AGENT_NAME ?? process.env.USERNAME ?? process.env.USER ?? os.userInfo().username;
}

function resolveAuditRunContextFields(): AuditRunContextFields {
  return compactAuditContextFields({
    agentName: process.env.AUDIT_AGENT_NAME ?? process.env.CODEX_AGENT_NAME,
    planRunId: process.env.AUDIT_PLAN_RUN_ID,
    planStepId: process.env.AUDIT_PLAN_STEP_ID,
    project: process.env.AUDIT_PROJECT,
    sessionId: process.env.AUDIT_SESSION_ID,
    workItemId: process.env.AUDIT_WORK_ITEM_ID
  });
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
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
    ...toContextRecord(summary),
    ...(summary.completedAt === undefined ? {} : { completedAt: summary.completedAt }),
    ...(summary.durationMs === undefined ? {} : { durationMs: summary.durationMs }),
    ...(summary.task === undefined ? {} : { task: summary.task })
  };
}

function toContextRecord(value: Partial<AuditRunContextFields>): Partial<AuditRunContextFields> {
  return compactAuditContextFields({
    agentName: value.agentName,
    planRunId: value.planRunId,
    planStepId: value.planStepId,
    project: value.project,
    sessionId: value.sessionId,
    workItemId: value.workItemId
  });
}

function getNormalizedCollections(summary: Partial<AuditSummary>) {
  return { artifacts: summary.artifacts ?? [], decisions: summary.decisions ?? [], executions: summary.executions ?? [], failures: summary.failures ?? [], handoffs: summary.handoffs ?? [] };
}

function getNormalizedSummaryBase(summary: Partial<AuditSummary>): Omit<
  AuditSummary,
  | "agentName"
  | "artifacts"
  | "completedAt"
  | "decisions"
  | "durationMs"
  | "failures"
  | "handoffs"
  | "planRunId"
  | "planStepId"
  | "project"
  | "sessionId"
  | "task"
  | "workItemId"
> {
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
    workflow: summary.workflow ?? "workflow"
  };
}
