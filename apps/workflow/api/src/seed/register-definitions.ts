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
 * This is idempotent—definitions are only created if they don't exist.
 */
export async function registerWorkflowDefinitions(
  prisma: PrismaClient
): Promise<void> {
  const definitions = [implementationWorkflow, conflictRepairWorkflow, planningWorkflow];

  for (const definition of definitions) {
    const existing = await prisma.workflowDefinition.findFirst({
      where: {
        name: definition.name,
        version: definition.version
      }
    });

    if (existing) {
      console.warn(
        `Workflow definition ${definition.name}@${definition.version} already exists, skipping`
      );
      continue;
    }

    const createInput = definitionToCreateInput(definition);
    console.warn(
      `Registering workflow definition ${definition.name}@${definition.version}...`
    );
    await createDefinition(prisma, createInput);
    console.warn(
      `Successfully registered workflow definition ${definition.name}@${definition.version}`
    );
  }
}
