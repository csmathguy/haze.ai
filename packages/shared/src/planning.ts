import { z } from "zod";

export const ProjectKeySchema = z.string().regex(/^[a-z][a-z0-9-]{1,31}$/u);
export const WorkItemIdSchema = z.string().regex(/^PLAN-\d+$/u);
export const WorkItemKindSchema = z.enum(["epic", "feature", "maintenance", "spike", "task"]);
export const WorkItemPrioritySchema = z.enum(["critical", "high", "medium", "low"]);
export const WorkItemStatusSchema = z.enum(["backlog", "planning", "ready", "in-progress", "blocked", "done", "archived"]);
export const WorkItemTaskStatusSchema = z.enum(["todo", "in-progress", "done"]);
export const AcceptanceCriterionStatusSchema = z.enum(["pending", "passed", "failed"]);
export const PlanRunModeSchema = z.enum(["manual", "single-agent", "parallel-agents"]);
export const PlanRunStatusSchema = z.enum(["draft", "ready", "executing", "completed", "superseded"]);
export const PlanStepPhaseSchema = z.enum(["research", "design", "implementation", "validation", "handoff"]);
export const PlanStepStatusSchema = z.enum(["pending", "in-progress", "done"]);

export const WorkItemTaskSchema = z.object({
  id: z.string().min(1),
  sequence: z.int().nonnegative(),
  status: WorkItemTaskStatusSchema,
  title: z.string().min(1)
});
export const AcceptanceCriterionSchema = z.object({
  id: z.string().min(1),
  sequence: z.int().nonnegative(),
  status: AcceptanceCriterionStatusSchema,
  title: z.string().min(1)
});
export const PlanStepSchema = z.object({
  id: z.string().min(1),
  phase: PlanStepPhaseSchema,
  sequence: z.int().nonnegative(),
  status: PlanStepStatusSchema,
  title: z.string().min(1)
});
export const PlanRunSchema = z.object({
  auditWorkflowRunId: z.string().min(1).optional(),
  createdAt: z.iso.datetime(),
  id: z.string().min(1),
  mode: PlanRunModeSchema,
  status: PlanRunStatusSchema,
  steps: z.array(PlanStepSchema),
  summary: z.string().min(1),
  updatedAt: z.iso.datetime()
});
export const PlanningProjectSchema = z.object({
  createdAt: z.iso.datetime(),
  description: z.string().min(1).optional(),
  isActive: z.boolean(),
  key: ProjectKeySchema,
  name: z.string().min(1),
  sortOrder: z.int().nonnegative(),
  updatedAt: z.iso.datetime()
});
export const WorkItemSchema = z.object({
  acceptanceCriteria: z.array(AcceptanceCriterionSchema),
  auditWorkflowRunId: z.string().min(1).optional(),
  blockedByWorkItemIds: z.array(WorkItemIdSchema),
  createdAt: z.iso.datetime(),
  id: WorkItemIdSchema,
  kind: WorkItemKindSchema,
  owner: z.string().min(1).optional(),
  planRuns: z.array(PlanRunSchema),
  priority: WorkItemPrioritySchema,
  projectKey: ProjectKeySchema,
  status: WorkItemStatusSchema,
  summary: z.string().min(1),
  targetIteration: z.string().min(1).optional(),
  tasks: z.array(WorkItemTaskSchema),
  title: z.string().min(1),
  updatedAt: z.iso.datetime()
});
export const PlanningWorkspaceSummarySchema = z.object({
  activeItems: z.int().nonnegative(),
  backlogItems: z.int().nonnegative(),
  blockedItems: z.int().nonnegative(),
  doneItems: z.int().nonnegative(),
  readyItems: z.int().nonnegative(),
  totalItems: z.int().nonnegative()
});
export const PlanningWorkspaceSchema = z.object({
  generatedAt: z.iso.datetime(),
  localOnly: z.literal(true),
  projects: z.array(PlanningProjectSchema),
  summary: PlanningWorkspaceSummarySchema,
  workItems: z.array(WorkItemSchema)
});

export const CreatePlanningProjectInputSchema = z.object({
  description: z.string().min(1).optional(),
  key: ProjectKeySchema,
  name: z.string().min(1)
});
export const CreatePlanRunInputSchema = z.object({
  auditWorkflowRunId: z.string().min(1).optional(),
  mode: PlanRunModeSchema,
  steps: z.array(z.string().min(1)).min(1),
  summary: z.string().min(1)
});
export const CreateWorkItemInputSchema = z.object({
  acceptanceCriteria: z.array(z.string().min(1)).default([]),
  auditWorkflowRunId: z.string().min(1).optional(),
  blockedByWorkItemIds: z.array(WorkItemIdSchema).default([]),
  kind: WorkItemKindSchema,
  owner: z.string().min(1).optional(),
  plan: CreatePlanRunInputSchema.optional(),
  priority: WorkItemPrioritySchema,
  projectKey: ProjectKeySchema,
  summary: z.string().min(1),
  targetIteration: z.string().min(1).optional(),
  tasks: z.array(z.string().min(1)).default([]),
  title: z.string().min(1)
});
export const UpdateWorkItemInputSchema = z
  .object({
    acceptanceCriteriaAdditions: z.array(z.string().min(1)).min(1).optional(),
    auditWorkflowRunId: z.string().min(1).optional().nullable(),
    blockedByWorkItemIds: z.array(WorkItemIdSchema).optional(),
    owner: z.string().min(1).optional().nullable(),
    plan: CreatePlanRunInputSchema.optional(),
    priority: WorkItemPrioritySchema.optional(),
    projectKey: ProjectKeySchema.optional(),
    status: WorkItemStatusSchema.optional(),
    summary: z.string().min(1).optional(),
    taskAdditions: z.array(z.string().min(1)).min(1).optional(),
    targetIteration: z.string().min(1).optional().nullable(),
    title: z.string().min(1).optional()
  })
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), {
    message: "Provide at least one field to update."
  });
export const NextWorkItemInputSchema = z.object({
  projectKey: ProjectKeySchema.optional()
});
export const UpdateWorkItemTaskStatusInputSchema = z.object({
  status: WorkItemTaskStatusSchema
});
export const UpdateAcceptanceCriterionStatusInputSchema = z.object({
  status: AcceptanceCriterionStatusSchema
});

export type AcceptanceCriterion = z.infer<typeof AcceptanceCriterionSchema>;
export type AcceptanceCriterionStatus = z.infer<typeof AcceptanceCriterionStatusSchema>;
export type CreatePlanningProjectDraftInput = z.input<typeof CreatePlanningProjectInputSchema>;
export type CreatePlanningProjectInput = z.infer<typeof CreatePlanningProjectInputSchema>;
export type CreatePlanRunDraftInput = z.input<typeof CreatePlanRunInputSchema>;
export type CreatePlanRunInput = z.infer<typeof CreatePlanRunInputSchema>;
export type CreateWorkItemDraftInput = z.input<typeof CreateWorkItemInputSchema>;
export type CreateWorkItemInput = z.infer<typeof CreateWorkItemInputSchema>;
export type NextWorkItemDraftInput = z.input<typeof NextWorkItemInputSchema>;
export type NextWorkItemInput = z.infer<typeof NextWorkItemInputSchema>;
export type PlanRun = z.infer<typeof PlanRunSchema>;
export type PlanRunMode = z.infer<typeof PlanRunModeSchema>;
export type PlanRunStatus = z.infer<typeof PlanRunStatusSchema>;
export type PlanStep = z.infer<typeof PlanStepSchema>;
export type PlanStepPhase = z.infer<typeof PlanStepPhaseSchema>;
export type PlanStepStatus = z.infer<typeof PlanStepStatusSchema>;
export type PlanningProject = z.infer<typeof PlanningProjectSchema>;
export type PlanningWorkspace = z.infer<typeof PlanningWorkspaceSchema>;
export type PlanningWorkspaceSummary = z.infer<typeof PlanningWorkspaceSummarySchema>;
export type ProjectKey = z.infer<typeof ProjectKeySchema>;
export type UpdateAcceptanceCriterionStatusPatchInput = z.input<typeof UpdateAcceptanceCriterionStatusInputSchema>;
export type UpdateAcceptanceCriterionStatusInput = z.infer<typeof UpdateAcceptanceCriterionStatusInputSchema>;
export type UpdateWorkItemPatchInput = z.input<typeof UpdateWorkItemInputSchema>;
export type UpdateWorkItemInput = z.infer<typeof UpdateWorkItemInputSchema>;
export type UpdateWorkItemTaskStatusPatchInput = z.input<typeof UpdateWorkItemTaskStatusInputSchema>;
export type UpdateWorkItemTaskStatusInput = z.infer<typeof UpdateWorkItemTaskStatusInputSchema>;
export type WorkItem = z.infer<typeof WorkItemSchema>;
export type WorkItemKind = z.infer<typeof WorkItemKindSchema>;
export type WorkItemPriority = z.infer<typeof WorkItemPrioritySchema>;
export type WorkItemStatus = z.infer<typeof WorkItemStatusSchema>;
export type WorkItemTask = z.infer<typeof WorkItemTaskSchema>;
export type WorkItemTaskStatus = z.infer<typeof WorkItemTaskStatusSchema>;
