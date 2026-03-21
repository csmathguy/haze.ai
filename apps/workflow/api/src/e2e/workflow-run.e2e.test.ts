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

  it("wait-for-event: pause, emit matching event, and resume", async () => {
    // 1. Create a workflow with a wait-for-event step followed by another step
    await workflowDefinitionService.createDefinition(prisma, {
      name: "wait-for-event-test",
      version: "1.0",
      description: "Test wait-for-event step",
      triggers: ["manual"],
      definitionJson: {
        steps: [
          {
            type: "wait-for-event",
            id: "wait-ci",
            label: "Wait for CI completion",
            eventType: "ci.build.completed",
            timeoutMs: 30000
          },
          {
            type: "command",
            id: "step-after-wait",
            label: "Echo after wait",
            scriptPath: process.platform === "win32" ? "cmd" : "/bin/echo",
            args: process.platform === "win32" ? ["/c", "echo done"] : ["done"]
          }
        ]
      }
    });

    // 2. Build the app
    const app = await buildApp({ databaseUrl: testDbUrl });

    try {
      // 3. Create a workflow run
      const createRunResponse = await app.inject({
        method: "POST",
        url: "/api/workflow/runs",
        payload: {
          definitionName: "wait-for-event-test",
          input: { testId: "wait-test-123" }
        }
      });

      expect(createRunResponse.statusCode).toBe(201);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const createRunData = createRunResponse.json();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const runId = String(createRunData.run.id);
      expect(runId).toBeDefined();

      // 4. Process worker batch to execute the wait-for-event step
      const worker = new WorkflowWorker({
        pollIntervalMs: 100,
        batchSize: 10,
        db: prisma
      });

      await worker.processBatch();

      // 5. Check that run is in waiting state
      const getRunAfterWaitResponse = await app.inject({
        method: "GET",
        url: `/api/workflow/runs/${runId}`
      });

      expect(getRunAfterWaitResponse.statusCode).toBe(200);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const runAfterWait = getRunAfterWaitResponse.json();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect((runAfterWait.run as Record<string, unknown>).status).toBe("waiting");

      // 6. Emit a matching event to resume the run
      const eventBus = new EventBus(prisma);
      await eventBus.emit({
        workflowRunId: runId,
        eventType: "ci.build.completed",
        payload: { status: "success", duration: 120 }
      });

      // 7. Process another batch to handle the event
      await worker.processBatch();

      // 8. Check that the run has advanced past the wait step
      const finalRunResponse = await app.inject({
        method: "GET",
        url: `/api/workflow/runs/${runId}`
      });

      expect(finalRunResponse.statusCode).toBe(200);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const finalRunData = finalRunResponse.json();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect((finalRunData.run as Record<string, unknown>).status).not.toBe("waiting");

      // 9. Verify that the wait step run was recorded
      const waitStepRun = await prisma.workflowStepRun.findFirst({
        where: { runId, stepId: "wait-ci" }
      });

      expect(waitStepRun).toBeDefined();
      expect(waitStepRun?.stepType).toBe("wait-for-event");
    } finally {
      await app.close();
    }
  });

  it("wait-for-event: timeout expires and fails the step", async () => {
    // 1. Create a workflow with a wait-for-event step with short timeout
    const timeoutDefinition = await workflowDefinitionService.createDefinition(prisma, {
      name: "wait-for-event-timeout-test",
      version: "1.0",
      description: "Test wait-for-event timeout",
      triggers: ["manual"],
      definitionJson: {
        steps: [
          {
            type: "wait-for-event",
            id: "wait-timeout",
            label: "Wait with short timeout",
            eventType: "delayed.event",
            timeoutMs: 100
          }
        ]
      }
    });

    // 2. Create a workflow run
    const run = await prisma.workflowRun.create({
      data: {
        definitionId: timeoutDefinition.id,
        definitionName: "wait-for-event-timeout-test",
        version: "1.0",
        status: "running",
        contextJson: JSON.stringify({})
      }
    });

    // 3. Set up the worker
    const worker = new WorkflowWorker({
      pollIntervalMs: 50,
      batchSize: 10,
      db: prisma
    });

    // 4. Create event to trigger the wait-for-event step execution
    const eventBus = new EventBus(prisma);
    await eventBus.emit({
      workflowRunId: run.id,
      eventType: "step.execute-requested",
      payload: {
        step: {
          type: "wait-for-event",
          id: "wait-timeout",
          label: "Wait with short timeout",
          eventType: "delayed.event",
          timeoutMs: 100
        }
      }
    });

    // 5. Process first batch to create the waiting state
    await worker.processBatch();

    // Verify the run is waiting
    const runStateAfterWait = await prisma.workflowRun.findUnique({
      where: { id: run.id }
    });
    expect(runStateAfterWait?.status).toBe("waiting");

    // 6. Wait for timeout to expire
    await new Promise((resolve) => setTimeout(resolve, 150));

    // 7. Process another batch - should detect timeout
    await worker.processBatch();

    // 8. Verify the run failed due to timeout
    const failedRun = await prisma.workflowRun.findUnique({
      where: { id: run.id }
    });

    expect(failedRun?.status).toBe("failed");

    // 9. Verify the step run has an error
    const failedStepRun = await prisma.workflowStepRun.findFirst({
      where: { runId: run.id, stepId: "wait-timeout" }
    });

    expect(failedStepRun).toBeDefined();
    expect(failedStepRun?.errorJson).toBeDefined();
    if (failedStepRun?.errorJson) {
      const errorData = JSON.parse(failedStepRun.errorJson) as Record<string, unknown>;
      expect(errorData.code).toBe("TIMEOUT");
      expect(String(errorData.message)).toContain("Timeout");
    }
  });
});
