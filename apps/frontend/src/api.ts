export interface OrchestratorStatus {
  busy: boolean;
  lastWakeReason: string;
}

export interface TaskRecord {
  id: string;
  title: string;
  description: string;
  priority: number;
  status: TaskStatus;
  projectId?: string;
  dependencies: string[];
  dependents?: string[];
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  dueAt: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
}

export type TaskStatus =
  | "backlog"
  | "planning"
  | "implementing"
  | "review"
  | "verification"
  | "awaiting_human"
  | "done"
  | "cancelled";

export interface AuditEventRecord {
  id: string;
  timestamp: string;
  eventType: string;
  actor: string;
  traceId: string;
  requestId: string;
  userId: string | null;
  previousHash: string | null;
  hash: string;
  payload: Record<string, unknown>;
}

export interface WorkflowStatusModelEntry {
  status: TaskStatus;
  label: string;
  allowedTransitions: TaskStatus[];
  blockedTransitions: Array<{
    status: TaskStatus;
    reasonCodes: string[];
  }>;
  hookSummary: {
    onEnterCount: number;
    onExitCount: number;
  };
}

export interface WorkflowStatusModel {
  statuses: WorkflowStatusModelEntry[];
}

export interface ProjectRecord {
  id: string;
  name: string;
  description: string;
  repository: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export async function fetchStatus(): Promise<OrchestratorStatus> {
  const response = await fetch("/api/orchestrator/status");
  if (!response.ok) {
    throw new Error(`Status request failed: ${response.status}`);
  }
  return (await response.json()) as OrchestratorStatus;
}

export async function fetchTasks(status?: string): Promise<TaskRecord[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const response = await fetch(`/api/tasks${query}`);
  if (!response.ok) {
    throw new Error(`Tasks request failed: ${response.status}`);
  }

  const json = (await response.json()) as { records: TaskRecord[] };
  return json.records;
}

export async function fetchRecentAudit(limit = 50): Promise<AuditEventRecord[]> {
  const response = await fetch(`/api/audit/recent?limit=${limit}`);
  if (!response.ok) {
    throw new Error(`Audit request failed: ${response.status}`);
  }

  const json = (await response.json()) as { records: AuditEventRecord[] };
  return json.records;
}

export async function fetchWorkflowStatusModel(): Promise<WorkflowStatusModel> {
  const response = await fetch("/api/workflow/status-model");
  if (!response.ok) {
    throw new Error(`Workflow status model request failed: ${response.status}`);
  }
  return (await response.json()) as WorkflowStatusModel;
}

export async function fetchProjects(): Promise<ProjectRecord[]> {
  const response = await fetch("/api/projects");
  if (!response.ok) {
    throw new Error(`Projects request failed: ${response.status}`);
  }

  const json = (await response.json()) as { records: ProjectRecord[] };
  return json.records;
}

export function subscribeAudit(onEvent: (event: AuditEventRecord) => void): () => void {
  const stream = new EventSource("/api/audit/stream");

  stream.addEventListener("audit", (raw) => {
    const payload = JSON.parse((raw as MessageEvent).data) as AuditEventRecord;
    onEvent(payload);
  });

  return () => {
    stream.close();
  };
}

export async function postJson(
  path: string,
  payload: Record<string, unknown>
): Promise<void> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`POST failed for ${path}: ${response.status}`);
  }
}

export async function patchTask(
  taskId: string,
  payload: Partial<Pick<TaskRecord, "status" | "metadata" | "projectId">>
): Promise<TaskRecord> {
  const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`PATCH failed for /api/tasks/${taskId}: ${response.status}`);
  }

  const json = (await response.json()) as { record: TaskRecord };
  return json.record;
}

export async function createProject(
  payload: Pick<ProjectRecord, "name" | "description" | "repository">
): Promise<ProjectRecord> {
  const response = await fetch("/api/projects", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`POST failed for /api/projects: ${response.status}`);
  }

  const json = (await response.json()) as { record: ProjectRecord };
  return json.record;
}

export async function patchProject(
  projectId: string,
  payload: Partial<Pick<ProjectRecord, "name" | "description" | "repository" | "metadata">>
): Promise<ProjectRecord> {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`PATCH failed for /api/projects/${projectId}: ${response.status}`);
  }

  const json = (await response.json()) as { record: ProjectRecord };
  return json.record;
}
