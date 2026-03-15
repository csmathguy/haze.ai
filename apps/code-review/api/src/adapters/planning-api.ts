import type { WorkItem } from "@taxes/shared";

import { getWorkItemById } from "@taxes/plan-api";

export interface PlanningWorkItemGateway {
  getWorkItem(workItemId: string): Promise<WorkItem | null>;
}

export class DirectPlanningServiceGateway implements PlanningWorkItemGateway {
  constructor(private readonly databaseUrl?: string) {}

  getWorkItem(workItemId: string): Promise<WorkItem | null> {
    return getWorkItemById(workItemId, this.databaseUrl !== undefined ? { databaseUrl: this.databaseUrl } : {});
  }
}
