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

const WorkflowStepRunSchema = z.object({
  id: z.string(),
  runId: z.string(),
  stepId: z.string(),
  stepType: z.string(),
  nodeType: z.string(),
  agentId: z.string().nullable(),
  model: z.string().nullable(),
  skillIds: z.string().nullable(),
  inputJson: z.string().nullable(),
  outputJson: z.string().nullable(),
  errorJson: z.string().nullable(),
  stdout: z.string().nullable(),
  stderr: z.string().nullable(),
  retryCount: z.number().int(),
  startedAt: z.string(),
  completedAt: z.string().nullable()
});

export type WorkflowStepRun = z.infer<typeof WorkflowStepRunSchema>;

const WorkflowRunSchema = z.object({
  id: z.string(),
  definitionId: z.string(),
  definitionName: z.string(),
  version: z.string(),
  status: z.string(),
  currentStep: z.string().nullable(),
  contextJson: z.string().nullable(),
  correlationId: z.string().nullable(),
  parentRunId: z.string().nullable(),
  startedAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().nullable(),
  stepRuns: z.array(WorkflowStepRunSchema).optional()
});

export type WorkflowRun = z.infer<typeof WorkflowRunSchema>;

const WorkflowDefinitionResponseSchema = z.object({
  definitions: z.array(WorkflowDefinitionSchema)
});

const SingleDefinitionResponseSchema = z.object({
  definition: WorkflowDefinitionSchema
});

const WorkflowRunResponseSchema = z.object({
  run: WorkflowRunSchema
});

const WorkflowRunListResponseSchema = z.object({
  runs: z.array(WorkflowRunSchema)
});

export async function listWorkflowDefinitions(): Promise<WorkflowDefinition[]> {
  const response = await fetch("/api/workflow/definitions");
  if (!response.ok) {
    throw new Error(`Failed to fetch workflow definitions: ${response.statusText}`);
  }
  const data = (await response.json()) as unknown;
  const parsed = WorkflowDefinitionResponseSchema.parse(data);
  return parsed.definitions;
}

export async function getWorkflowDefinition(name: string): Promise<WorkflowDefinition> {
  const response = await fetch(`/api/workflow/definitions/${encodeURIComponent(name)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch workflow definition: ${response.statusText}`);
  }
  const data = (await response.json()) as unknown;
  const parsed = SingleDefinitionResponseSchema.parse(data);
  return parsed.definition;
}

export async function listWorkflowRuns(limit = 50): Promise<WorkflowRun[]> {
  const response = await fetch(`/api/workflow/runs?limit=${String(limit)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch workflow runs: ${response.statusText}`);
  }
  const data = (await response.json()) as unknown;
  const parsed = WorkflowRunListResponseSchema.parse(data);
  return parsed.runs;
}

export async function getWorkflowRun(id: string): Promise<WorkflowRun> {
  const response = await fetch(`/api/workflow/runs/${encodeURIComponent(id)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch workflow run: ${response.statusText}`);
  }
  const data = (await response.json()) as unknown;
  const parsed = WorkflowRunResponseSchema.parse(data);
  return parsed.run;
}

export function parseDefinitionJson(definition: WorkflowDefinition): Record<string, unknown> {
  return JSON.parse(definition.definitionJson) as Record<string, unknown>;
}

export function parseTriggers(definition: WorkflowDefinition): string[] {
  return JSON.parse(definition.triggerEvents) as string[];
}
