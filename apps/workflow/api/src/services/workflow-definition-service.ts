import type { WorkflowDefinition as PrismaWorkflowDefinition, PrismaClient } from "@taxes/db";

export interface WorkflowDefinitionCreateInput {
  name: string;
  version: string;
  description?: string | undefined;
  triggers: string[];
  definitionJson: Record<string, unknown>;
}

export async function createDefinition(
  prisma: PrismaClient,
  data: WorkflowDefinitionCreateInput
): Promise<PrismaWorkflowDefinition> {
  return prisma.workflowDefinition.create({
    data: {
      name: data.name,
      version: data.version,
      description: data.description ?? null,
      triggerEvents: JSON.stringify(data.triggers),
      definitionJson: JSON.stringify(data.definitionJson),
      status: "active"
    }
  });
}

export async function listDefinitions(
  prisma: PrismaClient
): Promise<PrismaWorkflowDefinition[]> {
  return prisma.workflowDefinition.findMany({
    where: {
      status: "active"
    },
    orderBy: [
      { name: "asc" },
      { createdAt: "desc" }
    ]
  });
}

export async function getDefinitionByName(
  prisma: PrismaClient,
  name: string
): Promise<PrismaWorkflowDefinition | null> {
  const definitions = await prisma.workflowDefinition.findMany({
    where: {
      name,
      status: "active"
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 1
  });

  return definitions[0] ?? null;
}
