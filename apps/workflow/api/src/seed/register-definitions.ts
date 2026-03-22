import type { PrismaClient } from "@taxes/db";
import type { WorkflowDefinition } from "@taxes/shared";
import { implementationWorkflow, conflictRepairWorkflow, planningWorkflow } from "../definitions/index.js";
import type { WorkflowDefinitionCreateInput } from "../services/workflow-definition-service.js";
import { createDefinition } from "../services/workflow-definition-service.js";

/**
 * Convert a TypeScript WorkflowDefinition to the database format.
 * This serializes the definition to JSON for storage.
 */
function definitionToCreateInput(
  definition: WorkflowDefinition
): WorkflowDefinitionCreateInput {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-member-access
  const rawDef = (definition.inputSchema as any).def as Record<string, unknown> | undefined;
  const schemaDefOrEmpty: Record<string, unknown> = rawDef ?? {};

  return {
    name: definition.name,
    version: definition.version,
    description: `Agent-driven ${definition.name} workflow: ${definition.steps.map((step) => step.id).join(" → ")}`,
    triggers: definition.triggers,
    definitionJson: {
      name: definition.name,
      version: definition.version,
      triggers: definition.triggers,
      inputSchema: schemaDefOrEmpty,
      steps: definition.steps as Record<string, unknown>[],
      retryPolicy: definition.retryPolicy,
      timeoutMs: definition.timeoutMs
    }
  };
}

/**
 * Register all workflow definitions from the definitions directory.
 * Upserts on every startup so code changes are immediately reflected in the DB.
 */
export async function registerWorkflowDefinitions(
  prisma: PrismaClient
): Promise<void> {
  const definitions = [implementationWorkflow, conflictRepairWorkflow, planningWorkflow];

  for (const definition of definitions) {
    const createInput = definitionToCreateInput(definition);
    const existing = await prisma.workflowDefinition.findFirst({
      where: { name: definition.name, version: definition.version }
    });

    if (existing) {
      await prisma.workflowDefinition.update({
        where: { id: existing.id },
        data: {
          description: createInput.description ?? null,
          triggerEvents: JSON.stringify(createInput.triggers),
          definitionJson: JSON.stringify(createInput.definitionJson),
          updatedAt: new Date()
        }
      });
      console.warn(`Updated workflow definition ${definition.name}@${definition.version}`);
    } else {
      await createDefinition(prisma, createInput);
      console.warn(`Registered workflow definition ${definition.name}@${definition.version}`);
    }
  }
}
