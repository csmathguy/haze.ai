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

  test("does not auto-transition planning task when determination source is local planner hook", async () => {
    const audit = {
      record: vi.fn(async () => {})
    };
    const tasks = new TaskWorkflowService(audit, { random: () => 0 });
    const created = await tasks.create({
      title: "Planning autopilot ready task",
      description: "Has enough context",
      metadata: {
        acceptanceCriteria: ["Complete planning artifact and move forward"]
      }
    });
    await tasks.update(created.id, { status: "planning" });

    const worker = new OrchestratorWorkerService(tasks, audit, {
      now: () => new Date("2026-02-19T00:00:00.000Z"),
      evaluatePlanningTask: async () => ({
        decision: "needs_info",
        reasonCodes: ["MANUAL_TEST_EXPECTS_PLANNING"],
        evaluationSource: "heuristic",
        usedFallback: true
      })
    });
    worker.start();
    await worker.runOnce();
    worker.stop();

    const updated = tasks.get(created.id);
    expect(updated.status).toBe("planning");
    expect(
      audit.record.mock.calls.some(
        ([event]) => event.eventType === "worker_planning_transitioned_to_architecture_review"
      )
    ).toBe(false);
  });

  test("does not auto-transition planning task when planner determination is missing", async () => {
    const audit = {
      record: vi.fn(async () => {})
    };
    const taskId = "planning-no-determination";
    const updatedAt = "2026-02-19T00:00:00.000Z";
    const tasks = new TaskWorkflowService(audit, {
      random: () => 0,
      initialTasks: [
        {
          id: taskId,
          title: "Planning task without determination",
          description: "Ready-looking artifacts but no planner decision",
          priority: 3,
          status: "planning",
          dependencies: [],
          createdAt: updatedAt,
          updatedAt,
          startedAt: updatedAt,
          completedAt: null,
          dueAt: null,
          tags: [],
          metadata: {
            acceptanceCriteria: ["Document transition gate behavior"],
            planningArtifact: {
              createdAt: updatedAt,
              goals: ["Define planning goal"],
              steps: ["Define planning step"],
              risks: []
            },
            testingArtifacts: {
              schemaVersion: "1.0",
              planned: {
                gherkinScenarios: ["Given readiness gate..."],
                unitTestIntent: ["Validate readiness gate"],
                integrationTestIntent: ["Validate worker transition"],
                notes: null
              },
              implemented: {
                testsAddedOrUpdated: [],
                evidenceLinks: [],
                commandsRun: [],
                notes: null
              }
            },
            workerRuntime: {
              sessionId: "session-seeded",
              startedAt: updatedAt,
              lastTickAt: null,
              tasks: {
                [taskId]: {
                  sessionId: "session-seeded",
                  lastRunId: null,
                  lastProcessedAt: null,
                  planningReconciliationKeys: [`planning:${updatedAt}`],
                  dispatchedActionIds: [],
                  failedActionIds: [],
                  checkpoints: []
                }
              }
            }
          }
        }
      ]
    });

    const worker = new OrchestratorWorkerService(tasks, audit, {
      now: () => new Date(updatedAt),
      evaluatePlanningTask: async () => ({
        decision: "needs_info",
        reasonCodes: ["MANUAL_TEST_EXPECTS_PLANNING"],
        evaluationSource: "heuristic",
        usedFallback: true
      })
    });
    worker.start();
    await worker.runOnce();
    worker.stop();

    const updated = tasks.get(taskId);
    expect(updated.status).toBe("planning");
    expect(
      audit.record.mock.calls.some(
        ([event]) => event.eventType === "worker_planning_transitioned_to_architecture_review"
      )
    ).toBe(false);
  });

  test("auto-transitions planning task when approved by planning_agent source", async () => {
    const audit = {
      record: vi.fn(async () => {})
    };
    const taskId = "planning-agent-approved";
    const updatedAt = "2026-02-19T00:00:00.000Z";
    const tasks = new TaskWorkflowService(audit, {
      random: () => 0,
      initialTasks: [
        {
          id: taskId,
          title: "Planning task approved by planning agent",
          description: "Ready artifacts with external planner approval",
          priority: 3,
          status: "planning",
          dependencies: [],
          createdAt: updatedAt,
          updatedAt,
          startedAt: updatedAt,
          completedAt: null,
          dueAt: null,
          tags: [],
          metadata: {
            acceptanceCriteria: ["Document transition gate behavior"],
            planningArtifact: {
              createdAt: updatedAt,
              goals: ["Define planning goal"],
              steps: ["Define planning step"],
              risks: []
            },
            testingArtifacts: {
              schemaVersion: "1.0",
              planned: {
                gherkinScenarios: ["Given readiness gate..."],
                unitTestIntent: ["Validate readiness gate"],
                integrationTestIntent: ["Validate worker transition"],
                notes: null
              },
              implemented: {
                testsAddedOrUpdated: [],
                evidenceLinks: [],
                commandsRun: [],
                notes: null
              }
            },
            plannerDetermination: {
              decision: "approved",
              source: "planning_agent",
              reasonCodes: [],
              decidedAt: updatedAt
            },
            workerRuntime: {
              sessionId: "session-seeded",
              startedAt: updatedAt,
              lastTickAt: null,
              tasks: {
                [taskId]: {
                  sessionId: "session-seeded",
                  lastRunId: null,
                  lastProcessedAt: null,
                  planningReconciliationKeys: [`planning:${updatedAt}`],
                  dispatchedActionIds: [],
                  failedActionIds: [],
                  checkpoints: []
                }
              }
            }
          }
        }
      ]
    });

    const worker = new OrchestratorWorkerService(tasks, audit, {
      now: () => new Date(updatedAt)
    });
    worker.start();
    await worker.runOnce();
    worker.stop();

    const updated = tasks.get(taskId);
    expect(updated.status).toBe("architecture_review");
    expect(
      audit.record.mock.calls.some(
        ([event]) => event.eventType === "worker_planning_transitioned_to_architecture_review"
      )
    ).toBe(true);
  });

  test("evaluates planning task via planning-agent runner and records completion audit", async () => {
    const audit = {
      record: vi.fn(async () => {})
    };
    const evaluatePlanningTask = vi.fn(async () => ({
      decision: "approved" as const,
      reasonCodes: [],
      evaluationSource: "heuristic" as const,
      usedFallback: true
    }));
    const tasks = new TaskWorkflowService(audit, { random: () => 0 });
    const created = await tasks.create({
      title: "Planning runner task",
      description: "Needs scheduler evaluation",
      metadata: {
        acceptanceCriteria: ["Ready for architecture review"]
      }
    });
    await tasks.update(created.id, { status: "planning" });

    const worker = new OrchestratorWorkerService(tasks, audit, {
      now: () => new Date("2026-02-19T00:00:00.000Z"),
      evaluatePlanningTask
    });
    worker.start();
    await worker.runOnce();
    worker.stop();

    expect(evaluatePlanningTask).toHaveBeenCalledTimes(1);
    expect(
      audit.record.mock.calls.some(
        ([event]) => event.eventType === "worker_planning_agent_evaluation_completed"
      )
    ).toBe(true);
  });

  test("does not re-run planning-agent evaluation after task leaves planning", async () => {
    const audit = {
      record: vi.fn(async () => {})
    };
    const evaluatePlanningTask = vi.fn(async () => ({
      decision: "approved" as const,
      reasonCodes: [],
      evaluationSource: "heuristic" as const,
      usedFallback: true
    }));
    const taskId = "planning-eval-dedupe";
    const updatedAt = "2026-02-19T00:00:00.000Z";
    const tasks = new TaskWorkflowService(audit, {
      random: () => 0,
      initialTasks: [
        {
          id: taskId,
          title: "Planning eval dedupe task",
          description: "Unchanged snapshot should not be re-evaluated",
          priority: 3,
          status: "planning",
          dependencies: [],
          createdAt: updatedAt,
          updatedAt,
          startedAt: updatedAt,
          completedAt: null,
          dueAt: null,
          tags: [],
          metadata: {
            acceptanceCriteria: ["ready"],
            planningArtifact: {
              createdAt: updatedAt,
              goals: ["Goal"],
              steps: ["Step"],
              risks: []
            },
            testingArtifacts: {
              schemaVersion: "1.0",
              planned: {
                gherkinScenarios: ["Scenario"],
                unitTestIntent: ["Unit"],
                integrationTestIntent: ["Integration"],
                notes: null
              },
              implemented: {
                testsAddedOrUpdated: [],
                evidenceLinks: [],
                commandsRun: [],
                notes: null
              }
            },
            workerRuntime: {
              sessionId: "session-seeded",
              startedAt: updatedAt,
              lastTickAt: null,
              tasks: {
                [taskId]: {
                  sessionId: "session-seeded",
                  lastRunId: null,
                  lastProcessedAt: null,
                  planningReconciliationKeys: [`planning:${updatedAt}`],
                  dispatchedActionIds: [],
                  failedActionIds: [],
                  checkpoints: []
                }
              }
            }
          }
        }
      ]
    });

    const worker = new OrchestratorWorkerService(tasks, audit, {
      now: () => new Date(updatedAt),
      evaluatePlanningTask
    });
    worker.start();
    await worker.runOnce();
    await worker.runOnce();
    worker.stop();

    expect(evaluatePlanningTask).toHaveBeenCalledTimes(1);
  });

  test("records planning-agent evaluation failure without crashing worker tick", async () => {
    const audit = {
      record: vi.fn(async () => {})
    };
    const evaluatePlanningTask = vi.fn(async () => {
      throw new Error("planner_failure");
    });
    const tasks = new TaskWorkflowService(audit, { random: () => 0 });
    const created = await tasks.create({
      title: "Planning runner failure task",
      description: "Should audit failure",
      metadata: {
        acceptanceCriteria: ["Any"]
      }
    });
    await tasks.update(created.id, { status: "planning" });

    const worker = new OrchestratorWorkerService(tasks, audit, {
      now: () => new Date("2026-02-19T00:00:00.000Z"),
      evaluatePlanningTask
    });
    worker.start();
    await worker.runOnce();
    worker.stop();

    expect(
      audit.record.mock.calls.some(
        ([event]) => event.eventType === "worker_planning_agent_evaluation_failed"
      )
    ).toBe(true);
  });
});
