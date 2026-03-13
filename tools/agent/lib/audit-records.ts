type AuditMetadataValue = AuditMetadata | AuditMetadataValue[] | boolean | null | number | string;

interface AuditMetadata {
  [key: string]: AuditMetadataValue;
}

export type AuditFailureSeverity = "critical" | "high" | "low" | "medium";
export type AuditFailureStatus = "open" | "resolved";
export type AuditHandoffStatus = "accepted" | "blocked" | "cancelled" | "completed" | "pending";

export interface AuditDecisionSummary {
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

export interface AuditArtifactSummary {
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

export interface AuditFailureSummary {
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

export interface AuditHandoffSummary {
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

export function appendDecisionSummary(
  decisions: AuditDecisionSummary[],
  decision: AuditDecisionSummary
): AuditDecisionSummary[] {
  return [...decisions, decision];
}

export function appendArtifactSummary(
  artifacts: AuditArtifactSummary[],
  artifact: AuditArtifactSummary
): AuditArtifactSummary[] {
  return [...artifacts, artifact];
}

export function appendFailureSummary(
  failures: AuditFailureSummary[],
  failure: AuditFailureSummary
): AuditFailureSummary[] {
  return [...failures, failure];
}

export function appendHandoffSummary(
  handoffs: AuditHandoffSummary[],
  handoff: AuditHandoffSummary
): AuditHandoffSummary[] {
  return [...handoffs, handoff];
}
