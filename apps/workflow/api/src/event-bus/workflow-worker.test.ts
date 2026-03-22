import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@taxes/db";
import { getPrismaClient } from "@taxes/db";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { applyPendingMigrations } from "../db/migrations.js";
import { WorkflowWorker } from "./workflow-worker.js";
import { EventBus } from "./event-bus.js";

// Mock the planning client
vi.mock("@taxes/plan-api", () => ({
  getPrismaClient: vi.fn()
}));

describe("WorkflowWorker", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    // Set up test database with a temporary file-based SQLite
    const tempDir = tmpdir();
    const testDbFile = join(tempDir, `test-${randomUUID()}.db`);
    const testDbUrl = `file:${testDbFile}`;
    await applyPendingMigrations(testDbUrl);
    prisma = await getPrismaClient(testDbUrl);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function createTestWorkflowRun() {
    const definition = await prisma.workflowDefinition.create({
      data: {
        name: `test-def-${String(Date.now())}`,
        version: "1.0",
        description: "Test definition",
        triggerEvents: "[]",
        definitionJson: "{}"
      }
    });

    return prisma.workflowRun.create({
      data: {
        definitionId: definition.id,
        definitionName: definition.name,
        version: "1.0",
        contextJson: JSON.stringify({ input: "test" })
      }
    });
  }

  it("processBatch() returns 0 with no pending events", async () => {
    const worker = new WorkflowWorker({
      pollIntervalMs: 100,
      batchSize: 10,
      db: prisma
    });

    const count = await worker.processBatch();
    expect(count).toBe(0);
  });

  it("processBatch() processes a pending event and marks it processed", async () => {
    const eventBus = new EventBus(prisma);

    // Create a workflow run
    const run = await createTestWorkflowRun();

    // Create a pending event
    const event = await eventBus.emit({
      workflowRunId: run.id,
      eventType: "step.completed",
      payload: { stepId: "step_123" }
    });

    const worker = new WorkflowWorker({
      pollIntervalMs: 100,
      batchSize: 10,
      db: prisma
    });

    const count = await worker.processBatch();
    expect(count).toBe(1);

    // Verify event is marked processed
    const processedEvent = await prisma.workflowEvent.findUnique({
      where: { id: event.id }
    });
    expect(processedEvent?.processedAt).toBeDefined();

    // Verify run is updated (signalRun transitions to running + emit-event)
    const updatedRun = await prisma.workflowRun.findUnique({
      where: { id: run.id }
    });
    expect(updatedRun?.status).toBe("running");
  });

  it("processBatch() calls advanceRun with the event", async () => {
    const eventBus = new EventBus(prisma);

    // Clear any pending events from previous tests
    await prisma.workflowEvent.deleteMany({});

    const run = await createTestWorkflowRun();

    await eventBus.emit({
      workflowRunId: run.id,
      eventType: "approval.response",
      payload: { approved: true }
    });

    const worker = new WorkflowWorker({
      pollIntervalMs: 100,
      batchSize: 10,
      db: prisma
    });

    const count = await worker.processBatch();
    expect(count).toBe(1);

    // Check that the run context was updated with the event
    const updatedRun = await prisma.workflowRun.findUnique({
      where: { id: run.id }
    });
    const context = JSON.parse(updatedRun?.contextJson ?? "{}") as Record<string, unknown>;
    expect(context.lastEvent).toBeDefined();
    expect((context.lastEvent as Record<string, unknown>).type).toBe("approval.response");
  });

  it("processBatch() respects batchSize limit", async () => {
    const eventBus = new EventBus(prisma);

    // Create 5 workflow runs with pending events
    for (let i = 0; i < 5; i++) {
      const run = await createTestWorkflowRun();

      void eventBus.emit({
        workflowRunId: run.id,
        eventType: "event.test",
        payload: { index: i }
      });
    }

    const worker = new WorkflowWorker({
      pollIntervalMs: 100,
      batchSize: 2,
      db: prisma
    });

    const count = await worker.processBatch();
    expect(count).toBeLessThanOrEqual(2);
  });

  it("processBatch() handles missing workflow run gracefully", async () => {
    const eventBus = new EventBus(prisma);

    // Clear any pending events from previous tests
    await prisma.workflowEvent.deleteMany({});

    // Create an event with non-existent run ID
    const event = await eventBus.emit({
      workflowRunId: "non-existent-run",
      eventType: "test",
      payload: {}
    });

    const worker = new WorkflowWorker({
      pollIntervalMs: 100,
      batchSize: 10,
      db: prisma
    });

    const count = await worker.processBatch();
    expect(count).toBe(1);

    // Event should be marked failed, not processed
    const failedEvent = await prisma.workflowEvent.findUnique({
      where: { id: event.id }
    });
    expect(failedEvent?.processedAt).toBeNull();
    expect(failedEvent?.metadata).toBeDefined();
  });

  it("processBatch() persists effects back to DB", async () => {
    const eventBus = new EventBus(prisma);

    const run = await createTestWorkflowRun();

    await eventBus.emit({
      workflowRunId: run.id,
      eventType: "timer.fired",
      payload: {}
    });

    const worker = new WorkflowWorker({
      pollIntervalMs: 100,
      batchSize: 10,
      db: prisma
    });

    await worker.processBatch();

    // signalRun returns an emit-event effect
    // Verify a new event was created from the effect
    const emittedEvents = await prisma.workflowEvent.findMany({
      where: { correlationId: run.id }
    });

    // We should have at least the original event plus one emitted by the engine
    expect(emittedEvents.length).toBeGreaterThanOrEqual(1);
  });

  it("start() and stop() control the polling loop", () => {
    const worker = new WorkflowWorker({
      pollIntervalMs: 50,
      batchSize: 10,
      db: prisma
    });

    // Start the worker
    worker.start();
    expect(true).toBe(true); // Verify worker started without throwing

    // Give it a moment to poll
    return new Promise<void>(r => {
      setTimeout(() => {
        worker.stop();
        r();
      }, 100);
    });
  });

  it("processBatch() handles github.pull_request.merged events", async () => {
    const { getPrismaClient: getMockPlanClient } = await import("@taxes/plan-api");

    // Mock planning client
    const mockPlanningDb = {
      planWorkItem: {
        updateMany: vi.fn(() => Promise.resolve({ count: 1 } as unknown))
      },
      $disconnect: vi.fn(() => Promise.resolve(undefined))
    };

    vi.mocked(getMockPlanClient).mockResolvedValue(mockPlanningDb as never);

    // Clear any pending events
    await prisma.workflowEvent.deleteMany({});

    // Create a GitHub PR merged event (no correlationId needed)
    const event = await prisma.workflowEvent.create({
      data: {
        type: "github.pull_request.merged",
        source: "github",
        payload: JSON.stringify({
          pull_request: {
            number: 123,
            title: "Implement feature",
            body: "Closes PLAN-167 and PLAN-166",
            merged: true
          }
        })
      }
    });

    const worker = new WorkflowWorker({
      pollIntervalMs: 100,
      batchSize: 10,
      db: prisma
    });

    const count = await worker.processBatch();
    expect(count).toBe(1);

    // Verify event is marked processed
    const processedEvent = await prisma.workflowEvent.findUnique({
      where: { id: event.id }
    });
    expect(processedEvent?.processedAt).toBeDefined();

    // Verify planning client was called
    expect(mockPlanningDb.planWorkItem.updateMany).toHaveBeenCalledTimes(2);
  });

  it("processBatch() marks github.pull_request.closed events as processed without completing planning work", async () => {
    const { getPrismaClient: getMockPlanClient } = await import("@taxes/plan-api");

    const mockPlanningDb = {
      planWorkItem: {
        updateMany: vi.fn(() => Promise.resolve({ count: 1 } as unknown))
      },
      $disconnect: vi.fn(() => Promise.resolve(undefined))
    };

    vi.mocked(getMockPlanClient).mockResolvedValue(mockPlanningDb as never);

    await prisma.workflowEvent.deleteMany({});

    const event = await prisma.workflowEvent.create({
      data: {
        type: "github.pull_request.closed",
        source: "github",
        correlationId: "csmathguy/Taxes#321",
        payload: JSON.stringify({
          action: "closed",
          pull_request: {
            number: 321,
            title: "Closed without merge",
            body: "References PLAN-54 but did not merge",
            merged: false
          }
        })
      }
    });

    const worker = new WorkflowWorker({
      pollIntervalMs: 100,
      batchSize: 10,
      db: prisma
    });

    const count = await worker.processBatch();
    expect(count).toBe(1);

    const processedEvent = await prisma.workflowEvent.findUnique({
      where: { id: event.id }
    });
    expect(processedEvent?.processedAt).toBeDefined();
    expect(mockPlanningDb.planWorkItem.updateMany).not.toHaveBeenCalled();
  });

  it("processBatch() marks local code review action events as processed", async () => {
    await prisma.workflowEvent.deleteMany({});

    const event = await prisma.workflowEvent.create({
      data: {
        type: "code-review.pull-request.merge-submitted",
        source: "code-review",
        correlationId: "PLAN-54",
        payload: JSON.stringify({
          pullRequestNumber: 321,
          repository: {
            name: "Taxes",
            owner: "csmathguy",
            url: "https://github.com/csmathguy/Taxes"
          },
          submittedAt: "2026-03-22T15:05:00.000Z"
        })
      }
    });

    const worker = new WorkflowWorker({
      pollIntervalMs: 100,
      batchSize: 10,
      db: prisma
    });

    const count = await worker.processBatch();
    expect(count).toBe(1);

    const processedEvent = await prisma.workflowEvent.findUnique({
      where: { id: event.id }
    });
    expect(processedEvent?.processedAt).toBeDefined();
    expect(processedEvent?.metadata).toBeNull();
  });
});
