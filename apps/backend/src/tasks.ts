import { randomUUID } from "node:crypto";
import type { AuditSink } from "./audit.js";

export type TaskStatus =
  | "backlog"
  | "planning"
  | "implementing"
  | "review"
  | "verification"
  | "awaiting_human"
  | "done"
  | "cancelled";

type InputTaskStatus = TaskStatus | "todo" | "in_progress" | "ready";

const ACTIVE_TASK_STATUSES = new Set<TaskStatus>([
  "planning",
  "implementing",
  "review",
  "verification",
  "awaiting_human"
]);
const CANONICAL_TASK_ID_PATTERN = /^T-(\d{5})$/;

export interface TaskRecord {
  id: string;
  title: string;
  description: string;
  priority: number;
  status: TaskStatus;
  dependencies: string[];
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  dueAt: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
}

export interface TaskRecordWithDependents extends TaskRecord {
  dependents: string[];
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: number;
  dependencies?: string[];
  dueAt?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  priority?: number;
  status?: TaskStatus;
  dependencies?: string[];
  dueAt?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export class TaskServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
  }
}

interface TaskWorkflowServiceOptions {
  now?: () => Date;
  random?: () => number;
  initialTasks?: TaskRecord[];
  onChanged?: (tasks: TaskRecord[]) => Promise<void> | void;
}

export class TaskWorkflowService {
  private readonly tasks = new Map<string, TaskRecord>();
  private readonly now: () => Date;
  private readonly random: () => number;
  private readonly onChanged: (tasks: TaskRecord[]) => Promise<void> | void;

  constructor(
    private readonly audit: AuditSink,
    options?: TaskWorkflowServiceOptions
  ) {
    this.now = options?.now ?? (() => new Date());
    this.random = options?.random ?? Math.random;
    this.onChanged = options?.onChanged ?? (() => undefined);

    if (options?.initialTasks?.length) {
      this.importAll(options.initialTasks);
    }
  }

  list(): TaskRecord[] {
    return [...this.tasks.values()]
      .map((task) => this.cloneTask(task))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  listWithDependents(): TaskRecordWithDependents[] {
    const dependentsByTask = this.buildDependentsMap();
    return this.list().map((task) => ({
      ...task,
      dependents: dependentsByTask.get(task.id) ?? []
    }));
  }

  get(id: string): TaskRecord {
    const task = this.tasks.get(id);
    if (!task) {
      throw new TaskServiceError(`Task not found: ${id}`, 404);
    }

    return this.cloneTask(task);
  }

  getWithDependents(id: string): TaskRecordWithDependents {
    const record = this.get(id);
    const dependentsByTask = this.buildDependentsMap();
    return {
      ...record,
      dependents: dependentsByTask.get(id) ?? []
    };
  }

  importAll(records: TaskRecord[]): void {
    this.tasks.clear();

    for (const record of records) {
      const next = this.cloneTask(record);
      if (this.shouldAssignCanonicalTaskId(next.metadata)) {
        next.metadata = this.ensureCanonicalTaskId(next.metadata, next.id);
      }
      this.tasks.set(next.id, next);
    }

    if (this.hasAnyCycle()) {
      throw new TaskServiceError("Task dependencies create a cycle", 400);
    }
  }

  async syncFromCodebase(records: TaskRecord[]): Promise<{ imported: number }> {
    const current = this.list();
    const manualTasks = current.filter(
      (task) => task.metadata.source !== "documentation"
    );

    const merged = [...manualTasks, ...records];
    this.importAll(merged);
    await this.commitChange();

    await this.audit.record({
      eventType: "task_sync_from_codebase",
      actor: "task_workflow",
      payload: {
        imported: records.length,
        totalTasks: merged.length
      }
    });

    return { imported: records.length };
  }

  async create(input: CreateTaskInput): Promise<TaskRecord> {
    const now = this.now().toISOString();
    const task: TaskRecord = {
      id: randomUUID(),
      title: this.normalizeTitle(input.title),
      description: input.description?.trim() ?? "",
      priority: this.normalizePriority(input.priority),
      status: "backlog",
      dependencies: this.normalizeDependencies(input.dependencies),
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
      dueAt: input.dueAt ?? null,
      tags: this.normalizeTags(input.tags),
      metadata: this.shouldAssignCanonicalTaskId(input.metadata)
        ? this.ensureCanonicalTaskId(input.metadata, null)
        : input.metadata ?? {}
    };

    this.ensureDependenciesExist(task.dependencies);
    this.tasks.set(task.id, task);

    if (this.hasAnyCycle()) {
      this.tasks.delete(task.id);
      throw new TaskServiceError("Task dependencies create a cycle", 400);
    }

    await this.commitChange();
    await this.audit.record({
      eventType: "task_created",
      actor: "task_workflow",
      payload: {
        taskId: task.id,
        priority: task.priority,
        dependencyCount: task.dependencies.length
      }
    });

    return this.cloneTask(task);
  }

  async update(id: string, input: UpdateTaskInput): Promise<TaskRecord> {
    const existing = this.tasks.get(id);
    if (!existing) {
      throw new TaskServiceError(`Task not found: ${id}`, 404);
    }

    const previous = this.cloneTask(existing);

    if (input.title !== undefined) {
      existing.title = this.normalizeTitle(input.title);
    }

    if (input.description !== undefined) {
      existing.description = input.description.trim();
    }

    if (input.priority !== undefined) {
      existing.priority = this.normalizePriority(input.priority);
    }

    if (input.status !== undefined) {
      const previousStatus = existing.status;
      const status = this.normalizeStatus(input.status);
      existing.status = status;
      if (ACTIVE_TASK_STATUSES.has(status) && !existing.startedAt) {
        existing.startedAt = this.now().toISOString();
      }
      if (status === "done") {
        existing.completedAt = this.now().toISOString();
      } else if (previousStatus === "done") {
        existing.completedAt = null;
      }
    }

    if (input.dependencies !== undefined) {
      existing.dependencies = this.normalizeDependencies(input.dependencies);
      this.ensureDependenciesExist(existing.dependencies);
      if (existing.dependencies.includes(id)) {
        throw new TaskServiceError("Task cannot depend on itself", 400);
      }
    }

    if (input.dueAt !== undefined) {
      existing.dueAt = input.dueAt;
    }

    if (input.tags !== undefined) {
      existing.tags = this.normalizeTags(input.tags);
    }

    if (input.metadata !== undefined) {
      if (this.shouldAssignCanonicalTaskId(existing.metadata)) {
        existing.metadata = this.ensureCanonicalTaskId(
          input.metadata,
          existing.id,
          existing.metadata
        );
      } else {
        existing.metadata = input.metadata;
      }
    }

    existing.updatedAt = this.now().toISOString();

    if (this.hasAnyCycle()) {
      this.tasks.set(id, previous);
      throw new TaskServiceError("Task dependencies create a cycle", 400);
    }

    await this.commitChange();
    await this.audit.record({
      eventType: "task_updated",
      actor: "task_workflow",
      payload: {
        taskId: id,
        status: existing.status,
        priority: existing.priority
      }
    });

    return this.cloneTask(existing);
  }

  async delete(id: string): Promise<void> {
    if (!this.tasks.has(id)) {
      throw new TaskServiceError(`Task not found: ${id}`, 404);
    }

    const dependent = [...this.tasks.values()].find((task) =>
      task.dependencies.includes(id)
    );
    if (dependent) {
      throw new TaskServiceError(
        `Task ${id} cannot be deleted; required by ${dependent.id}`,
        409
      );
    }

    this.tasks.delete(id);
    await this.commitChange();
    await this.audit.record({
      eventType: "task_deleted",
      actor: "task_workflow",
      payload: { taskId: id }
    });
  }

  async claimNextTask(): Promise<TaskRecord | null> {
    const eligible = [...this.tasks.values()].filter(
      (task) =>
        task.status === "backlog" &&
        task.dependencies.every(
          (dependencyId) => this.tasks.get(dependencyId)?.status === "done"
        )
    );

    if (eligible.length === 0) {
      return null;
    }

    const highestPriority = Math.max(...eligible.map((task) => task.priority));
    const priorityTies = eligible.filter((task) => task.priority === highestPriority);
    const dependentsByTask = this.buildDependentsMap();
    const maxDependentCount = Math.max(
      ...priorityTies.map((task) => (dependentsByTask.get(task.id) ?? []).length)
    );
    const dependentTies = priorityTies.filter(
      (task) => (dependentsByTask.get(task.id) ?? []).length === maxDependentCount
    );
    const index = Math.floor(this.random() * dependentTies.length);
    const selected = dependentTies[index];

    selected.status = "planning";
    selected.startedAt = selected.startedAt ?? this.now().toISOString();
    selected.updatedAt = this.now().toISOString();

    await this.commitChange();
    await this.audit.record({
      eventType: "task_claimed",
      actor: "task_workflow",
      payload: {
        taskId: selected.id,
        priority: selected.priority,
        tieCount: dependentTies.length,
        priorityTieCount: priorityTies.length,
        dependentCount: (dependentsByTask.get(selected.id) ?? []).length
      }
    });

    return this.cloneTask(selected);
  }

  private async commitChange(): Promise<void> {
    await this.onChanged(this.list());
  }

  private cloneTask(task: TaskRecord): TaskRecord {
    return {
      ...task,
      status: this.normalizeStatus(task.status),
      dependencies: [...task.dependencies],
      tags: [...task.tags],
      metadata: { ...task.metadata }
    };
  }

  private normalizeTitle(title: string): string {
    const normalized = title.trim();
    if (!normalized) {
      throw new TaskServiceError("Task title is required", 400);
    }

    return normalized;
  }

  private normalizePriority(priority?: number): number {
    const next = priority ?? 3;
    if (!Number.isInteger(next) || next < 1 || next > 5) {
      throw new TaskServiceError("Task priority must be an integer between 1 and 5", 400);
    }

    return next;
  }

  private normalizeDependencies(dependencies?: string[]): string[] {
    return [...new Set(dependencies ?? [])];
  }

  private normalizeTags(tags?: string[]): string[] {
    return [...new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean))];
  }

  private normalizeStatus(status: InputTaskStatus): TaskStatus {
    switch (status) {
      case "todo":
      case "ready":
        return "backlog";
      case "in_progress":
        return "implementing";
      case "backlog":
      case "planning":
      case "implementing":
      case "review":
      case "verification":
      case "awaiting_human":
      case "done":
      case "cancelled":
        return status;
      default:
        throw new TaskServiceError(`Invalid task status: ${String(status)}`, 400);
    }
  }

  private shouldAssignCanonicalTaskId(metadata: Record<string, unknown> | undefined): boolean {
    return metadata?.source !== "documentation";
  }

  private ensureCanonicalTaskId(
    metadata: Record<string, unknown> | undefined,
    taskId: string | null,
    existingMetadata?: Record<string, unknown>
  ): Record<string, unknown> {
    const nextMetadata = { ...(metadata ?? {}) };
    const currentCanonical = this.getCanonicalTaskId(existingMetadata ?? nextMetadata, taskId);
    if (currentCanonical) {
      nextMetadata.canonicalTaskId = currentCanonical;
      return nextMetadata;
    }

    nextMetadata.canonicalTaskId = this.generateNextCanonicalTaskId();
    return nextMetadata;
  }

  private getCanonicalTaskId(
    metadata: Record<string, unknown> | undefined,
    taskId: string | null
  ): string | null {
    const metadataCandidate = metadata?.canonicalTaskId;
    if (
      typeof metadataCandidate === "string" &&
      CANONICAL_TASK_ID_PATTERN.test(metadataCandidate)
    ) {
      return metadataCandidate;
    }

    if (taskId && CANONICAL_TASK_ID_PATTERN.test(taskId)) {
      return taskId;
    }

    return null;
  }

  private generateNextCanonicalTaskId(): string {
    let max = 0;

    for (const task of this.tasks.values()) {
      const match = this.getCanonicalTaskId(task.metadata, task.id)?.match(
        CANONICAL_TASK_ID_PATTERN
      );
      if (!match) {
        continue;
      }

      const current = Number.parseInt(match[1], 10);
      if (current > max) {
        max = current;
      }
    }

    return `T-${String(max + 1).padStart(5, "0")}`;
  }

  private ensureDependenciesExist(dependencies: string[]): void {
    for (const dependencyId of dependencies) {
      if (!this.tasks.has(dependencyId)) {
        throw new TaskServiceError(`Unknown dependency: ${dependencyId}`, 400);
      }
    }
  }

  private hasAnyCycle(): boolean {
    const visited = new Set<string>();
    const inStack = new Set<string>();

    const visit = (taskId: string): boolean => {
      if (inStack.has(taskId)) {
        return true;
      }
      if (visited.has(taskId)) {
        return false;
      }

      visited.add(taskId);
      inStack.add(taskId);

      const task = this.tasks.get(taskId);
      if (!task) {
        inStack.delete(taskId);
        return false;
      }

      for (const dependencyId of task.dependencies) {
        if (visit(dependencyId)) {
          return true;
        }
      }

      inStack.delete(taskId);
      return false;
    };

    for (const taskId of this.tasks.keys()) {
      if (visit(taskId)) {
        return true;
      }
    }

    return false;
  }

  private buildDependentsMap(): Map<string, string[]> {
    const dependentsByTask = new Map<string, string[]>();

    for (const taskId of this.tasks.keys()) {
      dependentsByTask.set(taskId, []);
    }

    for (const task of this.tasks.values()) {
      for (const dependencyId of task.dependencies) {
        if (!dependentsByTask.has(dependencyId)) {
          dependentsByTask.set(dependencyId, []);
        }
        dependentsByTask.get(dependencyId)?.push(task.id);
      }
    }

    for (const [taskId, dependents] of dependentsByTask.entries()) {
      dependentsByTask.set(taskId, [...new Set(dependents)]);
    }

    return dependentsByTask;
  }
}
