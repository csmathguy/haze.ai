/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment */
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import type { PrismaClient } from "@taxes/db";
import { getPrismaClient } from "@taxes/db";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { applyPendingMigrations as applyWorkflowMigrations } from "../db/migrations.js";
import { GitHubPrMergedHandler } from "./github-pr-merged-handler.js";

// Mock the planning client
vi.mock("@taxes/plan-api", () => ({
  getPrismaClient: vi.fn()
}));

describe("GitHubPrMergedHandler", () => {
  let workflowPrisma: PrismaClient;
  let mockPlanningDb: Record<string, unknown>;

  beforeAll(async () => {
    // Set up test database with a temporary file-based SQLite
    const tempDir = tmpdir();
    const testDbFile = join(tempDir, `test-workflow-${randomUUID()}.db`);
    const testDbUrl = `file:${testDbFile}`;
    await applyWorkflowMigrations(testDbUrl);
    workflowPrisma = await getPrismaClient(testDbUrl);
  });

  afterAll(async () => {
    await workflowPrisma.$disconnect();
  });

  beforeEach(() => {
    // Reset mock before each test
    mockPlanningDb = {
      planWorkItem: {
        updateMany: vi.fn(() => Promise.resolve({ count: 1 } as unknown))
      },
      $disconnect: vi.fn(() => Promise.resolve(undefined))
    };
  });

  it("extracts PLAN-XXX references from PR body and marks work items as done", async () => {
    const { getPrismaClient: getMockPlanClient } = await import("@taxes/plan-api");
    vi.mocked(getMockPlanClient).mockResolvedValue(mockPlanningDb as never);

    const handler = new GitHubPrMergedHandler(workflowPrisma);

    const realEvent = await workflowPrisma.workflowEvent.create({
      data: {
        type: "github.pull_request.merged",
        source: "github",
        payload: JSON.stringify({
          pull_request: {
            number: 123,
            title: "Fix: resolve issue",
            body: "Closes PLAN-167\n\nThis PR implements the GitHub PR merged trigger feature.",
            merged: true
          }
        })
      }
    });

    const count = await handler.handleEvent(realEvent);

    expect(count).toBe(1);
    const planWorkItem = mockPlanningDb.planWorkItem as Record<string, unknown>;
    expect(planWorkItem.updateMany).toHaveBeenCalledWith({
      where: { id: "PLAN-167" },
      data: { status: "done", updatedAt: expect.any(Date) }
    });
    expect(mockPlanningDb.$disconnect).toHaveBeenCalled();
  });

  it("handles multiple PLAN-XXX references in PR body", async () => {
    const { getPrismaClient: getMockPlanClient } = await import("@taxes/plan-api");
    vi.mocked(getMockPlanClient).mockResolvedValue(mockPlanningDb as never);

    const handler = new GitHubPrMergedHandler(workflowPrisma);

    const realEvent = await workflowPrisma.workflowEvent.create({
      data: {
        type: "github.pull_request.merged",
        source: "github",
        payload: JSON.stringify({
          pull_request: {
            number: 124,
            title: "Multi-feature PR",
            body: "This PR closes PLAN-167 and PLAN-166. Also addresses PLAN-165 indirectly.",
            merged: true
          }
        })
      }
    });

    const count = await handler.handleEvent(realEvent);

    expect(count).toBe(3);
    expect(mockPlanningDb.planWorkItem.updateMany).toHaveBeenCalledTimes(3);
  });

  it("deduplicates PLAN references in PR body", async () => {
    const { getPrismaClient: getMockPlanClient } = await import("@taxes/plan-api");
    vi.mocked(getMockPlanClient).mockResolvedValue(mockPlanningDb as never);

    const handler = new GitHubPrMergedHandler(workflowPrisma);

    const realEvent = await workflowPrisma.workflowEvent.create({
      data: {
        type: "github.pull_request.merged",
        source: "github",
        payload: JSON.stringify({
          pull_request: {
            number: 125,
            title: "Dedup test",
            body: "Fixes PLAN-167. Also related to PLAN-167. And PLAN-167 again.",
            merged: true
          }
        })
      }
    });

    const count = await handler.handleEvent(realEvent);

    // Should only update once for the deduplicated reference
    expect(count).toBe(1);
    expect(mockPlanningDb.planWorkItem.updateMany).toHaveBeenCalledTimes(1);
  });

  it("returns 0 when PR body has no PLAN references", async () => {
    const { getPrismaClient: getMockPlanClient } = await import("@taxes/plan-api");
    vi.mocked(getMockPlanClient).mockResolvedValue(mockPlanningDb as never);

    const handler = new GitHubPrMergedHandler(workflowPrisma);

    const realEvent = await workflowPrisma.workflowEvent.create({
      data: {
        type: "github.pull_request.merged",
        source: "github",
        payload: JSON.stringify({
          pull_request: {
            number: 126,
            title: "No plan refs",
            body: "This is a regular PR with no work item references.",
            merged: true
          }
        })
      }
    });

    const count = await handler.handleEvent(realEvent);

    expect(count).toBe(0);
    expect(mockPlanningDb.planWorkItem.updateMany).not.toHaveBeenCalled();
  });

  it("returns 0 when PR has no body", async () => {
    const { getPrismaClient: getMockPlanClient } = await import("@taxes/plan-api");
    vi.mocked(getMockPlanClient).mockResolvedValue(mockPlanningDb as never);

    const handler = new GitHubPrMergedHandler(workflowPrisma);

    const realEvent = await workflowPrisma.workflowEvent.create({
      data: {
        type: "github.pull_request.merged",
        source: "github",
        payload: JSON.stringify({
          pull_request: {
            number: 127,
            title: "No body PR",
            body: null,
            merged: true
          }
        })
      }
    });

    const count = await handler.handleEvent(realEvent);

    expect(count).toBe(0);
    expect(mockPlanningDb.planWorkItem.updateMany).not.toHaveBeenCalled();
  });

  it("handles work item not found gracefully", async () => {
    const { getPrismaClient: getMockPlanClient } = await import("@taxes/plan-api");

    // Mock to throw when updating a non-existent work item
    const mockDb: Record<string, unknown> = {
      planWorkItem: {
        updateMany: vi.fn(() => {
          return Promise.reject(new Error("Work item not found"));
        })
      },
      $disconnect: vi.fn(() => Promise.resolve(undefined))
    };

    vi.mocked(getMockPlanClient).mockResolvedValue(mockDb);

    const handler = new GitHubPrMergedHandler(workflowPrisma);

    const realEvent = await workflowPrisma.workflowEvent.create({
      data: {
        type: "github.pull_request.merged",
        source: "github",
        payload: JSON.stringify({
          pull_request: {
            number: 128,
            title: "Non-existent ref",
            body: "Closes PLAN-999999",
            merged: true
          }
        })
      }
    });

    // Should not throw, should silently handle the error
    const count = await handler.handleEvent(realEvent);

    expect(count).toBe(0);
    expect(mockDb.$disconnect).toHaveBeenCalled();
  });

  it("marks event as processed after handling", async () => {
    const { getPrismaClient: getMockPlanClient } = await import("@taxes/plan-api");
    vi.mocked(getMockPlanClient).mockResolvedValue(mockPlanningDb as never);

    const handler = new GitHubPrMergedHandler(workflowPrisma);

    // Create a real event in the database
    const realEvent = await workflowPrisma.workflowEvent.create({
      data: {
        type: "github.pull_request.merged",
        source: "github",
        payload: JSON.stringify({
          pull_request: {
            number: 129,
            title: "Test processedAt",
            body: "Closes PLAN-167",
            merged: true
          }
        })
      }
    });

    await handler.handleEvent(realEvent);

    // Verify event was marked as processed
    const updatedEvent = await workflowPrisma.workflowEvent.findUnique({
      where: { id: realEvent.id }
    });

    expect(updatedEvent?.processedAt).not.toBeNull();
  });
});
