import { describe, expect, test, vi } from "vitest";
import { WorkflowHookDispatcher } from "../src/workflow-hook-dispatcher.js";

describe("WorkflowHookDispatcher", () => {
  test("suppresses duplicate jobs by idempotency key", async () => {
    const dispatch = vi.fn(async () => {});
    const dispatcher = new WorkflowHookDispatcher({ dispatch });
    const base = {
      taskId: "task-1",
      actionId: "action-1",
      actionType: "skill",
      runId: "run-1",
      sessionId: "session-1",
      processedAt: "2026-02-19T00:00:00.000Z",
      maxAttempts: 3,
      attempt: 0
    };

    expect(dispatcher.enqueue({ ...base, key: "task-1:action-1" })).toBe(true);
    expect(dispatcher.enqueue({ ...base, key: "task-1:action-1" })).toBe(false);

    const results = await dispatcher.processAll();
    expect(results).toHaveLength(1);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  test("retries until success within max attempts", async () => {
    const dispatch = vi.fn(async (job: { attempt: number }) => {
      if (job.attempt < 1) {
        throw new Error("transient");
      }
    });
    const dispatcher = new WorkflowHookDispatcher({ dispatch });

    dispatcher.enqueue({
      key: "task-2:action-2",
      taskId: "task-2",
      actionId: "action-2",
      actionType: "planner_execute",
      runId: "run-1",
      sessionId: "session-1",
      processedAt: "2026-02-19T00:00:00.000Z",
      maxAttempts: 3,
      attempt: 0
    });

    const results = await dispatcher.processAll();
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(results[0]?.status).toBe("dispatched");
    expect(results[0]?.job.attempt).toBe(1);
  });

  test("returns failed result when retry budget is exhausted", async () => {
    const dispatch = vi.fn(async () => {
      throw new Error("permanent");
    });
    const dispatcher = new WorkflowHookDispatcher({ dispatch });

    dispatcher.enqueue({
      key: "task-3:action-3",
      taskId: "task-3",
      actionId: "action-3",
      actionType: "command",
      runId: "run-1",
      sessionId: "session-1",
      processedAt: "2026-02-19T00:00:00.000Z",
      maxAttempts: 2,
      attempt: 0
    });

    const results = await dispatcher.processAll();
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(results[0]?.status).toBe("failed");
    expect(results[0]?.error).toBe("permanent");
  });
});
