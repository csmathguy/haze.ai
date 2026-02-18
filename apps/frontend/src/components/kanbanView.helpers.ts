import { type TaskRecord } from "../api";

export type DetailAnswer = {
  actor: string;
  message: string;
  timestamp: string | null;
};

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

export function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

export function isTaskBlockedByDependencies(
  task: Pick<TaskRecord, "dependencies">,
  tasksById: ReadonlyMap<string, TaskRecord>
): boolean {
  if (task.dependencies.length === 0) {
    return false;
  }

  return task.dependencies.some((dependencyId) => tasksById.get(dependencyId)?.status !== "done");
}

export function normalizeAnswerThread(value: unknown): DetailAnswer[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (typeof entry === "string") {
        return {
          actor: "human",
          message: entry,
          timestamp: null
        };
      }

      const item = asRecord(entry);
      if (!item) {
        return null;
      }

      const actor = typeof item.actor === "string" ? item.actor : "human";
      const messageCandidate = ["message", "answer", "response", "text"]
        .map((key) => item[key])
        .find((candidate) => typeof candidate === "string");
      if (typeof messageCandidate !== "string") {
        return null;
      }

      return {
        actor,
        message: messageCandidate,
        timestamp: typeof item.timestamp === "string" ? item.timestamp : null
      };
    })
    .filter((entry): entry is DetailAnswer => entry !== null);
}

export function getTaskDisplayId(task: TaskRecord): string {
  const canonicalId = asRecord(task.metadata)?.canonicalTaskId;
  if (typeof canonicalId === "string" && canonicalId.trim().length > 0) {
    return canonicalId;
  }
  return task.id;
}

export function formatShortTimestamp(value: string | null): string {
  if (!value) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}

export function formatVerboseTimestamp(value: string | null): string {
  if (!value) {
    return "N/A";
  }

  return new Date(value).toLocaleString();
}

export function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}
