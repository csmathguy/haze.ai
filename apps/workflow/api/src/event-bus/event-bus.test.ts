import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PrismaClient } from "@taxes/db";
import { getPrismaClient } from "@taxes/db";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { applyPendingMigrations } from "../db/migrations.js";
import { EventBus } from "./event-bus.js";

describe("EventBus", () => {
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

  it("emit() persists an event with status pending", async () => {
    const eventBus = new EventBus(prisma);

    // Create a workflow definition
    const definition = await prisma.workflowDefinition.create({
      data: {
        name: "test-def-1",
        version: "1.0",
        description: "Test definition",
        triggerEvents: "[]",
        definitionJson: "{}"
      }
    });

    // Create a workflow run
    const run = await prisma.workflowRun.create({
      data: {
        definitionId: definition.id,
        definitionName: definition.name,
        version: "1.0"
      }
    });

    const event = await eventBus.emit({
      workflowRunId: run.id,
      eventType: "step.completed",
      payload: { stepId: "step_456" }
    });

    expect(event).toBeDefined();
    expect(event.type).toBe("step.completed");
    expect(event.correlationId).toBe(run.id);
    expect(event.processedAt).toBeNull();

    const stored = JSON.parse(event.payload) as Record<string, unknown>;
    expect(stored.stepId).toBe("step_456");
  });

  it("fetchPending() returns pending events in order", async () => {
    const eventBus = new EventBus(prisma);

    // Create a workflow definition and run
    const definition = await prisma.workflowDefinition.create({
      data: {
        name: "test-def-2",
        version: "1.0",
        description: "Test definition",
        triggerEvents: "[]",
        definitionJson: "{}"
      }
    });

    const run = await prisma.workflowRun.create({
      data: {
        definitionId: definition.id,
        definitionName: definition.name,
        version: "1.0"
      }
    });

    // Create multiple pending events
    const event1 = await eventBus.emit({
      workflowRunId: run.id,
      eventType: "event.type1",
      payload: { seq: 1 }
    });

    // Add small delay to ensure different timestamps
    await new Promise(r => setTimeout(r, 10));

    const event2 = await eventBus.emit({
      workflowRunId: run.id,
      eventType: "event.type2",
      payload: { seq: 2 }
    });

    const pending = await eventBus.fetchPending(10);
    const event1Index = pending.findIndex(e => e.id === event1.id);
    const event2Index = pending.findIndex(e => e.id === event2.id);

    expect(event1Index).toBeLessThan(event2Index);
  });

  it("markProcessed() updates status to processed", async () => {
    const eventBus = new EventBus(prisma);

    const definition = await prisma.workflowDefinition.create({
      data: {
        name: "test-def-3",
        version: "1.0",
        description: "Test definition",
        triggerEvents: "[]",
        definitionJson: "{}"
      }
    });

    const run = await prisma.workflowRun.create({
      data: {
        definitionId: definition.id,
        definitionName: definition.name,
        version: "1.0"
      }
    });

    const event = await eventBus.emit({
      workflowRunId: run.id,
      eventType: "test.event",
      payload: {}
    });

    await eventBus.markProcessed(event.id);

    const updated = await prisma.workflowEvent.findUnique({
      where: { id: event.id }
    });

    expect(updated?.processedAt).toBeDefined();
    expect(updated?.processedAt).not.toBeNull();
  });

  it("markFailed() stores error metadata", async () => {
    const eventBus = new EventBus(prisma);

    const definition = await prisma.workflowDefinition.create({
      data: {
        name: "test-def-4",
        version: "1.0",
        description: "Test definition",
        triggerEvents: "[]",
        definitionJson: "{}"
      }
    });

    const run = await prisma.workflowRun.create({
      data: {
        definitionId: definition.id,
        definitionName: definition.name,
        version: "1.0"
      }
    });

    const event = await eventBus.emit({
      workflowRunId: run.id,
      eventType: "test.event",
      payload: {}
    });

    await eventBus.markFailed(event.id, "Processing failed");

    const updated = await prisma.workflowEvent.findUnique({
      where: { id: event.id }
    });

    expect(updated?.metadata).toBeDefined();
    const metadata = JSON.parse(updated?.metadata ?? "{}") as Record<string, unknown>;
    expect(metadata.error).toBe("Processing failed");
  });

  it("fetchPending() respects limit parameter", async () => {
    const eventBus = new EventBus(prisma);

    const definition = await prisma.workflowDefinition.create({
      data: {
        name: "test-def-5",
        version: "1.0",
        description: "Test definition",
        triggerEvents: "[]",
        definitionJson: "{}"
      }
    });

    const run = await prisma.workflowRun.create({
      data: {
        definitionId: definition.id,
        definitionName: definition.name,
        version: "1.0"
      }
    });

    // Create 5 events
    for (let i = 0; i < 5; i++) {
      await eventBus.emit({
        workflowRunId: run.id,
        eventType: "test",
        payload: {}
      });
    }

    const pending = await eventBus.fetchPending(2);
    expect(pending.length).toBeLessThanOrEqual(2);
  });

  it("fetchPending() only returns unprocessed events", async () => {
    const eventBus = new EventBus(prisma);

    const definition = await prisma.workflowDefinition.create({
      data: {
        name: "test-def-6",
        version: "1.0",
        description: "Test definition",
        triggerEvents: "[]",
        definitionJson: "{}"
      }
    });

    const run1 = await prisma.workflowRun.create({
      data: {
        definitionId: definition.id,
        definitionName: definition.name,
        version: "1.0"
      }
    });

    const run2 = await prisma.workflowRun.create({
      data: {
        definitionId: definition.id,
        definitionName: definition.name,
        version: "1.0"
      }
    });

    const unprocessed = await eventBus.emit({
      workflowRunId: run1.id,
      eventType: "test",
      payload: {}
    });

    const processed = await eventBus.emit({
      workflowRunId: run2.id,
      eventType: "test",
      payload: {}
    });

    await eventBus.markProcessed(processed.id);

    const pending = await eventBus.fetchPending(10);
    const pendingIds = pending.map(e => e.id);

    expect(pendingIds).toContain(unprocessed.id);
    expect(pendingIds).not.toContain(processed.id);
  });
});
