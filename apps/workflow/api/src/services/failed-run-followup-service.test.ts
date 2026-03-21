/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { PrismaClient } from "@taxes/db";
import { getPrismaClient } from "@taxes/db";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { createFollowUpWorkItemForFailedRun } from "./failed-run-followup-service.js";

describe("FailedRunFollowUpService", () => {
  let planningPrisma: PrismaClient;
  let testPlanningDbUrl: string;

  beforeAll(async () => {
    // Set up real planning database for integration testing
    const tempDir = tmpdir();
    const testDbFile = join(tempDir, `test-planning-${randomUUID()}.db`);
    testPlanningDbUrl = `file:${testDbFile}`;

    // Apply planning migrations
    const { applyPendingMigrations } = await import("../../../../../apps/plan/api/src/db/migrations.js");
    await applyPendingMigrations(testPlanningDbUrl);

    planningPrisma = await getPrismaClient(testPlanningDbUrl);
  });

  afterAll(async () => {
    await planningPrisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up database before each test
    await planningPrisma.planWorkItem.deleteMany({});
    await planningPrisma.planProject.deleteMany({});

    // Ensure default projects exist
    await planningPrisma.planProject.upsert({
      where: { key: "workflow" },
      update: {},
      create: {
        id: randomUUID(),
        key: "workflow",
        name: "Workflow",
        isActive: true,
        sortOrder: 0
      }
    });
  });

  describe("createFollowUpWorkItemForFailedRun", () => {
    it("creates a follow-up work item when run context has workItemId", async () => {
      const runId = "run-123";
      const workItemId = "PLAN-225";
      const failedStepId = "step-validate";
      const failureReason = "Validation failed due to missing input";

      const runContext: Record<string, unknown> = {
        input: { workItemId }
      };

      await createFollowUpWorkItemForFailedRun(
        runId,
        runContext,
        failedStepId,
        failureReason,
        testPlanningDbUrl
      );

      // Verify follow-up item was created
      const createdItem = await planningPrisma.planWorkItem.findFirst({
        where: { title: { contains: `Fix failed run for ${workItemId}` } }
      });

      expect(createdItem).toBeDefined();
      expect(createdItem?.title).toContain(`Fix failed run for ${workItemId}: ${failedStepId}`);
      expect(createdItem?.summary).toContain(runId);
      expect(createdItem?.summary).toContain(failureReason);
      expect(createdItem?.kind).toBe("task");
      expect(createdItem?.priority).toBe("high");
      expect(createdItem?.status).toBe("backlog");
    });

    it("skips creation if run context has no workItemId", async () => {
      const runId = "run-456";
      const runContext: Record<string, unknown> = {
        input: {} // No workItemId
      };

      await createFollowUpWorkItemForFailedRun(
        runId,
        runContext,
        "step-execute",
        "Some error",
        testPlanningDbUrl
      );

      // Verify no item was created
      const items = await planningPrisma.planWorkItem.findMany();
      expect(items).toHaveLength(0);
    });

    it("prevents duplicate follow-up items", async () => {
      const runId = "run-789";
      const workItemId = "PLAN-225";
      const failedStepId = "step-execute";

      const runContext: Record<string, unknown> = {
        input: { workItemId }
      };

      // Create first follow-up item
      await createFollowUpWorkItemForFailedRun(
        runId,
        runContext,
        failedStepId,
        "Error message",
        testPlanningDbUrl
      );

      // Attempt to create again with same workItemId
      await createFollowUpWorkItemForFailedRun(
        runId,
        runContext,
        failedStepId,
        "Different error message",
        testPlanningDbUrl
      );

      // Verify only one item exists
      const items = await planningPrisma.planWorkItem.findMany({
        where: { title: { contains: `Fix failed run for ${workItemId}` } }
      });
      expect(items).toHaveLength(1);
    });

    it("skips creation when no planning database URL is provided", async () => {
      const runId = "run-skip";
      const workItemId = "PLAN-225";
      const runContext: Record<string, unknown> = {
        input: { workItemId }
      };

      // Should not throw, should just return early
      await expect(
        createFollowUpWorkItemForFailedRun(
          runId,
          runContext,
          "step-id",
          "error",
          undefined
        )
      ).resolves.not.toThrow();

      // Verify nothing was created
      const items = await planningPrisma.planWorkItem.findMany();
      expect(items).toHaveLength(0);
    });

    it("extracts workItemId from direct context property", async () => {
      const runId = "run-direct";
      const workItemId = "PLAN-230";
      const runContext: Record<string, unknown> = {
        workItemId // Direct property, not nested in input
      };

      await createFollowUpWorkItemForFailedRun(
        runId,
        runContext,
        "step-deploy",
        "Deployment failed",
        testPlanningDbUrl
      );

      // Verify follow-up item was created
      const createdItem = await planningPrisma.planWorkItem.findFirst({
        where: { title: { contains: `Fix failed run for ${workItemId}` } }
      });

      expect(createdItem).toBeDefined();
      expect(createdItem?.title).toContain(workItemId);
    });

    it("handles failed step ID being undefined gracefully", async () => {
      const runId = "run-nostep";
      const workItemId = "PLAN-225";
      const runContext: Record<string, unknown> = {
        input: { workItemId }
      };

      await createFollowUpWorkItemForFailedRun(
        runId,
        runContext,
        undefined, // No failed step ID
        "Generic error",
        testPlanningDbUrl
      );

      // Verify follow-up item was created with "unknown step"
      const createdItem = await planningPrisma.planWorkItem.findFirst({
        where: { title: { contains: `Fix failed run for ${workItemId}` } }
      });

      expect(createdItem).toBeDefined();
      expect(createdItem?.title).toContain("unknown step");
    });

    it("includes error context from runContextJson if available", async () => {
      const runId = "run-context";
      const workItemId = "PLAN-225";
      const failedStepId = "step-validate";
      const runContext: Record<string, unknown> = {
        input: { workItemId },
        error: {
          message: "Expected property 'config' to be defined"
        }
      };

      await createFollowUpWorkItemForFailedRun(
        runId,
        runContext,
        failedStepId,
        "Validation error",
        testPlanningDbUrl
      );

      // Verify error details are in summary
      const createdItem = await planningPrisma.planWorkItem.findFirst({
        where: { title: { contains: `Fix failed run for ${workItemId}` } }
      });

      expect(createdItem?.summary).toContain("Expected property 'config' to be defined");
    });
  });
});
