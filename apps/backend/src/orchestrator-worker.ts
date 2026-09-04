import { randomUUID } from "node:crypto";
import type { AuditSink } from "./audit.js";
import type { TaskRecord } from "./tasks.js";
import { TaskWorkflowService } from "./tasks.js";
import { WorkflowHookDispatcher, type WorkflowDispatchJob } from "./workflow-hook-dispatcher.js";
import {
  PlanningAgentRunnerError,
  type PlanningAgentDecision
} from "./planning-agent-runner.js";
import {
  createPlanningAgentEvaluationKey,
  isPlanningReadyForArchitectureReview
} from "./orchestrator-worker-planning.js";
import {
  buildCompletedPlanningAgentArtifact,
  buildFailedPlanningAgentArtifact
} from "./orchestrator-worker-planning-artifact.js";
import {
  dispatchWorkerAction,
  evaluatePlanningTaskWithCli
} from "./orchestrator-worker-actions.js";
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
  planningAgent: {
    status: "unknown" | "ok" | "error";
    lastCheckedAt: string | null;
    lastError: string | null;
  };
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
  private planningAgentStatus: "unknown" | "ok" | "error" = "unknown";
  private planningAgentLastCheckedAt: string | null = null;
  private planningAgentLastError: string | null = null;

  constructor(
    private readonly tasks: TaskWorkflowService,
    private readonly audit: AuditSink,
    options?: OrchestratorWorkerServiceOptions
  ) {
    this.pollIntervalMs = options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.now = options?.now ?? (() => new Date());
    this.maxCheckpointsPerTask = options?.maxCheckpointsPerTask ?? DEFAULT_MAX_CHECKPOINTS_PER_TASK;
    this.maxDispatchAttempts = options?.maxDispatchAttempts ?? DEFAULT_MAX_DISPATCH_ATTEMPTS;
    this.dispatchAction =
      options?.dispatchAction ??
      (async (job) => dispatchWorkerAction({ audit: this.audit, sessionId: this.sessionId, job }));
    this.evaluatePlanningTask = options?.evaluatePlanningTask ?? evaluatePlanningTaskWithCli;
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.sessionId = randomUUID();
    this.startedAt = this.now().toISOString();
    this.lastTickAt = null;
    this.planningAgentStatus = "unknown";
    this.planningAgentLastCheckedAt = null;
    this.planningAgentLastError = null;
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
      inFlight: this.inFlight,
      planningAgent: {
        status: this.planningAgentStatus,
        lastCheckedAt: this.planningAgentLastCheckedAt,
        lastError: this.planningAgentLastError
      }
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
      const changedTaskIds = new Set<string>();

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
        taskStates.set(task.id, taskState);
        taskRecords.set(task.id, taskRecord);

        if (taskRecord.status === "planning") {
          const evaluationKey = createPlanningAgentEvaluationKey(taskRecord);
          const sessionEvaluationKey = `${this.sessionId}:${evaluationKey}`;
          if (!taskState.planningAgentEvaluationKeys.includes(sessionEvaluationKey)) {
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
              if (decision.planningArtifact || decision.testingPlanned) {
                const metadata = {
                  ...taskRecord.metadata
                } as Record<string, unknown>;
                if (decision.planningArtifact) {
                  metadata.planningArtifact = decision.planningArtifact;
                }
                if (decision.testingPlanned) {
                  const testingArtifacts =
                    typeof metadata.testingArtifacts === "object" &&
                    metadata.testingArtifacts !== null &&
                    !Array.isArray(metadata.testingArtifacts)
                      ? (metadata.testingArtifacts as Record<string, unknown>)
                      : {};
                  metadata.testingArtifacts = {
                    ...testingArtifacts,
                    planned: decision.testingPlanned
                  };
                }
                taskRecord = await this.tasks.update(taskRecord.id, { metadata });
                taskRecords.set(task.id, taskRecord);
              }
              taskRecord = await this.tasks.recordPlannerDetermination(taskRecord.id, {
                decision: decision.decision,
                source: "planning_agent",
                reasonCodes: decision.reasonCodes
              });
              taskRecord = await this.tasks.update(taskRecord.id, {
                metadata: {
                  ...taskRecord.metadata,
                  planningAgentArtifact: buildCompletedPlanningAgentArtifact(
                    {
                      runId,
                      sessionId: this.sessionId,
                      taskId: taskRecord.id,
                      at: tickAt
                    },
                    decision
                  )
                }
              });
              this.planningAgentStatus = "ok";
              this.planningAgentLastCheckedAt = tickAt;
              this.planningAgentLastError = null;
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
                  trace: decision.trace ?? null
                }
              });
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              const errorCode =
                error instanceof PlanningAgentRunnerError ? error.code : "unknown";
              const errorDetails =
                error instanceof PlanningAgentRunnerError ? (error.details ?? null) : null;
              taskRecord = await this.tasks.update(taskRecord.id, {
                metadata: {
                  ...taskRecord.metadata,
                  planningAgentArtifact: buildFailedPlanningAgentArtifact(
                    {
                      runId,
                      sessionId: this.sessionId,
                      taskId: taskRecord.id,
                      at: tickAt
                    },
                    {
                      errorCode,
                      error: errorMessage,
                      details: errorDetails
                    }
                  )
                }
              });
              taskRecords.set(task.id, taskRecord);
              this.planningAgentStatus = "error";
              this.planningAgentLastCheckedAt = tickAt;
              this.planningAgentLastError = errorMessage;
              await this.audit.record({
                eventType: "worker_planning_agent_evaluation_failed",
                actor: "orchestrator_worker",
                payload: {
                  taskId: taskRecord.id,
                  runId,
                  sessionId: this.sessionId,
                  evaluationKey,
                  error: errorMessage,
                  errorCode,
                  details: errorDetails
                }
              });
            }
            taskState.planningAgentEvaluationKeys.push(sessionEvaluationKey);
            taskState.planningAgentEvaluationKeys = taskState.planningAgentEvaluationKeys.slice(-50);
            changedTaskIds.add(task.id);
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
        changedTaskIds.add(result.job.taskId);

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

      for (const taskId of changedTaskIds.values()) {
        const taskState = taskStates.get(taskId);
        const task = taskRecords.get(taskId);
        if (!task || !taskState) {
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
}
