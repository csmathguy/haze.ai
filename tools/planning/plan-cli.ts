import { readFile } from "node:fs/promises";
import * as path from "node:path";

import type {
  CreateWorkItemInput,
  PlanningWorkspace,
  WorkItemStatus
} from "@taxes/shared";
import {
  CreatePlanningProjectInputSchema,
  CreateWorkItemInputSchema,
  NextWorkItemInputSchema,
  UpdateAcceptanceCriterionStatusInputSchema,
  UpdateWorkItemInputSchema,
  UpdateWorkItemTaskStatusInputSchema,
  WorkItemIdSchema
} from "@taxes/shared";

import { PLANNING_DATABASE_URL } from "../../apps/plan/api/src/config.js";
import { applyPendingMigrations } from "../../apps/plan/api/src/db/migrations.js";
import {
  createPlanningProject,
  createWorkItem,
  getNextWorkItem,
  getPlanningWorkspace,
  updateAcceptanceCriterionStatus,
  updateTaskStatus,
  updateWorkItem
} from "../../apps/plan/api/src/services/planning.js";
import { CODE_REVIEW_SEED_ITEMS } from "./mvp-seed-data.js";

type CommandHandler = (args: string[]) => Promise<unknown>;

const commandHandlers = new Map<string, CommandHandler>([
  ["criterion:set-status", handleCriterionSetStatus],
  ["project:create", handleProjectCreate],
  ["project:list", handleProjectList],
  ["seed:mvp", handleSeedMvp],
  ["task:set-status", handleTaskSetStatus],
  ["work-item:create", handleWorkItemCreate],
  ["work-item:next", handleWorkItemNext],
  ["work-item:update", handleWorkItemUpdate],
  ["workspace:get", handleWorkspaceGet]
]);
interface SeedWorkItem extends CreateWorkItemInput {
  readonly status?: WorkItemStatus;
}

const MVP_SEED_ITEMS: SeedWorkItem[] = [
  {
    acceptanceCriteria: [
      "The planning web app can display backlog items grouped by status.",
      "Users can drag or move items between columns without losing project context.",
      "The board highlights blocked items and WIP counts."
    ],
    blockedByWorkItemIds: [],
    kind: "feature",
    plan: {
      mode: "single-agent",
      steps: ["Confirm board interaction patterns", "Implement board queries and UI", "Validate drag or move interactions"],
      summary: "Add the first Kanban board slice for planning operations."
    },
    priority: "high",
    projectKey: "planning",
    status: "ready",
    summary: "Add a Kanban board so work flows are visible across backlog, ready, in-progress, blocked, and done.",
    tasks: ["Design board data shape", "Render grouped columns", "Persist status changes from the board"],
    title: "Kanban board MVP"
  },
  {
    acceptanceCriteria: [
      "Agents can claim a work item before implementation starts.",
      "The planning record stores the claiming agent and related workflow run ID.",
      "Stale or conflicting claims are detectable."
    ],
    blockedByWorkItemIds: [],
    kind: "feature",
    priority: "high",
    projectKey: "planning",
    summary: "Add a claim or lease mechanism so parallel agents do not collide on the same work item.",
    tasks: ["Model claim metadata", "Expose claim and release operations", "Surface claim state in the UI"],
    title: "Work item claim and lease flow"
  },
  {
    acceptanceCriteria: [
      "Planning sessions can create or refine project-scoped work items through a stable local command surface.",
      "The skill captures acceptance criteria, tasks, dependencies, and plan runs in one pass.",
      "The workflow can create follow-up backlog items when work is deferred."
    ],
    blockedByWorkItemIds: [],
    kind: "feature",
    priority: "high",
    projectKey: "planning",
    status: "planning",
    summary: "Harden the planning-session skill so research, decomposition, and backlog persistence are consistent.",
    tasks: ["Expand planning-session prompts", "Add examples for backlog splitting", "Validate the CLI workflow in docs"],
    title: "Planning session skill hardening"
  },
  {
    acceptanceCriteria: [
      "Audit runs can link back to a work item without manual file inspection.",
      "Planning can see the latest workflow outcome for a linked audit run.",
      "The integration stays loosely coupled across the two databases."
    ],
    blockedByWorkItemIds: [],
    kind: "feature",
    priority: "medium",
    projectKey: "audit",
    summary: "Connect planning and audit through stable IDs and lightweight summary data instead of manual correlation.",
    tasks: ["Define linkage fields", "Show audit references in planning views", "Document the cross-system contract"],
    title: "Audit linkage for planning work items"
  },
  {
    acceptanceCriteria: [
      "The taxes backlog can hold project-scoped improvement stories alongside planning and audit items.",
      "Tax workflow items keep the same planning shape as other projects.",
      "Cross-project prioritization remains deterministic."
    ],
    blockedByWorkItemIds: [],
    kind: "maintenance",
    priority: "medium",
    projectKey: "taxes",
    summary: "Seed the taxes project with backlog conventions that match the planning and audit projects.",
    tasks: ["Identify the first tax workflow improvements", "Capture acceptance criteria", "Validate cross-project selection rules"],
    title: "Taxes project backlog bootstrap"
  },
  ...CODE_REVIEW_SEED_ITEMS,
  {
    acceptanceCriteria: [
      "The repository exposes a first-class knowledge project alongside planning, audit, taxes, and code review.",
      "A local knowledge API and web shell exist with the same validation guardrails as the other products.",
      "The MVP can store structured human profiles and typed knowledge entries for agent memory."
    ],
    blockedByWorkItemIds: [],
    kind: "feature",
    plan: {
      mode: "parallel-agents",
      steps: [
        "Research agent memory and knowledge-system patterns",
        "Design the initial knowledge schema and shared contracts",
        "Scaffold the API, web app, and migration path for repository docs",
        "Validate typecheck, lint, tests, and architecture rules"
      ],
      summary: "Stand up the first knowledge product slice for long-term agent memory and shared research."
    },
    priority: "critical",
    projectKey: "knowledge",
    status: "ready",
    summary:
      "Create the first knowledge product slice so agents and humans can store and browse long-term memory, research, and notes in a local database instead of scattered docs.",
    tasks: [
      "Add the knowledge project type and shared planning support",
      "Model subjects and knowledge entries for agent memory",
      "Build the local API and web workspace",
      "Seed or migrate repository docs into the knowledge store"
    ],
    title: "Knowledge product MVP scaffold"
  },
  {
    acceptanceCriteria: [
      "Knowledge supports explicit relationships across humans, technologies, workflows, and projects.",
      "Agents can retrieve scoped memory through purpose-built read and write flows instead of broad scans.",
      "The product records provenance, review state, and freshness for derived knowledge."
    ],
    blockedByWorkItemIds: [],
    kind: "epic",
    priority: "high",
    projectKey: "knowledge",
    summary:
      "Expand the MVP into a durable memory system with graph relationships, stronger retrieval affordances, and better provenance modeling.",
    tasks: [
      "Add relationships and namespace-aware retrieval",
      "Improve freshness and review workflows",
      "Introduce richer agent-memory query surfaces"
    ],
    title: "Knowledge graph and retrieval expansion"
  },
  {
    acceptanceCriteria: [
      "Agents can continuously ingest research outputs into knowledge with minimal manual reshaping.",
      "Existing repository docs have a managed migration or synchronization workflow into knowledge entries.",
      "Human-facing views can render structured research reports and notes cleanly."
    ],
    blockedByWorkItemIds: [],
    kind: "feature",
    priority: "high",
    projectKey: "knowledge",
    summary:
      "Build the durable ingestion path from repository research and documentation into the knowledge store so memory stays current.",
    tasks: [
      "Design doc-to-entry migration rules",
      "Add sync tooling for repository docs and research outputs",
      "Improve structured report rendering in the web app"
    ],
    title: "Knowledge ingestion and doc migration pipeline"
  }
];

async function main(): Promise<void> {
  const [group, action, ...restArgs] = process.argv.slice(2);
  const commandKey = `${group ?? ""}:${action ?? ""}`;
  const handler = commandHandlers.get(commandKey);

  if (handler === undefined) {
    throw new Error(`Unknown command '${commandKey}'. Expected one of: ${[...commandHandlers.keys()].join(", ")}`);
  }

  await applyPendingMigrations(PLANNING_DATABASE_URL);
  const result = await handler(restArgs);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

async function handleWorkspaceGet(): Promise<{ workspace: PlanningWorkspace }> {
  return {
    workspace: await getPlanningWorkspace()
  };
}

async function handleProjectList(): Promise<{ projects: PlanningWorkspace["projects"] }> {
  const workspace = await getPlanningWorkspace();

  return {
    projects: workspace.projects
  };
}

async function handleProjectCreate(args: string[]): Promise<{ project: Awaited<ReturnType<typeof createPlanningProject>> }> {
  const key = readRequiredFlag(args, "--key");
  const name = readRequiredFlag(args, "--name");
  const description = readOptionalFlag(args, "--description");
  const input = CreatePlanningProjectInputSchema.parse({
    description,
    key,
    name
  });

  return {
    project: await createPlanningProject(input)
  };
}

async function handleWorkItemCreate(args: string[]): Promise<{ workItem: Awaited<ReturnType<typeof createWorkItem>> }> {
  const input = await readJsonFileFlag(args, "--json-file", CreateWorkItemInputSchema);

  return {
    workItem: await createWorkItem(input)
  };
}

async function handleWorkItemUpdate(args: string[]): Promise<{ workItem: Awaited<ReturnType<typeof updateWorkItem>> }> {
  const workItemId = WorkItemIdSchema.parse(readRequiredFlag(args, "--id"));
  const input = await readJsonFileFlag(args, "--json-file", UpdateWorkItemInputSchema);

  return {
    workItem: await updateWorkItem(workItemId, input)
  };
}

async function handleWorkItemNext(args: string[]): Promise<{ workItem: Awaited<ReturnType<typeof getNextWorkItem>> }> {
  const input = NextWorkItemInputSchema.parse({
    projectKey: readOptionalFlag(args, "--project-key")
  });

  return {
    workItem: await getNextWorkItem(input)
  };
}

async function handleTaskSetStatus(args: string[]): Promise<{ ok: true }> {
  const workItemId = WorkItemIdSchema.parse(readRequiredFlag(args, "--work-item-id"));
  const taskId = readRequiredFlag(args, "--task-id");
  const input = UpdateWorkItemTaskStatusInputSchema.parse({
    status: readRequiredFlag(args, "--status")
  });

  await updateTaskStatus(workItemId, taskId, input.status);

  return { ok: true };
}

async function handleCriterionSetStatus(args: string[]): Promise<{ ok: true }> {
  const workItemId = WorkItemIdSchema.parse(readRequiredFlag(args, "--work-item-id"));
  const criterionId = readRequiredFlag(args, "--criterion-id");
  const input = UpdateAcceptanceCriterionStatusInputSchema.parse({
    status: readRequiredFlag(args, "--status")
  });

  await updateAcceptanceCriterionStatus(workItemId, criterionId, input.status);

  return { ok: true };
}

async function handleSeedMvp(): Promise<{ createdWorkItems: string[]; totalWorkItems: number }> {
  const workspace = await getPlanningWorkspace();
  const existingItems = new Map(workspace.workItems.map((workItem) => [`${workItem.projectKey}:${workItem.title}`, workItem]));
  const createdWorkItems: string[] = [];

  for (const item of MVP_SEED_ITEMS) {
    const key = `${item.projectKey}:${item.title}`;
    const existingItem = existingItems.get(key);

    if (existingItem !== undefined) {
      await syncSeedStatus(existingItem.id, existingItem.status, item.status);
      continue;
    }

    const created = await createWorkItem(stripSeedStatus(item));
    createdWorkItems.push(created.id);
    existingItems.set(key, created);
    await syncSeedStatus(created.id, created.status, item.status);
  }

  return {
    createdWorkItems,
    totalWorkItems: (await getPlanningWorkspace()).workItems.length
  };
}

function stripSeedStatus(item: SeedWorkItem): CreateWorkItemInput {
  const createInput = { ...item };
  delete createInput.status;

  return createInput;
}

async function syncSeedStatus(workItemId: string, currentStatus: WorkItemStatus, targetStatus: WorkItemStatus | undefined): Promise<void> {
  if (targetStatus === undefined || currentStatus === targetStatus) {
    return;
  }

  await updateWorkItem(workItemId, {
    status: targetStatus
  });
}

function readOptionalFlag(args: string[], flagName: string): string | undefined {
  const index = args.indexOf(flagName);

  if (index === -1) {
    return undefined;
  }

  const value = args[index + 1];

  if (value === undefined) {
    throw new Error(`Missing value after ${flagName}.`);
  }

  return value;
}

function readRequiredFlag(args: string[], flagName: string): string {
  const value = readOptionalFlag(args, flagName);

  if (value === undefined) {
    throw new Error(`Pass ${flagName}.`);
  }

  return value;
}

async function readJsonFileFlag<TSchemaOutput>(
  args: string[],
  flagName: string,
  schema: { parse: (value: unknown) => TSchemaOutput }
): Promise<TSchemaOutput> {
  const filePath = readRequiredFlag(args, flagName);
  const rawContent = await readFile(path.resolve(filePath), "utf8");

  return schema.parse(JSON.parse(rawContent) as unknown);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
