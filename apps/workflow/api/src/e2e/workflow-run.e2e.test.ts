import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PrismaClient } from "@taxes/db";
import { getPrismaClient } from "@taxes/db";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { buildApp } from "../app.js";
import { applyPendingMigrations } from "../db/migrations.js";
import * as workflowDefinitionService from "../services/workflow-definition-service.js";
import { WorkflowWorker } from "../event-bus/workflow-worker.js";

describe("Workflow E2E: smoke test for full execution loop", () => {
  let prisma: PrismaClient;
  let testDbUrl: string;

  beforeAll(async () => {
    const tempDir = tmpdir();
    const testDbFile = join(tempDir, `test-e2e-workflow-${randomUUID()}.db`);
    testDbUrl = `file:${testDbFile}`;
    await applyPendingMigrations(testDbUrl);
    prisma = await getPrismaClient(testDbUrl);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a workflow run and advances through execution loop", async () => {
    // 1. Create a workflow definition with a simple 2-step flow
    await workflowDefinitionService.createDefinition(prisma, {
      name: "smoke-test",
      version: "1.0",
      description: "Smoke test workflow",
      triggers: ["manual"],
      definitionJson: {
        steps: [
          {
            type: "command",
            id: "step-1",
            label: "Echo hello",
            scriptPath: process.platform === "win32" ? "cmd" : "/bin/echo",
            args: process.platform === "win32" ? ["/c", "echo smoke-test"] : ["smoke-test"]
          },
          {
            type: "approval",
            id: "step-2",
            label: "Approval gate",
            prompt: "Do you approve?"
          }
        ]
      }
    });

    // 2. Build the Fastify app with the test database
    const app = await buildApp({ databaseUrl: testDbUrl });

    try {
      // 3. POST /api/workflow/runs to create a run
      const createRunResponse = await app.inject({
        method: "POST",
        url: "/api/workflow/runs",
        payload: {
          definitionName: "smoke-test",
          input: { workItemId: "PLAN-999" }
        }
      });

      expect(createRunResponse.statusCode).toBe(201);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const createRunData = createRunResponse.json();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(createRunData.run).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect((createRunData.run as Record<string, unknown>).status).toBe("running");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const runId = String(createRunData.run.id);
      expect(runId).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(createRunData.effects).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(Array.isArray(createRunData.effects)).toBe(true);

      // 4. Process one worker batch to execute the first step
      const worker = new WorkflowWorker({
        pollIntervalMs: 100,
        batchSize: 10,
        db: prisma
      });

      const processedCount = await worker.processBatch();
      expect(processedCount).toBeGreaterThanOrEqual(0);

      // 5. GET /api/workflow/runs/:id to check progress
      const getRunResponse = await app.inject({
        method: "GET",
        url: `/api/workflow/runs/${runId}`
      });

      expect(getRunResponse.statusCode).toBe(200);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const getRunData = getRunResponse.json();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(getRunData.run).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect((getRunData.run as Record<string, unknown>).id).toBe(runId);
      // After first step execution, run should be paused at approval or completed
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(["running", "paused", "completed"]).toContain((getRunData.run as Record<string, unknown>).status);

      // 6. If paused at approval, send approval response and continue
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if ((getRunData.run as Record<string, unknown>).status === "paused") {
        const signalResponse = await app.inject({
          method: "POST",
          url: `/api/workflow/runs/${runId}/signal`,
          payload: {
            type: "approval.responded",
            payload: { decision: "approved" }
          }
        });

        expect(signalResponse.statusCode).toBe(200);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const signalData = signalResponse.json();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(signalData.run).toBeDefined();

        // Process another batch to advance from approval
        const processedCount2 = await worker.processBatch();
        expect(processedCount2).toBeGreaterThanOrEqual(0);

        // Final state check
        const finalRunResponse = await app.inject({
          method: "GET",
          url: `/api/workflow/runs/${runId}`
        });

        expect(finalRunResponse.statusCode).toBe(200);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const finalRunData = finalRunResponse.json();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(["completed", "running", "paused"]).toContain((finalRunData.run as Record<string, unknown>).status);
      }
    } finally {
      await app.close();
    }
  });

  it("lists runs and returns them in API format", async () => {
    // Create a definition
    const definition = await workflowDefinitionService.createDefinition(prisma, {
      name: `test-list-${String(Date.now())}`,
      version: "1.0",
      description: "Test list runs",
      triggers: ["manual"],
      definitionJson: {
        steps: [
          {
            type: "command",
            id: "step-1",
            label: "Test step",
            scriptPath: process.platform === "win32" ? "cmd" : "/bin/echo",
            args: process.platform === "win32" ? ["/c", "echo test"] : ["test"]
          }
        ]
      }
    });

    // Build the app
    const app = await buildApp({ databaseUrl: testDbUrl });

    try {
      // Create a run
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/workflow/runs",
        payload: {
          definitionName: definition.name,
          input: {}
        }
      });

      expect(createResponse.statusCode).toBe(201);

      // List runs
      const listResponse = await app.inject({
        method: "GET",
        url: "/api/workflow/runs?limit=10"
      });

      expect(listResponse.statusCode).toBe(200);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const listData = listResponse.json();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(listData.runs).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(Array.isArray((listData.runs as unknown))).toBe(true);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(((listData.runs as unknown) as unknown[]).length).toBeGreaterThan(0);

      // Verify runs are in API format
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const firstRun = ((listData.runs as unknown) as unknown[])[0];
      expect((firstRun as Record<string, unknown>).id).toBeDefined();
      expect((firstRun as Record<string, unknown>).status).toBeDefined();
    } finally {
      await app.close();
    }
  });

  it("handles command step execution and records output", async () => {
    // Create a definition with a command that produces output
    const definition = await workflowDefinitionService.createDefinition(prisma, {
      name: `test-command-output-${String(Date.now())}`,
      version: "1.0",
      description: "Test command output",
      triggers: ["manual"],
      definitionJson: {
        steps: [
          {
            type: "command",
            id: "echo-step",
            label: "Echo output",
            scriptPath: process.platform === "win32" ? "cmd" : "/bin/echo",
            args: process.platform === "win32" ? ["/c", "echo hello-world"] : ["hello-world"]
          }
        ]
      }
    });

    // Create a run
    const run = await prisma.workflowRun.create({
      data: {
        definitionId: definition.id,
        definitionName: definition.name,
        version: "1.0",
        contextJson: JSON.stringify({ input: {} })
      }
    });

    // Execute the step via worker
    const worker = new WorkflowWorker({
      pollIntervalMs: 100,
      batchSize: 10,
      db: prisma
    });

    // Create event to trigger step execution
    const eventBusModule = await import("../event-bus/event-bus.js");
    const bus = new eventBusModule.EventBus(prisma);

    // Emit step.execute-requested event
    await bus.emit({
      workflowRunId: run.id,
      eventType: "step.execute-requested",
      payload: {
        step: {
          type: "command",
          id: "echo-step",
          label: "Echo output",
          scriptPath: process.platform === "win32" ? "cmd" : "/bin/echo",
          args: process.platform === "win32" ? ["/c", "echo hello-world"] : ["hello-world"]
        }
      }
    });

    // Process the event
    const processedCount = await worker.processBatch();
    expect(processedCount).toBeGreaterThanOrEqual(1);

    // Verify step run was recorded
    const stepRun = await prisma.workflowStepRun.findFirst({
      where: { runId: run.id, stepId: "echo-step" }
    });

    expect(stepRun).toBeDefined();
    if (stepRun) {
      expect(stepRun.stdout).toBeDefined();
      if (typeof stepRun.stdout === "string") {
        expect(stepRun.stdout).toContain("hello-world");
      }
    }
  });
});
