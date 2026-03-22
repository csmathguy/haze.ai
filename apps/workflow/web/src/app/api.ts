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
  tokenUsageJson: z.string().nullable().optional(),
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
  workItemId: z.string().nullable().optional(),
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

export async function listWorkflowRunsByDefinition(definitionName: string, limit = 50): Promise<WorkflowRun[]> {
  const params = new URLSearchParams({
    limit: String(limit)
  });
  const response = await fetch(`/api/workflow/runs?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch workflow runs: ${response.statusText}`);
  }
  const data = (await response.json()) as unknown;
  const parsed = WorkflowRunListResponseSchema.parse(data);
  return parsed.runs.filter((run) => run.definitionName === definitionName);
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

const StepMetricsSchema = z.object({
  stepId: z.string(),
  stepType: z.string(),
  totalRuns: z.number(),
  successCount: z.number(),
  failureCount: z.number(),
  successRate: z.number(),
  medianDurationMs: z.number(),
  p95DurationMs: z.number(),
  avgRetryCount: z.number(),
  avgInputTokens: z.number(),
  avgOutputTokens: z.number()
});

const DefinitionMetricsSchema = z.object({
  definitionName: z.string(),
  totalRuns: z.number(),
  successRate: z.number(),
  healthScore: z.number(),
  steps: z.array(StepMetricsSchema)
});

export type StepMetrics = z.infer<typeof StepMetricsSchema>;
export type DefinitionMetrics = z.infer<typeof DefinitionMetricsSchema>;

const AnalyticsResponseSchema = z.object({
  analytics: z.array(DefinitionMetricsSchema)
});

export async function getWorkflowAnalytics(
  definitionName?: string,
  since?: Date
): Promise<DefinitionMetrics[]> {
  const params = new URLSearchParams();
  if (definitionName) {
    params.append("definitionName", definitionName);
  }
  if (since) {
    params.append("since", since.toISOString());
  }
  const response = await fetch(`/api/workflow/analytics?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch workflow analytics: ${response.statusText}`);
  }
  const data = (await response.json()) as unknown;
  const parsed = AnalyticsResponseSchema.parse(data);
  return parsed.analytics;
}

const RunSummarySchema = z.object({
  id: z.string(),
  definitionName: z.string(),
  status: z.string(),
  currentStep: z.string().nullable(),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  elapsedMs: z.number(),
  isStalled: z.boolean(),
  pendingApprovalId: z.string().nullable(),
  workItemId: z.string().nullable()
});

export type RunSummary = z.infer<typeof RunSummarySchema>;

const FleetDashboardResponseSchema = z.object({
  counts: z.object({
    running: z.number(),
    waiting: z.number(),
    failed: z.number(),
    completed: z.number()
  }),
  activeRuns: z.array(RunSummarySchema),
  recentRuns: z.array(RunSummarySchema)
});

export type FleetDashboardData = z.infer<typeof FleetDashboardResponseSchema>;

export async function getFleetDashboard(): Promise<FleetDashboardData> {
  const response = await fetch("/api/workflow/runs/summary");
  if (!response.ok) {
    throw new Error(`Failed to fetch fleet dashboard: ${response.statusText}`);
  }
  const data = (await response.json()) as unknown;
  const parsed = FleetDashboardResponseSchema.parse(data);
  return parsed;
}

export async function cancelWorkflowRun(id: string): Promise<WorkflowRun> {
  const response = await fetch(`/api/workflow/runs/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
  if (!response.ok) {
    throw new Error(`Failed to cancel workflow run: ${response.statusText}`);
  }
  const data = (await response.json()) as unknown;
  const parsed = WorkflowRunResponseSchema.parse(data);
  return parsed.run;
}

export async function approveWorkflowRun(approvalId: string, respondedBy = "fleet-dashboard"): Promise<void> {
  const response = await fetch(`/api/workflow/approvals/${encodeURIComponent(approvalId)}/respond`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      decision: "approved",
      respondedBy,
      notes: "Approved from fleet dashboard"
    })
  });
  if (!response.ok) {
    throw new Error(`Failed to approve workflow run: ${response.statusText}`);
  }
}

export async function cleanupWorkflowRuns(olderThanDays: number, statuses: string[]): Promise<{
  deletedApprovalCount: number;
  deletedRunCount: number;
  deletedStepRunCount: number;
}> {
  const response = await fetch("/api/workflow/runs/cleanup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      olderThanDays,
      statuses
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to clean up workflow runs: ${response.statusText}`);
  }

  return await response.json() as {
    deletedApprovalCount: number;
    deletedRunCount: number;
    deletedStepRunCount: number;
  };
}

export async function deleteWorkflowRun(runId: string): Promise<{
  deletedApprovalCount: number;
  deletedRunCount: number;
  deletedStepRunCount: number;
}> {
  const response = await fetch(`/api/workflow/runs/${encodeURIComponent(runId)}/history`, {
    method: "DELETE"
  });

  if (!response.ok) {
    throw new Error(`Failed to delete workflow run: ${response.statusText}`);
  }

  return await response.json() as {
    deletedApprovalCount: number;
    deletedRunCount: number;
    deletedStepRunCount: number;
  };
}
