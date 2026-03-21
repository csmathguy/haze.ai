import { open, readFile, stat } from "node:fs/promises";
import * as path from "node:path";

import type { AuditEvent, AuditMetadataValue } from "./audit.js";
import { AUDIT_ROOT, getAuditDateSegment } from "./audit.js";

export const DEFAULT_POLL_INTERVAL_MS = 3_000;
export const DEFAULT_STALE_HEARTBEAT_MIN = 10;

export interface WatchOptions {
  /** How often to re-read the events file (ms). */
  pollIntervalMs: number;
  /** Exit non-zero after this many minutes without a heartbeat. */
  staleHeartbeatMin: number;
}

export interface WatchState {
  bytesRead: number;
  lastHeartbeatAt: number;
  runId: string;
  seenEventIds: Set<string>;
  startedAt: number;
}

export type WatchLine =
  | { kind: "header"; runId: string; workItemId: string | undefined; task: string | undefined }
  | { kind: "event"; event: AuditEvent; label: string; isGate: boolean }
  | { kind: "stale"; minutesSinceHeartbeat: number; staleAfterMin: number }
  | { kind: "done"; status: "failed" | "success" | "unknown" };

export function resolveEventsPath(runId: string): string {
  return path.join(AUDIT_ROOT, getAuditDateSegment(runId), runId, "events.ndjson");
}

export function createWatchState(runId: string): WatchState {
  return {
    bytesRead: 0,
    lastHeartbeatAt: Date.now(),
    runId,
    seenEventIds: new Set(),
    startedAt: Date.now()
  };
}

export function isStale(state: WatchState, options: WatchOptions): boolean {
  const elapsedMin = (Date.now() - state.lastHeartbeatAt) / 60_000;
  return elapsedMin >= options.staleHeartbeatMin;
}

export function minutesSinceHeartbeat(state: WatchState): number {
  return Math.floor((Date.now() - state.lastHeartbeatAt) / 60_000);
}

/**
 * Read any bytes added to the events file since the last poll.
 * Returns new AuditEvent records that haven't been seen yet.
 */
export async function readNewEvents(eventsPath: string, state: WatchState): Promise<AuditEvent[]> {
  let fileSize: number;

  try {
    const info = await stat(eventsPath);
    fileSize = info.size;
  } catch {
    return [];
  }

  if (fileSize <= state.bytesRead) {
    return [];
  }

  const buffer = Buffer.alloc(fileSize - state.bytesRead);
  const handle = await open(eventsPath, "r");

  try {
    await handle.read(buffer, 0, buffer.length, state.bytesRead);
    state.bytesRead = fileSize;
  } finally {
    await handle.close();
  }

  const newEvents: AuditEvent[] = [];

  for (const line of buffer.toString("utf8").split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;

    try {
      const event = JSON.parse(trimmed) as AuditEvent;
      if (!state.seenEventIds.has(event.eventId)) {
        state.seenEventIds.add(event.eventId);
        newEvents.push(event);
      }
    } catch {
      // skip malformed lines
    }
  }

  return newEvents;
}

/**
 * Check if an event counts as a heartbeat (activity proof).
 */
export function isHeartbeatEvent(event: AuditEvent): boolean {
  return (
    event.eventType === "execution-start" ||
    event.eventType === "execution-end" ||
    event.eventType === "workflow-note" ||
    (event.eventType === "artifact-recorded" && metaString(event, "kind") === "heartbeat")
  );
}

/**
 * Check if an event represents a human-approval gate.
 */
export function isApprovalGateEvent(event: AuditEvent): boolean {
  if (event.eventType !== "workflow-note") return false;
  const message = metaString(event, "message");
  return /approval.gate|human.approv|awaiting.approval|gate.fired/iu.test(message);
}

/**
 * Produce a human-readable label for an audit event.
 */
export function labelForEvent(event: AuditEvent): string {
  switch (event.eventType) {
    case "workflow-start":
      return labelWorkflowStart(event);
    case "workflow-end":
      return `workflow ended — status: ${event.status ?? "unknown"}`;
    case "workflow-note":
      return `note: ${metaString(event, "message") || "(no message)"}`;
    case "execution-start":
      return `→ ${event.executionKind ?? "exec"}: ${event.executionName ?? "(unnamed)"}`;
    case "execution-end":
      return labelExecutionEnd(event);
    case "artifact-recorded":
      return labelArtifact(event);
    case "handoff-recorded":
      return `handoff: ${metaString(event, "summary") || "(no summary)"}`;
    case "decision-recorded":
      return `decision: ${metaString(event, "summary") || "(no summary)"}`;
    case "failure-recorded":
      return `failure: ${metaString(event, "summary") || "(no summary)"}`;
    default:
      return event.eventType;
  }
}

function labelWorkflowStart(event: AuditEvent): string {
  const base = `workflow started — ${event.workflow}`;
  return event.task !== undefined ? `${base}: ${event.task}` : base;
}

function labelExecutionEnd(event: AuditEvent): string {
  const duration =
    event.durationMs !== undefined ? ` (${(event.durationMs / 1000).toFixed(1)}s)` : "";
  return `✓ ${event.executionKind ?? "exec"}: ${event.executionName ?? "(unnamed)"}${duration} [${event.status ?? "?"}]`;
}

function labelArtifact(event: AuditEvent): string {
  const kind = metaString(event, "kind") || "artifact";
  if (kind === "heartbeat") {
    return `♥ heartbeat: ${metaString(event, "message") || "(heartbeat)"}`;
  }
  return `artifact: ${kind}`;
}

function metaString(event: AuditEvent, key: string): string {
  const meta = event.metadata as Record<string, AuditMetadataValue> | undefined;
  const value = meta?.[key];
  return typeof value === "string" ? value : "";
}

/**
 * Process new events: update state, return WatchLine items to display.
 */
export function processEvents(events: AuditEvent[], state: WatchState): WatchLine[] {
  const lines: WatchLine[] = [];

  for (const event of events) {
    if (isHeartbeatEvent(event)) {
      state.lastHeartbeatAt = Date.now();
    }

    const isGate = isApprovalGateEvent(event);
    lines.push({ kind: "event", event, label: labelForEvent(event), isGate });
  }

  return lines;
}

/**
 * Check if the run has ended by scanning seen events.
 * Returns null if the events file is missing or no workflow-end event found.
 */
export async function readRunEndStatus(
  eventsPath: string
): Promise<"failed" | "success" | "unknown" | null> {
  let contents: string;
  try {
    contents = await readFile(eventsPath, "utf8");
  } catch {
    return null;
  }

  for (const line of contents.split("\n").reverse()) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    try {
      const event = JSON.parse(trimmed) as AuditEvent;
      if (event.eventType === "workflow-end") {
        return resolveEndStatus(event.status);
      }
    } catch {
      // skip
    }
  }

  return null;
}

function resolveEndStatus(status: string | undefined): "failed" | "success" | "unknown" {
  if (status === "failed") return "failed";
  if (status === "success") return "success";
  return "unknown";
}
