/**
 * Workflow API Client
 * Stubbed fetch functions for workflow endpoints.
 * These return empty arrays/null until the backend (PLAN-139) is ready.
 */

export interface WorkflowDefinitionSummary {
  name: string;
  description?: string;
  createdAt: string;
}

export interface WorkflowRunSummary {
  id: string;
  definitionName: string;
  status: "pending" | "running" | "paused" | "failed" | "completed" | "cancelled";
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowApproval {
  id: string;
  runId: string;
  nodeId: string;
  nodeName: string;
  message?: string;
  createdAt: string;
}

export interface WorkflowRunDetail {
  id: string;
  definitionName: string;
  status: "pending" | "running" | "paused" | "failed" | "completed" | "cancelled";
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  error?: string;
}

export interface WorkflowDefinitionDetail {
  name: string;
  description?: string;
  createdAt: string;
}

/**
 * Fetch all workflow definitions.
 */
export async function fetchWorkflowDefinitions(): Promise<WorkflowDefinitionSummary[]> {
  try {
    const response = await fetch("/api/workflow/definitions");

    if (!response.ok) {
      console.warn(`Workflow definitions request failed with ${response.status.toString()}.`);
      return [];
    }

    const payload = (await response.json()) as { definitions: WorkflowDefinitionSummary[] };
    return payload.definitions;
  } catch (error) {
    console.warn("Failed to fetch workflow definitions:", error);
    return [];
  }
}

/**
 * Fetch a single workflow definition by name.
 */
export async function fetchWorkflowDefinition(name: string): Promise<WorkflowDefinitionDetail | null> {
  try {
    const response = await fetch(`/api/workflow/definitions/${encodeURIComponent(name)}`);

    if (!response.ok) {
      console.warn(`Workflow definition request failed with ${response.status.toString()}.`);
      return null;
    }

    const payload = (await response.json()) as { definition: WorkflowDefinitionDetail };
    return payload.definition;
  } catch (error) {
    console.warn("Failed to fetch workflow definition:", error);
    return null;
  }
}

/**
 * Fetch all workflow runs (recent/active).
 */
export async function fetchWorkflowRuns(): Promise<WorkflowRunSummary[]> {
  try {
    const response = await fetch("/api/workflow/runs");

    if (!response.ok) {
      console.warn(`Workflow runs request failed with ${response.status.toString()}.`);
      return [];
    }

    const payload = (await response.json()) as { runs: WorkflowRunSummary[] };
    return payload.runs;
  } catch (error) {
    console.warn("Failed to fetch workflow runs:", error);
    return [];
  }
}

/**
 * Fetch a single workflow run by ID.
 */
export async function fetchWorkflowRun(id: string): Promise<WorkflowRunDetail | null> {
  try {
    const response = await fetch(`/api/workflow/runs/${encodeURIComponent(id)}`);

    if (!response.ok) {
      console.warn(`Workflow run request failed with ${response.status.toString()}.`);
      return null;
    }

    const payload = (await response.json()) as { run: WorkflowRunDetail };
    return payload.run;
  } catch (error) {
    console.warn("Failed to fetch workflow run:", error);
    return null;
  }
}

/**
 * Fetch pending approval gates.
 */
export async function fetchPendingApprovals(): Promise<WorkflowApproval[]> {
  try {
    const response = await fetch("/api/workflow/approvals");

    if (!response.ok) {
      console.warn(`Workflow approvals request failed with ${response.status.toString()}.`);
      return [];
    }

    const payload = (await response.json()) as { approvals: WorkflowApproval[] };
    return payload.approvals;
  } catch (error) {
    console.warn("Failed to fetch workflow approvals:", error);
    return [];
  }
}
