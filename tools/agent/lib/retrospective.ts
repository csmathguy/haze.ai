import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { AUDIT_ROOT, getAuditDateSegment, type AuditEvent, type AuditStepSummary, type AuditSummary } from "./audit.js";
import { formatAuditLogReference } from "./retrospective-paths.js";
import { buildTimelineEntries, type TimelineEntry } from "./retrospective-timeline.js";

export const RETROSPECTIVE_ROOT = path.resolve("artifacts", "retrospectives");

export interface CreateRetrospectiveOptions {
  auditRoot?: string;
  force?: boolean;
  now?: Date;
  outputPath?: string;
  retrospectiveRoot?: string;
}

export interface LoadedAuditRun {
  events: AuditEvent[];
  paths: RetrospectivePaths;
  summary: AuditSummary;
}

export interface RetrospectivePaths {
  eventsPath: string;
  outputPath: string;
  runDir: string;
  summaryPath: string;
}

interface RetrySummary {
  attempts: number;
  failedAttempts: number;
  recovered: boolean;
  step: string;
}

export async function createRetrospectiveArtifact(
  runId: string,
  options: CreateRetrospectiveOptions = {}
): Promise<LoadedAuditRun> {
  const paths = resolveRetrospectivePaths(runId, options);

  if (!options.force && existsSync(paths.outputPath)) {
    throw new Error(`Retrospective already exists at ${paths.outputPath}. Re-run with --force to overwrite it.`);
  }

  const loadedRun = await loadAuditRun(paths);
  const markdown = buildRetrospectiveMarkdown(loadedRun, options.now ?? new Date());

  await mkdir(path.dirname(paths.outputPath), { recursive: true });
  await writeFile(paths.outputPath, markdown);

  return loadedRun;
}

export function resolveRetrospectivePaths(
  runId: string,
  options: Pick<CreateRetrospectiveOptions, "auditRoot" | "outputPath" | "retrospectiveRoot"> = {}
): RetrospectivePaths {
  const auditRoot = options.auditRoot ?? AUDIT_ROOT;
  const retrospectiveRoot = options.retrospectiveRoot ?? RETROSPECTIVE_ROOT;
  const dateSegment = getAuditDateSegment(runId);
  const runDir = path.join(auditRoot, dateSegment, runId);
  const outputPath = options.outputPath ?? path.join(retrospectiveRoot, dateSegment, `${runId}.md`);

  return {
    eventsPath: path.join(runDir, "events.ndjson"),
    outputPath,
    runDir,
    summaryPath: path.join(runDir, "summary.json")
  };
}

export async function loadAuditRun(paths: RetrospectivePaths): Promise<LoadedAuditRun> {
  const [summary, events] = await Promise.all([readAuditSummary(paths.summaryPath), readAuditEvents(paths.eventsPath)]);

  return {
    events,
    paths,
    summary
  };
}

export function buildRetrospectiveMarkdown(run: LoadedAuditRun, now: Date = new Date()): string {
  const relativeAuditPath = toPortablePath(path.relative(path.dirname(run.paths.outputPath), run.paths.runDir));
  const failedSteps = collectFailedSteps(run.summary.steps);
  const repeatedSteps = summarizeRetries(run.summary.steps);
  const workflowNotes = collectWorkflowNotes(run.events);
  const timelineEntries = buildTimelineEntries(run.events, run.paths.runDir);
  const longestSteps = [...run.summary.steps].sort((left, right) => right.durationMs - left.durationMs).slice(0, 3);
  const uniqueSteps = [...new Set(run.summary.steps.map((step) => step.step))];

  return [
    "# Workflow Retrospective",
    "",
    `Generated on ${now.toISOString()}.`,
    "",
    "## Run Summary",
    `- Run ID: \`${run.summary.runId}\``,
    `- Workflow: \`${run.summary.workflow}\``,
    `- Task: ${run.summary.task ?? "Not recorded"}`,
    `- Status: ${run.summary.status}`,
    `- Started: ${run.summary.startedAt}`,
    `- Completed: ${run.summary.completedAt ?? "Not recorded"}`,
    `- Duration: ${formatDuration(run.summary.durationMs)}`,
    `- Audit run: \`${relativeAuditPath}\``,
    "",
    "## Evidence Snapshot",
    `- Command attempts: ${String(run.summary.steps.length)}`,
    `- Failed attempts: ${String(failedSteps.length)}`,
    `- Executions recorded: ${String(run.summary.stats.executionCount)} total, ${String(run.summary.stats.failedExecutionCount)} failed`,
    `- Unique steps: ${uniqueSteps.length === 0 ? "none" : uniqueSteps.join(", ")}`,
    `- Longest steps: ${formatLongestSteps(longestSteps)}`,
    `- Repeated steps: ${formatRetrySummaries(repeatedSteps)}`,
    `- Workflow notes: ${formatWorkflowNotes(workflowNotes)}`,
    `- Failure points: ${formatFailurePoints(failedSteps, run.paths.runDir)}`,
    "",
    "## Key Timeline",
    ...formatTimelineEntries(timelineEntries),
    "",
    "## Outcome",
    "_Summarize the delivered result and whether the workflow finished in the expected state._",
    "",
    "## What Went Well",
    "_Capture concrete wins backed by the audit trail, notes, or code changes._",
    "- ",
    "",
    "## What Didn't Go Well",
    "_Focus on process, sequencing, missing context, or validation gaps. Avoid blame._",
    "- ",
    "",
    "## What Could Have Gone Better Sooner",
    "_Identify decisions, checks, or handoffs that would have shortened time-to-answer._",
    "- ",
    "",
    "## Impediments And Recurring Blockers",
    "_Call out repeated failures, late feedback, missing documentation, or environment friction._",
    "- ",
    "",
    "## Tooling, Systems, And Structure Improvements",
    "_List changes to scripts, docs, task structure, or repository automation that would improve future runs._",
    "- ",
    "",
    "## Future Tasks To Consider",
    "_Capture follow-on work that the retrospective surfaced._",
    "- ",
    "",
    "## Follow-Up Actions",
    "| Action | Owner | Due date | Evidence |",
    "| --- | --- | --- | --- |",
    "|  |  |  |  |",
    ""
  ].join("\n");
}

async function readAuditSummary(summaryPath: string): Promise<AuditSummary> {
  try {
    const contents = await readFile(summaryPath, "utf8");
    return JSON.parse(contents) as AuditSummary;
  } catch (error) {
    throw createMissingAuditError(error, summaryPath);
  }
}

async function readAuditEvents(eventsPath: string): Promise<AuditEvent[]> {
  try {
    const contents = await readFile(eventsPath, "utf8");

    return contents
      .split(/\r?\n/gu)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as AuditEvent);
  } catch (error) {
    throw createMissingAuditError(error, eventsPath);
  }
}

function createMissingAuditError(error: unknown, filePath: string): Error {
  if (error instanceof Error && "code" in error && error.code === "ENOENT") {
    return new Error(`Expected audit file at ${filePath}, but it does not exist.`);
  }

  return error instanceof Error ? error : new Error(String(error));
}

function collectFailedSteps(steps: AuditStepSummary[]): AuditStepSummary[] {
  return steps.filter((step) => step.status === "failed");
}

function summarizeRetries(steps: AuditStepSummary[]): RetrySummary[] {
  const grouped = new Map<string, AuditStepSummary[]>();

  for (const step of steps) {
    const existing = grouped.get(step.step) ?? [];
    existing.push(step);
    grouped.set(step.step, existing);
  }

  return [...grouped.entries()]
    .filter(([, attempts]) => attempts.length > 1)
    .map(([step, attempts]) => {
      const failedAttempts = attempts.filter((attempt) => attempt.status === "failed").length;
      return {
        attempts: attempts.length,
        failedAttempts,
        recovered: failedAttempts > 0 && attempts.at(-1)?.status === "success",
        step
      };
    });
}

function collectWorkflowNotes(events: AuditEvent[]): TimelineEntry[] {
  return events
    .filter((event) => event.eventType === "workflow-note")
    .flatMap((event) => {
      const message = event.metadata?.message;
      return typeof message === "string" ? [{ message, timestamp: event.timestamp }] : [];
    });
}

function formatLongestSteps(steps: AuditStepSummary[]): string {
  if (steps.length === 0) {
    return "none";
  }

  return steps.map((step) => `${step.step} (${formatDuration(step.durationMs)}, ${step.status})`).join("; ");
}

function formatRetrySummaries(retries: RetrySummary[]): string {
  if (retries.length === 0) {
    return "none";
  }

  return retries
    .map((retry) => {
      if (retry.failedAttempts === 0) {
        return `${retry.step} x${String(retry.attempts)}`;
      }

      const recovery = retry.recovered ? ", recovered later" : "";
      return `${retry.step} x${String(retry.attempts)} (${String(retry.failedAttempts)} failed${recovery})`;
    })
    .join("; ");
}

function formatWorkflowNotes(notes: TimelineEntry[]): string {
  if (notes.length === 0) {
    return "none";
  }

  return notes.map((note) => `${note.timestamp}: ${note.message}`).join("; ");
}

function formatFailurePoints(failedSteps: AuditStepSummary[], runDir: string): string {
  if (failedSteps.length === 0) {
    return "none";
  }

  return failedSteps
    .map((step) => `${step.step} (${formatDuration(step.durationMs)}; log: ${formatAuditLogReference(step.logFile, runDir)})`)
    .join("; ");
}

function formatTimelineEntries(entries: TimelineEntry[]): string[] {
  if (entries.length === 0) {
    return ["- No notable events were recorded beyond the summary metadata."];
  }

  return entries.map((entry) => `- ${entry.timestamp}: ${entry.message}`);
}

function formatDuration(durationMs: number | undefined): string {
  if (durationMs === undefined) {
    return "Not recorded";
  }

  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [
    hours > 0 ? `${String(hours)}h` : null,
    minutes > 0 ? `${String(minutes)}m` : null,
    `${String(seconds)}s`
  ].filter((value): value is string => value !== null);

  return parts.join(" ");
}

function toPortablePath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}
