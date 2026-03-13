import type {
  CreateWorkItemDraftInput,
  PlanningWorkspace,
  UpdateAcceptanceCriterionStatusPatchInput,
  UpdateWorkItemPatchInput,
  UpdateWorkItemTaskStatusPatchInput
} from "@taxes/shared";

interface PlanningWorkspaceResponse {
  workspace: PlanningWorkspace;
}

export async function fetchPlanningWorkspace(): Promise<PlanningWorkspace> {
  const response = await fetch("/api/planning/workspace");

  if (!response.ok) {
    throw new Error(`Planning workspace request failed with ${response.status.toString()}.`);
  }

  const payload = (await response.json()) as PlanningWorkspaceResponse;
  return payload.workspace;
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
