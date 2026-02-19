import { randomUUID } from "node:crypto";
import type { AuditSink } from "./audit.js";
import type { TaskRecord, WorkflowNextAction } from "./tasks.js";
import { TaskWorkflowService } from "./tasks.js";
import { WorkflowHookDispatcher, type WorkflowDispatchJob } from "./workflow-hook-dispatcher.js";

interface WorkerCheckpoint {
  key: string;
  actionId: string;
  actionType: string;
  runId: string;
  processedAt: string;
  status?: "dispatched" | "failed";
  attempt?: number;
  error?: string;
}

interface WorkerTaskState {
  sessionId: string;
  lastRunId: string | null;
  lastProcessedAt: string | null;
  planningReconciliationKeys: string[];
  dispatchedActionIds: string[];
  failedActionIds: string[];
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
  maxDispatchAttempts?: number;
  dispatchAction?: (job: WorkflowDispatchJob) => Promise<void>;
}

const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_MAX_CHECKPOINTS_PER_TASK = 100;
const DEFAULT_MAX_DISPATCH_ATTEMPTS = 3;

export class OrchestratorWorkerService {
  private readonly pollIntervalMs: number;
  private readonly now: () => Date;
  private readonly maxCheckpointsPerTask: number;
  private readonly maxDispatchAttempts: number;
  private readonly dispatchAction: (job: WorkflowDispatchJob) => Promise<void>;
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
    this.maxDispatchAttempts = options?.maxDispatchAttempts ?? DEFAULT_MAX_DISPATCH_ATTEMPTS;
    this.dispatchAction = options?.dispatchAction ?? this.defaultDispatchAction;
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
      const dispatcher = new WorkflowHookDispatcher({
        dispatch: this.dispatchAction
      });
      const taskStates = new Map<string, WorkerTaskState>();
      const taskRecords = new Map<string, TaskRecord>();

      for (const task of records) {
        let taskRecord = task;
        const workerMetadata = this.readWorkerMetadata(task);
        const taskState = workerMetadata.tasks[task.id] ?? this.createTaskState();
        workerMetadata.tasks[task.id] = taskState;
        workerMetadata.lastTickAt = tickAt;
        taskStates.set(task.id, taskState);
        taskRecords.set(task.id, taskRecord);

        if (taskRecord.status === "planning") {
          const reconciliationKey = `planning:${taskRecord.updatedAt}`;
          if (!taskState.planningReconciliationKeys.includes(reconciliationKey)) {
            taskState.planningReconciliationKeys.push(reconciliationKey);
            taskState.planningReconciliationKeys = taskState.planningReconciliationKeys.slice(-50);
            taskRecord = await this.tasks.reconcilePlanningTask(taskRecord.id, {
              trigger: "worker_reconciliation",
              runId,
              sessionId: this.sessionId
            });
            taskRecords.set(task.id, taskRecord);
          }

          if (this.isPlanningReadyForArchitectureReview(taskRecord)) {
            taskRecord = await this.tasks.update(taskRecord.id, { status: "architecture_review" });
            taskRecords.set(task.id, taskRecord);
            await this.audit.record({
              eventType: "worker_planning_transitioned_to_architecture_review",
              actor: "orchestrator_worker",
              payload: {
                taskId: taskRecord.id,
                runId,
                sessionId: this.sessionId
              }
            });
          }
        }

        const actions = this.readNextActions(taskRecord);
        if (actions.length === 0) {
          continue;
        }

        for (const action of actions) {
          const actionId = typeof action.id === "string" ? action.id : randomUUID();
          const actionType = typeof action.type === "string" ? action.type : "unknown";
          if (
            taskState.dispatchedActionIds.includes(actionId) ||
            taskState.failedActionIds.includes(actionId)
          ) {
            continue;
          }

          const key = `${task.id}:${actionId}`;
          dispatcher.enqueue({
            key,
            taskId: taskRecord.id,
            actionId,
            actionType,
            runId,
            sessionId: this.sessionId,
            processedAt: tickAt,
            maxAttempts: this.maxDispatchAttempts,
            attempt: 0
          });
        }
      }

      const results = await dispatcher.processAll();
      for (const result of results) {
        const taskState = taskStates.get(result.job.taskId);
        const task = taskRecords.get(result.job.taskId);
        if (!taskState || !task) {
          continue;
        }
        taskState.lastRunId = runId;
        taskState.lastProcessedAt = tickAt;

        if (result.status === "dispatched") {
          if (!taskState.dispatchedActionIds.includes(result.job.actionId)) {
            taskState.dispatchedActionIds.push(result.job.actionId);
          }
          taskState.checkpoints.push({
            key: result.job.key,
            actionId: result.job.actionId,
            actionType: result.job.actionType,
            runId,
            processedAt: tickAt,
            status: "dispatched",
            attempt: result.job.attempt + 1
          });
        } else {
          if (!taskState.failedActionIds.includes(result.job.actionId)) {
            taskState.failedActionIds.push(result.job.actionId);
          }
          taskState.checkpoints.push({
            key: result.job.key,
            actionId: result.job.actionId,
            actionType: result.job.actionType,
            runId,
            processedAt: tickAt,
            status: "failed",
            attempt: result.job.attempt + 1,
            error: result.error ?? "dispatch_failed"
          });
          await this.audit.record({
            eventType: "worker_action_dispatch_failed",
            actor: "orchestrator_worker",
            payload: {
              taskId: result.job.taskId,
              sessionId: this.sessionId,
              runId,
              actionId: result.job.actionId,
              actionType: result.job.actionType,
              attempts: result.job.attempt + 1,
              error: result.error
            }
          });
        }

        taskState.checkpoints = taskState.checkpoints.slice(-this.maxCheckpointsPerTask);
      }

      for (const [taskId, taskState] of taskStates.entries()) {
        const task = taskRecords.get(taskId);
        if (!task) {
          continue;
        }
        const workerMetadata = this.readWorkerMetadata(task);
        workerMetadata.lastTickAt = tickAt;
        workerMetadata.tasks[taskId] = taskState;
        await this.tasks.update(taskId, {
          metadata: {
            ...task.metadata,
            workerRuntime: workerMetadata
          }
        });
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

  private createTaskState(): WorkerTaskState {
    return {
      sessionId: this.sessionId ?? "unknown",
      lastRunId: null,
      lastProcessedAt: null,
      planningReconciliationKeys: [],
      dispatchedActionIds: [],
      failedActionIds: [],
      checkpoints: []
    };
  }

  private readNextActions(task: TaskRecord): WorkflowNextAction[] {
    const metadata = this.asRecord(task.metadata);
    const workflowRuntime = this.asRecord(metadata.workflowRuntime);
    const nextActions = workflowRuntime.nextActions;
    return Array.isArray(nextActions) ? (nextActions as WorkflowNextAction[]) : [];
  }

  private defaultDispatchAction = async (job: WorkflowDispatchJob): Promise<void> => {
    await this.audit.record({
      eventType: "worker_action_dispatched",
      actor: "orchestrator_worker",
      payload: {
        taskId: job.taskId,
        sessionId: this.sessionId,
        runId: job.runId,
        checkpointKey: job.key,
        actionId: job.actionId,
        actionType: job.actionType,
        attempts: job.attempt + 1
      }
    });
    if (job.attempt > 0) {
      await this.audit.record({
        eventType: "worker_action_dispatch_retried",
        actor: "orchestrator_worker",
        payload: {
          taskId: job.taskId,
          sessionId: this.sessionId,
          runId: job.runId,
          checkpointKey: job.key,
          actionId: job.actionId,
          actionType: job.actionType,
          attempts: job.attempt + 1
        }
      });
    }
  };

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
        planningReconciliationKeys: this.readStringArray(candidate.planningReconciliationKeys),
        dispatchedActionIds: this.readStringArray(candidate.dispatchedActionIds),
        failedActionIds: this.readStringArray(candidate.failedActionIds),
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

  private isPlanningReadyForArchitectureReview(task: TaskRecord): boolean {
    if (task.status !== "planning") {
      return false;
    }
    const metadata = this.asRecord(task.metadata);
    if (this.asRecord(metadata.awaitingHumanArtifact).question) {
      return false;
    }
    const plannerDetermination = this.asRecord(metadata.plannerDetermination);
    const plannerDecision = this.readString(plannerDetermination.decision);
    if (plannerDecision !== "approved") {
      return false;
    }
    const plannerSource = this.readString(plannerDetermination.source);
    if (plannerSource !== "planning_agent" && plannerSource !== "human_review") {
      return false;
    }

    const planningArtifact = this.asRecord(metadata.planningArtifact);
    const goals = this.readStringArray(planningArtifact.goals);
    const steps = this.readStringArray(planningArtifact.steps);
    const testingArtifacts = this.asRecord(metadata.testingArtifacts);
    const planned = this.asRecord(testingArtifacts.planned);
    const gherkin = this.readStringArray(planned.gherkinScenarios);
    const unit = this.readStringArray(planned.unitTestIntent);
    const integration = this.readStringArray(planned.integrationTestIntent);

    return goals.length > 0 && steps.length > 0 && gherkin.length > 0 && unit.length > 0 && integration.length > 0;
  }
}
