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
import type { Prisma } from "@taxes/db";

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

export async function getWorkItemById(workItemId: string, options: PlanningPersistenceOptions = {}): Promise<WorkItem | null> {
  const prisma = await getPrismaClient(options.databaseUrl);
  await ensureDefaultProjects(prisma);

  const record = await prisma.planWorkItem.findUnique({
    include: PLAN_WORK_ITEM_INCLUDE,
    where: {
      id: workItemId
    }
  });

  return record === null ? null : mapWorkItem(record);
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

/**
 * Updates a work item and emits a workflow event if the status changes to "in-progress".
 * This is the gateway-friendly version that handles workflow event emission.
 */
export async function updateWorkItemAndEmitWorkflowEvent(
  workItemId: string,
  input: UpdateWorkItemPatchInput,
  options: PlanningPersistenceOptions = {}
): Promise<WorkItem> {
  // Get the current work item before update to check for status change
  const prisma = await getPrismaClient(options.databaseUrl);
  const existingWorkItem = await prisma.planWorkItem.findUnique({
    include: PLAN_WORK_ITEM_INCLUDE,
    where: { id: workItemId }
  });

  if (existingWorkItem === null) {
    throw new PlanningNotFoundError(`Planning work item ${workItemId} was not found.`);
  }

  // Perform the update using existing logic
  const updatedWorkItem = await updateWorkItem(workItemId, input, options);

  // Check if status changed to "in-progress"
  const newStatus = input.status;
  if (newStatus === "in-progress" && existingWorkItem.status !== "in-progress") {
    // Emit workflow event (outside of transaction as we need the workflow DB)
    await maybeEmitImplementationWorkflowEvent(
      workItemId,
      updatedWorkItem.summary || updatedWorkItem.title,
      options.workflowDatabaseUrl
    );
  }

  return updatedWorkItem;
}

/**
 * Emits a WorkflowEvent when a work item status changes to "in-progress".
 * Requires access to the workflow database URL.
 */
async function maybeEmitImplementationWorkflowEvent(
  workItemId: string,
  summary: string,
  workflowDatabaseUrl?: string
): Promise<void> {
  try {
    // Skip if no workflow database URL is provided
    if (!workflowDatabaseUrl) {
      console.warn(`No workflow database URL provided, skipping event emission for work item ${workItemId}`);
      return;
    }

    // Import the client factory from the db package
    const dbModule = await import("@taxes/db");
    const workflowPrisma = await dbModule.getPrismaClient(workflowDatabaseUrl);

    try {
      await workflowPrisma.workflowEvent.create({
        data: {
          type: "planning.work_item.status_changed",
          source: "planning",
          correlationId: workItemId,
          payload: JSON.stringify({
            workItemId,
            status: "in-progress",
            summary
          })
        }
      });
    } finally {
      // Note: we don't disconnect here to avoid connection pool thrashing
      // The gateway manages the lifecycle
    }
  } catch (error) {
    // Log but don't throw — workflow event emission is best-effort
    console.error(`Failed to emit workflow event for work item ${workItemId}:`, error);
  }
}
