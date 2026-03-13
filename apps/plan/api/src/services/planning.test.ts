import { afterEach, describe, expect, it } from "vitest";
import type { WorkItem } from "@taxes/shared";

import type { TestPlanningContext } from "../test/database.js";
import { createTestPlanningContext } from "../test/database.js";
import {
  createPlanningProject,
  createWorkItem,
  getNextWorkItem,
  getPlanningWorkspace,
  updateAcceptanceCriterionStatus,
  updateTaskStatus,
  updateWorkItem
} from "./planning.js";

describe("planning service", () => {
  const workspaces: TestPlanningContext[] = [];

  afterEach(async () => {
    await Promise.all(workspaces.splice(0, workspaces.length).map(async (workspace) => workspace.cleanup()));
  });

  it("starts with an empty local-only workspace", async () => {
    const workspace = await createTestPlanningContext("planning-service-empty");
    workspaces.push(workspace);
    const snapshot = await getPlanningWorkspace(workspace);

    expect(snapshot.localOnly).toBe(true);
    expect(snapshot.projects.map((project) => project.key)).toEqual(["planning", "audit", "taxes"]);
    expect(snapshot.summary.totalItems).toBe(0);
    expect(snapshot.workItems).toEqual([]);
  });

  it("stores project-scoped work items with tasks, acceptance criteria, dependencies, and plan steps", async () => {
    const workspace = await createTestPlanningContext("planning-service-create");
    workspaces.push(workspace);
    const prerequisite = await createWorkItem(
      {
        kind: "spike",
        projectKey: "planning",
        priority: "medium",
        summary: "Establish the planning data model.",
        title: "Planning schema spike"
      },
      workspace
    );
    const createdItem = await createWorkItem(
      {
        acceptanceCriteria: ["Checklist data is stored", "A planning key is generated"],
        blockedByWorkItemIds: [prerequisite.id],
        kind: "feature",
        plan: {
          mode: "parallel-agents",
          steps: ["Research options", "Persist the chosen plan", "Validate quality gates"],
          summary: "Implementation plan for the planning backlog."
        },
        priority: "high",
        projectKey: "planning",
        summary: "Capture the first version of planning metadata for autonomous agent work.",
        tasks: ["Create the domain model", "Add API endpoints", "Render the backlog view"],
        title: "Planning work item foundation"
      },
      workspace
    );

    expect(createdItem.id).toBe("PLAN-2");
    expect(createdItem.blockedByWorkItemIds).toEqual([prerequisite.id]);
    expect(createdItem.projectKey).toBe("planning");
    expect(createdItem.tasks).toHaveLength(3);
    expect(createdItem.acceptanceCriteria).toHaveLength(2);
    expect(createdItem.planRuns[0]?.steps).toHaveLength(3);
  });

  it("updates work item metadata and can enrich tasks, acceptance criteria, and plan runs", async () => {
    const workspace = await createTestPlanningContext("planning-service-update");
    workspaces.push(workspace);
    const createdItem = await createStatusUpdateFixture(workspace);

    await applyEnrichedWorkItemUpdate(createdItem, workspace);

    const snapshot = await getPlanningWorkspace(workspace);
    const updatedItem = snapshot.workItems[0];

    expectEnrichedWorkItem(updatedItem);
  });

  it("creates custom projects and selects the next actionable item deterministically", async () => {
    const workspace = await createTestPlanningContext("planning-service-next");
    workspaces.push(workspace);

    await createPlanningProject(
      {
        description: "Shared workflow telemetry and reporting work.",
        key: "ops",
        name: "Operations"
      },
      workspace
    );

    const prerequisite = await createWorkItem(
      {
        kind: "feature",
        priority: "high",
        projectKey: "planning",
        summary: "Build the foundational planning API.",
        title: "Planning API foundation"
      },
      workspace
    );

    const blockedReadyItem = await createWorkItem(
      {
        blockedByWorkItemIds: [prerequisite.id],
        kind: "feature",
        priority: "critical",
        projectKey: "planning",
        summary: "Add claims after the API foundation is complete.",
        title: "Claim workflow"
      },
      workspace
    );
    await updateWorkItem(blockedReadyItem.id, { status: "ready" }, workspace);

    const projectReadyItem = await createWorkItem(
      {
        kind: "task",
        priority: "high",
        projectKey: "planning",
        summary: "Create the first Kanban board slice.",
        title: "Planning Kanban board"
      },
      workspace
    );
    await updateWorkItem(projectReadyItem.id, { status: "ready" }, workspace);

    const otherProjectItem = await createWorkItem(
      {
        kind: "task",
        priority: "critical",
        projectKey: "ops",
        summary: "Improve audit reporting.",
        title: "Operations reporting"
      },
      workspace
    );
    await updateWorkItem(otherProjectItem.id, { status: "ready" }, workspace);

    const nextPlanningItem = await getNextWorkItem({ projectKey: "planning" }, workspace);
    const nextAnyProjectItem = await getNextWorkItem({}, workspace);

    expect(nextPlanningItem?.id).toBe(projectReadyItem.id);
    expect(nextPlanningItem?.projectKey).toBe("planning");
    expect(nextAnyProjectItem?.id).toBe(otherProjectItem.id);
  });
});

async function applyEnrichedWorkItemUpdate(createdItem: WorkItem, workspace: TestPlanningContext): Promise<void> {
  const firstTaskId = createdItem.tasks[0]?.id ?? "";
  const firstCriterionId = createdItem.acceptanceCriteria[0]?.id ?? "";

  await updateWorkItem(
    createdItem.id,
    {
      acceptanceCriteriaAdditions: ["The backlog item documents follow-up work"],
      auditWorkflowRunId: "2026-03-11T210000-000-implementation-example",
      owner: "codex",
      plan: {
        mode: "single-agent",
        steps: ["Reframe the task", "Update the checklist", "Validate the resulting state"],
        summary: "Refined implementation plan after discovery."
      },
      status: "in-progress",
      summary: "Keep project-scoped planning state current as implementation evolves.",
      taskAdditions: ["Capture follow-up backlog candidates"],
      title: "Update planning work item status"
    },
    workspace
  );
  await updateTaskStatus(createdItem.id, firstTaskId, "done", workspace);
  await updateAcceptanceCriterionStatus(createdItem.id, firstCriterionId, "passed", workspace);
}

async function createStatusUpdateFixture(workspace: TestPlanningContext): Promise<WorkItem> {
  return createWorkItem(
    {
      acceptanceCriteria: ["Validation passes"],
      kind: "feature",
      priority: "high",
      projectKey: "planning",
      summary: "Keep planning state current.",
      tasks: ["Run the tests"],
      title: "Update planning status"
    },
    workspace
  );
}

function expectEnrichedWorkItem(updatedItem: WorkItem | undefined): void {
  expect(updatedItem).toEqual(
    expect.objectContaining({
      auditWorkflowRunId: "2026-03-11T210000-000-implementation-example",
      owner: "codex",
      status: "in-progress"
    })
  );
  expectEnrichedChecklist(updatedItem);
  expectEnrichedPlan(updatedItem);
}

function expectEnrichedChecklist(updatedItem: WorkItem | undefined): void {
  expect(updatedItem?.title).toBe("Update planning work item status");
  expect(updatedItem?.summary).toContain("project-scoped");
  expect(updatedItem?.tasks.map((task) => task.title)).toContain("Capture follow-up backlog candidates");
  expect(updatedItem?.tasks[0]?.status).toBe("done");
  expect(updatedItem?.acceptanceCriteria.map((criterion) => criterion.title)).toContain(
    "The backlog item documents follow-up work"
  );
  expect(updatedItem?.acceptanceCriteria[0]?.status).toBe("passed");
}

function expectEnrichedPlan(updatedItem: WorkItem | undefined): void {
  expect(updatedItem?.planRuns).toHaveLength(1);
  expect(updatedItem?.planRuns[0]?.summary).toBe("Refined implementation plan after discovery.");
}
