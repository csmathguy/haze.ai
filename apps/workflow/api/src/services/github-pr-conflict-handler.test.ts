import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient } from "@taxes/db";
import { GitHubPrConflictHandler } from "./github-pr-conflict-handler.js";

describe("GitHubPrConflictHandler", () => {
  let mockDb: Partial<PrismaClient>;

  beforeEach(() => {
    mockDb = {
      workflowRun: {
        create: vi.fn().mockResolvedValue({ id: "run-123" })
      },
      workflowEvent: {
        update: vi.fn().mockResolvedValue({})
      }
    };
  });

  describe("handleEvent", () => {
    it("should emit a github.pull_request.conflict event when mergeable_state is dirty and PLAN-XXX is in body", async () => {
      const handler = new GitHubPrConflictHandler(mockDb as PrismaClient);

      const event = {
        id: "event-1",
        type: "github.pull_request.conflict",
        source: "github",
        payload: JSON.stringify({
          action: "opened",
          pull_request: {
            number: 123,
            title: "Fix bug",
            body: "Fixes PLAN-216\n\nChanges made...",
            mergeable_state: "dirty",
            head: { ref: "feature/bug-fix", sha: "abc123" },
            base: { ref: "main", sha: "def456" },
            html_url: "https://github.com/owner/repo/pull/123"
          }
        }),
        correlationId: null,
        processedAt: null,
        failedAt: null,
        failureReason: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await handler.handleEvent(event);

      expect(result).toBe("run-123");
      expect(mockDb.workflowRun?.create).toHaveBeenCalledWith({
        data: {
          definitionName: "conflict-repair",
          version: "1.0.0",
          status: "pending",
          correlationId: "conflict-PLAN-216-123",
          contextJson: JSON.stringify({
            workItemId: "PLAN-216",
            prNumber: 123,
            prTitle: "Fix bug",
            headBranch: "feature/bug-fix",
            baseBranch: "main",
            headSha: "abc123",
            baseSha: "def456",
            prUrl: "https://github.com/owner/repo/pull/123",
            prBody: "Fixes PLAN-216\n\nChanges made..."
          })
        }
      });
      expect(mockDb.workflowEvent?.update).toHaveBeenCalledWith({
        where: { id: "event-1" },
        data: { processedAt: expect.any(Date) }
      });
    });

    it("should return null if no PLAN-XXX reference is found in PR body", async () => {
      const handler = new GitHubPrConflictHandler(mockDb as PrismaClient);

      const event = {
        id: "event-2",
        type: "github.pull_request.conflict",
        source: "github",
        payload: JSON.stringify({
          action: "opened",
          pull_request: {
            number: 124,
            title: "Update docs",
            body: "Documentation update with no plan reference",
            mergeable_state: "dirty",
            head: { ref: "feature/docs", sha: "xyz789" },
            base: { ref: "main", sha: "def456" },
            html_url: "https://github.com/owner/repo/pull/124"
          }
        }),
        correlationId: null,
        processedAt: null,
        failedAt: null,
        failureReason: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await handler.handleEvent(event);

      expect(result).toBeNull();
      expect(mockDb.workflowRun?.create).not.toHaveBeenCalled();
      expect(mockDb.workflowEvent?.update).not.toHaveBeenCalled();
    });

    it("should return null if payload is malformed", async () => {
      const handler = new GitHubPrConflictHandler(mockDb as PrismaClient);

      const event = {
        id: "event-3",
        type: "github.pull_request.conflict",
        source: "github",
        payload: "invalid json",
        correlationId: null,
        processedAt: null,
        failedAt: null,
        failureReason: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await expect(handler.handleEvent(event)).rejects.toThrow("Failed to parse event payload");
    });

    it("should handle PLAN reference case-insensitively", async () => {
      const handler = new GitHubPrConflictHandler(mockDb as PrismaClient);

      const event = {
        id: "event-4",
        type: "github.pull_request.conflict",
        source: "github",
        payload: JSON.stringify({
          action: "synchronize",
          pull_request: {
            number: 125,
            title: "Test case sensitivity",
            body: "Fixes plan-999 in lowercase",
            mergeable_state: "dirty",
            head: { ref: "feature/test", sha: "aaa111" },
            base: { ref: "main", sha: "def456" },
            html_url: "https://github.com/owner/repo/pull/125"
          }
        }),
        correlationId: null,
        processedAt: null,
        failedAt: null,
        failureReason: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await handler.handleEvent(event);

      expect(result).toBe("run-123");
      expect(mockDb.workflowRun?.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contextJson: expect.stringContaining("PLAN-999")
          })
        })
      );
    });

    it("should return null if pull_request data is missing required fields", async () => {
      const handler = new GitHubPrConflictHandler(mockDb as PrismaClient);

      const event = {
        id: "event-5",
        type: "github.pull_request.conflict",
        source: "github",
        payload: JSON.stringify({
          action: "opened",
          pull_request: {
            number: 126,
            title: "Incomplete PR",
            body: "Fixes PLAN-300"
            // missing head, base, html_url
          }
        }),
        correlationId: null,
        processedAt: null,
        failedAt: null,
        failureReason: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await handler.handleEvent(event);

      expect(result).toBeNull();
      expect(mockDb.workflowRun?.create).not.toHaveBeenCalled();
    });
  });
});
