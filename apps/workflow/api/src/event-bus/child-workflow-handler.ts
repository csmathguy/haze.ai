import type { PrismaClient } from "@taxes/db";
import type { WorkflowDefinition } from "@taxes/shared";
import { WorkflowEngine } from "@taxes/shared";
import * as workflowDefinitionService from "../services/workflow-definition-service.js";

interface ChildRunData {
  id: string;
  parentRunId: string | null;
  status: string;
  contextJson: string | null;
}

interface ParentRunData {
  id: string;
  definitionName: string;
  version: string;
  status: string;
  currentStep: string | null;
  contextJson: string | null;
  correlationId: string | null;
  parentRunId: string | null;
  startedAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

async function loadParentRunAndDefinition(
  db: PrismaClient,
  parentRunId: string
): Promise<{ parentRun: ParentRunData | null; parentDef: WorkflowDefinition | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
  const parentRun: ParentRunData | null = await (db as any).workflowRun.findUnique({
    where: { id: parentRunId }
  });

  if (!parentRun) return { parentRun: null, parentDef: null };

  const parentDefObj = await workflowDefinitionService.getDefinitionByName(db, parentRun.definitionName);
  if (!parentDefObj) return { parentRun, parentDef: null };

  const parentDefJson = JSON.parse(parentDefObj.definitionJson) as Record<string, unknown>;
  const parentDef: WorkflowDefinition = {
    name: parentDefObj.name,
    version: parentDefObj.version,
    triggers: JSON.parse(parentDefObj.triggerEvents) as string[],
    inputSchema: {} as never,
    steps: (parentDefJson.steps ?? []) as never[]
  };

  return { parentRun, parentDef };
}

async function findChildStepRun(
  db: PrismaClient,
  parentRunId: string,
  childRunId: string
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
  const childStepRun: { stepId: string; inputJson: string | null } | null = await (db as any).workflowStepRun.findFirst({
    where: { runId: parentRunId, stepType: "child-workflow" }
  });

  if (!childStepRun) return false;

  const stepInputData = JSON.parse(childStepRun.inputJson ?? "{}") as Record<string, unknown>;
  return stepInputData.childRunId === childRunId;
}

async function processCompletedChild(
  db: PrismaClient,
  parentRun: ParentRunData,
  childRun: ChildRunData,
  parentDef: WorkflowDefinition
): Promise<void> {
  const parentContextJson = parentRun.contextJson
    ? (JSON.parse(parentRun.contextJson) as Record<string, unknown>)
    : {};

  const parentRunState = {
    id: parentRun.id,
    definitionName: parentRun.definitionName,
    version: parentRun.version,
    status: parentRun.status as "running" | "pending" | "paused" | "waiting" | "failed" | "completed" | "cancelled",
    currentStepId: parentRun.currentStep ?? undefined,
    contextJson: parentContextJson,
    correlationId: parentRun.correlationId ?? undefined,
    parentRunId: parentRun.parentRunId ?? undefined,
    startedAt: parentRun.startedAt.toISOString(),
    updatedAt: parentRun.updatedAt.toISOString(),
    completedAt: parentRun.completedAt?.toISOString()
  };

  const childContextJson = childRun.contextJson
    ? (JSON.parse(childRun.contextJson) as Record<string, unknown>)
    : {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
  const childStepRun: { stepId: string } | null = await (db as any).workflowStepRun.findFirst({
    where: { runId: parentRun.id, stepType: "child-workflow" }
  });

  if (!childStepRun) return;

  const mergedContextJson = {
    ...parentContextJson,
    [childStepRun.stepId]: childContextJson
  };

  const parentRunStateWithMergedContext = {
    ...parentRunState,
    contextJson: mergedContextJson
  };

  const engine = new WorkflowEngine();
  const stepResult = { type: "success" as const };
  const advanceResult = engine.advanceRun(parentRunStateWithMergedContext, stepResult, parentDef);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  await (db as any).workflowRun.update({
    where: { id: parentRun.id },
    data: {
      status: advanceResult.nextRun.status,
      currentStep: advanceResult.nextRun.currentStepId ?? null,
      contextJson: JSON.stringify(advanceResult.nextRun.contextJson),
      updatedAt: new Date(advanceResult.nextRun.updatedAt),
      completedAt: advanceResult.nextRun.completedAt ? new Date(advanceResult.nextRun.completedAt) : null
    }
  });
}

async function processFailedChild(
  db: PrismaClient,
  parentRun: ParentRunData,
  childRun: ChildRunData,
  parentDef: WorkflowDefinition
): Promise<void> {
  const parentContextJson = parentRun.contextJson
    ? (JSON.parse(parentRun.contextJson) as Record<string, unknown>)
    : {};

  const parentRunState = {
    id: parentRun.id,
    definitionName: parentRun.definitionName,
    version: parentRun.version,
    status: parentRun.status as "running" | "pending" | "paused" | "waiting" | "failed" | "completed" | "cancelled",
    currentStepId: parentRun.currentStep ?? undefined,
    contextJson: parentContextJson,
    correlationId: parentRun.correlationId ?? undefined,
    parentRunId: parentRun.parentRunId ?? undefined,
    startedAt: parentRun.startedAt.toISOString(),
    updatedAt: parentRun.updatedAt.toISOString(),
    completedAt: parentRun.completedAt?.toISOString()
  };

  const engine = new WorkflowEngine();
  const stepResult = {
    type: "failure" as const,
    error: {
      message: `Child workflow failed: ${childRun.id}`,
      code: "CHILD_WORKFLOW_FAILED"
    }
  };

  const advanceResult = engine.advanceRun(parentRunState, stepResult, parentDef);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  await (db as any).workflowRun.update({
    where: { id: parentRun.id },
    data: {
      status: advanceResult.nextRun.status,
      currentStep: advanceResult.nextRun.currentStepId ?? null,
      contextJson: JSON.stringify(advanceResult.nextRun.contextJson),
      updatedAt: new Date(advanceResult.nextRun.updatedAt),
      completedAt: advanceResult.nextRun.completedAt ? new Date(advanceResult.nextRun.completedAt) : null
    }
  });
}

/**
 * Scans all completed/failed child runs and resumes their parent workflows.
 * For each completed child with a parent:
 * 1. Load parent run and workflow definition
 * 2. Find the step that spawned this child (via inputJson.childRunId match)
 * 3. Call engine.advanceRun with the child's context as output
 * 4. Update parent run and apply effects
 */
export async function resumeParentForCompletedChildren(db: PrismaClient): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
  const childRuns: ChildRunData[] = await (db as any).workflowRun.findMany({
    where: {
      parentRunId: { not: null },
      status: { in: ["completed", "failed"] }
    }
  });

  for (const childRun of childRuns) {
    if (!childRun.parentRunId) continue;

    const { parentRun, parentDef } = await loadParentRunAndDefinition(db, childRun.parentRunId);

    if (!parentRun?.status || parentRun.status !== "waiting" || !parentDef) continue;

    const childRunMatches = await findChildStepRun(db, childRun.parentRunId, childRun.id);
    if (!childRunMatches) continue;

    if (childRun.status === "completed") {
      await processCompletedChild(db, parentRun, childRun, parentDef);
    } else if (childRun.status === "failed") {
      await processFailedChild(db, parentRun, childRun, parentDef);
    }
  }
}
