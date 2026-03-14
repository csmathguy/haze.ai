import { AuditWorkItemTimelineSchema, type AuditWorkItemTimeline } from "@taxes/shared";

import { AUDIT_API_ORIGIN, CODE_REVIEW_DEPENDENCY_TIMEOUT_MS } from "../config.js";

interface AuditTimelineResponse {
  readonly timeline: AuditWorkItemTimeline;
}

export interface AuditWorkItemGateway {
  getWorkItemTimeline(workItemId: string): Promise<AuditWorkItemTimeline | null>;
}

export class LocalAuditApiGateway implements AuditWorkItemGateway {
  async getWorkItemTimeline(workItemId: string): Promise<AuditWorkItemTimeline | null> {
    const response = await fetch(`${AUDIT_API_ORIGIN}/api/audit/work-items/${encodeURIComponent(workItemId)}/timeline`, {
      signal: AbortSignal.timeout(CODE_REVIEW_DEPENDENCY_TIMEOUT_MS)
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Audit API request failed with ${response.status.toString()}.`);
    }

    const payload = (await response.json()) as AuditTimelineResponse;
    return AuditWorkItemTimelineSchema.parse(payload.timeline);
  }
}
