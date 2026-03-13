import { afterEach, describe, expect, it } from "vitest";

import type { TestPlanningContext } from "../test/database.js";
import { createTestPlanningContext } from "../test/database.js";
import {
  createWorkItem,
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
    expect(snapshot.summary.totalItems).toBe(0);
    expect(snapshot.workItems).toEqual([]);
  });

  it("stores work items with tasks, acceptance criteria, dependencies, and plan steps", async () => {
    const workspace = await createTestPlanningContext("planning-service-create");
    workspaces.push(workspace);
    const prerequisite = await createWorkItem(
      {
        kind: "spike",
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
        summary: "Capture the first version of planning metadata for autonomous agent work.",
        tasks: ["Create the domain model", "Add API endpoints", "Render the backlog view"],
        title: "Planning work item foundation"
      },
      workspace
    );

    expect(createdItem.id).toBe("PLAN-2");
    expect(createdItem.blockedByWorkItemIds).toEqual([prerequisite.id]);
    expect(createdItem.tasks).toHaveLength(3);
    expect(createdItem.acceptanceCriteria).toHaveLength(2);
    expect(createdItem.planRuns[0]?.steps).toHaveLength(3);
  });

  it("updates work item, task, and acceptance criterion status", async () => {
    const workspace = await createTestPlanningContext("planning-service-update");
    workspaces.push(workspace);
    const createdItem = await createWorkItem(
      {
        acceptanceCriteria: ["Validation passes"],
        kind: "feature",
        priority: "high",
        summary: "Keep planning state current.",
        tasks: ["Run the tests"],
        title: "Update planning status"
      },
      workspace
    );
    const firstTaskId = createdItem.tasks[0]?.id;
    const firstCriterionId = createdItem.acceptanceCriteria[0]?.id;

    await updateWorkItem(
      createdItem.id,
      {
        auditWorkflowRunId: "2026-03-11T210000-000-implementation-example",
        status: "in-progress"
      },
      workspace
    );
    await updateTaskStatus(createdItem.id, firstTaskId ?? "", "done", workspace);
    await updateAcceptanceCriterionStatus(createdItem.id, firstCriterionId ?? "", "passed", workspace);

    const snapshot = await getPlanningWorkspace(workspace);
    const updatedItem = snapshot.workItems[0];

    expect(updatedItem).toEqual(
      expect.objectContaining({
        auditWorkflowRunId: "2026-03-11T210000-000-implementation-example",
        status: "in-progress"
      })
    );
    expect(updatedItem?.tasks[0]?.status).toBe("done");
    expect(updatedItem?.acceptanceCriteria[0]?.status).toBe("passed");
  });
});
