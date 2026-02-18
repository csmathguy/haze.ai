import { describe, expect, test } from "vitest";
import type { TaskRecord } from "./api";
import { applyKanbanTaskFilters, type KanbanTaskFilterState } from "./kanban-filters";

function makeTask(input: Partial<TaskRecord> & Pick<TaskRecord, "id" | "title">): TaskRecord {
  return {
    id: input.id,
    title: input.title,
    description: input.description ?? "",
    priority: input.priority ?? 3,
    status: input.status ?? "backlog",
    dependencies: input.dependencies ?? [],
    dependents: input.dependents ?? [],
    createdAt: input.createdAt ?? "2026-02-16T00:00:00.000Z",
    updatedAt: input.updatedAt ?? "2026-02-16T00:00:00.000Z",
    startedAt: input.startedAt ?? null,
    completedAt: input.completedAt ?? null,
    dueAt: input.dueAt ?? null,
    tags: input.tags ?? [],
    metadata: input.metadata ?? {}
  };
}

describe("kanban filters", () => {
  test("returns all tasks when no filters are active", () => {
    const tasks = [
      makeTask({ id: "t1", title: "One", tags: ["backend"] }),
      makeTask({ id: "t2", title: "Two", tags: ["frontend"] })
    ];

    const state: KanbanTaskFilterState = {};
    expect(applyKanbanTaskFilters(tasks, state).map((task) => task.id)).toEqual(["t1", "t2"]);
  });

  test("filters by tag", () => {
    const tasks = [
      makeTask({ id: "t1", title: "One", tags: ["backend"] }),
      makeTask({ id: "t2", title: "Two", tags: ["frontend"] })
    ];

    const state: KanbanTaskFilterState = { tag: "backend" };
    expect(applyKanbanTaskFilters(tasks, state).map((task) => task.id)).toEqual(["t1"]);
  });

  test("composes tag and blocked filters for future dimensions", () => {
    const tasks = [
      makeTask({ id: "t1", title: "Blocked backend", tags: ["backend"], dependencies: ["dep-1"] }),
      makeTask({ id: "t2", title: "Unblocked backend", tags: ["backend"], dependencies: [] }),
      makeTask({ id: "t3", title: "Blocked frontend", tags: ["frontend"], dependencies: ["dep-2"] })
    ];

    const state: KanbanTaskFilterState = { tag: "backend", blocked: "blocked" };
    expect(applyKanbanTaskFilters(tasks, state).map((task) => task.id)).toEqual(["t1"]);
  });
});
