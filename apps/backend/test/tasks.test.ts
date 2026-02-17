import { describe, expect, test, vi } from "vitest";
import { TaskWorkflowService } from "../src/tasks.js";

function buildService(
  random = () => 0,
  options: ConstructorParameters<typeof TaskWorkflowService>[1] = {}
): TaskWorkflowService {
  const audit = {
    record: vi.fn(async () => {})
  };

  return new TaskWorkflowService(audit, { random, ...options });
}

describe("TaskWorkflowService", () => {
  test("supports CRUD with dependency validation", async () => {
    const service = buildService();

    const parent = await service.create({
      title: "Parent task",
      priority: 5
    });
    const child = await service.create({
      title: "Child task",
      dependencies: [parent.id],
      priority: 4
    });

    expect(service.list()).toHaveLength(2);
    expect(service.get(child.id).dependencies).toEqual([parent.id]);

    await service.update(parent.id, { status: "done" });
    await service.update(child.id, { status: "backlog" });
    const claimed = await service.claimNextTask();
    expect(claimed?.id).toBe(child.id);

    await expect(service.delete(parent.id)).rejects.toMatchObject({
      statusCode: 409
    });

    await service.delete(child.id);
    expect(service.list()).toHaveLength(1);
  });

  test("rejects unknown dependencies", async () => {
    const service = buildService();

    await expect(
      service.create({
        title: "Invalid",
        dependencies: ["missing-task"]
      })
    ).rejects.toMatchObject({
      message: "Unknown dependency: missing-task",
      statusCode: 400
    });
  });

  test("prevents dependency cycles", async () => {
    const service = buildService();

    const a = await service.create({ title: "A" });
    const b = await service.create({ title: "B", dependencies: [a.id] });

    await expect(
      service.update(a.id, {
        dependencies: [b.id]
      })
    ).rejects.toMatchObject({
      statusCode: 400
    });
  });

  test("selects highest priority and randomizes ties", async () => {
    const service = buildService(() => 0.8);

    const low = await service.create({ title: "Low", priority: 2 });
    const tieOne = await service.create({ title: "Tie one", priority: 5 });
    const tieTwo = await service.create({ title: "Tie two", priority: 5 });
    await service.update(low.id, { status: "backlog" });
    await service.update(tieOne.id, { status: "backlog" });
    await service.update(tieTwo.id, { status: "backlog" });

    const selected = await service.claimNextTask();
    expect(selected?.id).toBe(tieTwo.id);
    expect(selected?.status).toBe("planning");

    expect(tieOne.id).not.toBe(selected?.id);
  });

  test("prefers tasks with more dependents after priority tie", async () => {
    const service = buildService(() => 0.9);

    const parentA = await service.create({ title: "Parent A", priority: 5 });
    const parentB = await service.create({ title: "Parent B", priority: 5 });
    await service.create({ title: "Parent C", priority: 5 });
    await service.create({ title: "Child A1", dependencies: [parentA.id], priority: 1 });
    await service.create({ title: "Child A2", dependencies: [parentA.id], priority: 1 });
    await service.create({ title: "Child B1", dependencies: [parentB.id], priority: 1 });

    const selected = await service.claimNextTask();
    expect(selected?.id).toBe(parentA.id);
    expect(selected?.status).toBe("planning");
  });

  test("computes dependents as a read-only reverse view", async () => {
    const service = buildService();

    const parent = await service.create({ title: "Parent task" });
    const child = await service.create({
      title: "Child task",
      dependencies: [parent.id]
    });

    const parentWithDependents = service.getWithDependents(parent.id);
    expect(parentWithDependents.dependents).toEqual([child.id]);

    const childWithDependents = service.getWithDependents(child.id);
    expect(childWithDependents.dependents).toEqual([]);

    expect(service.get(parent.id).dependencies).toEqual([]);
  });

  test("returns null when no eligible task exists", async () => {
    const service = buildService();

    const parent = await service.create({ title: "Parent" });
    await service.create({ title: "Blocked child", dependencies: [parent.id], priority: 5 });
    await service.update(parent.id, { status: "backlog" });

    const result = await service.claimNextTask();
    expect(result?.id).toBe(parent.id);
    expect(result?.status).toBe("planning");

    await service.update(parent.id, { status: "cancelled" });
    const none = await service.claimNextTask();
    expect(none).toBeNull();
  });

  test("sets completedAt when entering done and clears it when exiting done", async () => {
    const service = buildService();
    const task = await service.create({ title: "Lifecycle task" });

    const done = await service.update(task.id, { status: "done" });
    expect(done.completedAt).not.toBeNull();

    const review = await service.update(task.id, { status: "review" });
    expect(review.completedAt).toBeNull();
  });

  test("assigns canonicalTaskId on create and increments deterministically", async () => {
    const service = buildService();

    const first = await service.create({ title: "First task" });
    const second = await service.create({
      title: "Second task",
      metadata: { canonicalTaskId: "invalid" }
    });

    expect(first.metadata.canonicalTaskId).toBe("T-00001");
    expect(second.metadata.canonicalTaskId).toBe("T-00002");
  });

  test("preserves canonicalTaskId when metadata is updated", async () => {
    const service = buildService();
    const task = await service.create({ title: "Task with canonical id" });

    expect(task.metadata.canonicalTaskId).toBe("T-00001");

    const updated = await service.update(task.id, {
      metadata: { source: "manual", canonicalTaskId: "bad-value" }
    });

    expect(updated.metadata.canonicalTaskId).toBe("T-00001");
  });

  test("backfills canonicalTaskId for legacy loaded tasks", () => {
    const audit = {
      record: vi.fn(async () => {})
    };

    const service = new TaskWorkflowService(audit, {
      initialTasks: [
        {
          id: "legacy-1",
          title: "Legacy 1",
          description: "",
          priority: 3,
          status: "backlog",
          dependencies: [],
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z",
          startedAt: null,
          completedAt: null,
          dueAt: null,
          tags: [],
          metadata: {}
        },
        {
          id: "legacy-2",
          title: "Legacy 2",
          description: "",
          priority: 3,
          status: "backlog",
          dependencies: [],
          createdAt: "2026-02-16T00:01:00.000Z",
          updatedAt: "2026-02-16T00:01:00.000Z",
          startedAt: null,
          completedAt: null,
          dueAt: null,
          tags: [],
          metadata: { canonicalTaskId: "T-00005" }
        }
      ]
    });

    expect(service.get("legacy-1").metadata.canonicalTaskId).toBe("T-00001");
    expect(service.get("legacy-2").metadata.canonicalTaskId).toBe("T-00005");
  });

  test("normalizes legacy statuses when loading existing records", () => {
    const audit = {
      record: vi.fn(async () => {})
    };

    const service = new TaskWorkflowService(audit, {
      initialTasks: [
        {
          id: "legacy-todo",
          title: "Legacy todo",
          description: "",
          priority: 3,
          status: "todo" as never,
          dependencies: [],
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z",
          startedAt: null,
          completedAt: null,
          dueAt: null,
          tags: [],
          metadata: {}
        },
        {
          id: "legacy-in-progress",
          title: "Legacy in progress",
          description: "",
          priority: 3,
          status: "in_progress" as never,
          dependencies: [],
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z",
          startedAt: null,
          completedAt: null,
          dueAt: null,
          tags: [],
          metadata: {}
        },
        {
          id: "legacy-ready",
          title: "Legacy ready",
          description: "",
          priority: 3,
          status: "ready" as never,
          dependencies: [],
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z",
          startedAt: null,
          completedAt: null,
          dueAt: null,
          tags: [],
          metadata: {}
        }
      ]
    });

    expect(service.get("legacy-todo").status).toBe("backlog");
    expect(service.get("legacy-in-progress").status).toBe("implementing");
    expect(service.get("legacy-ready").status).toBe("backlog");
  });

  test("does not create duplicate tasks for normalized title matches and bumps priority", async () => {
    const service = buildService();

    const original = await service.create({
      title: "Fix API timeout handling",
      priority: 2
    });

    const duplicateAttempt = await service.create({
      title: "  fix-api   timeout handling ",
      priority: 1
    });

    expect(duplicateAttempt.id).toBe(original.id);
    expect(service.list()).toHaveLength(1);
    expect(service.get(original.id).priority).toBe(3);
  });

  test("caps duplicate priority bump at 5", async () => {
    const service = buildService();

    const original = await service.create({
      title: "Resolve flaky orchestrator wake race",
      priority: 5
    });

    const duplicateAttempt = await service.create({
      title: "resolve flaky orchestrator wake race"
    });

    expect(duplicateAttempt.id).toBe(original.id);
    expect(service.list()).toHaveLength(1);
    expect(service.get(original.id).priority).toBe(5);
  });

  test("initializes workflowRuntime schema on create", async () => {
    const service = buildService();
    const created = await service.create({ title: "Runtime init task" });
    const runtime = created.metadata.workflowRuntime as Record<string, unknown>;

    expect(runtime.schemaVersion).toBe("1.0");
    expect(runtime.lastTransition).toBeNull();
    expect(runtime.nextActions).toEqual([]);
    expect(runtime.blockingReasons).toEqual([]);
    expect(runtime.actionHistory).toEqual([]);
  });

  test("initializes testingArtifacts schema on create", async () => {
    const service = buildService();
    const created = await service.create({ title: "Testing artifact init task" });
    const testingArtifacts = created.metadata.testingArtifacts as Record<string, unknown>;
    const planned = testingArtifacts.planned as Record<string, unknown>;
    const implemented = testingArtifacts.implemented as Record<string, unknown>;

    expect(testingArtifacts.schemaVersion).toBe("1.0");
    expect(planned.gherkinScenarios).toEqual([]);
    expect(planned.unitTestIntent).toEqual([]);
    expect(planned.integrationTestIntent).toEqual([]);
    expect(planned.notes).toBeNull();
    expect(implemented.testsAddedOrUpdated).toEqual([]);
    expect(implemented.evidenceLinks).toEqual([]);
    expect(implemented.commandsRun).toEqual([]);
    expect(implemented.notes).toBeNull();
  });

  test("backfills workflowRuntime schema for legacy loaded tasks", () => {
    const audit = {
      record: vi.fn(async () => {})
    };
    const service = new TaskWorkflowService(audit, {
      initialTasks: [
        {
          id: "legacy-runtime",
          title: "Legacy runtime",
          description: "",
          priority: 3,
          status: "backlog",
          dependencies: [],
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z",
          startedAt: null,
          completedAt: null,
          dueAt: null,
          tags: [],
          metadata: {}
        }
      ]
    });

    const runtime = service.get("legacy-runtime").metadata.workflowRuntime as Record<
      string,
      unknown
    >;
    expect(runtime.schemaVersion).toBe("1.0");
    expect(runtime.lastTransition).toBeNull();
  });

  test("backfills testingArtifacts schema for legacy loaded tasks", () => {
    const audit = {
      record: vi.fn(async () => {})
    };
    const service = new TaskWorkflowService(audit, {
      initialTasks: [
        {
          id: "legacy-testing",
          title: "Legacy testing",
          description: "",
          priority: 3,
          status: "backlog",
          dependencies: [],
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z",
          startedAt: null,
          completedAt: null,
          dueAt: null,
          tags: [],
          metadata: {}
        }
      ]
    });

    const testingArtifacts = service.get("legacy-testing").metadata.testingArtifacts as Record<
      string,
      unknown
    >;
    const planned = testingArtifacts.planned as Record<string, unknown>;
    const implemented = testingArtifacts.implemented as Record<string, unknown>;
    expect(testingArtifacts.schemaVersion).toBe("1.0");
    expect(planned.gherkinScenarios).toEqual([]);
    expect(implemented.testsAddedOrUpdated).toEqual([]);
  });

  test("runs status hooks in onExit then onEnter order and records runtime", async () => {
    const service = buildService();
    const callOrder: string[] = [];

    (service as unknown as { statusHooks: Record<string, unknown> }).statusHooks = {
      backlog: {
        onExit: [
          () => {
            callOrder.push("backlog:onExit");
            return {
              nextActions: [{ id: "prepare-plan", type: "skill" }]
            };
          }
        ]
      },
      planning: {
        onEnter: [
          () => {
            callOrder.push("planning:onEnter");
            return {
              blockingReasons: [{ code: "PLAN_MISSING", message: "Plan artifact missing" }]
            };
          }
        ]
      }
    };

    const task = await service.create({ title: "Hooked transition task" });
    const updated = await service.update(task.id, { status: "planning" });
    const runtime = updated.metadata.workflowRuntime as Record<string, unknown>;
    const lastTransition = runtime.lastTransition as Record<string, unknown>;
    const nextActions = runtime.nextActions as unknown[];
    const blockingReasons = runtime.blockingReasons as unknown[];
    const actionHistory = runtime.actionHistory as unknown[];

    expect(callOrder).toEqual(["backlog:onExit", "planning:onEnter"]);
    expect(lastTransition.from).toBe("backlog");
    expect(lastTransition.to).toBe("planning");
    expect(nextActions).toHaveLength(1);
    expect(blockingReasons).toHaveLength(1);
    expect(actionHistory).toHaveLength(3);
  });

  test("blocks invalid status transitions with deterministic code and runtime reason", async () => {
    const service = buildService();
    const task = await service.create({ title: "Invalid transition task" });

    await expect(service.update(task.id, { status: "verification" })).rejects.toMatchObject({
      statusCode: 409,
      code: "TASK_TRANSITION_BLOCKED"
    });

    const persisted = service.get(task.id);
    const runtime = persisted.metadata.workflowRuntime as Record<string, unknown>;
    const blockingReasons = runtime.blockingReasons as Array<Record<string, unknown>>;
    expect(blockingReasons[0]?.code).toBe("INVALID_STATUS_TRANSITION");
  });

  test("redirects implementing to review failures into awaiting_human with remediation metadata", async () => {
    const service = buildService();
    const task = await service.create({ title: "Review gate task" });
    await service.update(task.id, { status: "implementing" });

    await expect(service.update(task.id, { status: "review" })).rejects.toMatchObject({
      statusCode: 409,
      code: "TASK_TRANSITION_REDIRECTED"
    });

    const redirected = service.get(task.id);
    expect(redirected.status).toBe("awaiting_human");
    expect((redirected.metadata.awaitingHumanArtifact as Record<string, unknown>).question).toBeTypeOf(
      "string"
    );

    const backToImplementing = await service.update(task.id, {
      status: "implementing"
    });
    const withArtifacts = await service.update(backToImplementing.id, {
      metadata: {
        reviewArtifact: { changeSummary: ["done"] },
        verificationArtifact: { commands: ["npm run verify"], result: "passed" }
      }
    });
    const allowed = await service.update(withArtifacts.id, { status: "review" });
    expect(allowed.status).toBe("review");
  });

  test("executes allow-listed command actions and records success", async () => {
    const commandExecutor = vi.fn(async () => ({
      exitCode: 0,
      stdout: "ok",
      stderr: ""
    }));
    const service = buildService(() => 0, { commandExecutor });
    (service as unknown as { statusHooks: Record<string, unknown> }).statusHooks = {
      backlog: {
        onExit: [
          () => ({
            nextActions: [
              { id: "verify", type: "command", command: "npm", args: ["run", "verify"] }
            ]
          })
        ]
      }
    };

    const task = await service.create({ title: "Command action task" });
    const updated = await service.update(task.id, { status: "planning" });
    const runtime = updated.metadata.workflowRuntime as Record<string, unknown>;
    const actionHistory = runtime.actionHistory as Array<Record<string, unknown>>;

    expect(commandExecutor).toHaveBeenCalledTimes(1);
    expect(actionHistory.some((entry) => entry.actionId === "verify" && entry.result === "ok")).toBe(
      true
    );
  });

  test("records blocking reason when command action is not allow-listed", async () => {
    const commandExecutor = vi.fn(async () => ({
      exitCode: 0,
      stdout: "ok",
      stderr: ""
    }));
    const service = buildService(() => 0, { commandExecutor });
    (service as unknown as { statusHooks: Record<string, unknown> }).statusHooks = {
      backlog: {
        onExit: [
          () => ({
            nextActions: [
              {
                id: "forbidden",
                type: "command",
                command: "powershell",
                args: ["-NoProfile", "-Command", "echo hi"]
              }
            ]
          })
        ]
      }
    };

    const task = await service.create({ title: "Denied command action task" });
    const updated = await service.update(task.id, { status: "planning" });
    const runtime = updated.metadata.workflowRuntime as Record<string, unknown>;
    const blockingReasons = runtime.blockingReasons as Array<Record<string, unknown>>;
    const actionHistory = runtime.actionHistory as Array<Record<string, unknown>>;

    expect(commandExecutor).not.toHaveBeenCalled();
    expect(blockingReasons.some((reason) => reason.code === "COMMAND_NOT_ALLOWED")).toBe(true);
    expect(
      actionHistory.some(
        (entry) => entry.actionId === "forbidden" && entry.error === "command_not_allowed"
      )
    ).toBe(true);
  });

  test("records command execution failure and keeps emitted skill actions", async () => {
    const commandExecutor = vi.fn(async () => {
      throw new Error("timeout");
    });
    const service = buildService(() => 0, { commandExecutor });
    (service as unknown as { statusHooks: Record<string, unknown> }).statusHooks = {
      backlog: {
        onExit: [
          () => ({
            nextActions: [
              { id: "timeout-cmd", type: "command", command: "npm", args: ["run", "verify"] },
              { id: "manual-review", type: "skill", skill: "workflow-verify-commit-pr" }
            ]
          })
        ]
      }
    };

    const task = await service.create({ title: "Command failure task" });
    const updated = await service.update(task.id, { status: "planning" });
    const runtime = updated.metadata.workflowRuntime as Record<string, unknown>;
    const blockingReasons = runtime.blockingReasons as Array<Record<string, unknown>>;
    const nextActions = runtime.nextActions as Array<Record<string, unknown>>;
    const actionHistory = runtime.actionHistory as Array<Record<string, unknown>>;

    expect(commandExecutor).toHaveBeenCalledTimes(1);
    expect(blockingReasons.some((reason) => reason.code === "COMMAND_EXECUTION_FAILED")).toBe(
      true
    );
    expect(
      actionHistory.some((entry) => entry.actionId === "timeout-cmd" && entry.result === "error")
    ).toBe(true);
    expect(nextActions.some((action) => action.id === "manual-review" && action.type === "skill")).toBe(
      true
    );
  });

  test("schedules skill actions as first-class next actions and audits scheduling", async () => {
    const audit = {
      record: vi.fn(async () => {})
    };
    const commandExecutor = vi.fn(async () => ({
      exitCode: 0,
      stdout: "ok",
      stderr: ""
    }));
    const service = new TaskWorkflowService(audit, {
      random: () => 0,
      commandExecutor
    });
    (service as unknown as { statusHooks: Record<string, unknown> }).statusHooks = {
      backlog: {
        onExit: [
          () => ({
            nextActions: [{ id: "manual-review", type: "skill", skill: "workflow-stage-artifact" }]
          })
        ]
      }
    };

    const task = await service.create({ title: "Skill action task" });
    const updated = await service.update(task.id, { status: "planning" });
    const runtime = updated.metadata.workflowRuntime as Record<string, unknown>;
    const actionHistory = runtime.actionHistory as Array<Record<string, unknown>>;

    expect(commandExecutor).not.toHaveBeenCalled();
    expect(
      actionHistory.some(
        (entry) => entry.actionId === "manual-review" && entry.actionType === "skill"
      )
    ).toBe(true);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "task_action_scheduled" })
    );
  });

  test("dedupes duplicate action ids emitted in one transition context", async () => {
    const commandExecutor = vi.fn(async () => ({
      exitCode: 0,
      stdout: "ok",
      stderr: ""
    }));
    const service = buildService(() => 0, { commandExecutor });
    (service as unknown as { statusHooks: Record<string, unknown> }).statusHooks = {
      backlog: {
        onExit: [
          () => ({
            nextActions: [
              { id: "dup", type: "command", command: "npm", args: ["run", "verify"] },
              { id: "dup", type: "command", command: "npm", args: ["run", "verify"] }
            ]
          })
        ]
      }
    };

    const task = await service.create({ title: "Duplicate action id task" });
    await service.update(task.id, { status: "planning" });
    expect(commandExecutor).toHaveBeenCalledTimes(1);
  });

  test("returns workflow status model with transitions, reason codes, and hook counts", () => {
    const service = buildService();
    const model = service.getStatusModel();
    const implementing = model.statuses.find((entry) => entry.status === "implementing");

    expect(implementing).toBeDefined();
    expect(implementing?.allowedTransitions).toContain("review");
    expect(implementing?.blockedTransitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "review",
          reasonCodes: expect.arrayContaining(["MISSING_REVIEW_ARTIFACTS"])
        })
      ])
    );
    expect(implementing?.hookSummary).toEqual({
      onEnterCount: 0,
      onExitCount: 0
    });
  });

  test("records retrospective artifact and emits audit event", async () => {
    const audit = {
      record: vi.fn(async () => {})
    };
    const service = new TaskWorkflowService(audit, { random: () => 0 });
    const task = await service.create({ title: "Retrospective target task" });

    const updated = await service.recordRetrospective(task.id, {
      scope: "Context window checkpoint",
      wentWell: ["Verification discipline stayed consistent"],
      didNotGoWell: ["Some redundant test reruns occurred"],
      couldBeBetter: ["Batch related checks earlier"],
      missingSkills: ["Dedicated retrospective skill"],
      missingDataPoints: ["Per-step token/time budget snapshots"],
      efficiencyNotes: ["Prefer grouped reads before edits"],
      actionItems: [
        {
          title: "Add retrospective skill",
          owner: "agent",
          priority: "low",
          notes: "Create deterministic template workflow"
        }
      ],
      sources: ["https://www.scrum.org/resources/what-is-a-sprint-retrospective"]
    });

    const latest = (updated.metadata.latestRetrospective as Record<string, unknown>) ?? {};
    expect(latest.scope).toBe("Context window checkpoint");
    expect(updated.metadata.retrospectives).toBeDefined();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "task_retrospective_recorded" })
    );
  });

  test("rejects retrospective with no insight content", async () => {
    const service = buildService();
    const task = await service.create({ title: "Retrospective validation task" });

    await expect(
      service.recordRetrospective(task.id, {
        scope: "Context checkpoint",
        wentWell: [],
        didNotGoWell: [],
        couldBeBetter: [],
        missingSkills: [],
        missingDataPoints: [],
        efficiencyNotes: [],
        actionItems: [],
        sources: []
      })
    ).rejects.toMatchObject({
      statusCode: 400
    });
  });
});

