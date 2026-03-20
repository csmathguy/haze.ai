import type { PrismaClient } from "@taxes/db";
import { WorkflowEngine } from "@taxes/shared";

import { EventBus } from "./event-bus.js";
import { GitHubPrMergedHandler } from "../services/github-pr-merged-handler.js";

export interface WorkerConfig {
  readonly pollIntervalMs: number;   // default 1000
  readonly batchSize: number;        // default 10
  readonly db: PrismaClient;
  readonly planningDatabaseUrl?: string;
}

export class WorkflowWorker {
  private pollIntervalMs: number;
  private batchSize: number;
  private db: PrismaClient;
  private eventBus: EventBus;
  private planningDatabaseUrl?: string;
  private pollHandle: NodeJS.Timeout | null = null;
  private running = false;

  constructor(config: WorkerConfig) {
    this.pollIntervalMs = config.pollIntervalMs;
    this.batchSize = config.batchSize;
    this.db = config.db;
    this.eventBus = new EventBus(config.db);
    this.planningDatabaseUrl = config.planningDatabaseUrl;
  }

  /** Start the polling loop (non-blocking, runs in background) */
  start(): void {
    if (this.running) return;
    this.running = true;

    const poll = async () => {
      try {
        await this.processBatch();
      } catch (error) {
        console.error("Error processing workflow batch:", error);
      }

      if (this.running) {
        this.pollHandle = setTimeout(poll, this.pollIntervalMs);
      }
    };

    this.pollHandle = setTimeout(poll, this.pollIntervalMs);
  }

  /** Stop the polling loop gracefully */
  stop(): void {
    this.running = false;

    if (this.pollHandle !== null) {
      clearTimeout(this.pollHandle);
      this.pollHandle = null;
    }
  }

  /** Process one batch of pending events — public for testing */
  async processBatch(): Promise<number> {
    const events = await this.eventBus.fetchPending(this.batchSize);

    if (events.length === 0) {
      return 0;
    }

    for (const event of events) {
      await this.processEvent(event);
    }

    return events.length;
  }

  private async processEvent(event: { id: string; type: string; correlationId: string | null; payload: string }): Promise<void> {
    try {
      // Handle external system events (e.g., GitHub PR merged) that don't require a workflow run
      if (event.type === "github.pull_request.merged") {
        await this.handleGitHubPrMergedEvent(event);
        return;
      }

      // Handle standard workflow events
      const correlationId = event.correlationId;
      if (!correlationId) {
        await this.eventBus.markFailed(event.id, "No correlationId (workflowRunId) in event");
        return;
      }

      const run = await this.db.workflowRun.findUnique({
        where: { id: correlationId }
      });

      if (!run) {
        await this.eventBus.markFailed(event.id, `WorkflowRun not found: ${correlationId}`);
        return;
      }

      const payload = this.parseEventPayload(event.payload, event.id);
      if (payload === null) {
        return;
      }

      const runData = this.convertRunToSchema(run);
      const workflowEvent = {
        type: event.type,
        payload
      };

      const engine = new WorkflowEngine();
      const result = engine.signalRun(runData, workflowEvent);

      await this.updateRun(run.id, result);
      await this.applyEffects(run.id, result.effects);
      await this.eventBus.markProcessed(event.id);
    } catch (error) {
      await this.eventBus.markFailed(event.id, `Processing error: ${String(error)}`);
    }
  }

  private async handleGitHubPrMergedEvent(event: { id: string; type: string; payload: string }): Promise<void> {
    try {
      const fullEvent = await this.db.workflowEvent.findUnique({
        where: { id: event.id }
      });

      if (!fullEvent) {
        throw new Error(`Event not found: ${event.id}`);
      }

      const handler = new GitHubPrMergedHandler(this.db, this.planningDatabaseUrl);
      await handler.handleEvent(fullEvent);
    } catch (error) {
      await this.eventBus.markFailed(event.id, `GitHub PR merged handler error: ${String(error)}`);
    }
  }

  private parseEventPayload(payload: string, eventId: string): Record<string, unknown> | null {
    let parsed: Record<string, unknown> = {};
    try {
      if (payload) {
        parsed = JSON.parse(payload) as Record<string, unknown>;
      }
    } catch (parseError) {
      void this.eventBus.markFailed(eventId, `Failed to parse event payload: ${String(parseError)}`);
      return null;
    }
    return parsed;
  }

  private convertRunToSchema(run: { id: string; definitionName: string; version: string; status: string; currentStep: string | null; contextJson: string | null; correlationId: string | null; parentRunId: string | null; startedAt: Date; updatedAt: Date; completedAt: Date | null }) {
    const contextJson = typeof run.contextJson === "string"
      ? (JSON.parse(run.contextJson) as Record<string, unknown>)
      : (run.contextJson as Record<string, unknown>);

    return {
      id: run.id,
      definitionName: run.definitionName,
      version: run.version,
      status: run.status as "running" | "pending" | "paused" | "waiting" | "failed" | "completed" | "cancelled",
      currentStepId: run.currentStep ?? undefined,
      contextJson,
      correlationId: run.correlationId ?? undefined,
      parentRunId: run.parentRunId ?? undefined,
      startedAt: run.startedAt.toISOString(),
      updatedAt: run.updatedAt.toISOString(),
      completedAt: run.completedAt?.toISOString()
    };
  }

  private async updateRun(runId: string, result: { nextRun: { status: string; currentStepId?: string; contextJson: Record<string, unknown> | string; updatedAt: string; completedAt?: string } }): Promise<void> {
    const contextToStore = typeof result.nextRun.contextJson === "string"
      ? result.nextRun.contextJson
      : JSON.stringify(result.nextRun.contextJson);

    await this.db.workflowRun.update({
      where: { id: runId },
      data: {
        status: result.nextRun.status,
        currentStep: result.nextRun.currentStepId,
        contextJson: contextToStore,
        updatedAt: new Date(result.nextRun.updatedAt),
        completedAt: result.nextRun.completedAt ? new Date(result.nextRun.completedAt) : null
      }
    });
  }

  private async applyEffects(runId: string, effects: { type: string; [key: string]: unknown }[]): Promise<void> {
    for (const effect of effects) {
      if (effect.type === "emit-event") {
        const emitEffect = effect as { type: string; eventType: string; payload?: Record<string, unknown> };
        await this.eventBus.emit({
          workflowRunId: runId,
          eventType: emitEffect.eventType,
          payload: emitEffect.payload ?? {}
        });
      } else if (effect.type === "complete-run") {
        await this.db.workflowRun.update({
          where: { id: runId },
          data: { status: "completed" }
        });
      } else if (effect.type === "fail-run") {
        await this.db.workflowRun.update({
          where: { id: runId },
          data: { status: "failed" }
        });
      } else if (effect.type === "execute-step") {
        const executeEffect = effect as { type: string; step: { id: string; type: string } };
        const nodeType = this.getNodeType(executeEffect.step.type);
        await this.db.workflowStepRun.create({
          data: {
            runId,
            stepId: executeEffect.step.id,
            stepType: executeEffect.step.type,
            nodeType,
            inputJson: JSON.stringify(executeEffect.step)
          }
        });
      } else if (effect.type === "create-approval") {
        const approvalEffect = effect as { type: string; stepId: string; prompt: string };
        await this.db.workflowApproval.create({
          data: {
            runId,
            stepId: approvalEffect.stepId,
            prompt: approvalEffect.prompt
          }
        });
      }
    }
  }

  private getNodeType(stepType: string): "approval" | "wait" | "deterministic" | "agent" {
    switch (stepType) {
      case "approval":
        return "approval";
      case "wait-for-event":
        return "wait";
      case "command":
      case "timer":
        return "deterministic";
      default:
        return "agent";
    }
  }
}
