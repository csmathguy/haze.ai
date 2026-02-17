import { describe, expect, test, vi } from "vitest";
import { TaskWorkflowService } from "../src/tasks.js";

function buildService(random = () => 0): TaskWorkflowService {
  const audit = {
    record: vi.fn(async () => {})
  };

  return new TaskWorkflowService(audit, { random });
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
});

