import { randomUUID } from "node:crypto";
import type { AuditSink } from "./audit.js";
import type { TaskRecord, WorkflowNextAction } from "./tasks.js";
import { TaskWorkflowService } from "./tasks.js";

interface WorkerCheckpoint {
  key: string;
  actionId: string;
  actionType: string;
  runId: string;
  processedAt: string;
}

interface WorkerTaskState {
  sessionId: string;
  lastRunId: string | null;
  lastProcessedAt: string | null;
  dispatchedActionIds: string[];
  checkpoints: WorkerCheckpoint[];
}

interface WorkerMetadataState {
  sessionId: string;
  startedAt: string;
  lastTickAt: string | null;
  tasks: Record<string, WorkerTaskState>;
}

export interface OrchestratorWorkerStatus {
  running: boolean;
  sessionId: string | null;
  startedAt: string | null;
  lastTickAt: string | null;
  inFlight: boolean;
}

interface OrchestratorWorkerServiceOptions {
  pollIntervalMs?: number;
  now?: () => Date;
  maxCheckpointsPerTask?: number;
}

const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_MAX_CHECKPOINTS_PER_TASK = 100;

export class OrchestratorWorkerService {
  private readonly pollIntervalMs: number;
  private readonly now: () => Date;
  private readonly maxCheckpointsPerTask: number;
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private inFlight = false;
  private sessionId: string | null = null;
  private startedAt: string | null = null;
  private lastTickAt: string | null = null;

  constructor(
    private readonly tasks: TaskWorkflowService,
    private readonly audit: AuditSink,
    options?: OrchestratorWorkerServiceOptions
  ) {
    this.pollIntervalMs = options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.now = options?.now ?? (() => new Date());
    this.maxCheckpointsPerTask = options?.maxCheckpointsPerTask ?? DEFAULT_MAX_CHECKPOINTS_PER_TASK;
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.sessionId = randomUUID();
    this.startedAt = this.now().toISOString();
    this.lastTickAt = null;
    this.timer = setInterval(() => {
      void this.runOnce();
    }, this.pollIntervalMs);
  }

  stop(): void {
    if (!this.running) {
      return;
    }
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getStatus(): OrchestratorWorkerStatus {
    return {
      running: this.running,
      sessionId: this.sessionId,
      startedAt: this.startedAt,
      lastTickAt: this.lastTickAt,
      inFlight: this.inFlight
    };
  }

  async runOnce(): Promise<void> {
    if (!this.running || this.inFlight || !this.sessionId) {
      return;
    }

    this.inFlight = true;
    const tickAt = this.now().toISOString();
    this.lastTickAt = tickAt;
    const runId = randomUUID();

    try {
      const records = this.tasks.list();
      for (const task of records) {
        const actions = this.readNextActions(task);
        if (actions.length === 0) {
          continue;
        }
        await this.dispatchTaskActions(task, actions, runId, tickAt);
      }
      await this.audit.record({
        eventType: "worker_run_completed",
        actor: "orchestrator_worker",
        payload: {
          sessionId: this.sessionId,
          runId,
          tickAt
        }
      });
    } finally {
      this.inFlight = false;
    }
  }

  private readNextActions(task: TaskRecord): WorkflowNextAction[] {
    const metadata = this.asRecord(task.metadata);
    const workflowRuntime = this.asRecord(metadata.workflowRuntime);
    const nextActions = workflowRuntime.nextActions;
    return Array.isArray(nextActions) ? (nextActions as WorkflowNextAction[]) : [];
  }

  private async dispatchTaskActions(
    task: TaskRecord,
    actions: WorkflowNextAction[],
    runId: string,
    processedAt: string
  ): Promise<void> {
    const workerMetadata = this.readWorkerMetadata(task);
    const taskState = workerMetadata.tasks[task.id] ?? {
      sessionId: this.sessionId ?? "unknown",
      lastRunId: null,
      lastProcessedAt: null,
      dispatchedActionIds: [],
      checkpoints: []
    };

    for (const action of actions) {
      const actionId = typeof action.id === "string" ? action.id : randomUUID();
      const actionType = typeof action.type === "string" ? action.type : "unknown";
      const checkpointKey = `${task.id}:${actionId}`;
      if (taskState.dispatchedActionIds.includes(actionId)) {
        continue;
      }

      taskState.dispatchedActionIds.push(actionId);
      taskState.lastRunId = runId;
      taskState.lastProcessedAt = processedAt;
      taskState.checkpoints.push({
        key: checkpointKey,
        actionId,
        actionType,
        runId,
        processedAt
      });
      taskState.checkpoints = taskState.checkpoints.slice(-this.maxCheckpointsPerTask);

      await this.audit.record({
        eventType: "worker_action_dispatched",
        actor: "orchestrator_worker",
        payload: {
          taskId: task.id,
          sessionId: this.sessionId,
          runId,
          checkpointKey,
          actionId,
          actionType
        }
      });
    }

    workerMetadata.lastTickAt = processedAt;
    workerMetadata.tasks[task.id] = taskState;
    await this.tasks.update(task.id, {
      metadata: {
        ...task.metadata,
        workerRuntime: workerMetadata
      }
    });
  }

  private readWorkerMetadata(task: TaskRecord): WorkerMetadataState {
    const metadata = this.asRecord(task.metadata);
    const current = this.asRecord(metadata.workerRuntime);
    const tasks = this.asRecord(current.tasks);

    const normalizedTasks: Record<string, WorkerTaskState> = {};
    for (const [taskId, value] of Object.entries(tasks)) {
      const candidate = this.asRecord(value);
      normalizedTasks[taskId] = {
        sessionId: this.readString(candidate.sessionId) ?? (this.sessionId ?? "unknown"),
        lastRunId: this.readString(candidate.lastRunId) ?? null,
        lastProcessedAt: this.readString(candidate.lastProcessedAt) ?? null,
        dispatchedActionIds: this.readStringArray(candidate.dispatchedActionIds),
        checkpoints: this.readCheckpoints(candidate.checkpoints)
      };
    }

    return {
      sessionId: this.readString(current.sessionId) ?? (this.sessionId ?? "unknown"),
      startedAt: this.readString(current.startedAt) ?? (this.startedAt ?? this.now().toISOString()),
      lastTickAt: this.readString(current.lastTickAt) ?? null,
      tasks: normalizedTasks
    };
  }

  private readCheckpoints(value: unknown): WorkerCheckpoint[] {
    if (!Array.isArray(value)) {
      return [];
    }
    const checkpoints: WorkerCheckpoint[] = [];
    for (const entry of value) {
      const record = this.asRecord(entry);
      const key = this.readString(record.key);
      const actionId = this.readString(record.actionId);
      const actionType = this.readString(record.actionType);
      const runId = this.readString(record.runId);
      const processedAt = this.readString(record.processedAt);
      if (!key || !actionId || !actionType || !runId || !processedAt) {
        continue;
      }
      checkpoints.push({ key, actionId, actionType, runId, processedAt });
    }
    return checkpoints;
  }

  private readStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      .map((entry) => entry.trim());
  }

  private readString(value: unknown): string | null {
    if (typeof value !== "string") {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }
}
