export type AuditExecutionKind = "command" | "hook" | "operation" | "skill" | "tool" | "validation";
export type AuditWorkflowStatus = "failed" | "running" | "skipped" | "success";
export type AuditMetadataValue =
  | AuditMetadata
  | AuditMetadataValue[]
  | boolean
  | null
  | number
  | string;

export interface AuditMetadata {
  [key: string]: AuditMetadataValue;
}

export interface AuditSyncEvent {
  actor: string;
  command?: string[];
  cwd: string;
  durationMs?: number;
  errorMessage?: string;
  errorName?: string;
  eventId: string;
  eventType: "execution-end" | "execution-start" | "workflow-end" | "workflow-note" | "workflow-start";
  executionId?: string;
  executionKind?: AuditExecutionKind;
  executionName?: string;
  exitCode?: number;
  logFile?: string;
  metadata?: AuditMetadata;
  parentExecutionId?: string;
  runId: string;
  status?: AuditWorkflowStatus;
  step?: string;
  task?: string;
  timestamp: string;
  workflow: string;
}

export interface AuditSyncExecutionSummary {
  command?: string[];
  durationMs: number;
  errorMessage?: string;
  errorName?: string;
  executionId: string;
  exitCode?: number;
  kind: AuditExecutionKind;
  logFile?: string;
  metadata?: AuditMetadata;
  name: string;
  parentExecutionId?: string;
  startedAt: string;
  status: AuditWorkflowStatus;
  step?: string;
}

export interface AuditSyncSummary {
  actor: string;
  completedAt?: string;
  cwd: string;
  durationMs?: number;
  executions: AuditSyncExecutionSummary[];
  runId: string;
  startedAt: string;
  stats: {
    byKind: Partial<Record<AuditExecutionKind, number>>;
    byStatus: Partial<Record<AuditWorkflowStatus, number>>;
    executionCount: number;
    failedExecutionCount: number;
  };
  status: AuditWorkflowStatus;
  task?: string;
  workflow: string;
}
