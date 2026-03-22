import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";

import type { PrismaClient } from "@taxes/db";
import { getPrismaClient } from "@taxes/db";

import { buildApp } from "../app.js";
import { applyPendingMigrations } from "../db/migrations.js";
import { WorkflowWorker } from "../event-bus/workflow-worker.js";
import * as workflowDefinitionService from "../services/workflow-definition-service.js";

describe("Workflow E2E: child-workflow step execution", () => {
  let prisma: PrismaClient;
  let testDbUrl: string;

  beforeAll(async () => {
    const testDbFile = join(tmpdir(), `test-e2e-child-workflow-${randomUUID()}.db`);
    testDbUrl = `file:${testDbFile}`;
    await applyPendingMigrations(testDbUrl);
    prisma = await getPrismaClient(testDbUrl);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("executes child-workflow step and merges child output into parent context", async () => {
    const childDef = await workflowDefinitionService.createDefinition(prisma, {
      name: `child-workflow-test-${String(Date.now())}`,
      version: "1.0",
      description: "Child workflow for testing",
      triggers: ["manual"],
      definitionJson: {
        steps: [
          {
            type: "command",
            id: "child-step-1",
            label: "Child command",
            scriptPath: process.platform === "win32" ? "cmd" : "/bin/echo",
            args: process.platform === "win32" ? ["/c", "echo child-output"] : ["child-output"]
          }
        ]
      }
    });

    const parentDef = await workflowDefinitionService.createDefinition(prisma, {
      name: `parent-workflow-test-${String(Date.now())}`,
      version: "1.0",
      description: "Parent workflow for testing",
      triggers: ["manual"],
      definitionJson: {
        steps: [
          {
            type: "child-workflow",
            id: "child-step",
            label: "Spawn child workflow",
            workflowName: childDef.name,
            inputMapping: { sourceData: "{{contextValue}}" }
          }
        ]
      }
    });

    const app = await buildApp({ databaseUrl: testDbUrl });
    const worker = new WorkflowWorker({ pollIntervalMs: 100, batchSize: 10, db: prisma });

    try {
      const createRunResponse = await app.inject({
        method: "POST",
        url: "/api/workflow/runs",
        payload: { definitionName: parentDef.name, input: { contextValue: "test-input" } }
      });
      expect(createRunResponse.statusCode).toBe(201);

      const createData: { run: { id: string } } = createRunResponse.json();
      const parentRunId = createData.run.id;

      await worker.processBatch();

      const parentResponse = await app.inject({ method: "GET", url: `/api/workflow/runs/${parentRunId}` });
      expect(parentResponse.statusCode).toBe(200);
      const parentData: { run: Record<string, unknown> } = parentResponse.json();
      expect(parentData.run.status).toBe("waiting");

      const childRuns = await prisma.workflowRun.findMany({ where: { parentRunId } });
      expect(childRuns.length).toBeGreaterThan(0);
      const [firstChild] = childRuns;
      if (!firstChild) { throw new Error("Expected at least one child run"); }
      const childRunId = firstChild.id;

      await worker.processBatch();

      const childResponse = await app.inject({ method: "GET", url: `/api/workflow/runs/${childRunId}` });
      expect(childResponse.statusCode).toBe(200);
      const childData: { run: Record<string, unknown> } = childResponse.json();
      expect(childData.run.status).toBe("completed");

      await worker.processBatch();

      const finalResponse = await app.inject({ method: "GET", url: `/api/workflow/runs/${parentRunId}` });
      expect(finalResponse.statusCode).toBe(200);
      const finalData: { run: Record<string, unknown> } = finalResponse.json();
      expect(finalData.run.status).toBe("completed");

      const parentContext = JSON.parse(String(finalData.run.contextJson)) as Record<string, unknown>;
      expect(parentContext["child-step"]).toBeDefined();
    } finally {
      await app.close();
    }
  });
});
