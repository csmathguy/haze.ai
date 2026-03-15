import { spawnSync } from "node:child_process";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";
import type { WorkItem } from "@taxes/shared";

import { disconnectPrismaClient } from "../../apps/plan/api/src/db/client.js";
import type { TestPlanningContext } from "../../apps/plan/api/src/test/database.js";
import { createTestPlanningContext } from "../../apps/plan/api/src/test/database.js";
import { createWorkItem, updateWorkItem } from "../../apps/plan/api/src/services/planning.js";

interface WorkItemListResponse {
  workItems: WorkItem[];
}

interface WorkItemResponse {
  workItem: WorkItem;
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const tsxCliPath = path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");

describe("plan CLI", () => {
  const workspaces: TestPlanningContext[] = [];

  afterEach(async () => {
    await Promise.all(workspaces.splice(0, workspaces.length).map(async (workspace) => workspace.cleanup()));
  });

  it("lists work items for a project and can filter by status", async () => {
    const workspace = await createTestPlanningContext("plan-cli-list");
    workspaces.push(workspace);

    const planningReadyItem = await createWorkItem(
      {
        kind: "feature",
        priority: "high",
        projectKey: "planning",
        summary: "Render the first planning board.",
        title: "Planning board"
      },
      workspace
    );
    await updateWorkItem(planningReadyItem.id, { status: "ready" }, workspace);
    await createWorkItem(
      {
        kind: "task",
        priority: "medium",
        projectKey: "planning",
        summary: "Document planning entry points.",
        title: "Planning docs"
      },
      workspace
    );
    await createWorkItem(
      {
        kind: "task",
        priority: "medium",
        projectKey: "code-review",
        summary: "Render trust signals.",
        title: "Trust gate"
      },
      workspace
    );
    await disconnectPrismaClient(workspace.databaseUrl);

    const listResult = runPlanCli(["work-item", "list", "--project", "planning"], workspace.databaseUrl);
    const listPayload = JSON.parse(listResult.stdout) as WorkItemListResponse;

    expect(listResult.status).toBe(0);
    expect(listPayload.workItems).toHaveLength(2);
    expect(listPayload.workItems.map((workItem) => workItem.projectKey)).toEqual(["planning", "planning"]);

    const filteredResult = runPlanCli(["work-item", "list", "--project", "planning", "--status", "ready"], workspace.databaseUrl);
    const filteredPayload = JSON.parse(filteredResult.stdout) as WorkItemListResponse;

    expect(filteredResult.status).toBe(0);
    expect(filteredPayload.workItems.map((workItem) => workItem.id)).toEqual([planningReadyItem.id]);
  }, 60000);

  it("returns a single work item by positional id", async () => {
    const workspace = await createTestPlanningContext("plan-cli-get");
    workspaces.push(workspace);

    const workItem = await createWorkItem(
      {
        acceptanceCriteria: ["Reviewers can inspect the trust evidence."],
        kind: "feature",
        plan: {
          mode: "single-agent",
          steps: ["Design the contract", "Implement the command", "Validate the result"],
          summary: "Expose single-item planning detail from the CLI."
        },
        priority: "high",
        projectKey: "planning",
        summary: "Add direct work item inspection to the planning CLI.",
        tasks: ["Add the handler", "Cover it with tests"],
        title: "Work item detail command"
      },
      workspace
    );
    await disconnectPrismaClient(workspace.databaseUrl);

    const result = runPlanCli(["work-item", "get", workItem.id], workspace.databaseUrl);
    const payload = JSON.parse(result.stdout) as WorkItemResponse;

    expect(result.status).toBe(0);
    expect(payload.workItem).toEqual(
      expect.objectContaining({
        id: workItem.id,
        projectKey: "planning",
        title: "Work item detail command"
      })
    );
    expect(payload.workItem.acceptanceCriteria).toHaveLength(1);
    expect(payload.workItem.tasks).toHaveLength(2);
    expect(payload.workItem.planRuns).toHaveLength(1);
  });

  it("prints valid commands when an unknown command is invoked", async () => {
    const workspace = await createTestPlanningContext("plan-cli-unknown");
    workspaces.push(workspace);
    await disconnectPrismaClient(workspace.databaseUrl);

    const result = runPlanCli(["work-item", "bogus"], workspace.databaseUrl);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unknown command 'work-item:bogus'.");
    expect(result.stderr).toContain("Valid commands:");
    expect(result.stderr).toContain("work-item:get");
    expect(result.stderr).toContain("work-item:list");
  });
});

function runPlanCli(args: string[], databaseUrl: string): { status: number | null; stderr: string; stdout: string } {
  const result = spawnSync(process.execPath, [tsxCliPath, "tools/planning/plan-cli.ts", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      PLANNING_DATABASE_URL: databaseUrl
    }
  });

  return {
    status: result.status,
    stderr: result.stderr,
    stdout: result.stdout
  };
}
