import type {
  CreateWorkItemDraftInput,
  PlanningWorkspace,
  UpdateAcceptanceCriterionStatusPatchInput,
  UpdateWorkItemPatchInput,
  UpdateWorkItemTaskStatusPatchInput
} from "@taxes/shared";
import { PlanningWorkspaceSchema } from "@taxes/shared";

interface PlanningWorkspaceResponse {
  workspace: PlanningWorkspace;
}

export async function fetchPlanningWorkspace(): Promise<PlanningWorkspace> {
  const response = await fetch("/api/planning/workspace");

  if (!response.ok) {
    throw new Error(`Planning workspace request failed with ${response.status.toString()}.`);
  }

  const payload = (await response.json()) as PlanningWorkspaceResponse;

  try {
    return PlanningWorkspaceSchema.parse(payload.workspace);
  } catch {
    throw new Error("Planning workspace response was invalid.");
  }
}

export async function createPlanningWorkItem(input: CreateWorkItemDraftInput): Promise<void> {
  await sendJsonRequest("/api/planning/work-items", "POST", input);
}

export async function updatePlanningWorkItem(workItemId: string, input: UpdateWorkItemPatchInput): Promise<void> {
  await sendJsonRequest(`/api/planning/work-items/${workItemId}`, "PATCH", input);
}

export async function updatePlanningTaskStatus(
  workItemId: string,
  taskId: string,
  input: UpdateWorkItemTaskStatusPatchInput
): Promise<void> {
  await sendJsonRequest(`/api/planning/work-items/${workItemId}/tasks/${taskId}`, "PATCH", input);
}

export async function updatePlanningAcceptanceCriterionStatus(
  workItemId: string,
  criterionId: string,
  input: UpdateAcceptanceCriterionStatusPatchInput
): Promise<void> {
  await sendJsonRequest(`/api/planning/work-items/${workItemId}/acceptance-criteria/${criterionId}`, "PATCH", input);
}

export interface StartPlanningSessionResult {
  runId: string;
}

export async function startPlanningSession(idea: string, projectKey?: string): Promise<StartPlanningSessionResult> {
  const response = await fetch("/api/planning/sessions/start", {
    body: JSON.stringify({ idea, projectKey }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`Failed to start planning session (${response.status.toString()}).`);
  }

  return response.json() as Promise<StartPlanningSessionResult>;
}

async function sendJsonRequest(url: string, method: "PATCH" | "POST", body: unknown): Promise<void> {
  const response = await fetch(url, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json"
    },
    method
  });

  if (!response.ok) {
    throw new Error(`Planning request failed with ${response.status.toString()}.`);
  }
}
