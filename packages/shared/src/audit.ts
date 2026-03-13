import { z } from "zod";

export const AuditWorkflowStatusSchema = z.enum(["failed", "running", "skipped", "success"]);
export const AuditExecutionKindSchema = z.enum(["command", "hook", "operation", "skill", "tool", "validation"]);
export const AuditEventTypeSchema = z.enum([
  "execution-end",
  "execution-start",
  "workflow-end",
  "workflow-note",
  "workflow-start"
]);

export const AuditStatsSnapshotSchema = z.object({
  byKind: z.record(z.string(), z.number().int().nonnegative()),
  byStatus: z.record(z.string(), z.number().int().nonnegative()),
  executionCount: z.number().int().nonnegative(),
  failedExecutionCount: z.number().int().nonnegative()
});

export const AuditRunOverviewSchema = z.object({
  actor: z.string(),
  completedAt: z.iso.datetime().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  executionCount: z.number().int().nonnegative(),
  failedExecutionCount: z.number().int().nonnegative(),
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

export const AuditEventRecordSchema = z.object({
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

export const AuditRunDetailSchema = z.object({
  events: z.array(AuditEventRecordSchema),
  executions: z.array(AuditExecutionRecordSchema),
  run: AuditRunOverviewSchema
});

export type AuditEventRecord = z.infer<typeof AuditEventRecordSchema>;
export type AuditExecutionKind = z.infer<typeof AuditExecutionKindSchema>;
export type AuditExecutionRecord = z.infer<typeof AuditExecutionRecordSchema>;
export type AuditEventType = z.infer<typeof AuditEventTypeSchema>;
export type AuditRunDetail = z.infer<typeof AuditRunDetailSchema>;
export type AuditRunOverview = z.infer<typeof AuditRunOverviewSchema>;
export type AuditStatsSnapshot = z.infer<typeof AuditStatsSnapshotSchema>;
export type AuditWorkflowStatus = z.infer<typeof AuditWorkflowStatusSchema>;
