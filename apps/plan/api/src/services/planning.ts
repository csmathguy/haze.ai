import { randomUUID } from "node:crypto";

import type {
  AcceptanceCriterionStatus,
  CreatePlanningProjectDraftInput,
  CreateWorkItemDraftInput,
  NextWorkItemDraftInput,
  PlanningProject,
  PlanningWorkspace,
  UpdateWorkItemPatchInput,
  WorkItem,
  WorkItemTaskStatus
} from "@taxes/shared";
import {
  CreatePlanningProjectInputSchema,
  CreateWorkItemInputSchema,
  NextWorkItemInputSchema,
  PlanningWorkspaceSchema,
  UpdateWorkItemInputSchema
} from "@taxes/shared";
import type { Prisma } from "@prisma/client";

import { getPrismaClient } from "../db/client.js";
import type { PlanningPersistenceOptions } from "./context.js";
import {
  buildPlanRunCreateData,
  buildSummary,
  buildWorkItemCreateData,
  buildWorkItemUpdateData,
  ensureDefaultProjects,
  ensureDependenciesExist,
  ensureProjectExists,
  getNextProjectSortOrder,
  getNextWorkItemSequence,
  PLAN_WORK_ITEM_INCLUDE,
  PlanningConflictError,
  PlanningNotFoundError,
  readProjectSortOrder
} from "./planning-support.js";
import { compareNextWorkItems, compareWorkItems, mapProject, mapWorkItem } from "./planning-mapping.js";
import type { StoredPlanWorkItem } from "./planning-support.js";

export { PlanningConflictError, PlanningNotFoundError } from "./planning-support.js";

export async function getPlanningWorkspace(options: PlanningPersistenceOptions = {}): Promise<PlanningWorkspace> {
  const prisma = await getPrismaClient(options.databaseUrl);
  await ensureDefaultProjects(prisma);

  const [projectRecords, workItemRecords] = await Promise.all([
    prisma.planProject.findMany({
      orderBy: [{ sortOrder: "asc" }, { key: "asc" }]
    }),
    prisma.planWorkItem.findMany({
      include: PLAN_WORK_ITEM_INCLUDE,
      orderBy: [{ sequence: "asc" }]
    })
  ]);
  const projects = projectRecords.map(mapProject);
  const projectSortOrder = new Map(projects.map((project) => [project.key, project.sortOrder]));
  const workItems = workItemRecords.map(mapWorkItem).sort((left, right) => compareWorkItems(left, right, projectSortOrder));

  return PlanningWorkspaceSchema.parse({
    generatedAt: new Date().toISOString(),
    localOnly: true,
    projects,
    summary: buildSummary(workItems),
    workItems
  });
}

export async function createPlanningProject(
  input: CreatePlanningProjectDraftInput,
  options: PlanningPersistenceOptions = {}
): Promise<PlanningProject> {
  const prisma = await getPrismaClient(options.databaseUrl);
  const parsedInput = CreatePlanningProjectInputSchema.parse(input);

  return prisma.$transaction(async (transaction) => {
    await ensureDefaultProjects(transaction);

    const existingProject = await transaction.planProject.findUnique({
      where: {
        key: parsedInput.key
      }
    });

    if (existingProject !== null) {
      throw new PlanningConflictError(`Planning project ${parsedInput.key} already exists.`);
    }

    const project = await transaction.planProject.create({
      data: {
        id: randomUUID(),
        isActive: true,
        key: parsedInput.key,
        name: parsedInput.name,
        sortOrder: await getNextProjectSortOrder(transaction),
        ...(parsedInput.description === undefined ? {} : { description: parsedInput.description })
      }
    });

    return mapProject(project);
  });
}

export async function createWorkItem(
  input: CreateWorkItemDraftInput,
  options: PlanningPersistenceOptions = {}
): Promise<WorkItem> {
  const prisma = await getPrismaClient(options.databaseUrl);
  const parsedInput = CreateWorkItemInputSchema.parse(input);

  return prisma.$transaction(async (transaction) => {
    await ensureDefaultProjects(transaction);
    await ensureProjectExists(transaction, parsedInput.projectKey);
    await ensureDependenciesExist(transaction, parsedInput.blockedByWorkItemIds);

    const sequence = await getNextWorkItemSequence(transaction);
    const createdWorkItem = await transaction.planWorkItem.create({
      data: buildWorkItemCreateData(parsedInput, sequence),
      include: PLAN_WORK_ITEM_INCLUDE
    });
    const storedWorkItem = await maybeAttachPlanRun(transaction, createdWorkItem.id, parsedInput.plan);

    return mapWorkItem(storedWorkItem);
  });
}

export async function getNextWorkItem(
  input: NextWorkItemDraftInput,
  options: PlanningPersistenceOptions = {}
): Promise<WorkItem | null> {
  const prisma = await getPrismaClient(options.databaseUrl);
  const parsedInput = NextWorkItemInputSchema.parse(input);
  await ensureDefaultProjects(prisma);

  const candidateRecords = await prisma.planWorkItem.findMany({
    include: PLAN_WORK_ITEM_INCLUDE,
    orderBy: [{ sequence: "asc" }],
    where: {
      blockedByDependencies: {
        none: {
          blockingWorkItem: {
            status: {
              not: "done"
            }
          }
        }
      },
      ...(parsedInput.projectKey === undefined
        ? {}
        : {
            project: {
              key: parsedInput.projectKey
            }
          }),
      status: {
        in: ["ready", "planning", "backlog"]
      }
    }
  });

  if (candidateRecords.length === 0) {
    return null;
  }

  const projectSortOrder = await readProjectSortOrder(prisma);
  const nextRecord = candidateRecords.toSorted((left, right) => compareNextWorkItems(left, right, projectSortOrder))[0];

  return nextRecord === undefined ? null : mapWorkItem(nextRecord);
}

export async function updateWorkItem(
  workItemId: string,
  input: UpdateWorkItemPatchInput,
  options: PlanningPersistenceOptions = {}
): Promise<WorkItem> {
  const prisma = await getPrismaClient(options.databaseUrl);
  const parsedInput = UpdateWorkItemInputSchema.parse(input);

  return prisma.$transaction(async (transaction) => {
    await ensureDefaultProjects(transaction);

    const existingWorkItem = await transaction.planWorkItem.findUnique({
      include: PLAN_WORK_ITEM_INCLUDE,
      where: {
        id: workItemId
      }
    });

    if (existingWorkItem === null) {
      throw new PlanningNotFoundError(`Planning work item ${workItemId} was not found.`);
    }

    if (parsedInput.projectKey !== undefined) {
      await ensureProjectExists(transaction, parsedInput.projectKey);
    }

    if (parsedInput.blockedByWorkItemIds !== undefined) {
      await ensureDependenciesExist(transaction, parsedInput.blockedByWorkItemIds, workItemId);
    }

    const updatedWorkItem = await transaction.planWorkItem.update({
      data: buildWorkItemUpdateData(existingWorkItem, parsedInput),
      include: PLAN_WORK_ITEM_INCLUDE,
      where: {
        id: workItemId
      }
    });

    return mapWorkItem(updatedWorkItem);
  });
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

async function maybeAttachPlanRun(
  transaction: Prisma.TransactionClient,
  createdWorkItemId: string,
  planInput: ReturnType<typeof CreateWorkItemInputSchema.parse>["plan"]
): Promise<StoredPlanWorkItem> {
  if (planInput === undefined) {
    return transaction.planWorkItem.findUniqueOrThrow({
      include: PLAN_WORK_ITEM_INCLUDE,
      where: {
        id: createdWorkItemId
      }
    }) as Promise<StoredPlanWorkItem>;
  }

  return transaction.planWorkItem.update({
    data: {
      planRuns: {
        create: buildPlanRunCreateData(planInput)
      }
    },
    include: PLAN_WORK_ITEM_INCLUDE,
    where: {
      id: createdWorkItemId
    }
  }) as Promise<StoredPlanWorkItem>;
}
