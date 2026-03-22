import type { CreateWorkItemDraftInput, WorkItem } from "@taxes/shared";
import { WorkItemSchema } from "@taxes/shared";

interface CreatePlanningWorkItemResponse {
  workItem: WorkItem;
}

export async function createPlanningWorkItemFromCodeReview(input: CreateWorkItemDraftInput): Promise<WorkItem> {
  const response = await fetch("/api/planning/work-items", {
    body: JSON.stringify(input),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`Planning request failed with ${response.status.toString()}.`);
  }

  const payload = (await response.json()) as CreatePlanningWorkItemResponse;

  try {
    return WorkItemSchema.parse(payload.workItem);
  } catch {
    throw new Error("Planning work item response was invalid.");
  }
}
