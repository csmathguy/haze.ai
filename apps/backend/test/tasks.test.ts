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
    await service.update(child.id, { status: "ready" });
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
    await service.update(low.id, { status: "ready" });
    await service.update(tieOne.id, { status: "ready" });
    await service.update(tieTwo.id, { status: "ready" });

    const selected = await service.claimNextTask();
    expect(selected?.id).toBe(tieTwo.id);
    expect(selected?.status).toBe("planning");

    expect(tieOne.id).not.toBe(selected?.id);
  });

  test("returns null when no eligible task exists", async () => {
    const service = buildService();

    const parent = await service.create({ title: "Parent" });
    await service.create({ title: "Blocked child", dependencies: [parent.id], priority: 5 });
    await service.update(parent.id, { status: "ready" });

    const result = await service.claimNextTask();
    expect(result?.id).toBe(parent.id);
    expect(result?.status).toBe("planning");

    await service.update(parent.id, { status: "cancelled" });
    const none = await service.claimNextTask();
    expect(none).toBeNull();
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
        }
      ]
    });

    expect(service.get("legacy-todo").status).toBe("backlog");
    expect(service.get("legacy-in-progress").status).toBe("implementing");
  });
});

