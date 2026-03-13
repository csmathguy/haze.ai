import type { AuditAnalyticsSnapshot, AuditEventRecord, AuditRunDetail, AuditRunOverview } from "@taxes/shared";

export interface AuditRunFilters {
  agentName: string;
  project: string;
  status: string;
  workflow: string;
  workItemId: string;
  worktreePath: string;
}

interface AnalyticsResponse {
  analytics: AuditAnalyticsSnapshot;
}

interface RunsResponse {
  runs: AuditRunOverview[];
}

interface DetailResponse {
  detail: AuditRunDetail;
}

interface StreamSubscriptionOptions {
  onError: () => void;
  onEvent: (event: AuditEventRecord) => void;
  onReady: (since: string) => void;
  since?: string;
}

export async function fetchAuditRuns(filters: AuditRunFilters): Promise<AuditRunOverview[]> {
  const searchParams = buildRunSearchParams(filters);
  const response = await fetch(`/api/audit/runs?${searchParams.toString()}`);

  if (!response.ok) {
    throw new Error("Failed to load audit runs.");
  }

  const payload = (await response.json()) as RunsResponse;
  return payload.runs;
}

export async function fetchAuditAnalytics(filters: AuditRunFilters): Promise<AuditAnalyticsSnapshot> {
  const searchParams = buildRunSearchParams(filters);
  const response = await fetch(`/api/audit/analytics?${searchParams.toString()}`);

  if (!response.ok) {
    throw new Error("Failed to load audit analytics.");
  }

  const payload = (await response.json()) as AnalyticsResponse;
  return payload.analytics;
}

function buildRunSearchParams(filters: AuditRunFilters): URLSearchParams {
  const searchParams = new URLSearchParams({
    limit: "80"
  });

  if (filters.agentName.length > 0) {
    searchParams.set("agentName", filters.agentName);
  }

  if (filters.project.length > 0) {
    searchParams.set("project", filters.project);
  }

  if (filters.status.length > 0) {
    searchParams.set("status", filters.status);
  }

  if (filters.workflow.length > 0) {
    searchParams.set("workflow", filters.workflow);
  }

  if (filters.workItemId.length > 0) {
    searchParams.set("workItemId", filters.workItemId);
  }

  if (filters.worktreePath.length > 0) {
    searchParams.set("worktreePath", filters.worktreePath);
  }

  return searchParams;
}

export async function fetchAuditRunDetail(runId: string): Promise<AuditRunDetail> {
  const response = await fetch(`/api/audit/runs/${encodeURIComponent(runId)}`);

  if (!response.ok) {
    throw new Error("Failed to load audit run detail.");
  }

  const payload = (await response.json()) as DetailResponse;
  return payload.detail;
}

export function subscribeToAuditStream(options: StreamSubscriptionOptions): () => void {
  const url = new URL("/api/audit/stream", window.location.origin);

  if (options.since !== undefined) {
    url.searchParams.set("since", options.since);
  }

  const eventSource = new EventSource(url);
  eventSource.addEventListener("ready", (event) => {
    const payload = JSON.parse((event as MessageEvent<string>).data) as { since: string };
    options.onReady(payload.since);
  });
  eventSource.addEventListener("audit-event", (event) => {
    options.onEvent(JSON.parse((event as MessageEvent<string>).data) as AuditEventRecord);
  });
  eventSource.onerror = () => {
    options.onError();
  };

  return () => {
    eventSource.close();
  };
}
