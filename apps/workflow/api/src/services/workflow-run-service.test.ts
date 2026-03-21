import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PrismaClient } from "@taxes/db";
import { getPrismaClient } from "@taxes/db";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { applyPendingMigrations } from "../db/migrations.js";
import * as workflowDefinitionService from "./workflow-definition-service.js";
import * as workflowRunService from "./workflow-run-service.js";

describe("WorkflowRunService", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    const tempDir = tmpdir();
    const testDbFile = join(tempDir, `test-workflow-run-${randomUUID()}.db`);
    const testDbUrl = `file:${testDbFile}`;
    await applyPendingMigrations(testDbUrl);
    prisma = await getPrismaClient(testDbUrl);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("startRun() creates a new workflow run and emits initial effects", async () => {
    const definition = await workflowDefinitionService.createDefinition(prisma, {
      name: "test-start-run",
      version: "1.0",
      description: "Test workflow",
      triggers: ["manual"],
      definitionJson: {
        steps: [
          {
            type: "command",
            id: "step-1",
            label: "First step",
            scriptPath: "/bin/echo",
            args: ["hello"]
          }
        ]
      }
    });

    const result = await workflowRunService.startRun(prisma, {
      definitionName: definition.name,
      input: { testData: "value" }
    });

    expect(result.run).toBeDefined();
    expect(result.run.definitionName).toBe(definition.name);
    expect(result.run.status).toBe("running");
    expect(result.effects.length).toBeGreaterThan(0);
    const hasExecuteStep = result.effects.some((e: Record<string, unknown>) => e.type === "execute-step");
    expect(hasExecuteStep).toBe(true);
  });

  it("getRun() retrieves run with step history", async () => {
    const definition = await workflowDefinitionService.createDefinition(prisma, {
      name: "test-get-run",
      version: "1.0",
      description: "Test workflow",
      triggers: ["manual"],
      definitionJson: {
        steps: [
          {
            type: "command",
            id: "step-1",
            label: "Step 1",
            scriptPath: "/bin/echo"
          }
        ]
      }
    });

    const { run } = await workflowRunService.startRun(prisma, {
      definitionName: definition.name,
      input: {}
    });

    const retrieved = await workflowRunService.getRun(prisma, run.id);

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(run.id);
    expect(retrieved?.status).toBe("running");
  });

  it("getRun() returns null for nonexistent run", async () => {
    const result = await workflowRunService.getRun(prisma, "nonexistent-run-id");
    expect(result).toBeNull();
  });

  it("listRuns() returns runs with optional status filter", async () => {
    const definition = await workflowDefinitionService.createDefinition(prisma, {
      name: "test-list-runs",
      version: "1.0",
      description: "Test workflow",
      triggers: ["manual"],
      definitionJson: {
        steps: [
          {
            type: "command",
            id: "step-1",
            label: "Step 1",
            scriptPath: "/bin/echo"
          }
        ]
      }
    });

    const { run: run1 } = await workflowRunService.startRun(prisma, {
      definitionName: definition.name,
      input: {}
    });

    const { run: run2 } = await workflowRunService.startRun(prisma, {
      definitionName: definition.name,
      input: {}
    });

    const allRuns = await workflowRunService.listRuns(prisma, { limit: 10 });
    expect(allRuns.length).toBeGreaterThanOrEqual(2);

    const runningRuns = await workflowRunService.listRuns(prisma, {
      status: "running",
      limit: 10
    });
    const runningIds = runningRuns.map(r => r.id);
    expect(runningIds).toContain(run1.id);
    expect(runningIds).toContain(run2.id);
  });

  it("signalRun() applies a workflow event to a run", async () => {
    const definition = await workflowDefinitionService.createDefinition(prisma, {
      name: "test-signal-run",
      version: "1.0",
      description: "Test workflow",
      triggers: ["manual"],
      definitionJson: {
        steps: [
          {
            type: "wait-for-event",
            id: "wait-1",
            label: "Wait for approval",
            eventType: "approval.given"
          }
        ]
      }
    });

    const { run } = await workflowRunService.startRun(prisma, {
      definitionName: definition.name,
      input: {}
    });

    const result = await workflowRunService.signalRun(prisma, {
      runId: run.id,
      event: {
        type: "approval.given",
        payload: { approved: true }
      }
    });

    expect(result.run).toBeDefined();
    expect(result.effects).toBeDefined();
    const contextJson = typeof result.run.contextJson === "string"
      ? (JSON.parse(result.run.contextJson) as Record<string, unknown>)
      : (result.run.contextJson as Record<string, unknown>);
    const lastEvent = contextJson.lastEvent as Record<string, unknown>;
    expect(lastEvent.type).toBe("approval.given");
  });

  it("cancelRun() transitions run to cancelled status", async () => {
    const definition = await workflowDefinitionService.createDefinition(prisma, {
      name: "test-cancel-run",
      version: "1.0",
      description: "Test workflow",
      triggers: ["manual"],
      definitionJson: {
        steps: [
          {
            type: "command",
            id: "step-1",
            label: "Step 1",
            scriptPath: "/bin/echo"
          }
        ]
      }
    });

    const { run } = await workflowRunService.startRun(prisma, {
      definitionName: definition.name,
      input: {}
    });

    const result = await workflowRunService.cancelRun(prisma, run.id);

    expect(result.run).toBeDefined();
    expect(result.run.status).toBe("cancelled");
    expect(result.effects).toBeDefined();
  });

  it("listRuns() with formatRunForApi handles runs that have step runs (regression: PLAN-195)", async () => {
    const definition = await workflowDefinitionService.createDefinition(prisma, {
      name: "test-list-with-steps",
      version: "1.0",
      description: "Test workflow",
      triggers: ["manual"],
      definitionJson: {
        steps: [
          {
            type: "command",
            id: "step-1",
            label: "Step 1",
            scriptPath: "/bin/echo"
          }
        ]
      }
    });

    const { run } = await workflowRunService.startRun(prisma, {
      definitionName: definition.name,
      input: {}
    });

    // Create a step run directly (simulating what StepExecutionHandler does)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await (prisma as any).workflowStepRun.create({
      data: {
        runId: run.id,
        stepId: "step-1",
        stepType: "command",
        nodeType: "deterministic",
        stdout: "hello world",
        stderr: "",
        branchName: null,
        inputJson: "{}",
        retryCount: 0
      }
    });

    const runs = await workflowRunService.listRuns(prisma, { limit: 10 });
    const runWithSteps = runs.find((r) => r.id === run.id);
    expect(runWithSteps).toBeDefined();

    if (!runWithSteps) throw new Error("run not found in list");

    // formatRunForApi must not throw when step runs include all columns
    expect(() => workflowRunService.formatRunForApi(runWithSteps)).not.toThrow();
    const formatted = workflowRunService.formatRunForApi(runWithSteps);
    expect(Array.isArray(formatted.stepRuns)).toBe(true);
    const stepRuns = formatted.stepRuns as unknown[];
    expect(stepRuns.length).toBe(1);
  });

  it("listRuns() respects limit parameter", async () => {
    const definition = await workflowDefinitionService.createDefinition(prisma, {
      name: "test-list-limit",
      version: "1.0",
      description: "Test workflow",
      triggers: ["manual"],
      definitionJson: {
        steps: [
          {
            type: "command",
            id: "step-1",
            label: "Step 1",
            scriptPath: "/bin/echo"
          }
        ]
      }
    });

    for (let i = 0; i < 5; i++) {
      await workflowRunService.startRun(prisma, {
        definitionName: definition.name,
        input: { index: i }
      });
    }

    const limited = await workflowRunService.listRuns(prisma, { limit: 2 });
    expect(limited.length).toBeLessThanOrEqual(2);
  });
});
