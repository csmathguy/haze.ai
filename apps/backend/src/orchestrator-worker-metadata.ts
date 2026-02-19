import type { TaskRecord, WorkflowNextAction } from "./tasks.js";

export interface WorkerCheckpoint {
  key: string;
  actionId: string;
  actionType: string;
  runId: string;
  processedAt: string;
  status?: "dispatched" | "failed";
  attempt?: number;
  error?: string;
}

export interface WorkerTaskState {
  sessionId: string;
  lastRunId: string | null;
  lastProcessedAt: string | null;
  planningReconciliationKeys: string[];
  planningAgentEvaluationKeys: string[];
  dispatchedActionIds: string[];
  failedActionIds: string[];
  checkpoints: WorkerCheckpoint[];
}

export interface WorkerMetadataState {
  sessionId: string;
  startedAt: string;
  lastTickAt: string | null;
  tasks: Record<string, WorkerTaskState>;
}

export function createTaskState(sessionId: string | null): WorkerTaskState {
  return {
    sessionId: sessionId ?? "unknown",
    lastRunId: null,
    lastProcessedAt: null,
    planningReconciliationKeys: [],
    planningAgentEvaluationKeys: [],
    dispatchedActionIds: [],
    failedActionIds: [],
    checkpoints: []
  };
}

export function readNextActions(task: TaskRecord): WorkflowNextAction[] {
  const metadata = asRecord(task.metadata);
  const workflowRuntime = asRecord(metadata.workflowRuntime);
  const nextActions = workflowRuntime.nextActions;
  return Array.isArray(nextActions) ? (nextActions as WorkflowNextAction[]) : [];
}

export function readWorkerMetadata(input: {
  task: TaskRecord;
  sessionId: string | null;
  startedAt: string | null;
  now: () => Date;
}): WorkerMetadataState {
  const { task, sessionId, startedAt, now } = input;
  const metadata = asRecord(task.metadata);
  const current = asRecord(metadata.workerRuntime);
  const tasks = asRecord(current.tasks);

  const normalizedTasks: Record<string, WorkerTaskState> = {};
  for (const [taskId, value] of Object.entries(tasks)) {
    const candidate = asRecord(value);
    normalizedTasks[taskId] = {
      sessionId: readString(candidate.sessionId) ?? (sessionId ?? "unknown"),
      lastRunId: readString(candidate.lastRunId) ?? null,
      lastProcessedAt: readString(candidate.lastProcessedAt) ?? null,
      planningReconciliationKeys: readStringArray(candidate.planningReconciliationKeys),
      planningAgentEvaluationKeys: readStringArray(candidate.planningAgentEvaluationKeys),
      dispatchedActionIds: readStringArray(candidate.dispatchedActionIds),
      failedActionIds: readStringArray(candidate.failedActionIds),
      checkpoints: readCheckpoints(candidate.checkpoints)
    };
  }

  return {
    sessionId: readString(current.sessionId) ?? (sessionId ?? "unknown"),
    startedAt: readString(current.startedAt) ?? (startedAt ?? now().toISOString()),
    lastTickAt: readString(current.lastTickAt) ?? null,
    tasks: normalizedTasks
  };
}

function readCheckpoints(value: unknown): WorkerCheckpoint[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const checkpoints: WorkerCheckpoint[] = [];
  for (const entry of value) {
    const record = asRecord(entry);
    const key = readString(record.key);
    const actionId = readString(record.actionId);
    const actionType = readString(record.actionType);
    const runId = readString(record.runId);
    const processedAt = readString(record.processedAt);
    if (!key || !actionId || !actionType || !runId || !processedAt) {
      continue;
    }
    checkpoints.push({ key, actionId, actionType, runId, processedAt });
  }
  return checkpoints;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    .map((entry) => entry.trim());
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}
