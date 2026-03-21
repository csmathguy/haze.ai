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

/**
 * Scans all completed/failed child runs and resumes their parent workflows.
 * For each completed child with a parent:
 * 1. Load parent run and workflow definition
 * 2. Find the step that spawned this child (via inputJson.childRunId match)
 * 3. Call engine.advanceRun with the child's context as output
 * 4. Update parent run and apply effects
 */
export async function resumeParentForCompletedChildren(db: PrismaClient): Promise<void> {
  // Find all child runs that are completed/failed and have a parentRunId
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
  const childRuns: ChildRunData[] = await (db as any).workflowRun.findMany({
    where: {
      parentRunId: { not: null },
      status: { in: ["completed", "failed"] }
    }
  });

  for (const childRun of childRuns) {
    if (!childRun.parentRunId) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    const parentRun: ParentRunData | null = await (db as any).workflowRun.findUnique({
      where: { id: childRun.parentRunId }
    });

    // Parent must exist and be in waiting state
    if (!parentRun || parentRun.status !== "waiting") continue;

    // Get the parent's workflow definition
    const parentDef = await workflowDefinitionService.getDefinitionByName(db, parentRun.definitionName);
    if (!parentDef) continue;

    const parentDefJson = JSON.parse(parentDef.definitionJson) as Record<string, unknown>;
    const workflowDefinition: WorkflowDefinition = {
      name: parentDef.name,
      version: parentDef.version,
      triggers: JSON.parse(parentDef.triggerEvents) as string[],
      inputSchema: {} as never,
      steps: (parentDefJson.steps ?? []) as never[]
    };

    // Find the step that spawned this child (by matching childRunId in step inputs)
    const childRunId = childRun.id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    const childStepRun: { stepId: string; inputJson: string | null } | null = await (db as any).workflowStepRun.findFirst({
      where: { runId: childRun.parentRunId, stepType: "child-workflow" }
    });

    if (!childStepRun) continue;

    // Verify this step ran the specific child
    const stepInputData = JSON.parse(childStepRun.inputJson ?? "{}") as Record<string, unknown>;
    if (stepInputData.childRunId !== childRunId) continue;

    // Build the parent's current state
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

    // Build the step result based on child status
    const childContextJson = childRun.contextJson
      ? (JSON.parse(childRun.contextJson) as Record<string, unknown>)
      : {};

    if (childRun.status === "completed") {
      // Success: merge child output into parent context under step ID, then advance
      const engine = new WorkflowEngine();

      // Merge child context directly under the step ID so parent context has
      // parentContext[stepId] = childContextJson (not nested under "step_" prefix)
      const mergedContextJson = {
        ...parentContextJson,
        [childStepRun.stepId]: childContextJson
      };

      const parentRunStateWithMergedContext = {
        ...parentRunState,
        contextJson: mergedContextJson
      };

      // No output passed so engine.advanceRun won't add step_<id> key on top
      const stepResult = {
        type: "success" as const
      };

      const advanceResult = engine.advanceRun(parentRunStateWithMergedContext, stepResult, workflowDefinition);

      // Update parent run with new state
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
    } else if (childRun.status === "failed") {
      // Failure: propagate child error to parent
      const engine = new WorkflowEngine();
      const stepResult = {
        type: "failure" as const,
        error: {
          message: `Child workflow failed: ${childRun.id}`,
          code: "CHILD_WORKFLOW_FAILED"
        }
      };

      const advanceResult = engine.advanceRun(parentRunState, stepResult, workflowDefinition);

      // Update parent run to failed state
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
  }
}
