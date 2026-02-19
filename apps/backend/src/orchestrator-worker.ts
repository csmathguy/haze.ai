import { randomUUID } from "node:crypto";
import type { AuditSink } from "./audit.js";
import type { TaskRecord } from "./tasks.js";
import { TaskWorkflowService } from "./tasks.js";
import { WorkflowHookDispatcher, type WorkflowDispatchJob } from "./workflow-hook-dispatcher.js";
import { PlanningAgentRunner, type PlanningAgentDecision } from "./planning-agent-runner.js";
import {
  createPlanningAgentEvaluationKey,
  isPlanningReadyForArchitectureReview
} from "./orchestrator-worker-planning.js";
import {
  createTaskState,
  readNextActions,
  readWorkerMetadata,
  type WorkerTaskState
} from "./orchestrator-worker-metadata.js";

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
  evaluatePlanningTask?: (task: TaskRecord) => Promise<PlanningAgentDecision>;
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
  private readonly evaluatePlanningTask: (task: TaskRecord) => Promise<PlanningAgentDecision>;
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
    this.evaluatePlanningTask = options?.evaluatePlanningTask ?? this.defaultEvaluatePlanningTask;
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
        const workerMetadata = readWorkerMetadata({
          task,
          sessionId: this.sessionId,
          startedAt: this.startedAt,
          now: this.now
        });
        const taskState = workerMetadata.tasks[task.id] ?? createTaskState(this.sessionId);
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

          const evaluationKey = createPlanningAgentEvaluationKey(taskRecord);
          if (!taskState.planningAgentEvaluationKeys.includes(evaluationKey)) {
            await this.audit.record({
              eventType: "worker_planning_agent_evaluation_started",
              actor: "orchestrator_worker",
              payload: {
                taskId: taskRecord.id,
                runId,
                sessionId: this.sessionId,
                evaluationKey
              }
            });
            try {
              const decision = await this.evaluatePlanningTask(taskRecord);
              taskRecord = await this.tasks.recordPlannerDetermination(taskRecord.id, {
                decision: decision.decision,
                source: "planning_agent",
                reasonCodes: decision.reasonCodes
              });
              taskRecords.set(task.id, taskRecord);
              await this.audit.record({
                eventType: "worker_planning_agent_evaluation_completed",
                actor: "orchestrator_worker",
                payload: {
                  taskId: taskRecord.id,
                  runId,
                  sessionId: this.sessionId,
                  evaluationKey,
                  decision: decision.decision,
                  reasonCodes: decision.reasonCodes,
                  evaluationSource: decision.evaluationSource,
                  usedFallback: decision.usedFallback
                }
              });
            } catch (error) {
              await this.audit.record({
                eventType: "worker_planning_agent_evaluation_failed",
                actor: "orchestrator_worker",
                payload: {
                  taskId: taskRecord.id,
                  runId,
                  sessionId: this.sessionId,
                  evaluationKey,
                  error: error instanceof Error ? error.message : String(error)
                }
              });
            }
            taskState.planningAgentEvaluationKeys.push(evaluationKey);
            taskState.planningAgentEvaluationKeys = taskState.planningAgentEvaluationKeys.slice(-50);
          }

          if (isPlanningReadyForArchitectureReview(taskRecord)) {
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

        const actions = readNextActions(taskRecord);
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
        const workerMetadata = readWorkerMetadata({
          task,
          sessionId: this.sessionId,
          startedAt: this.startedAt,
          now: this.now
        });
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

  private readonly defaultEvaluatePlanningTask = async (
    task: TaskRecord
  ): Promise<PlanningAgentDecision> => {
    const runner = new PlanningAgentRunner();
    return runner.evaluate(task);
  };
}
