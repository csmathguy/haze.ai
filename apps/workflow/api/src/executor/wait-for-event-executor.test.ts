import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PrismaClient } from "@taxes/db";
import { getPrismaClient } from "@taxes/db";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { executeWaitForEventStep } from "./wait-for-event-executor.js";
import { applyPendingMigrations } from "../db/migrations.js";

describe("WaitForEventExecutor", () => {
  let prisma: PrismaClient;
  let testDbUrl: string;

  beforeAll(async () => {
    const tempDir = tmpdir();
    const testDbFile = join(tempDir, `test-wait-for-event-${randomUUID()}.db`);
    testDbUrl = `file:${testDbFile}`;
    await applyPendingMigrations(testDbUrl);
    prisma = await getPrismaClient(testDbUrl);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should return a waiting result with correct event type", async () => {
    // Create a test workflow run
    const runId = randomUUID();
    await prisma.workflowRun.create({
      data: {
        id: runId,
        definitionId: randomUUID(),
        definitionName: "test-workflow",
        version: "1.0",
        status: "waiting",
        contextJson: JSON.stringify({})
      }
    });

    // Create a step run
    const stepRunId = randomUUID();
    const stepRun = await prisma.workflowStepRun.create({
      data: {
        id: stepRunId,
        runId,
        stepId: "wait-step-1",
        stepType: "wait-for-event",
        nodeType: "wait",
        inputJson: "{}"
      }
    });

    // Execute the wait-for-event step
    const result = await executeWaitForEventStep(
      prisma,
      stepRun.id,
      {
        type: "wait-for-event",
        id: "wait-step-1",
        label: "Wait for CI completion",
        eventType: "ci.build.completed",
        correlationKey: "build-123",
        timeoutMs: 60000
      }
    );

    expect(result.type).toBe("waiting");
    expect(result.eventType).toBe("ci.build.completed");
    expect(result.correlationKey).toBe("build-123");
    expect(result.timeoutMs).toBe(60000);
    expect(result.startedAt).toBeDefined();

    // Verify the step run was updated with input data
    const updatedStepRun = await prisma.workflowStepRun.findUnique({
      where: { id: stepRunId }
    });

    expect(updatedStepRun).toBeDefined();
    expect(updatedStepRun?.inputJson).toBeDefined();

    const inputData = JSON.parse(updatedStepRun?.inputJson ?? "{}") as Record<string, unknown>;
    expect(inputData.eventType).toBe("ci.build.completed");
    expect(inputData.correlationKey).toBe("build-123");
    expect(inputData.timeoutMs).toBe(60000);
    expect(inputData.expectedAt).toBeDefined();
  });

  it("should store event type without correlation key when not provided", async () => {
    const runId = randomUUID();
    await prisma.workflowRun.create({
      data: {
        id: runId,
        definitionId: randomUUID(),
        definitionName: "test-workflow",
        version: "1.0",
        status: "waiting",
        contextJson: JSON.stringify({})
      }
    });

    const stepRunId = randomUUID();
    const stepRun = await prisma.workflowStepRun.create({
      data: {
        id: stepRunId,
        runId,
        stepId: "wait-step-2",
        stepType: "wait-for-event",
        nodeType: "wait",
        inputJson: "{}"
      }
    });

    const result = await executeWaitForEventStep(
      prisma,
      stepRun.id,
      {
        type: "wait-for-event",
        id: "wait-step-2",
        label: "Wait for webhook",
        eventType: "webhook.received"
      }
    );

    expect(result.type).toBe("waiting");
    expect(result.eventType).toBe("webhook.received");
    expect(result.correlationKey).toBeUndefined();
    expect(result.timeoutMs).toBeUndefined();
  });

  it("should store timeout duration when provided", async () => {
    const runId = randomUUID();
    await prisma.workflowRun.create({
      data: {
        id: runId,
        definitionId: randomUUID(),
        definitionName: "test-workflow",
        version: "1.0",
        status: "waiting",
        contextJson: JSON.stringify({})
      }
    });

    const stepRunId = randomUUID();
    const stepRun = await prisma.workflowStepRun.create({
      data: {
        id: stepRunId,
        runId,
        stepId: "wait-step-3",
        stepType: "wait-for-event",
        nodeType: "wait",
        inputJson: "{}"
      }
    });

    const result = await executeWaitForEventStep(
      prisma,
      stepRun.id,
      {
        type: "wait-for-event",
        id: "wait-step-3",
        label: "Wait with timeout",
        eventType: "payment.processed",
        timeoutMs: 30000
      }
    );

    expect(result.timeoutMs).toBe(30000);

    const updatedStepRun = await prisma.workflowStepRun.findUnique({
      where: { id: stepRunId }
    });

    const inputData = JSON.parse(updatedStepRun?.inputJson ?? "{}") as Record<string, unknown>;
    expect(inputData.timeoutMs).toBe(30000);
  });
});
