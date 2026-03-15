import type { AuditWorkItemTimeline } from "@taxes/shared";

import { getAuditWorkItemTimeline } from "@taxes/audit-api";

export interface AuditWorkItemGateway {
  getWorkItemTimeline(workItemId: string): Promise<AuditWorkItemTimeline | null>;
}

export class DirectAuditServiceGateway implements AuditWorkItemGateway {
  constructor(private readonly databaseUrl?: string) {}

  getWorkItemTimeline(workItemId: string): Promise<AuditWorkItemTimeline | null> {
    return getAuditWorkItemTimeline(workItemId, this.databaseUrl !== undefined ? { databaseUrl: this.databaseUrl } : {});
  }
}
