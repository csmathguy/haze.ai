import { describe, expect, test, vi } from "vitest";
import { OrchestratorWorkerService } from "../src/orchestrator-worker.js";
import { TaskWorkflowService } from "../src/tasks.js";

describe("OrchestratorWorkerService", () => {
  test("processes queued workflow actions and persists worker checkpoints", async () => {
    const audit = {
      record: vi.fn(async () => {})
    };
    const tasks = new TaskWorkflowService(audit, { random: () => 0 });
    const created = await tasks.create({ title: "Worker queued task" });
    await tasks.update(created.id, {
      metadata: {
        workflowRuntime: {
          schemaVersion: "1.0",
          lastTransition: null,
          nextActions: [{ id: "planner_execute_1", type: "planner_execute" }],
          blockingReasons: [],
          actionHistory: []
        }
      }
    });

    const worker = new OrchestratorWorkerService(tasks, audit, {
      now: () => new Date("2026-02-19T00:00:00.000Z")
    });
    worker.start();
    await worker.runOnce();
    worker.stop();

    const updated = tasks.get(created.id);
    const workerRuntime = updated.metadata.workerRuntime as Record<string, unknown>;
    const taskStates = workerRuntime.tasks as Record<string, unknown>;
    const taskState = taskStates[created.id] as Record<string, unknown>;
    const checkpoints = taskState.checkpoints as Array<Record<string, unknown>>;

    expect(workerRuntime.sessionId).toBeTypeOf("string");
    expect(taskState.dispatchedActionIds).toContain("planner_execute_1");
    expect(checkpoints).toHaveLength(1);
    expect(checkpoints[0]?.actionType).toBe("planner_execute");
    expect(
      audit.record.mock.calls.some(
        ([event]) => event.eventType === "worker_action_dispatched"
      )
    ).toBe(true);
  });

  test("deduplicates action dispatches across repeated runs", async () => {
    const audit = {
      record: vi.fn(async () => {})
    };
    const tasks = new TaskWorkflowService(audit, { random: () => 0 });
    const created = await tasks.create({ title: "Worker dedupe task" });
    await tasks.update(created.id, {
      metadata: {
        workflowRuntime: {
          schemaVersion: "1.0",
          lastTransition: null,
          nextActions: [{ id: "manual_review", type: "skill", skill: "workflow-stage-artifact" }],
          blockingReasons: [],
          actionHistory: []
        }
      }
    });

    const worker = new OrchestratorWorkerService(tasks, audit, {
      now: () => new Date("2026-02-19T00:00:00.000Z")
    });
    worker.start();
    await worker.runOnce();
    await worker.runOnce();
    worker.stop();

    const dispatchEvents = audit.record.mock.calls.filter(
      ([event]) => event.eventType === "worker_action_dispatched"
    );
    expect(dispatchEvents).toHaveLength(1);
  });

  test("reports lifecycle status transitions", () => {
    const audit = {
      record: vi.fn(async () => {})
    };
    const tasks = new TaskWorkflowService(audit, { random: () => 0 });
    const worker = new OrchestratorWorkerService(tasks, audit);

    expect(worker.getStatus().running).toBe(false);
    worker.start();
    expect(worker.getStatus().running).toBe(true);
    expect(worker.getStatus().sessionId).toBeTypeOf("string");
    worker.stop();
    expect(worker.getStatus().running).toBe(false);
  });

  test("retries transient dispatch failures with bounded attempts", async () => {
    const audit = {
      record: vi.fn(async () => {})
    };
    const tasks = new TaskWorkflowService(audit, { random: () => 0 });
    const created = await tasks.create({ title: "Worker retry task" });
    await tasks.update(created.id, {
      metadata: {
        workflowRuntime: {
          schemaVersion: "1.0",
          lastTransition: null,
          nextActions: [{ id: "retry_action", type: "skill", skill: "workflow-stage-artifact" }],
          blockingReasons: [],
          actionHistory: []
        }
      }
    });

    const dispatchAction = vi.fn(async (job: { attempt: number }) => {
      if (job.attempt < 1) {
        throw new Error("transient");
      }
    });

    const worker = new OrchestratorWorkerService(tasks, audit, {
      now: () => new Date("2026-02-19T00:00:00.000Z"),
      dispatchAction,
      maxDispatchAttempts: 3
    });
    worker.start();
    await worker.runOnce();
    worker.stop();

    expect(dispatchAction).toHaveBeenCalledTimes(2);
    const updated = tasks.get(created.id);
    const workerRuntime = updated.metadata.workerRuntime as Record<string, unknown>;
    const taskState = (workerRuntime.tasks as Record<string, unknown>)[created.id] as Record<
      string,
      unknown
    >;
    expect(taskState.dispatchedActionIds).toContain("retry_action");
    expect(taskState.failedActionIds).toEqual([]);
  });

  test("records terminal failure when retry budget is exhausted", async () => {
    const audit = {
      record: vi.fn(async () => {})
    };
    const tasks = new TaskWorkflowService(audit, { random: () => 0 });
    const created = await tasks.create({ title: "Worker terminal failure task" });
    await tasks.update(created.id, {
      metadata: {
        workflowRuntime: {
          schemaVersion: "1.0",
          lastTransition: null,
          nextActions: [{ id: "always_fail", type: "command", command: "npm", args: ["run"] }],
          blockingReasons: [],
          actionHistory: []
        }
      }
    });

    const dispatchAction = vi.fn(async () => {
      throw new Error("permanent");
    });

    const worker = new OrchestratorWorkerService(tasks, audit, {
      now: () => new Date("2026-02-19T00:00:00.000Z"),
      dispatchAction,
      maxDispatchAttempts: 2
    });
    worker.start();
    await worker.runOnce();
    worker.stop();

    expect(dispatchAction).toHaveBeenCalledTimes(2);
    const updated = tasks.get(created.id);
    const workerRuntime = updated.metadata.workerRuntime as Record<string, unknown>;
    const taskState = (workerRuntime.tasks as Record<string, unknown>)[created.id] as Record<
      string,
      unknown
    >;
    expect(taskState.failedActionIds).toContain("always_fail");
    expect(
      audit.record.mock.calls.some(
        ([event]) => event.eventType === "worker_action_dispatch_failed"
      )
    ).toBe(true);
  });
});
