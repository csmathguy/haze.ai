export type AuditExecutionKind = "command" | "hook" | "operation" | "skill" | "tool" | "validation";
export type AuditFailureSeverity = "critical" | "high" | "low" | "medium";
export type AuditFailureStatus = "open" | "resolved";
export type AuditHandoffStatus = "accepted" | "blocked" | "cancelled" | "completed" | "pending";
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

export interface AuditRunContextFields {
  agentName?: string;
  planRunId?: string;
  planStepId?: string;
  project?: string;
  sessionId?: string;
  workItemId?: string;
}

export interface AuditSyncEvent {
  actor: string;
  agentName?: string;
  command?: string[];
  cwd: string;
  durationMs?: number;
  errorMessage?: string;
  errorName?: string;
  eventId: string;
  eventType:
    | "artifact-recorded"
    | "decision-recorded"
    | "execution-end"
    | "execution-start"
    | "failure-recorded"
    | "handoff-recorded"
    | "workflow-end"
    | "workflow-note"
    | "workflow-start";
  executionId?: string;
  executionKind?: AuditExecutionKind;
  executionName?: string;
  exitCode?: number;
  logFile?: string;
  metadata?: AuditMetadata;
  planRunId?: string;
  planStepId?: string;
  parentExecutionId?: string;
  project?: string;
  runId: string;
  sessionId?: string;
  status?: AuditWorkflowStatus;
  step?: string;
  task?: string;
  timestamp: string;
  workflow: string;
  workItemId?: string;
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

export interface AuditSyncDecisionSummary {
  category: string;
  decisionId: string;
  executionId?: string;
  metadata?: AuditMetadata;
  options?: string[];
  rationale?: string;
  selectedOption?: string;
  summary: string;
  timestamp: string;
}

export interface AuditSyncArtifactSummary {
  artifactId: string;
  artifactType: string;
  executionId?: string;
  label: string;
  metadata?: AuditMetadata;
  path?: string;
  status: string;
  timestamp: string;
  uri?: string;
}

export interface AuditSyncFailureSummary {
  category: string;
  detail?: string;
  executionId?: string;
  failureId: string;
  metadata?: AuditMetadata;
  retryable: boolean;
  severity: AuditFailureSeverity;
  status: AuditFailureStatus;
  summary: string;
  timestamp: string;
}

export interface AuditSyncHandoffSummary {
  artifactIds?: string[];
  detail?: string;
  executionId?: string;
  handoffId: string;
  metadata?: AuditMetadata;
  planRunId?: string;
  planStepId?: string;
  sourceAgent: string;
  status: AuditHandoffStatus;
  summary: string;
  targetAgent: string;
  timestamp: string;
  workItemId?: string;
}

export interface AuditSyncSummary {
  actor: string;
  agentName?: string;
  artifacts: AuditSyncArtifactSummary[];
  completedAt?: string;
  cwd: string;
  decisions: AuditSyncDecisionSummary[];
  durationMs?: number;
  executions: AuditSyncExecutionSummary[];
  failures: AuditSyncFailureSummary[];
  handoffs: AuditSyncHandoffSummary[];
  planRunId?: string;
  planStepId?: string;
  project?: string;
  runId: string;
  sessionId?: string;
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
  workItemId?: string;
}
