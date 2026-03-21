import type { PrismaClient } from "@taxes/db";
import * as workflowDefinitionService from "../services/workflow-definition-service.js";
import { startRun } from "../services/workflow-run-service.js";

export interface ChildWorkflowStepConfig {
  type: "child-workflow";
  id: string;
  label?: string;
  workflowName: string;
  inputMapping?: Record<string, string>;
}

export interface ChildWorkflowResult {
  type: "waiting-for-child";
  childRunId: string;
  workflowName: string;
  startedAt: string;
}

/**
 * Maps input values from the parent context using the inputMapping rules.
 * If inputMapping is { "key1": "{{parent.value}}" }, extracts parent.value from contextJson.
 */
function mapInputFromParentContext(
  inputMapping: Record<string, string> | undefined,
  parentContextJson: Record<string, unknown>
): Record<string, unknown> {
  if (!inputMapping) {
    return {};
  }

  const result: Record<string, unknown> = {};
  for (const [key, template] of Object.entries(inputMapping)) {
    // Simple interpolation: replace {{key.path}} with context values
    const interpolated = template.replace(/\{\{([^}]+)\}\}/g, (_match, path: string) => {
      const parts = path.trim().split(".");
      let current: unknown = parentContextJson;
      for (const part of parts) {
        if (current !== null && typeof current === "object" && part in current) {
          current = (current as Record<string, unknown>)[part];
        } else {
          return _match;
        }
      }
      if (typeof current === "string") return current;
      if (current === null || current === undefined) return "";
      if (typeof current === "object") return JSON.stringify(current);
      return (current as number | boolean | bigint).toString();
    });
    result[key] = interpolated;
  }

  return result;
}

/**
 * Detects circular workflow references by walking up the parentRunId chain.
 * Rejects if the child workflow name matches the current run's definition or any ancestor.
 */
async function checkForCircularReferences(
  db: PrismaClient,
  currentRunId: string,
  currentDefinitionName: string,
  childWorkflowName: string
): Promise<void> {
  if (childWorkflowName === currentDefinitionName) {
    throw new Error(`Circular workflow reference: child workflow "${childWorkflowName}" is the same as the current workflow`);
  }

  // Walk up the parent chain
  let ancestorRunId: string | null = currentRunId;
  let visited = new Set<string>();

  while (ancestorRunId && !visited.has(ancestorRunId)) {
    visited.add(ancestorRunId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    const run: { parentRunId: string | null; definitionName: string } | null = await (db as any).workflowRun.findUnique({
      where: { id: ancestorRunId }
    });

    if (!run) break;

    if (run.definitionName === childWorkflowName) {
      throw new Error(`Circular workflow reference: ancestor workflow "${run.definitionName}" would create a cycle with child "${childWorkflowName}"`);
    }

    ancestorRunId = run.parentRunId;
  }
}

/**
 * Executes a child-workflow step:
 * 1. Validates the child workflow exists
 * 2. Checks for circular references
 * 3. Creates a new WorkflowRun with parentRunId set
 * 4. Records the step and returns waiting state
 */
export async function executeChildWorkflowStep(
  db: PrismaClient,
  parentRunId: string,
  parentDefinitionName: string,
  stepRunId: string,
  step: ChildWorkflowStepConfig,
  parentContextJson: Record<string, unknown>
): Promise<ChildWorkflowResult> {
  const childWorkflowName = step.workflowName;

  // Check for circular references
  await checkForCircularReferences(db, parentRunId, parentDefinitionName, childWorkflowName);

  // Get the child workflow definition
  const childDefinition = await workflowDefinitionService.getDefinitionByName(db, childWorkflowName);
  if (!childDefinition) {
    throw new Error(`Child workflow definition not found: ${childWorkflowName}`);
  }

  // Map input from parent context
  const childInput = mapInputFromParentContext(step.inputMapping, parentContextJson);

  // Create the child run via startRun so it gets proper initial state and events emitted
  const { run: childRun } = await startRun(db, {
    definitionName: childWorkflowName,
    input: childInput,
    parentRunId
  });

  const startedAt = childRun.startedAt.toISOString();

  // Update the step run to record the child run ID
  const inputData: Record<string, unknown> = {
    workflowName: childWorkflowName,
    childRunId: childRun.id,
    startedAt
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  await (db as any).workflowStepRun.update({
    where: { id: stepRunId },
    data: { inputJson: JSON.stringify(inputData) }
  });

  return {
    type: "waiting-for-child",
    childRunId: childRun.id,
    workflowName: childWorkflowName,
    startedAt
  };
}
