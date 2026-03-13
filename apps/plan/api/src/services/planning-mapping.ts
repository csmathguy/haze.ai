import type { PlanningProject, WorkItem } from "@taxes/shared";
import { PlanningProjectSchema, WorkItemSchema } from "@taxes/shared";

import type { StoredPlanProject, StoredPlanWorkItem } from "./planning-support.js";

const NEXT_WORK_ITEM_STATUS_RANK = new Map<string, number>([
  ["ready", 0],
  ["planning", 1],
  ["backlog", 2]
]);
const WORK_ITEM_STATUS_RANK = new Map<string, number>([
  ["ready", 0],
  ["planning", 1],
  ["backlog", 2],
  ["in-progress", 3],
  ["blocked", 4],
  ["done", 5],
  ["archived", 6]
]);
const WORK_ITEM_PRIORITY_RANK = new Map<string, number>([
  ["critical", 0],
  ["high", 1],
  ["medium", 2],
  ["low", 3]
]);

export function compareNextWorkItems(
  left: StoredPlanWorkItem,
  right: StoredPlanWorkItem,
  projectSortOrder: Map<string, number>
): number {
  return (
    compareNumbers(getStatusRank(NEXT_WORK_ITEM_STATUS_RANK, left.status), getStatusRank(NEXT_WORK_ITEM_STATUS_RANK, right.status)) ||
    compareNumbers(getPriorityRank(left.priority), getPriorityRank(right.priority)) ||
    compareNumbers(getProjectSortOrder(projectSortOrder, left.project.key), getProjectSortOrder(projectSortOrder, right.project.key)) ||
    compareNumbers(left.sequence, right.sequence)
  );
}

export function compareWorkItems(left: WorkItem, right: WorkItem, projectSortOrder: Map<string, number>): number {
  return (
    compareNumbers(getProjectSortOrder(projectSortOrder, left.projectKey), getProjectSortOrder(projectSortOrder, right.projectKey)) ||
    compareNumbers(getStatusRank(WORK_ITEM_STATUS_RANK, left.status), getStatusRank(WORK_ITEM_STATUS_RANK, right.status)) ||
    compareNumbers(getPriorityRank(left.priority), getPriorityRank(right.priority)) ||
    compareNumbers(getNumericPlanId(left.id), getNumericPlanId(right.id))
  );
}

export function mapProject(record: StoredPlanProject): PlanningProject {
  return PlanningProjectSchema.parse({
    createdAt: record.createdAt.toISOString(),
    description: record.description ?? undefined,
    isActive: record.isActive,
    key: record.key,
    name: record.name,
    sortOrder: record.sortOrder,
    updatedAt: record.updatedAt.toISOString()
  });
}

export function mapWorkItem(record: StoredPlanWorkItem): WorkItem {
  return WorkItemSchema.parse({
    acceptanceCriteria: record.acceptanceCriteria.map((criterion) => ({
      id: criterion.id,
      sequence: criterion.sequence,
      status: criterion.status,
      title: criterion.title
    })),
    auditWorkflowRunId: record.auditWorkflowRunId ?? undefined,
    blockedByWorkItemIds: record.blockedByDependencies.map((dependency) => dependency.blockingWorkItemId),
    createdAt: record.createdAt.toISOString(),
    id: record.id,
    kind: record.kind,
    owner: record.owner ?? undefined,
    planRuns: record.planRuns.map((planRun) => ({
      auditWorkflowRunId: planRun.auditWorkflowRunId ?? undefined,
      createdAt: planRun.createdAt.toISOString(),
      id: planRun.id,
      mode: planRun.mode,
      status: planRun.status,
      steps: planRun.steps.map((step) => ({
        id: step.id,
        phase: step.phase,
        sequence: step.sequence,
        status: step.status,
        title: step.title
      })),
      summary: planRun.summary,
      updatedAt: planRun.updatedAt.toISOString()
    })),
    priority: record.priority,
    projectKey: record.project.key,
    status: record.status,
    summary: record.summary,
    targetIteration: record.targetIteration ?? undefined,
    tasks: record.tasks.map((task) => ({
      id: task.id,
      sequence: task.sequence,
      status: task.status,
      title: task.title
    })),
    title: record.title,
    updatedAt: record.updatedAt.toISOString()
  });
}

function compareNumbers(left: number, right: number): number {
  return left - right;
}

function getNumericPlanId(workItemId: string): number {
  return Number.parseInt(workItemId.replace("PLAN-", ""), 10);
}

function getPriorityRank(priority: string): number {
  return WORK_ITEM_PRIORITY_RANK.get(priority) ?? Number.MAX_SAFE_INTEGER;
}

function getProjectSortOrder(projectSortOrder: Map<string, number>, projectKey: string): number {
  return projectSortOrder.get(projectKey) ?? Number.MAX_SAFE_INTEGER;
}

function getStatusRank(rankMap: Map<string, number>, status: string): number {
  return rankMap.get(status) ?? Number.MAX_SAFE_INTEGER;
}
