import type { PrismaClient } from "@taxes/db";
import type { WorkflowDefinition, WorkflowRun, WorkflowRunEffect, WorkflowEffect, ExecuteStepEffect } from "@taxes/shared";
import { WorkflowEngine } from "@taxes/shared";

import { EventBus } from "./event-bus.js";
import { checkForWaitForEventMatches, checkForTimedOutWaitingSteps } from "./wait-for-event-handler.js";
import { GitHubPrMergedHandler } from "../services/github-pr-merged-handler.js";
import * as workflowDefinitionService from "../services/workflow-definition-service.js";
import { StepExecutionHandler } from "../executor/step-execution-handler.js";

/** Internal step-status notification event types that the worker emits for observability only. */
function isInternalStepNotification(eventType: string): boolean {
  return eventType === "step.waiting-for-event" || eventType === "step.waiting-for-approval";
}

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
  private planningDatabaseUrl: string | undefined;
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
    await checkForTimedOutWaitingSteps(this.db);
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

      // Handle step execute requests emitted by startRun / signalRun service layer
      if (event.type === "step.execute-requested") {
        await this.handleStepExecuteRequestedEvent(event);
        return;
      }

      // Internal step-status notification events — mark processed but do NOT route through
      // engine.signalRun, which would unconditionally reset the run status to "running".
      if (isInternalStepNotification(event.type)) {
        await this.eventBus.markProcessed(event.id);
        return;
      }

      await this.handleStandardWorkflowEvent(event);
    } catch (error) {
      await this.eventBus.markFailed(event.id, `Processing error: ${String(error)}`);
    }
  }

  private async handleStandardWorkflowEvent(event: { id: string; type: string; correlationId: string | null; payload: string }): Promise<void> {
    // Parse payload
    let eventPayload: Record<string, unknown> = {};
    try {
      if (event.payload) {
        eventPayload = JSON.parse(event.payload) as Record<string, unknown>;
      }
    } catch {
      // Use empty payload if parsing fails
    }

    // Try to match against waiting workflow runs
    const matched = await checkForWaitForEventMatches(this.db, event.type, eventPayload);
    if (matched) {
      await this.eventBus.markProcessed(event.id);
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

    // Load the workflow definition from the database
    const definition = await workflowDefinitionService.getDefinitionByName(
      this.db,
      run.definitionName
    );

    const runData = this.convertRunToSchema(run);
    const workflowEvent = { type: event.type, payload: eventPayload };
    const engine = new WorkflowEngine();
    let result;
    let workflowDefinition: WorkflowDefinition | null = null;

    if (definition) {
      const definitionJson = JSON.parse(definition.definitionJson) as Record<string, unknown>;
      workflowDefinition = {
        name: definition.name,
        version: definition.version,
        triggers: JSON.parse(definition.triggerEvents) as string[],
        inputSchema: {} as never,
        steps: (definitionJson.steps ?? []) as never[]
      };
      result = engine.signalRun(runData, workflowEvent, workflowDefinition);
    } else {
      result = engine.signalRun(runData, workflowEvent);
    }

    await this.updateRun(run.id, result);
    await this.applyEffects(run.id, result.effects, result.nextRun, workflowDefinition);
    await this.eventBus.markProcessed(event.id);
  }

  private async handleStepExecuteRequestedEvent(event: { id: string; type: string; correlationId: string | null; payload: string }): Promise<void> {
    try {
      const correlationId = event.correlationId;
      if (!correlationId) {
        await this.eventBus.markFailed(event.id, "No correlationId in step.execute-requested event");
        return;
      }

      const run = await this.db.workflowRun.findUnique({ where: { id: correlationId } });
      if (!run) {
        await this.eventBus.markFailed(event.id, `WorkflowRun not found: ${correlationId}`);
        return;
      }

      const payload = this.parseEventPayload(event.payload);
      if (payload === null) return;

      const step = payload.step as { id: string; type: string; [key: string]: unknown } | undefined;
      if (!step) {
        await this.eventBus.markFailed(event.id, "No step in step.execute-requested payload");
        return;
      }

      const definitionName = run.definitionName;
      const definition = await workflowDefinitionService.getDefinitionByName(this.db, definitionName);
      if (!definition) {
        await this.eventBus.markFailed(event.id, `WorkflowDefinition not found: ${definitionName}`);
        return;
      }

      const definitionJson = JSON.parse(definition.definitionJson) as Record<string, unknown>;
      const workflowDefinition: WorkflowDefinition = {
        name: definition.name,
        version: definition.version,
        triggers: JSON.parse(definition.triggerEvents) as string[],
        inputSchema: {} as never,
        steps: (definitionJson.steps ?? []) as never[]
      };

      const runData = this.convertRunToSchema(run);
      const handler = new StepExecutionHandler(this.db);
      const advanceResult = await handler.executeAndAdvance(correlationId, runData, step, workflowDefinition);
      await this.updateRun(correlationId, advanceResult);
      await this.applyEffects(correlationId, advanceResult.effects, advanceResult.nextRun, workflowDefinition);
      await this.eventBus.markProcessed(event.id);
    } catch (error) {
      await this.eventBus.markFailed(event.id, `Step execute handler error: ${String(error)}`);
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

  private parseEventPayload(payloadStr: string): Record<string, unknown> | null {
    try {
      if (!payloadStr) return {};
      return JSON.parse(payloadStr) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private convertRunToSchema(run: { id: string; definitionName: string; version: string; status: string; currentStep: string | null; contextJson: string | null; correlationId: string | null; parentRunId: string | null; startedAt: Date; updatedAt: Date; completedAt: Date | null }) {
    const contextJson: Record<string, unknown> = run.contextJson
      ? (JSON.parse(run.contextJson) as Record<string, unknown>)
      : {};

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

  private async updateRun(runId: string, result: WorkflowRunEffect): Promise<void> {
    await this.db.workflowRun.update({
      where: { id: runId },
      data: {
        status: result.nextRun.status,
        currentStep: result.nextRun.currentStepId ?? null,
        contextJson: JSON.stringify(result.nextRun.contextJson),
        updatedAt: new Date(result.nextRun.updatedAt),
        completedAt: result.nextRun.completedAt ? new Date(result.nextRun.completedAt) : null
      }
    });
  }

  private async applyEffects(
    runId: string,
    effects: WorkflowEffect[],
    currentRun: WorkflowRun,
    definition: WorkflowDefinition | null
  ): Promise<void> {
    for (const effect of effects) {
      if (effect.type === "emit-event") {
        await this.eventBus.emit({
          workflowRunId: runId,
          eventType: effect.eventType,
          payload: effect.payload ?? {}
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
        await this.dispatchStepExecution(runId, currentRun, effect, definition);
      } else if (effect.type === "create-approval") {
        const existing = await this.db.workflowApproval.findFirst({
          where: { runId, stepId: effect.stepId, status: "pending" }
        });
        if (!existing) {
          await this.db.workflowApproval.create({
            data: { runId, stepId: effect.stepId, prompt: effect.prompt }
          });
        }
      }
    }
  }

  private async dispatchStepExecution(
    runId: string,
    currentRun: WorkflowRun,
    effect: ExecuteStepEffect,
    definition: WorkflowDefinition | null
  ): Promise<void> {
    if (!definition) {
      // No definition available — create a pending step run and stop (old behaviour)
      const step = effect.step;
      const nodeType = this.getNodeType(step.type);
      await this.db.workflowStepRun.create({
        data: { runId, stepId: step.id, stepType: step.type, nodeType, inputJson: JSON.stringify(step) }
      });
      return;
    }

    const step = effect.step as { id: string; type: string; [key: string]: unknown };
    const handler = new StepExecutionHandler(this.db);

    // Execute the step and get the engine's next state
    const advanceResult = await handler.executeAndAdvance(runId, currentRun, step, definition);

    // Persist the updated run state
    await this.updateRun(runId, advanceResult);

    // Recursively apply any new effects (e.g., the next execute-step)
    await this.applyEffects(runId, advanceResult.effects, advanceResult.nextRun, definition);
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
