import type { WorkflowRun as PrismaWorkflowRun, PrismaClient } from "@taxes/db";
import type { WorkflowEvent, WorkflowRun, WorkflowDefinition } from "@taxes/shared";
import { WorkflowEngine } from "@taxes/shared";

import { EventBus } from "../event-bus/event-bus.js";
import * as workflowDefinitionService from "./workflow-definition-service.js";

export interface StartRunInput {
  definitionName: string;
  input?: unknown;
  parentRunId?: string;
  workItemId?: string;
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
      parentRunId: data.parentRunId ?? null,
      workItemId: data.workItemId ?? null,
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

type WorkflowRunWithStepRuns = PrismaWorkflowRun & {
  workflowStepRuns?: {
    id: string;
    runId: string;
    stepId: string;
    stepType: string;
    nodeType: string;
    agentId: string | null;
    model: string | null;
    skillIds: string | null;
    inputJson: string | null;
    outputJson: string | null;
    errorJson: string | null;
    stdout: string | null;
    stderr: string | null;
    tokenUsageJson: string | null;
    retryCount: number;
    startedAt: Date;
    completedAt: Date | null;
  }[];
};

export async function getRun(
  prisma: PrismaClient,
  runId: string
): Promise<WorkflowRunWithStepRuns | null> {
  return prisma.workflowRun.findUnique({
    where: { id: runId },
    include: { workflowStepRuns: true }
  });
}

export async function listRuns(
  prisma: PrismaClient,
  options?: ListRunsOptions
): Promise<WorkflowRunWithStepRuns[]> {
  return prisma.workflowRun.findMany({
    where: options?.status !== undefined ? { status: options.status } : {},
    orderBy: { startedAt: "desc" },
    take: options?.limit ?? 50,
    include: { workflowStepRuns: true }
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

  const definition = await workflowDefinitionService.getDefinitionByName(
    prisma,
    run.definitionName
  );

  if (!definition) {
    throw new Error("Workflow definition not found: " + run.definitionName);
  }

  const workflowRun = convertPrismaRunToWorkflowRun(run);
  const engine = new WorkflowEngine();
  const workflowDefinition = buildWorkflowDefinition(definition);
  const effect = engine.signalRun(workflowRun, data.event, workflowDefinition);

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
  await applySignalRunEffects(eventBus, data.runId, effect.effects);

  return {
    run: updatedRun,
    effects: effect.effects as unknown[]
  };
}

async function applySignalRunEffects(
  eventBus: EventBus,
  runId: string,
  effects: unknown[]
): Promise<void> {
  const typedEffects = effects as { type: string; [key: string]: unknown }[];
  for (const effect of typedEffects) {
    if (effect.type === "emit-event") {
      await eventBus.emit({
        workflowRunId: runId,
        eventType: effect.eventType as string,
        payload: (effect.payload ?? {}) as Record<string, unknown>
      });
    } else if (effect.type === "execute-step") {
      await eventBus.emit({
        workflowRunId: runId,
        eventType: "step.execute-requested",
        payload: { step: effect.step }
      });
    } else if (effect.type === "create-approval") {
      await eventBus.emit({
        workflowRunId: runId,
        eventType: "approval.created",
        payload: { stepId: effect.stepId, prompt: effect.prompt }
      });
    }
  }
}

function buildWorkflowDefinition(definition: { name: string; version: string; definitionJson: string; triggerEvents: string }): WorkflowDefinition {
  const definitionJson = JSON.parse(definition.definitionJson) as Record<string, unknown>;

  return {
    name: definition.name,
    version: definition.version,
    triggers: JSON.parse(definition.triggerEvents) as string[],
    inputSchema: {} as never,
    steps: (definitionJson.steps ?? []) as never[]
  } as WorkflowDefinition;
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

export function formatRunForApi(run: WorkflowRunWithStepRuns): Record<string, unknown> {
  const stepRuns = run.workflowStepRuns?.map((sr) => ({
    id: sr.id,
    runId: sr.runId,
    stepId: sr.stepId,
    stepType: sr.stepType,
    nodeType: sr.nodeType,
    agentId: sr.agentId,
    model: sr.model,
    skillIds: sr.skillIds,
    inputJson: sr.inputJson,
    outputJson: sr.outputJson,
    errorJson: sr.errorJson,
    stdout: sr.stdout,
    stderr: sr.stderr,
    tokenUsageJson: sr.tokenUsageJson ?? null,
    retryCount: sr.retryCount,
    startedAt: sr.startedAt.toISOString(),
    completedAt: sr.completedAt?.toISOString() ?? null
  })) ?? [];

  return {
    id: run.id,
    definitionId: run.definitionId,
    definitionName: run.definitionName,
    version: run.version,
    status: run.status,
    currentStep: run.currentStep,
    contextJson: run.contextJson,
    correlationId: run.correlationId,
    parentRunId: run.parentRunId,
    workItemId: run.workItemId,
    startedAt: run.startedAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    stepRuns
  };
}
