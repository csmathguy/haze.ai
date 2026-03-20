import { z } from "zod";

const WorkflowDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string().nullable(),
  definitionJson: z.string(),
  triggerEvents: z.string(),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;

const WorkflowDefinitionResponseSchema = z.object({
  definitions: z.array(WorkflowDefinitionSchema)
});

const SingleDefinitionResponseSchema = z.object({
  definition: WorkflowDefinitionSchema
});

export async function listWorkflowDefinitions(): Promise<WorkflowDefinition[]> {
  const response = await fetch("/api/workflow/definitions");
  if (!response.ok) {
    throw new Error(`Failed to fetch workflow definitions: ${response.statusText}`);
  }
  const data: unknown = await response.json();
  const parsed = WorkflowDefinitionResponseSchema.parse(data);
  return parsed.definitions;
}

export async function getWorkflowDefinition(name: string): Promise<WorkflowDefinition> {
  const response = await fetch(`/api/workflow/definitions/${encodeURIComponent(name)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch workflow definition: ${response.statusText}`);
  }
  const data: unknown = await response.json();
  const parsed = SingleDefinitionResponseSchema.parse(data);
  return parsed.definition;
}

export function parseDefinitionJson(definition: WorkflowDefinition): Record<string, unknown> {
  return JSON.parse(definition.definitionJson) as Record<string, unknown>;
}

export function parseTriggers(definition: WorkflowDefinition): string[] {
  return JSON.parse(definition.triggerEvents) as string[];
}
