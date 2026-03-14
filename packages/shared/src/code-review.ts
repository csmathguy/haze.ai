import { z } from "zod";

import { AuditWorkflowStatusSchema } from "./audit.js";
import {
  PlanRunModeSchema,
  PlanRunStatusSchema,
  ProjectKeySchema,
  WorkItemIdSchema,
  WorkItemPrioritySchema,
  WorkItemStatusSchema
} from "./planning.js";

export const ReviewLaneIdSchema = z.enum(["context", "docs", "implementation", "risks", "tests", "validation"]);
export const CodeReviewPullRequestStateSchema = z.enum(["CLOSED", "MERGED", "OPEN"]);
export const CodeReviewPlanContextSourceSchema = z.enum(["body", "branch"]);
export const CodeReviewFileChangeTypeSchema = z.enum(["added", "copied", "deleted", "modified", "renamed", "unknown"]);

export const CodeReviewRepositorySchema = z.object({
  name: z.string().min(1),
  owner: z.string().min(1),
  url: z.url()
});

export const CodeReviewActorSchema = z.object({
  isBot: z.boolean(),
  login: z.string().min(1),
  name: z.string().min(1).optional()
});

export const CodeReviewPlanContextSchema = z.object({
  source: CodeReviewPlanContextSourceSchema,
  url: z.url(),
  workItemId: WorkItemIdSchema
});

export const CodeReviewChecklistProgressSchema = z.object({
  completeCount: z.int().nonnegative(),
  pendingCount: z.int().nonnegative(),
  totalCount: z.int().nonnegative()
});

export const CodeReviewPlanRunSummarySchema = z.object({
  completedStepCount: z.int().nonnegative(),
  currentStepTitle: z.string().min(1).optional(),
  mode: PlanRunModeSchema,
  status: PlanRunStatusSchema,
  summary: z.string().min(1),
  totalStepCount: z.int().nonnegative()
});

export const CodeReviewLinkedWorkItemSchema = z.object({
  acceptanceCriteria: CodeReviewChecklistProgressSchema,
  latestPlanRun: CodeReviewPlanRunSummarySchema.optional(),
  owner: z.string().min(1).optional(),
  priority: WorkItemPrioritySchema,
  projectKey: ProjectKeySchema,
  status: WorkItemStatusSchema,
  summary: z.string().min(1),
  targetIteration: z.string().min(1).optional(),
  tasks: CodeReviewChecklistProgressSchema,
  title: z.string().min(1),
  workItemId: WorkItemIdSchema
});

export const CodeReviewAuditRunSummarySchema = z.object({
  durationMs: z.number().int().nonnegative().optional(),
  executionCount: z.number().int().nonnegative(),
  failureCount: z.number().int().nonnegative(),
  latestEventAt: z.iso.datetime().optional(),
  runId: z.string().min(1),
  startedAt: z.iso.datetime(),
  status: AuditWorkflowStatusSchema,
  workflow: z.string().min(1)
});

export const CodeReviewAuditEvidenceSchema = z.object({
  activeAgents: z.array(z.string().min(1)),
  artifactCount: z.number().int().nonnegative(),
  decisionCount: z.number().int().nonnegative(),
  failureCount: z.number().int().nonnegative(),
  handoffCount: z.number().int().nonnegative(),
  latestEventAt: z.iso.datetime().optional(),
  recentRuns: z.array(CodeReviewAuditRunSummarySchema),
  runCount: z.number().int().nonnegative(),
  workflows: z.array(z.string().min(1)),
  workItemId: WorkItemIdSchema
});

export const CodeReviewCheckSchema = z.object({
  completedAt: z.iso.datetime().optional(),
  conclusion: z.string().min(1).optional(),
  detailsUrl: z.url().optional(),
  name: z.string().min(1),
  startedAt: z.iso.datetime().optional(),
  status: z.string().min(1),
  workflowName: z.string().min(1).optional()
});

export const CodeReviewFileExplanationSchema = z.object({
  rationale: z.string().min(1),
  reviewFocus: z.array(z.string().min(1)).min(1),
  summary: z.string().min(1)
});

export const CodeReviewChangedFileSchema = z.object({
  additions: z.int().nonnegative(),
  areaLabel: z.string().min(1),
  changeType: CodeReviewFileChangeTypeSchema,
  deletions: z.int().nonnegative(),
  explanation: CodeReviewFileExplanationSchema,
  laneId: ReviewLaneIdSchema,
  patch: z.string().optional(),
  path: z.string().min(1),
  tags: z.array(z.string().min(1))
});

export const ReviewLaneSchema = z.object({
  evidence: z.array(z.string().min(1)),
  files: z.array(CodeReviewChangedFileSchema),
  highlights: z.array(z.string().min(1)),
  id: ReviewLaneIdSchema,
  questions: z.array(z.string().min(1)).min(1),
  reviewerGoal: z.string().min(1),
  summary: z.string().min(1),
  title: z.string().min(1)
});

export const CodeReviewNarrativeSectionSchema = z.object({
  items: z.array(z.string().min(1)),
  title: z.string().min(1)
});

export const CodeReviewNarrativeSchema = z.object({
  reviewFocus: z.array(z.string().min(1)),
  reviewOrder: z.array(z.string().min(1)),
  risks: z.array(z.string().min(1)),
  summaryBullets: z.array(z.string().min(1)),
  validationCommands: z.array(z.string().min(1)),
  valueSummary: z.string().min(1),
  whatChangedSections: z.array(CodeReviewNarrativeSectionSchema)
});

export const CodeReviewPullRequestStatsSchema = z.object({
  commentCount: z.int().nonnegative(),
  fileCount: z.int().nonnegative(),
  reviewCount: z.int().nonnegative(),
  totalAdditions: z.int().nonnegative(),
  totalDeletions: z.int().nonnegative()
});

export const CodeReviewPullRequestSummarySchema = z.object({
  author: CodeReviewActorSchema,
  baseRefName: z.string().min(1),
  headRefName: z.string().min(1),
  isDraft: z.boolean(),
  linkedPlan: CodeReviewPlanContextSchema.optional(),
  number: z.int().positive(),
  reviewDecision: z.string(),
  state: CodeReviewPullRequestStateSchema,
  title: z.string().min(1),
  updatedAt: z.iso.datetime(),
  url: z.url()
});

export const CodeReviewPullRequestDetailSchema = CodeReviewPullRequestSummarySchema.extend({
  auditEvidence: CodeReviewAuditEvidenceSchema.optional(),
  body: z.string(),
  checks: z.array(CodeReviewCheckSchema),
  evidenceWarnings: z.array(z.string().min(1)).optional(),
  lanes: z.array(ReviewLaneSchema).min(1),
  mergeStateStatus: z.string().min(1),
  narrative: CodeReviewNarrativeSchema,
  planningWorkItem: CodeReviewLinkedWorkItemSchema.optional(),
  stats: CodeReviewPullRequestStatsSchema,
  trustStatement: z.string().min(1)
});

export const CodeReviewWorkspaceSchema = z.object({
  generatedAt: z.iso.datetime(),
  localOnly: z.literal(true),
  pullRequests: z.array(CodeReviewPullRequestSummarySchema),
  purpose: z.string().min(1),
  repository: CodeReviewRepositorySchema,
  showingRecentFallback: z.boolean(),
  title: z.string().min(1),
  trustStatement: z.string().min(1)
});

export type CodeReviewActor = z.infer<typeof CodeReviewActorSchema>;
export type CodeReviewAuditEvidence = z.infer<typeof CodeReviewAuditEvidenceSchema>;
export type CodeReviewAuditRunSummary = z.infer<typeof CodeReviewAuditRunSummarySchema>;
export type CodeReviewChangedFile = z.infer<typeof CodeReviewChangedFileSchema>;
export type CodeReviewCheck = z.infer<typeof CodeReviewCheckSchema>;
export type CodeReviewChecklistProgress = z.infer<typeof CodeReviewChecklistProgressSchema>;
export type CodeReviewFileChangeType = z.infer<typeof CodeReviewFileChangeTypeSchema>;
export type CodeReviewFileExplanation = z.infer<typeof CodeReviewFileExplanationSchema>;
export type CodeReviewLinkedWorkItem = z.infer<typeof CodeReviewLinkedWorkItemSchema>;
export type CodeReviewNarrative = z.infer<typeof CodeReviewNarrativeSchema>;
export type CodeReviewNarrativeSection = z.infer<typeof CodeReviewNarrativeSectionSchema>;
export type CodeReviewPlanContext = z.infer<typeof CodeReviewPlanContextSchema>;
export type CodeReviewPlanContextSource = z.infer<typeof CodeReviewPlanContextSourceSchema>;
export type CodeReviewPlanRunSummary = z.infer<typeof CodeReviewPlanRunSummarySchema>;
export type CodeReviewPullRequestDetail = z.infer<typeof CodeReviewPullRequestDetailSchema>;
export type CodeReviewPullRequestState = z.infer<typeof CodeReviewPullRequestStateSchema>;
export type CodeReviewPullRequestStats = z.infer<typeof CodeReviewPullRequestStatsSchema>;
export type CodeReviewPullRequestSummary = z.infer<typeof CodeReviewPullRequestSummarySchema>;
export type CodeReviewRepository = z.infer<typeof CodeReviewRepositorySchema>;
export type CodeReviewWorkspace = z.infer<typeof CodeReviewWorkspaceSchema>;
export type ReviewLane = z.infer<typeof ReviewLaneSchema>;
export type ReviewLaneId = z.infer<typeof ReviewLaneIdSchema>;
