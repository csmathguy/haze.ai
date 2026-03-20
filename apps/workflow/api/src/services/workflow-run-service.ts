import type { WorkflowRun as PrismaWorkflowRun, PrismaClient } from "@taxes/db";
import type { WorkflowEvent, WorkflowRun } from "@taxes/shared";
import { WorkflowEngine } from "@taxes/shared";

import { EventBus } from "../event-bus/event-bus.js";
import * as workflowDefinitionService from "./workflow-definition-service.js";

export interface StartRunInput {
  definitionName: string;
  input?: unknown;
}

export interface SignalRunInput {
  runId: string;
  event: WorkflowEvent;
}

export interface ListRunsOptions {
  status?: string | undefined;
  limit?: number | undefined;
}

export async function startRun(
  prisma: PrismaClient,
  data: StartRunInput
): Promise<{ run: PrismaWorkflowRun; effects: unknown[] }> {
  const definition = await workflowDefinitionService.getDefinitionByName(
    prisma,
    data.definitionName
  );

  if (!definition) {
    throw new Error("Workflow definition not found: " + data.definitionName);
  }

  const definitionJson = JSON.parse(definition.definitionJson) as Record<string, unknown>;

  const workflowDefinition = {
    name: definition.name,
    version: definition.version,
    triggers: JSON.parse(definition.triggerEvents) as string[],
    inputSchema: {} as never,
    steps: (definitionJson.steps ?? []) as never[]
  };

  const engine = new WorkflowEngine();
  const effect = engine.startRun(workflowDefinition, data.input ?? null);

  const persistedRun = await prisma.workflowRun.create({
    data: {
      definitionId: definition.id,
      definitionName: definition.name,
      version: definition.version,
      status: effect.nextRun.status,
      currentStep: effect.nextRun.currentStepId ?? null,
      contextJson: JSON.stringify(effect.nextRun.contextJson),
      startedAt: new Date(effect.nextRun.startedAt),
      updatedAt: new Date(effect.nextRun.updatedAt)
    }
  });

  const eventBus = new EventBus(prisma);
  for (const eff of effect.effects) {
    if (eff.type === "execute-step") {
      await eventBus.emit({
        workflowRunId: persistedRun.id,
        eventType: "step.execute-requested",
        payload: { step: eff.step }
      });
    }
  }

  return {
    run: persistedRun,
    effects: effect.effects as unknown[]
  };
}

export async function getRun(
  prisma: PrismaClient,
  runId: string
): Promise<PrismaWorkflowRun | null> {
  return prisma.workflowRun.findUnique({
    where: { id: runId }
  });
}

export async function listRuns(
  prisma: PrismaClient,
  options?: ListRunsOptions
): Promise<PrismaWorkflowRun[]> {
  return prisma.workflowRun.findMany({
    where: options?.status !== undefined ? { status: options.status } : {},
    orderBy: { startedAt: "desc" },
    take: options?.limit ?? 50
  });
}

export async function signalRun(
  prisma: PrismaClient,
  data: SignalRunInput
): Promise<{ run: PrismaWorkflowRun; effects: unknown[] }> {
  const run = await prisma.workflowRun.findUnique({
    where: { id: data.runId }
  });

  if (!run) {
    throw new Error("Workflow run not found: " + data.runId);
  }

  const workflowRun = convertPrismaRunToWorkflowRun(run);
  const engine = new WorkflowEngine();
  const effect = engine.signalRun(workflowRun, data.event);

  const updatedRun = await prisma.workflowRun.update({
    where: { id: data.runId },
    data: {
      status: effect.nextRun.status,
      currentStep: effect.nextRun.currentStepId ?? null,
      contextJson: JSON.stringify(effect.nextRun.contextJson),
      updatedAt: new Date(effect.nextRun.updatedAt),
      completedAt: effect.nextRun.completedAt ? new Date(effect.nextRun.completedAt) : null
    }
  });

  const eventBus = new EventBus(prisma);
  for (const eff of effect.effects) {
    if (eff.type === "emit-event") {
      await eventBus.emit({
        workflowRunId: data.runId,
        eventType: eff.eventType,
        payload: eff.payload ?? {}
      });
    }
  }

  return {
    run: updatedRun,
    effects: effect.effects as unknown[]
  };
}

export async function cancelRun(
  prisma: PrismaClient,
  runId: string
): Promise<{ run: PrismaWorkflowRun; effects: unknown[] }> {
  const run = await prisma.workflowRun.findUnique({
    where: { id: runId }
  });

  if (!run) {
    throw new Error("Workflow run not found: " + runId);
  }

  const workflowRun = convertPrismaRunToWorkflowRun(run);
  const engine = new WorkflowEngine();
  const effect = engine.cancelRun(workflowRun);

  const updatedRun = await prisma.workflowRun.update({
    where: { id: runId },
    data: {
      status: effect.nextRun.status,
      updatedAt: new Date(effect.nextRun.updatedAt),
      completedAt: new Date(effect.nextRun.completedAt ?? new Date())
    }
  });

  return {
    run: updatedRun,
    effects: effect.effects as unknown[]
  };
}

function convertPrismaRunToWorkflowRun(run: PrismaWorkflowRun): WorkflowRun {
  const contextJson = run.contextJson !== null
    ? (JSON.parse(run.contextJson) as Record<string, unknown>)
    : {};

  return {
    id: run.id,
    definitionName: run.definitionName,
    version: run.version,
    status: run.status as WorkflowRun["status"],
    ...(run.currentStep !== null ? { currentStepId: run.currentStep } : {}),
    contextJson,
    ...(run.correlationId !== null ? { correlationId: run.correlationId } : {}),
    ...(run.parentRunId !== null ? { parentRunId: run.parentRunId } : {}),
    startedAt: run.startedAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    ...(run.completedAt !== null ? { completedAt: run.completedAt.toISOString() } : {})
  };
}
