import { randomUUID } from "node:crypto";

import type {
  CreateWorkItemInput,
  PlanningWorkspace,
  UpdateWorkItemInput,
  WorkItem
} from "@taxes/shared";
import type { Prisma, PrismaClient } from "@prisma/client";

export class PlanningConflictError extends Error {}
export class PlanningNotFoundError extends Error {}

const DEFAULT_PROJECTS = [
  {
    description: "Planning systems, agent workflows, backlog hygiene, and delivery orchestration.",
    key: "planning",
    name: "Planning",
    sortOrder: 0
  },
  {
    description: "Audit capture, workflow telemetry, and review tooling.",
    key: "audit",
    name: "Audit",
    sortOrder: 1
  },
  {
    description: "Tax document processing, extraction, and filing workflows.",
    key: "taxes",
    name: "Taxes",
    sortOrder: 2
  },
  {
    description: "Human-centered pull request review, trust-building walkthroughs, and diff understanding.",
    key: "code-review",
    name: "Code Review",
    sortOrder: 3
  },
  {
    description: "Agent knowledge, long-term memory, research capture, and human-alignment surfaces.",
    key: "knowledge",
    name: "Knowledge",
    sortOrder: 4
  }
] as const;
export const PLAN_WORK_ITEM_INCLUDE = {
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
  project: true,
  tasks: {
    orderBy: {
      sequence: "asc"
    }
  }
} as const;

export type PrismaClientLike = PrismaClient | Prisma.TransactionClient;
export type StoredPlanProject = Prisma.PlanProjectGetPayload<Record<string, never>>;
export type StoredPlanWorkItem = Prisma.PlanWorkItemGetPayload<{
  include: typeof PLAN_WORK_ITEM_INCLUDE;
}>;

export function buildSummary(workItems: WorkItem[]): PlanningWorkspace["summary"] {
  return {
    activeItems: workItems.filter((item) => item.status === "in-progress").length,
    backlogItems: workItems.filter((item) => item.status === "backlog" || item.status === "planning").length,
    blockedItems: workItems.filter((item) => item.status === "blocked").length,
    doneItems: workItems.filter((item) => item.status === "done").length,
    readyItems: workItems.filter((item) => item.status === "ready").length,
    totalItems: workItems.length
  };
}

export function buildWorkItemCreateData(input: CreateWorkItemInput, sequence: number): Prisma.PlanWorkItemCreateInput {
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
    project: {
      connect: {
        key: input.projectKey
      }
    },
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

export function buildWorkItemUpdateData(
  existingWorkItem: StoredPlanWorkItem,
  input: UpdateWorkItemInput
): Prisma.PlanWorkItemUpdateInput {
  return {
    ...buildScalarUpdateData(input),
    ...buildAcceptanceCriteriaUpdate(existingWorkItem, input),
    ...buildDependencyUpdate(input),
    ...buildPlanRunUpdate(input),
    ...buildProjectUpdate(input),
    ...buildTaskUpdate(existingWorkItem, input)
  };
}

export function buildPlanRunCreateData(
  planInput: NonNullable<CreateWorkItemInput["plan"]>
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

export async function ensureDefaultProjects(client: PrismaClientLike): Promise<void> {
  const existingProjects = await client.planProject.findMany({
    select: {
      key: true
    },
    where: {
      key: {
        in: DEFAULT_PROJECTS.map((project) => project.key)
      }
    }
  });
  const existingKeys = new Set(existingProjects.map((project) => project.key));

  for (const project of DEFAULT_PROJECTS) {
    if (existingKeys.has(project.key)) {
      continue;
    }

    await client.planProject.create({
      data: {
        description: project.description,
        id: randomUUID(),
        isActive: true,
        key: project.key,
        name: project.name,
        sortOrder: project.sortOrder
      }
    });
  }
}

export async function ensureDependenciesExist(
  client: PrismaClientLike,
  blockedByWorkItemIds: string[],
  currentWorkItemId?: string
): Promise<void> {
  if (blockedByWorkItemIds.length === 0) {
    return;
  }

  if (currentWorkItemId !== undefined && blockedByWorkItemIds.includes(currentWorkItemId)) {
    throw new PlanningConflictError("A work item cannot depend on itself.");
  }

  const dependencyCount = await client.planWorkItem.count({
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

export async function ensureProjectExists(client: PrismaClientLike, projectKey: string): Promise<void> {
  const project = await client.planProject.findUnique({
    where: {
      key: projectKey
    }
  });

  if (project === null) {
    throw new PlanningNotFoundError(`Planning project ${projectKey} was not found.`);
  }
}

export async function getNextProjectSortOrder(client: PrismaClientLike): Promise<number> {
  const currentMax = await client.planProject.aggregate({
    _max: {
      sortOrder: true
    }
  });

  return (currentMax._max.sortOrder ?? -1) + 1;
}

export async function getNextWorkItemSequence(client: PrismaClientLike): Promise<number> {
  const currentMax = await client.planWorkItem.aggregate({
    _max: {
      sequence: true
    }
  });

  return (currentMax._max.sequence ?? 0) + 1;
}

export async function readProjectSortOrder(client: PrismaClientLike): Promise<Map<string, number>> {
  const projects = await client.planProject.findMany({
    orderBy: [{ sortOrder: "asc" }, { key: "asc" }]
  });

  return new Map(projects.map((project) => [project.key, project.sortOrder]));
}

function buildAcceptanceCriteriaUpdate(
  existingWorkItem: StoredPlanWorkItem,
  input: UpdateWorkItemInput
): Prisma.PlanWorkItemUpdateInput {
  if (input.acceptanceCriteriaAdditions === undefined || input.acceptanceCriteriaAdditions.length === 0) {
    return {};
  }

  const startSequence = getNextSequence(existingWorkItem.acceptanceCriteria);

  return {
    acceptanceCriteria: {
      create: input.acceptanceCriteriaAdditions.map((criterion, index) => ({
        id: randomUUID(),
        sequence: startSequence + index,
        status: "pending",
        title: criterion
      }))
    }
  };
}

function buildDependencyUpdate(input: UpdateWorkItemInput): Prisma.PlanWorkItemUpdateInput {
  if (input.blockedByWorkItemIds === undefined) {
    return {};
  }

  return {
    blockedByDependencies: {
      create: input.blockedByWorkItemIds.map((blockingWorkItemId) => ({
        blockingWorkItemId
      })),
      deleteMany: {}
    }
  };
}

function buildPlanRunUpdate(input: UpdateWorkItemInput): Prisma.PlanWorkItemUpdateInput {
  if (input.plan === undefined) {
    return {};
  }

  return {
    planRuns: {
      create: buildPlanRunCreateData(input.plan)
    }
  };
}

function buildProjectUpdate(input: UpdateWorkItemInput): Prisma.PlanWorkItemUpdateInput {
  if (input.projectKey === undefined) {
    return {};
  }

  return {
    project: {
      connect: {
        key: input.projectKey
      }
    }
  };
}

function buildScalarUpdateData(input: UpdateWorkItemInput): Prisma.PlanWorkItemUpdateInput {
  return {
    ...(input.auditWorkflowRunId === undefined ? {} : { auditWorkflowRunId: input.auditWorkflowRunId }),
    ...(input.owner === undefined ? {} : { owner: input.owner }),
    ...(input.priority === undefined ? {} : { priority: input.priority }),
    ...(input.status === undefined ? {} : { status: input.status }),
    ...(input.summary === undefined ? {} : { summary: input.summary }),
    ...(input.targetIteration === undefined ? {} : { targetIteration: input.targetIteration }),
    ...(input.title === undefined ? {} : { title: input.title })
  };
}

function buildTaskUpdate(
  existingWorkItem: StoredPlanWorkItem,
  input: UpdateWorkItemInput
): Prisma.PlanWorkItemUpdateInput {
  if (input.taskAdditions === undefined || input.taskAdditions.length === 0) {
    return {};
  }

  const startSequence = getNextSequence(existingWorkItem.tasks);

  return {
    tasks: {
      create: input.taskAdditions.map((task, index) => ({
        id: randomUUID(),
        sequence: startSequence + index,
        status: "todo",
        title: task
      }))
    }
  };
}

function getNextSequence(records: readonly { sequence: number }[]): number {
  return records.reduce((currentMax, record) => Math.max(currentMax, record.sequence), -1) + 1;
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
