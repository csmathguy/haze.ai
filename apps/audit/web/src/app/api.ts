import type { AuditEventRecord, AuditRunDetail, AuditRunOverview } from "@taxes/shared";

export interface AuditRunFilters {
  status: string;
  workflow: string;
  worktreePath: string;
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
  const searchParams = new URLSearchParams({
    limit: "80"
  });

  if (filters.status.length > 0) {
    searchParams.set("status", filters.status);
  }

  if (filters.workflow.length > 0) {
    searchParams.set("workflow", filters.workflow);
  }

  if (filters.worktreePath.length > 0) {
    searchParams.set("worktreePath", filters.worktreePath);
  }

  const response = await fetch(`/api/audit/runs?${searchParams.toString()}`);

  if (!response.ok) {
    throw new Error("Failed to load audit runs.");
  }

  const payload = (await response.json()) as RunsResponse;
  return payload.runs;
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
