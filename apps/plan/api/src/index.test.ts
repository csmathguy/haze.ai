import * as path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import type { PlanningWorkspace } from "@taxes/shared";

import { buildApp } from "./app.js";
import type { TestPlanningContext } from "./test/database.js";
import { createTestPlanningContext } from "./test/database.js";

interface PlanningWorkspaceResponse {
  workspace: PlanningWorkspace;
}

describe("plan buildApp", () => {
  const workspaces: TestPlanningContext[] = [];

  afterEach(async () => {
    await Promise.all(workspaces.splice(0, workspaces.length).map(async (workspace) => workspace.cleanup()));
  });

  it("returns an empty planning workspace snapshot", async () => {
    const workspace = await createTestPlanningContext("plan-build-app-empty");
    workspaces.push(workspace);
    const app = await buildApp(workspace);
    const response = await app.inject({
      method: "GET",
      url: "/api/planning/workspace"
    });
    const payload: PlanningWorkspaceResponse = response.json();

    expect(response.statusCode).toBe(200);
    expect(payload.workspace.localOnly).toBe(true);
    expect(payload.workspace.projects.map((project) => project.key)).toEqual(["planning", "audit", "taxes"]);
    expect(payload.workspace.summary.totalItems).toBe(0);
    expect(payload.workspace.workItems).toEqual([]);

    await app.close();
  });

  it("creates a planning workspace when started from the app workspace directory", async () => {
    const originalWorkingDirectory = process.cwd();
    const appWorkingDirectory = path.resolve(originalWorkingDirectory, "apps", "plan", "api");

    process.chdir(appWorkingDirectory);

    try {
      const workspace = await createTestPlanningContext("plan-build-app-cwd");
      workspaces.push(workspace);
      const app = await buildApp(workspace);
      const response = await app.inject({
        method: "GET",
        url: "/api/planning/workspace"
      });

      expect(response.statusCode).toBe(200);
      await app.close();
    } finally {
      process.chdir(originalWorkingDirectory);
    }
  });

  it("creates a work item with checklist data and plan steps", async () => {
    const workspace = await createTestPlanningContext("plan-build-app-create");
    workspaces.push(workspace);
    const app = await buildApp(workspace);
    const createResponse = await app.inject({
      method: "POST",
      payload: {
        acceptanceCriteria: ["Planning notes are captured", "The backlog item has a stable key"],
        auditWorkflowRunId: "2026-03-11T205727-121-implementation-742fde85",
        kind: "feature",
        plan: {
          mode: "parallel-agents",
          steps: ["Research the approach", "Break the work into tasks", "Validate the implementation"],
          summary: "Initial plan for work item orchestration."
        },
        priority: "high",
        projectKey: "planning",
        summary: "Store work items, tasks, criteria, and plan steps in a shared local backlog.",
        targetIteration: "2026-W11",
        tasks: ["Design the schema", "Expose the API", "Build the backlog view"],
        title: "Planning backlog foundation"
      },
      url: "/api/planning/work-items"
    });

    expect(createResponse.statusCode).toBe(201);

    const workspaceResponse = await app.inject({
      method: "GET",
      url: "/api/planning/workspace"
    });
    const payload: PlanningWorkspaceResponse = workspaceResponse.json();
    const createdItem = payload.workspace.workItems[0];

    expect(createdItem).toEqual(
      expect.objectContaining({
        auditWorkflowRunId: "2026-03-11T205727-121-implementation-742fde85",
        id: "PLAN-1",
        kind: "feature",
        priority: "high",
        projectKey: "planning",
        status: "backlog",
        targetIteration: "2026-W11",
        title: "Planning backlog foundation"
      })
    );
    expect(createdItem?.acceptanceCriteria).toHaveLength(2);
    expect(createdItem?.planRuns[0]?.mode).toBe("parallel-agents");
    expect(createdItem?.planRuns[0]?.steps).toHaveLength(3);
    expect(createdItem?.tasks).toHaveLength(3);
    expect(payload.workspace.summary.totalItems).toBe(1);

    await app.close();
  });

  it("creates custom projects and returns the next actionable item", async () => {
    const workspace = await createTestPlanningContext("plan-build-app-next");
    workspaces.push(workspace);
    const app = await buildApp(workspace);

    const projectResponse = await app.inject({
      method: "POST",
      payload: {
        description: "Internal ops and workflow platform work.",
        key: "ops",
        name: "Operations"
      },
      url: "/api/planning/projects"
    });
    expect(projectResponse.statusCode).toBe(201);

    const readyResponse = await app.inject({
      method: "POST",
      payload: {
        kind: "task",
        priority: "high",
        projectKey: "planning",
        summary: "Render the first Kanban board slice.",
        title: "Kanban board MVP"
      },
      url: "/api/planning/work-items"
    });
    const readyPayload: { workItem: { id: string } } = readyResponse.json();
    await app.inject({
      method: "PATCH",
      payload: {
        status: "ready"
      },
      url: `/api/planning/work-items/${readyPayload.workItem.id}`
    });

    const nextResponse = await app.inject({
      method: "GET",
      url: "/api/planning/work-items/next?projectKey=planning"
    });
    const nextPayload: { workItem: { id: string; projectKey: string } | null } = nextResponse.json();

    expect(nextResponse.statusCode).toBe(200);
    expect(nextPayload.workItem).toEqual(
      expect.objectContaining({
        id: readyPayload.workItem.id,
        projectKey: "planning"
      })
    );

    await app.close();
  });
});
