import { describe, it, expect, beforeEach, vi } from "vitest";
import { GitHubCiFailedHandler } from "./github-ci-failed-handler.js";
import type { PrismaClient } from "@taxes/db";

// Mock the planning database client
vi.mock("@taxes/plan-api", () => ({
  getPrismaClient: vi.fn()
}));

describe("GitHubCiFailedHandler", () => {
  let mockWorkflowDb: Partial<PrismaClient>;
  let handler: GitHubCiFailedHandler;
  let mockCreateEvent: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockCreateEvent = vi.fn().mockResolvedValue({
      id: "event-123",
      type: "github.ci.failed"
    });

    mockWorkflowDb = {
      workflowEvent: {
        create: mockCreateEvent
      } as never
    };

    handler = new GitHubCiFailedHandler(mockWorkflowDb as PrismaClient);
  });

  it("should emit github.ci.failed event when PR is linked to a work item", async () => {
    const { getPrismaClient } = await import("@taxes/plan-api");
    const mockPlanningDb = {
      planWorkItem: {
        findUnique: vi.fn().mockResolvedValue({ id: "PLAN-218" })
      },
      $disconnect: vi.fn()
    };
    (getPrismaClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockPlanningDb);

    const payload = JSON.stringify({
      pull_request: {
        number: 42,
        body: "Fixes PLAN-218: Implement CI failure detection\n\nThis PR adds CI failure event handlers."
      }
    });

    await handler.handleEvent(42, "Test Job", "https://github.com/example/logs", payload);

    expect(mockCreateEvent).toHaveBeenCalledWith({
      data: {
        type: "github.ci.failed",
        source: "github",
        correlationId: "pr-42",
        payload: JSON.stringify({
          prNumber: 42,
          jobName: "Test Job",
          logsUrl: "https://github.com/example/logs",
          failedSteps: [],
          workItemId: "PLAN-218"
        })
      }
    });
  });

  it("should silently ignore CI failures when PR body is missing", async () => {
    const { getPrismaClient } = await import("@taxes/plan-api");
    const mockPlanningDb = {
      planWorkItem: {
        findUnique: vi.fn()
      },
      $disconnect: vi.fn()
    };
    (getPrismaClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockPlanningDb);

    const payload = JSON.stringify({
      pull_request: {
        number: 42,
        body: null
      }
    });

    await handler.handleEvent(42, "Test Job", "https://github.com/example/logs", payload);

    expect(mockCreateEvent).not.toHaveBeenCalled();
  });

  it("should silently ignore CI failures when PLAN-XXX is not in PR body", async () => {
    const { getPrismaClient } = await import("@taxes/plan-api");
    const mockPlanningDb = {
      planWorkItem: {
        findUnique: vi.fn()
      },
      $disconnect: vi.fn()
    };
    (getPrismaClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockPlanningDb);

    const payload = JSON.stringify({
      pull_request: {
        number: 42,
        body: "This is a normal PR without work item reference"
      }
    });

    await handler.handleEvent(42, "Test Job", "https://github.com/example/logs", payload);

    expect(mockCreateEvent).not.toHaveBeenCalled();
  });

  it("should silently ignore CI failures when work item does not exist", async () => {
    const { getPrismaClient } = await import("@taxes/plan-api");
    const mockPlanningDb = {
      planWorkItem: {
        findUnique: vi.fn().mockResolvedValue(null)
      },
      $disconnect: vi.fn()
    };
    (getPrismaClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockPlanningDb);

    const payload = JSON.stringify({
      pull_request: {
        number: 42,
        body: "Fixes PLAN-999: Nonexistent work item"
      }
    });

    await handler.handleEvent(42, "Test Job", "https://github.com/example/logs", payload);

    expect(mockCreateEvent).not.toHaveBeenCalled();
  });

  it("should extract work item ID from PR body with case-insensitive matching", async () => {
    const { getPrismaClient } = await import("@taxes/plan-api");
    const mockPlanningDb = {
      planWorkItem: {
        findUnique: vi.fn().mockResolvedValue({ id: "PLAN-100" })
      },
      $disconnect: vi.fn()
    };
    (getPrismaClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockPlanningDb);

    const payload = JSON.stringify({
      pull_request: {
        number: 42,
        body: "Fixes plan-100: lowercase work item reference"
      }
    });

    await handler.handleEvent(42, "Test Job", "https://github.com/example/logs", payload);

    expect(mockCreateEvent).toHaveBeenCalled();
    const callArgs = mockCreateEvent.mock.calls[0]?.[0] as { data: { payload: string } };
    const eventPayload = JSON.parse(callArgs.data.payload);
    expect(eventPayload.workItemId).toBe("PLAN-100");
  });

  it("should properly disconnect planning database", async () => {
    const { getPrismaClient } = await import("@taxes/plan-api");
    const mockDisconnect = vi.fn();
    const mockPlanningDb = {
      planWorkItem: {
        findUnique: vi.fn().mockResolvedValue({ id: "PLAN-218" })
      },
      $disconnect: mockDisconnect
    };
    (getPrismaClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockPlanningDb);

    const payload = JSON.stringify({
      pull_request: {
        number: 42,
        body: "Fixes PLAN-218"
      }
    });

    await handler.handleEvent(42, "Test Job", "https://github.com/example/logs", payload);

    expect(mockDisconnect).toHaveBeenCalled();
  });
});
