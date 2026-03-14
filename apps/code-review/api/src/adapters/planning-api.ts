import { WorkItemSchema, type WorkItem } from "@taxes/shared";

import { CODE_REVIEW_DEPENDENCY_TIMEOUT_MS, PLAN_API_ORIGIN } from "../config.js";

interface PlanningWorkItemResponse {
  readonly workItem: WorkItem;
}

export interface PlanningWorkItemGateway {
  getWorkItem(workItemId: string): Promise<WorkItem | null>;
}

export class LocalPlanningApiGateway implements PlanningWorkItemGateway {
  async getWorkItem(workItemId: string): Promise<WorkItem | null> {
    const response = await fetch(`${PLAN_API_ORIGIN}/api/planning/work-items/${encodeURIComponent(workItemId)}`, {
      signal: AbortSignal.timeout(CODE_REVIEW_DEPENDENCY_TIMEOUT_MS)
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Planning API request failed with ${response.status.toString()}.`);
    }

    const payload = (await response.json()) as PlanningWorkItemResponse;
    return WorkItemSchema.parse(payload.workItem);
  }
}
