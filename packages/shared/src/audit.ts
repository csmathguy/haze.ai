import { z } from "zod";

export const AuditWorkflowStatusSchema = z.enum(["failed", "running", "skipped", "success"]);
export const AuditExecutionKindSchema = z.enum(["command", "hook", "operation", "skill", "tool", "validation"]);
export const AuditFailureSeveritySchema = z.enum(["low", "medium", "high", "critical"]);
export const AuditFailureStatusSchema = z.enum(["open", "resolved"]);
export const AuditHandoffStatusSchema = z.enum(["pending", "accepted", "completed", "blocked", "cancelled"]);
export const AuditEventTypeSchema = z.enum([
  "artifact-recorded",
  "decision-recorded",
  "execution-end",
  "execution-start",
  "failure-recorded",
  "handoff-recorded",
  "workflow-end",
  "workflow-note",
  "workflow-start"
]);
export const AuditContextSchema = z.object({
  agentName: z.string().optional(),
  planRunId: z.string().optional(),
  planStepId: z.string().optional(),
  project: z.string().optional(),
  sessionId: z.string().optional(),
  workItemId: z.string().optional()
});

export const AuditStatsSnapshotSchema = z.object({
  byKind: z.record(z.string(), z.number().int().nonnegative()),
  byStatus: z.record(z.string(), z.number().int().nonnegative()),
  executionCount: z.number().int().nonnegative(),
  failedExecutionCount: z.number().int().nonnegative()
});

export const AuditRunOverviewSchema = AuditContextSchema.extend({
  actor: z.string(),
  artifactCount: z.number().int().nonnegative(),
  completedAt: z.iso.datetime().optional(),
  decisionCount: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative().optional(),
  executionCount: z.number().int().nonnegative(),
  failedExecutionCount: z.number().int().nonnegative(),
  failureCount: z.number().int().nonnegative(),
  handoffCount: z.number().int().nonnegative(),
  latestEventAt: z.iso.datetime().optional(),
  repoPath: z.string().optional(),
  runId: z.string(),
  startedAt: z.iso.datetime(),
  stats: AuditStatsSnapshotSchema,
  status: AuditWorkflowStatusSchema,
  task: z.string().optional(),
  workflow: z.string(),
  worktreePath: z.string()
});

export const AuditExecutionRecordSchema = z.object({
  command: z.array(z.string()).optional(),
  completedAt: z.iso.datetime().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  errorMessage: z.string().optional(),
  errorName: z.string().optional(),
  executionId: z.string(),
  exitCode: z.number().int().optional(),
  kind: AuditExecutionKindSchema,
  logFile: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  name: z.string(),
  parentExecutionId: z.string().optional(),
  startedAt: z.iso.datetime(),
  status: AuditWorkflowStatusSchema,
  step: z.string().optional()
});

export const AuditEventRecordSchema = AuditContextSchema.extend({
  actor: z.string(),
  command: z.array(z.string()).optional(),
  cwd: z.string(),
  durationMs: z.number().int().nonnegative().optional(),
  errorMessage: z.string().optional(),
  errorName: z.string().optional(),
  eventId: z.string(),
  eventType: AuditEventTypeSchema,
  executionId: z.string().optional(),
  executionKind: AuditExecutionKindSchema.optional(),
  executionName: z.string().optional(),
  exitCode: z.number().int().optional(),
  logFile: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  parentExecutionId: z.string().optional(),
  runId: z.string(),
  status: AuditWorkflowStatusSchema.optional(),
  step: z.string().optional(),
  task: z.string().optional(),
  timestamp: z.iso.datetime(),
  workflow: z.string()
});

export const AuditDecisionRecordSchema = z.object({
  category: z.string(),
  decisionId: z.string(),
  executionId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  options: z.array(z.string()).optional(),
  rationale: z.string().optional(),
  runId: z.string(),
  selectedOption: z.string().optional(),
  summary: z.string(),
  timestamp: z.iso.datetime()
});

export const AuditArtifactRecordSchema = z.object({
  artifactId: z.string(),
  artifactType: z.string(),
  executionId: z.string().optional(),
  label: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  path: z.string().optional(),
  runId: z.string(),
  status: z.string(),
  timestamp: z.iso.datetime(),
  uri: z.string().optional()
});

export const AuditFailureRecordSchema = z.object({
  category: z.string(),
  detail: z.string().optional(),
  executionId: z.string().optional(),
  failureId: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  retryable: z.boolean(),
  runId: z.string(),
  severity: AuditFailureSeveritySchema,
  status: AuditFailureStatusSchema,
  summary: z.string(),
  timestamp: z.iso.datetime()
});
export const AuditHandoffRecordSchema = z.object({
  artifactIds: z.array(z.string()).optional(),
  detail: z.string().optional(),
  executionId: z.string().optional(),
  handoffId: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  planRunId: z.string().optional(),
  planStepId: z.string().optional(),
  runId: z.string(),
  sourceAgent: z.string(),
  status: AuditHandoffStatusSchema,
  summary: z.string(),
  targetAgent: z.string(),
  timestamp: z.iso.datetime(),
  workItemId: z.string().optional()
});

export const AuditRunDetailSchema = z.object({
  artifacts: z.array(AuditArtifactRecordSchema),
  decisions: z.array(AuditDecisionRecordSchema),
  events: z.array(AuditEventRecordSchema),
  executions: z.array(AuditExecutionRecordSchema),
  failures: z.array(AuditFailureRecordSchema),
  handoffs: z.array(AuditHandoffRecordSchema),
  run: AuditRunOverviewSchema
});

export const AuditAnalyticsBreakdownEntrySchema = z.object({
  count: z.number().int().nonnegative(),
  key: z.string()
});

export const AuditAnalyticsSnapshotSchema = z.object({
  byAgent: z.array(AuditAnalyticsBreakdownEntrySchema),
  byProject: z.array(AuditAnalyticsBreakdownEntrySchema),
  byWorkItem: z.array(AuditAnalyticsBreakdownEntrySchema),
  byWorkflow: z.array(AuditAnalyticsBreakdownEntrySchema),
  failureCategories: z.array(AuditAnalyticsBreakdownEntrySchema),
  handoffStatuses: z.array(AuditAnalyticsBreakdownEntrySchema),
  totals: z.object({
    artifactCount: z.number().int().nonnegative(),
    decisionCount: z.number().int().nonnegative(),
    executionCount: z.number().int().nonnegative(),
    failureCount: z.number().int().nonnegative(),
    handoffCount: z.number().int().nonnegative(),
    failedRuns: z.number().int().nonnegative(),
    runningRuns: z.number().int().nonnegative(),
    totalRuns: z.number().int().nonnegative()
  })
});

export const AuditWorkItemTimelineSummarySchema = z.object({
  activeAgents: z.array(z.string()),
  artifactCount: z.number().int().nonnegative(),
  decisionCount: z.number().int().nonnegative(),
  executionCount: z.number().int().nonnegative(),
  failureCount: z.number().int().nonnegative(),
  handoffCount: z.number().int().nonnegative(),
  latestEventAt: z.iso.datetime().optional(),
  runCount: z.number().int().nonnegative(),
  workflows: z.array(z.string())
});
export const AuditWorkItemTimelineSchema = z.object({
  artifacts: z.array(AuditArtifactRecordSchema),
  decisions: z.array(AuditDecisionRecordSchema),
  events: z.array(AuditEventRecordSchema),
  failures: z.array(AuditFailureRecordSchema),
  handoffs: z.array(AuditHandoffRecordSchema),
  runs: z.array(AuditRunOverviewSchema),
  summary: AuditWorkItemTimelineSummarySchema,
  workItemId: z.string()
});

export type AuditEventRecord = z.infer<typeof AuditEventRecordSchema>;
export type AuditAnalyticsBreakdownEntry = z.infer<typeof AuditAnalyticsBreakdownEntrySchema>;
export type AuditAnalyticsSnapshot = z.infer<typeof AuditAnalyticsSnapshotSchema>;
export type AuditArtifactRecord = z.infer<typeof AuditArtifactRecordSchema>;
export type AuditContext = z.infer<typeof AuditContextSchema>;
export type AuditDecisionRecord = z.infer<typeof AuditDecisionRecordSchema>;
export type AuditExecutionKind = z.infer<typeof AuditExecutionKindSchema>;
export type AuditExecutionRecord = z.infer<typeof AuditExecutionRecordSchema>;
export type AuditEventType = z.infer<typeof AuditEventTypeSchema>;
export type AuditFailureRecord = z.infer<typeof AuditFailureRecordSchema>;
export type AuditFailureSeverity = z.infer<typeof AuditFailureSeveritySchema>;
export type AuditFailureStatus = z.infer<typeof AuditFailureStatusSchema>;
export type AuditHandoffRecord = z.infer<typeof AuditHandoffRecordSchema>;
export type AuditHandoffStatus = z.infer<typeof AuditHandoffStatusSchema>;
export type AuditRunDetail = z.infer<typeof AuditRunDetailSchema>;
export type AuditRunOverview = z.infer<typeof AuditRunOverviewSchema>;
export type AuditStatsSnapshot = z.infer<typeof AuditStatsSnapshotSchema>;
export type AuditWorkItemTimeline = z.infer<typeof AuditWorkItemTimelineSchema>;
export type AuditWorkItemTimelineSummary = z.infer<typeof AuditWorkItemTimelineSummarySchema>;
export type AuditWorkflowStatus = z.infer<typeof AuditWorkflowStatusSchema>;
