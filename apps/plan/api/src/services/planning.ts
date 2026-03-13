import { randomUUID } from "node:crypto";

import type {
  AcceptanceCriterionStatus,
  CreateWorkItemDraftInput,
  PlanningWorkspace,
  UpdateWorkItemInput,
  UpdateWorkItemPatchInput,
  WorkItem,
  WorkItemTaskStatus
} from "@taxes/shared";
import {
  CreateWorkItemInputSchema,
  UpdateWorkItemInputSchema,
  PlanningWorkspaceSchema,
  WorkItemSchema
} from "@taxes/shared";
import type { Prisma } from "@prisma/client";

import { getPrismaClient } from "../db/client.js";
import type { PlanningPersistenceOptions } from "./context.js";

const PLAN_WORK_ITEM_INCLUDE = {
  acceptanceCriteria: {
    orderBy: {
      sequence: "asc"
    }
  },
  blockedByDependencies: {
    orderBy: {
      blockingWorkItemId: "asc"
    }
  },
  planRuns: {
    include: {
      steps: {
        orderBy: {
          sequence: "asc"
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  },
  tasks: {
    orderBy: {
      sequence: "asc"
    }
  }
} as const;

type StoredPlanWorkItem = Prisma.PlanWorkItemGetPayload<{
  include: typeof PLAN_WORK_ITEM_INCLUDE;
}>;

export class PlanningNotFoundError extends Error {}

export async function getPlanningWorkspace(options: PlanningPersistenceOptions = {}): Promise<PlanningWorkspace> {
  const prisma = await getPrismaClient(options.databaseUrl);
  const records = await prisma.planWorkItem.findMany({
    include: PLAN_WORK_ITEM_INCLUDE,
    orderBy: [{ status: "asc" }, { priority: "asc" }, { sequence: "asc" }]
  });
  const workItems = records.map(mapWorkItem);

  return PlanningWorkspaceSchema.parse({
    generatedAt: new Date().toISOString(),
    localOnly: true,
    summary: buildSummary(workItems),
    workItems
  });
}

export async function createWorkItem(
  input: CreateWorkItemDraftInput,
  options: PlanningPersistenceOptions = {}
): Promise<WorkItem> {
  const prisma = await getPrismaClient(options.databaseUrl);
  const parsedInput = CreateWorkItemInputSchema.parse(input);

  return prisma.$transaction(async (transaction) => {
    await ensureDependenciesExist(transaction, parsedInput.blockedByWorkItemIds);

    const sequence = await getNextWorkItemSequence(transaction);
    const workItemCreateData = buildWorkItemCreateData(parsedInput, sequence);
    const createdWorkItem = await transaction.planWorkItem.create({
      data: workItemCreateData,
      include: PLAN_WORK_ITEM_INCLUDE
    });
    const storedWorkItem = await maybeAttachPlanRun(transaction, createdWorkItem as StoredPlanWorkItem, parsedInput);

    return mapWorkItem(storedWorkItem);
  });
}

export async function updateWorkItem(
  workItemId: string,
  input: UpdateWorkItemPatchInput,
  options: PlanningPersistenceOptions = {}
): Promise<void> {
  const prisma = await getPrismaClient(options.databaseUrl);
  const parsedInput = UpdateWorkItemInputSchema.parse(input);
  const updateResult = await prisma.planWorkItem.updateMany({
    data: buildWorkItemUpdateInput(parsedInput),
    where: {
      id: workItemId
    }
  });

  if (updateResult.count === 0) {
    throw new PlanningNotFoundError(`Planning work item ${workItemId} was not found.`);
  }
}

export async function updateTaskStatus(
  workItemId: string,
  taskId: string,
  status: WorkItemTaskStatus,
  options: PlanningPersistenceOptions = {}
): Promise<void> {
  const prisma = await getPrismaClient(options.databaseUrl);
  const updateResult = await prisma.planWorkItemTask.updateMany({
    data: {
      status
    },
    where: {
      id: taskId,
      workItemId
    }
  });

  if (updateResult.count === 0) {
    throw new PlanningNotFoundError(`Planning task ${taskId} was not found for ${workItemId}.`);
  }
}

export async function updateAcceptanceCriterionStatus(
  workItemId: string,
  criterionId: string,
  status: AcceptanceCriterionStatus,
  options: PlanningPersistenceOptions = {}
): Promise<void> {
  const prisma = await getPrismaClient(options.databaseUrl);
  const updateResult = await prisma.planAcceptanceCriterion.updateMany({
    data: {
      status
    },
    where: {
      id: criterionId,
      workItemId
    }
  });

  if (updateResult.count === 0) {
    throw new PlanningNotFoundError(`Planning acceptance criterion ${criterionId} was not found for ${workItemId}.`);
  }
}

function buildSummary(workItems: WorkItem[]): PlanningWorkspace["summary"] {
  return {
    activeItems: workItems.filter((item) => item.status === "in-progress").length,
    backlogItems: workItems.filter((item) => item.status === "backlog" || item.status === "planning").length,
    blockedItems: workItems.filter((item) => item.status === "blocked").length,
    doneItems: workItems.filter((item) => item.status === "done").length,
    readyItems: workItems.filter((item) => item.status === "ready").length,
    totalItems: workItems.length
  };
}

function buildWorkItemCreateData(
  input: ReturnType<typeof CreateWorkItemInputSchema.parse>,
  sequence: number
): Prisma.PlanWorkItemCreateInput {
  return {
    acceptanceCriteria: {
      create: input.acceptanceCriteria.map((criterion, index) => ({
        id: randomUUID(),
        sequence: index,
        status: "pending",
        title: criterion
      }))
    },
    blockedByDependencies: {
      create: input.blockedByWorkItemIds.map((blockingWorkItemId) => ({
        blockingWorkItemId
      }))
    },
    id: `PLAN-${sequence.toString()}`,
    kind: input.kind,
    priority: input.priority,
    sequence,
    status: "backlog",
    summary: input.summary,
    tasks: {
      create: input.tasks.map((task, index) => ({
        id: randomUUID(),
        sequence: index,
        status: "todo",
        title: task
      }))
    },
    title: input.title,
    ...(input.auditWorkflowRunId === undefined ? {} : { auditWorkflowRunId: input.auditWorkflowRunId }),
    ...(input.owner === undefined ? {} : { owner: input.owner }),
    ...(input.targetIteration === undefined ? {} : { targetIteration: input.targetIteration })
  };
}

async function maybeAttachPlanRun(
  transaction: Prisma.TransactionClient,
  createdWorkItem: StoredPlanWorkItem,
  input: ReturnType<typeof CreateWorkItemInputSchema.parse>
): Promise<StoredPlanWorkItem> {
  const planInput = input.plan;

  if (planInput === undefined) {
    return createdWorkItem;
  }

  const updatedWorkItem = await transaction.planWorkItem.update({
    data: {
      planRuns: {
        create: buildPlanRunCreateData(planInput)
      }
    },
    include: PLAN_WORK_ITEM_INCLUDE,
    where: {
      id: createdWorkItem.id
    }
  });

  return updatedWorkItem as StoredPlanWorkItem;
}

function buildPlanRunCreateData(
  planInput: NonNullable<ReturnType<typeof CreateWorkItemInputSchema.parse>["plan"]>
): Prisma.PlanRunCreateWithoutWorkItemInput {
  return {
    id: randomUUID(),
    mode: planInput.mode,
    status: "draft",
    steps: {
      create: planInput.steps.map((step, index) => ({
        id: randomUUID(),
        phase: inferPlanStepPhase(index, planInput.steps.length),
        sequence: index,
        status: "pending",
        title: step
      }))
    },
    summary: planInput.summary,
    ...(planInput.auditWorkflowRunId === undefined ? {} : { auditWorkflowRunId: planInput.auditWorkflowRunId })
  };
}

function buildWorkItemUpdateInput(input: UpdateWorkItemInput): Prisma.PlanWorkItemUpdateManyMutationInput {
  const updateInput: Prisma.PlanWorkItemUpdateManyMutationInput = {};

  if (input.auditWorkflowRunId !== undefined) {
    updateInput.auditWorkflowRunId = input.auditWorkflowRunId;
  }

  if (input.owner !== undefined) {
    updateInput.owner = input.owner;
  }

  if (input.priority !== undefined) {
    updateInput.priority = input.priority;
  }

  if (input.status !== undefined) {
    updateInput.status = input.status;
  }

  if (input.targetIteration !== undefined) {
    updateInput.targetIteration = input.targetIteration;
  }

  return updateInput;
}

async function ensureDependenciesExist(
  transaction: Prisma.TransactionClient,
  blockedByWorkItemIds: string[]
): Promise<void> {
  if (blockedByWorkItemIds.length === 0) {
    return;
  }

  const dependencyCount = await transaction.planWorkItem.count({
    where: {
      id: {
        in: blockedByWorkItemIds
      }
    }
  });

  if (dependencyCount !== blockedByWorkItemIds.length) {
    throw new PlanningNotFoundError("One or more dependency work items were not found.");
  }
}

async function getNextWorkItemSequence(transaction: Prisma.TransactionClient): Promise<number> {
  const currentMax = await transaction.planWorkItem.aggregate({
    _max: {
      sequence: true
    }
  });

  return (currentMax._max.sequence ?? 0) + 1;
}

function inferPlanStepPhase(index: number, totalSteps: number): "design" | "implementation" | "research" | "validation" {
  if (index === 0) {
    return "research";
  }

  if (index === totalSteps - 1) {
    return "validation";
  }

  return index === 1 ? "design" : "implementation";
}

function mapWorkItem(record: StoredPlanWorkItem): WorkItem {
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
