import type { TaskRecord } from "./api";

export interface KanbanTaskFilterState {
  tag?: string | null;
  blocked?: "blocked" | "unblocked" | null;
}

type TaskPredicate = (task: TaskRecord) => boolean;

function isTaskBlocked(task: TaskRecord): boolean {
  return task.dependencies.length > 0;
}

function buildKanbanPredicates(state: KanbanTaskFilterState): TaskPredicate[] {
  const predicates: TaskPredicate[] = [];

  const tag = state.tag?.trim();
  if (tag) {
    predicates.push((task) => task.tags.includes(tag));
  }

  if (state.blocked === "blocked") {
    predicates.push((task) => isTaskBlocked(task));
  }

  if (state.blocked === "unblocked") {
    predicates.push((task) => !isTaskBlocked(task));
  }

  return predicates;
}

export function applyKanbanTaskFilters(
  tasks: TaskRecord[],
  state: KanbanTaskFilterState
): TaskRecord[] {
  const predicates = buildKanbanPredicates(state);
  if (predicates.length === 0) {
    return tasks;
  }

  return tasks.filter((task) => predicates.every((predicate) => predicate(task)));
}
