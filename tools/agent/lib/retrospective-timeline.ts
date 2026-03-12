import type { AuditEvent } from "./audit.js";
import { formatAuditLogReference } from "./retrospective-paths.js";

export interface TimelineEntry {
  message: string;
  timestamp: string;
}

type TimelineEntryBuilder = (
  event: AuditEvent,
  failedAttemptsByLabel: Map<string, number>,
  runDir: string
) => TimelineEntry | null;

export function buildTimelineEntries(events: AuditEvent[], runDir: string): TimelineEntry[] {
  const failedAttemptsByLabel = new Map<string, number>();

  return events
    .flatMap((event) => {
      const entry = toTimelineEntry(event, failedAttemptsByLabel, runDir);
      return entry === null ? [] : [entry];
    })
    .slice(0, 10);
}

function toTimelineEntry(
  event: AuditEvent,
  failedAttemptsByLabel: Map<string, number>,
  runDir: string
): TimelineEntry | null {
  const builder = TIMELINE_ENTRY_BUILDERS[event.eventType];
  return builder(event, failedAttemptsByLabel, runDir);
}

function createWorkflowStartEntry(event: AuditEvent): TimelineEntry {
  return {
    message: event.task === undefined ? "Workflow started." : `Workflow started for "${event.task}".`,
    timestamp: event.timestamp
  };
}

function createWorkflowNoteEntry(event: AuditEvent): TimelineEntry | null {
  const message = event.metadata?.message;

  return typeof message === "string"
    ? {
        message: `Workflow note: ${message}.`,
        timestamp: event.timestamp
      }
    : null;
}

function createFailedExecutionEntry(
  event: AuditEvent,
  failedAttemptsByLabel: Map<string, number>,
  runDir: string
): TimelineEntry | null {
  if (event.status !== "failed") {
    return null;
  }

  const label = event.step ?? event.executionName ?? event.executionKind ?? "execution";
  const attempt = getFailedAttemptNumber(event, failedAttemptsByLabel, label);

  return {
    message: `${label} failed on attempt ${String(attempt)} after ${formatDuration(event.durationMs)}. Review ${formatAuditLogReference(event.logFile, runDir)}.`,
    timestamp: event.timestamp
  };
}

function createWorkflowEndEntry(event: AuditEvent): TimelineEntry {
  return {
    message: `Workflow ended with status ${event.status ?? "unknown"}.`,
    timestamp: event.timestamp
  };
}

const TIMELINE_ENTRY_BUILDERS: Record<AuditEvent["eventType"], TimelineEntryBuilder> = {
  "execution-end": (event, failedAttemptsByLabel, runDir) =>
    createFailedExecutionEntry(event, failedAttemptsByLabel, runDir),
  "execution-start": () => null,
  "workflow-end": (event) => createWorkflowEndEntry(event),
  "workflow-note": (event) => createWorkflowNoteEntry(event),
  "workflow-start": (event) => createWorkflowStartEntry(event)
};

function getFailedAttemptNumber(
  event: AuditEvent,
  failedAttemptsByLabel: Map<string, number>,
  label: string
): number {
  if (event.step === undefined) {
    return 1;
  }

  const attempt = (failedAttemptsByLabel.get(label) ?? 0) + 1;
  failedAttemptsByLabel.set(label, attempt);
  return attempt;
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
