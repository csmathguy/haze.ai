import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
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
const ALLOWED_STATUS_TRANSITIONS: Record<TaskStatus, ReadonlySet<TaskStatus>> = {
  backlog: new Set(["planning", "implementing", "done", "cancelled"]),
  planning: new Set(["backlog", "implementing", "awaiting_human", "cancelled"]),
  implementing: new Set(["backlog", "review", "awaiting_human", "cancelled"]),
  review: new Set(["implementing", "verification", "done", "awaiting_human", "cancelled"]),
  verification: new Set(["implementing", "done", "awaiting_human", "cancelled"]),
  awaiting_human: new Set(["planning", "implementing", "review", "cancelled"]),
  done: new Set(["review", "cancelled"]),
  cancelled: new Set(["backlog"])
};
const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  planning: "Planning",
  implementing: "Implementing",
  review: "Review",
  verification: "Verification",
  awaiting_human: "Awaiting Human",
  done: "Done",
  cancelled: "Cancelled"
};
const CANONICAL_TASK_ID_PATTERN = /^T-(\d{5})$/;
const WORKFLOW_RUNTIME_SCHEMA_VERSION = "1.0";
const TESTING_ARTIFACTS_SCHEMA_VERSION = "1.0";
const DEFAULT_COMMAND_TIMEOUT_MS = 30_000;
const DEFAULT_COMMAND_ALLOWLIST = ["npm", "git", "scripts/"];
const execFileAsync = promisify(execFile);

export interface WorkflowNextAction {
  id: string;
  type: string;
  [key: string]: unknown;
}

export interface WorkflowBlockingReason {
  code: string;
  message: string;
  [key: string]: unknown;
}

export interface WorkflowActionHistoryEntry {
  at: string;
  phase: "onEnter" | "onExit";
  status: TaskStatus;
  result: "ok" | "error";
  nextActionCount: number;
  blockingReasonCount: number;
  actionId?: string;
  actionType?: string;
  error?: string;
}

export interface WorkflowTransitionRecord {
  from: TaskStatus;
  to: TaskStatus;
  at: string;
}

export interface WorkflowRuntimeState {
  schemaVersion: string;
  lastTransition: WorkflowTransitionRecord | null;
  nextActions: WorkflowNextAction[];
  blockingReasons: WorkflowBlockingReason[];
  actionHistory: WorkflowActionHistoryEntry[];
}

export interface TaskTestingPlanState {
  gherkinScenarios: string[];
  unitTestIntent: string[];
  integrationTestIntent: string[];
  notes: string | null;
}

export interface TaskTestingImplementedState {
  testsAddedOrUpdated: string[];
  evidenceLinks: string[];
  commandsRun: string[];
  notes: string | null;
}

export interface TaskTestingArtifactsState {
  schemaVersion: string;
  planned: TaskTestingPlanState;
  implemented: TaskTestingImplementedState;
}

export interface TaskRetrospectiveActionItem {
  title: string;
  owner: string | null;
  priority: "low" | "medium" | "high";
  notes: string | null;
}

export interface TaskRetrospectiveInput {
  scope: string;
  wentWell: string[];
  didNotGoWell: string[];
  couldBeBetter: string[];
  missingSkills: string[];
  missingDataPoints: string[];
  efficiencyNotes: string[];
  actionItems: TaskRetrospectiveActionItem[];
  sources: string[];
}

export interface TaskRetrospectiveArtifact extends TaskRetrospectiveInput {
  createdAt: string;
}

export interface TaskStatusHookContext {
  task: TaskRecord;
  fromStatus: TaskStatus;
  toStatus: TaskStatus;
  phase: "onEnter" | "onExit";
}

export interface TaskStatusHookResult {
  nextActions?: WorkflowNextAction[];
  blockingReasons?: WorkflowBlockingReason[];
}

export interface WorkflowCommandExecutionRequest {
  command: string;
  args: string[];
  timeoutMs: number;
}

export interface WorkflowCommandExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type WorkflowCommandExecutor = (
  request: WorkflowCommandExecutionRequest
) => Promise<WorkflowCommandExecutionResult>;

export type TaskStatusHook = (
  context: TaskStatusHookContext
) => TaskStatusHookResult | void | Promise<TaskStatusHookResult | void>;

export interface TaskStatusHookMap {
  [status: string]: {
    onEnter?: TaskStatusHook[];
    onExit?: TaskStatusHook[];
  };
}

export interface WorkflowStatusModelEntry {
  status: TaskStatus;
  label: string;
  allowedTransitions: TaskStatus[];
  blockedTransitions: Array<{
    status: TaskStatus;
    reasonCodes: string[];
  }>;
  hookSummary: {
    onEnterCount: number;
    onExitCount: number;
  };
}

export interface WorkflowStatusModel {
  statuses: WorkflowStatusModelEntry[];
}

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
    public readonly statusCode: number,
    public readonly code?: string
  ) {
    super(message);
  }
}

interface TaskWorkflowServiceOptions {
  now?: () => Date;
  random?: () => number;
  initialTasks?: TaskRecord[];
  onChanged?: (tasks: TaskRecord[]) => Promise<void> | void;
  statusHooks?: TaskStatusHookMap;
  commandExecutor?: WorkflowCommandExecutor;
  commandAllowlist?: string[];
  commandTimeoutMs?: number;
}

export class TaskWorkflowService {
  private readonly tasks = new Map<string, TaskRecord>();
  private readonly now: () => Date;
  private readonly random: () => number;
  private readonly onChanged: (tasks: TaskRecord[]) => Promise<void> | void;
  private readonly statusHooks: TaskStatusHookMap;
  private readonly commandExecutor: WorkflowCommandExecutor;
  private readonly commandAllowlist: string[];
  private readonly commandTimeoutMs: number;

  constructor(
    private readonly audit: AuditSink,
    options?: TaskWorkflowServiceOptions
  ) {
    this.now = options?.now ?? (() => new Date());
    this.random = options?.random ?? Math.random;
    this.onChanged = options?.onChanged ?? (() => undefined);
    this.statusHooks = options?.statusHooks ?? {};
    this.commandExecutor = options?.commandExecutor ?? this.executeCommand;
    this.commandAllowlist = options?.commandAllowlist ?? DEFAULT_COMMAND_ALLOWLIST;
    this.commandTimeoutMs = options?.commandTimeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS;

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

  getStatusModel(): WorkflowStatusModel {
    const allStatuses = Object.keys(ALLOWED_STATUS_TRANSITIONS) as TaskStatus[];
    const statuses = allStatuses.map((status) => {
      const allowed = [...ALLOWED_STATUS_TRANSITIONS[status]];
      const blockedTransitions = allStatuses
        .map((candidate) => ({
          status: candidate,
          reasonCodes: this.getTransitionReasonCodes(status, candidate)
        }))
        .filter((transition) => transition.reasonCodes.length > 0);

      return {
        status,
        label: STATUS_LABELS[status],
        allowedTransitions: allowed,
        blockedTransitions,
        hookSummary: {
          onEnterCount: this.statusHooks[status]?.onEnter?.length ?? 0,
          onExitCount: this.statusHooks[status]?.onExit?.length ?? 0
        }
      } satisfies WorkflowStatusModelEntry;
    });

    return { statuses };
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
      next.metadata = this.ensureWorkflowRuntimeMetadata(next.metadata);
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
    const normalizedTitle = this.normalizeTitle(input.title);
    const duplicate = this.findDuplicateByTitle(normalizedTitle);
    if (duplicate) {
      const previousPriority = duplicate.priority;
      duplicate.priority = Math.min(5, duplicate.priority + 1);
      duplicate.updatedAt = now;
      duplicate.metadata = this.ensureWorkflowRuntimeMetadata(duplicate.metadata);

      await this.commitChange();
      await this.audit.record({
        eventType: "task_duplicate_detected",
        actor: "task_workflow",
        payload: {
          taskId: duplicate.id,
          previousPriority,
          nextPriority: duplicate.priority
        }
      });

      return this.cloneTask(duplicate);
    }

    const task: TaskRecord = {
      id: randomUUID(),
      title: normalizedTitle,
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
    task.metadata = this.ensureWorkflowRuntimeMetadata(task.metadata);

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
    existing.metadata = this.ensureWorkflowRuntimeMetadata(existing.metadata);

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
      if (previousStatus !== status) {
        await this.validateStatusTransition(existing, previousStatus, status);
        existing.status = status;
        await this.executeStatusHooks(existing, previousStatus, status);
      }
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
      existing.metadata = this.ensureWorkflowRuntimeMetadata(existing.metadata);
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

  async recordRetrospective(
    id: string,
    input: TaskRetrospectiveInput
  ): Promise<TaskRecord> {
    const existing = this.tasks.get(id);
    if (!existing) {
      throw new TaskServiceError(`Task not found: ${id}`, 404);
    }

    const artifact = this.normalizeRetrospectiveInput(input);
    const metadata = this.ensureWorkflowRuntimeMetadata(existing.metadata);
    const history = Array.isArray(metadata.retrospectives)
      ? (metadata.retrospectives as TaskRetrospectiveArtifact[])
      : [];
    metadata.retrospectives = [...history, artifact];
    metadata.latestRetrospective = artifact;
    existing.metadata = metadata;
    existing.updatedAt = this.now().toISOString();

    await this.commitChange();
    await this.audit.record({
      eventType: "task_retrospective_recorded",
      actor: "task_workflow",
      payload: {
        taskId: existing.id,
        scope: artifact.scope,
        wentWellCount: artifact.wentWell.length,
        didNotGoWellCount: artifact.didNotGoWell.length,
        actionItemCount: artifact.actionItems.length,
        sourceCount: artifact.sources.length
      }
    });

    return this.cloneTask(existing);
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

  private normalizeRetrospectiveInput(input: TaskRetrospectiveInput): TaskRetrospectiveArtifact {
    const normalizeList = (value: string[]): string[] =>
      [...new Set(value.map((item) => item.trim()).filter(Boolean))];
    const scope = input.scope.trim();
    if (!scope) {
      throw new TaskServiceError("Retrospective scope is required", 400);
    }

    const wentWell = normalizeList(input.wentWell);
    const didNotGoWell = normalizeList(input.didNotGoWell);
    const couldBeBetter = normalizeList(input.couldBeBetter);
    const missingSkills = normalizeList(input.missingSkills);
    const missingDataPoints = normalizeList(input.missingDataPoints);
    const efficiencyNotes = normalizeList(input.efficiencyNotes);
    const sources = normalizeList(input.sources);

    if (
      wentWell.length === 0 &&
      didNotGoWell.length === 0 &&
      couldBeBetter.length === 0 &&
      missingSkills.length === 0 &&
      missingDataPoints.length === 0 &&
      efficiencyNotes.length === 0
    ) {
      throw new TaskServiceError("Retrospective must include at least one insight", 400);
    }

    const actionItems = input.actionItems
      .map((item) => {
        const title = item.title.trim();
        if (!title) {
          return null;
        }
        const owner = item.owner?.trim();
        const notes = item.notes?.trim();
        return {
          title,
          owner: owner && owner.length > 0 ? owner : null,
          priority: item.priority,
          notes: notes && notes.length > 0 ? notes : null
        } satisfies TaskRetrospectiveActionItem;
      })
      .filter((item): item is TaskRetrospectiveActionItem => item !== null);

    return {
      createdAt: this.now().toISOString(),
      scope,
      wentWell,
      didNotGoWell,
      couldBeBetter,
      missingSkills,
      missingDataPoints,
      efficiencyNotes,
      actionItems,
      sources
    };
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

  private findDuplicateByTitle(title: string): TaskRecord | undefined {
    const normalizedInput = this.normalizeDuplicateTitle(title);
    const matches = [...this.tasks.values()].filter(
      (task) => this.normalizeDuplicateTitle(task.title) === normalizedInput
    );
    if (matches.length === 0) {
      return undefined;
    }

    return matches.sort((a, b) => {
      if (a.createdAt !== b.createdAt) {
        return a.createdAt.localeCompare(b.createdAt);
      }
      return a.id.localeCompare(b.id);
    })[0];
  }

  private normalizeDuplicateTitle(title: string): string {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  private getTransitionReasonCodes(fromStatus: TaskStatus, toStatus: TaskStatus): string[] {
    const reasonCodes: string[] = [];
    const allowed = ALLOWED_STATUS_TRANSITIONS[fromStatus];
    if (!allowed.has(toStatus)) {
      reasonCodes.push("INVALID_STATUS_TRANSITION");
    }

    if (fromStatus === "implementing" && toStatus === "review") {
      reasonCodes.push("MISSING_REVIEW_ARTIFACTS");
    }

    if (toStatus === "awaiting_human") {
      reasonCodes.push("MISSING_AWAITING_HUMAN_ARTIFACT");
    }

    return reasonCodes;
  }

  private async validateStatusTransition(
    task: TaskRecord,
    fromStatus: TaskStatus,
    toStatus: TaskStatus
  ): Promise<void> {
    const blockingReasons: WorkflowBlockingReason[] = [];
    const allowed = ALLOWED_STATUS_TRANSITIONS[fromStatus];
    if (!allowed.has(toStatus)) {
      blockingReasons.push({
        code: "INVALID_STATUS_TRANSITION",
        message: `Transition from ${fromStatus} to ${toStatus} is not allowed`
      });
    }

    if (fromStatus === "implementing" && toStatus === "review") {
      if (!this.hasReviewTransitionArtifacts(task.metadata)) {
        const reviewReason: WorkflowBlockingReason = {
          code: "MISSING_REVIEW_ARTIFACTS",
          message: "implementing->review requires reviewArtifact and verificationArtifact"
        };
        await this.redirectTransitionToAwaitingHuman(
          task,
          fromStatus,
          toStatus,
          reviewReason
        );
        throw new TaskServiceError(
          `Transition redirected from ${fromStatus} to awaiting_human`,
          409,
          "TASK_TRANSITION_REDIRECTED"
        );
      }
    }

    if (toStatus === "awaiting_human" && !this.hasAwaitingHumanArtifact(task.metadata)) {
      blockingReasons.push({
        code: "MISSING_AWAITING_HUMAN_ARTIFACT",
        message: "awaiting_human requires awaitingHumanArtifact metadata"
      });
    }

    if (blockingReasons.length === 0) {
      return;
    }

    const metadata = this.ensureWorkflowRuntimeMetadata(task.metadata);
    const runtime = metadata.workflowRuntime as WorkflowRuntimeState;
    const transitionAt = this.now().toISOString();
    runtime.lastTransition = {
      from: fromStatus,
      to: toStatus,
      at: transitionAt
    };
    runtime.blockingReasons.push(...blockingReasons);
    runtime.actionHistory.push({
      at: transitionAt,
      phase: "onExit",
      status: fromStatus,
      result: "error",
      nextActionCount: 0,
      blockingReasonCount: blockingReasons.length,
      error: "status_transition_blocked"
    });
    task.metadata = metadata;

    await this.commitChange();
    await this.audit.record({
      eventType: "task_transition_blocked",
      actor: "task_workflow",
      payload: {
        taskId: task.id,
        fromStatus,
        toStatus,
        reasons: blockingReasons
      }
    });

    throw new TaskServiceError(
      `Transition blocked from ${fromStatus} to ${toStatus}`,
      409,
      "TASK_TRANSITION_BLOCKED"
    );
  }

  private hasReviewTransitionArtifacts(metadata: Record<string, unknown>): boolean {
    return this.isRecord(metadata.reviewArtifact) && this.isRecord(metadata.verificationArtifact);
  }

  private hasAwaitingHumanArtifact(metadata: Record<string, unknown>): boolean {
    return this.isRecord(metadata.awaitingHumanArtifact);
  }

  private async redirectTransitionToAwaitingHuman(
    task: TaskRecord,
    fromStatus: TaskStatus,
    attemptedStatus: TaskStatus,
    reason: WorkflowBlockingReason
  ): Promise<void> {
    const metadata = this.ensureWorkflowRuntimeMetadata(task.metadata);
    const runtime = metadata.workflowRuntime as WorkflowRuntimeState;
    const transitionAt = this.now().toISOString();
    runtime.lastTransition = {
      from: fromStatus,
      to: attemptedStatus,
      at: transitionAt
    };
    runtime.blockingReasons.push(reason);
    runtime.actionHistory.push({
      at: transitionAt,
      phase: "onExit",
      status: fromStatus,
      result: "error",
      nextActionCount: 0,
      blockingReasonCount: 1,
      error: "status_transition_redirected"
    });

    metadata.awaitingHumanArtifact = {
      question:
        "Review transition blocked. Attach reviewArtifact and verificationArtifact, then retry transition to review.",
      options: [
        {
          label: "Provide artifacts and retry (Recommended)",
          description: "Add review + verification metadata and transition again."
        },
        {
          label: "Cancel transition",
          description: "Keep implementing and postpone review."
        }
      ],
      recommendedOption: "Provide artifacts and retry (Recommended)",
      requestedAt: transitionAt,
      blockingReason: reason
    };
    metadata.transitionNote =
      "Auto-redirected to awaiting_human because implementing->review requirements were not met.";

    task.metadata = metadata;
    task.status = "awaiting_human";
    task.updatedAt = transitionAt;

    await this.commitChange();
    await this.audit.record({
      eventType: "task_transition_redirected",
      actor: "task_workflow",
      payload: {
        taskId: task.id,
        fromStatus,
        attemptedStatus,
        redirectedTo: "awaiting_human",
        reason
      }
    });
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private createWorkflowRuntimeState(): WorkflowRuntimeState {
    return {
      schemaVersion: WORKFLOW_RUNTIME_SCHEMA_VERSION,
      lastTransition: null,
      nextActions: [],
      blockingReasons: [],
      actionHistory: []
    };
  }

  private createTestingArtifactsState(): TaskTestingArtifactsState {
    return {
      schemaVersion: TESTING_ARTIFACTS_SCHEMA_VERSION,
      planned: {
        gherkinScenarios: [],
        unitTestIntent: [],
        integrationTestIntent: [],
        notes: null
      },
      implemented: {
        testsAddedOrUpdated: [],
        evidenceLinks: [],
        commandsRun: [],
        notes: null
      }
    };
  }

  private ensureWorkflowRuntimeMetadata(
    metadata: Record<string, unknown> | undefined
  ): Record<string, unknown> {
    const nextMetadata = { ...(metadata ?? {}) };
    const candidate = nextMetadata.workflowRuntime as Partial<WorkflowRuntimeState> | undefined;
    const current = candidate ?? this.createWorkflowRuntimeState();

    nextMetadata.workflowRuntime = {
      schemaVersion: WORKFLOW_RUNTIME_SCHEMA_VERSION,
      lastTransition: current.lastTransition ?? null,
      nextActions: Array.isArray(current.nextActions) ? current.nextActions : [],
      blockingReasons: Array.isArray(current.blockingReasons) ? current.blockingReasons : [],
      actionHistory: Array.isArray(current.actionHistory) ? current.actionHistory : []
    } satisfies WorkflowRuntimeState;

    const testingCandidate = nextMetadata.testingArtifacts as
      | Partial<TaskTestingArtifactsState>
      | undefined;
    const testing = testingCandidate ?? this.createTestingArtifactsState();
    const plannedCandidate = testing.planned as Partial<TaskTestingPlanState> | undefined;
    const implementedCandidate = testing.implemented as Partial<TaskTestingImplementedState> | undefined;

    nextMetadata.testingArtifacts = {
      schemaVersion: TESTING_ARTIFACTS_SCHEMA_VERSION,
      planned: {
        gherkinScenarios: Array.isArray(plannedCandidate?.gherkinScenarios)
          ? plannedCandidate.gherkinScenarios
          : [],
        unitTestIntent: Array.isArray(plannedCandidate?.unitTestIntent)
          ? plannedCandidate.unitTestIntent
          : [],
        integrationTestIntent: Array.isArray(plannedCandidate?.integrationTestIntent)
          ? plannedCandidate.integrationTestIntent
          : [],
        notes: typeof plannedCandidate?.notes === "string" ? plannedCandidate.notes : null
      },
      implemented: {
        testsAddedOrUpdated: Array.isArray(implementedCandidate?.testsAddedOrUpdated)
          ? implementedCandidate.testsAddedOrUpdated
          : [],
        evidenceLinks: Array.isArray(implementedCandidate?.evidenceLinks)
          ? implementedCandidate.evidenceLinks
          : [],
        commandsRun: Array.isArray(implementedCandidate?.commandsRun)
          ? implementedCandidate.commandsRun
          : [],
        notes: typeof implementedCandidate?.notes === "string" ? implementedCandidate.notes : null
      }
    } satisfies TaskTestingArtifactsState;

    return nextMetadata;
  }

  private async executeStatusHooks(
    task: TaskRecord,
    fromStatus: TaskStatus,
    toStatus: TaskStatus
  ): Promise<void> {
    const metadata = this.ensureWorkflowRuntimeMetadata(task.metadata);
    const runtime = metadata.workflowRuntime as WorkflowRuntimeState;
    const transitionAt = this.now().toISOString();
    runtime.lastTransition = {
      from: fromStatus,
      to: toStatus,
      at: transitionAt
    };

    const executionPlan: Array<{
      phase: "onEnter" | "onExit";
      status: TaskStatus;
      hook: TaskStatusHook;
    }> = [];

    for (const hook of this.statusHooks[fromStatus]?.onExit ?? []) {
      executionPlan.push({ phase: "onExit", status: fromStatus, hook });
    }
    for (const hook of this.statusHooks[toStatus]?.onEnter ?? []) {
      executionPlan.push({ phase: "onEnter", status: toStatus, hook });
    }

    for (const step of executionPlan) {
      try {
        const outcome = (await step.hook({
          task: this.cloneTask(task),
          fromStatus,
          toStatus,
          phase: step.phase
        })) ?? { nextActions: [], blockingReasons: [] };
        const nextActions = Array.isArray(outcome.nextActions) ? outcome.nextActions : [];
        const blockingReasons = Array.isArray(outcome.blockingReasons)
          ? outcome.blockingReasons
          : [];
        runtime.nextActions.push(...nextActions);
        runtime.blockingReasons.push(...blockingReasons);
        runtime.actionHistory.push({
          at: transitionAt,
          phase: step.phase,
          status: step.status,
          result: "ok",
          nextActionCount: nextActions.length,
          blockingReasonCount: blockingReasons.length
        });
        await this.executeNextActions(
          task.id,
          runtime,
          nextActions,
          step.phase,
          step.status,
          transitionAt
        );
      } catch (error) {
        runtime.actionHistory.push({
          at: transitionAt,
          phase: step.phase,
          status: step.status,
          result: "error",
          nextActionCount: 0,
          blockingReasonCount: 0,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    task.metadata = metadata;
  }

  private async executeNextActions(
    taskId: string,
    runtime: WorkflowRuntimeState,
    actions: WorkflowNextAction[],
    phase: "onEnter" | "onExit",
    status: TaskStatus,
    transitionAt: string
  ): Promise<void> {
    for (const action of actions) {
      if (this.wasActionHandled(runtime, action.id, phase, status)) {
        continue;
      }

      if (!this.isCommandAction(action)) {
        runtime.actionHistory.push({
          at: transitionAt,
          phase,
          status,
          result: "ok",
          nextActionCount: 0,
          blockingReasonCount: 0,
          actionId: action.id,
          actionType: action.type
        });
        await this.audit.record({
          eventType: "task_action_scheduled",
          actor: "task_workflow",
          payload: {
            taskId,
            actionId: action.id,
            actionType: action.type,
            phase,
            status
          }
        });
        continue;
      }

      const actionId = action.id;
      if (!this.isCommandAllowed(action.command)) {
        runtime.blockingReasons.push({
          code: "COMMAND_NOT_ALLOWED",
          message: `Command is not allow-listed: ${action.command}`
        });
        runtime.actionHistory.push({
          at: transitionAt,
          phase,
          status,
          result: "error",
          nextActionCount: 0,
          blockingReasonCount: 1,
          actionId,
          actionType: action.type,
          error: "command_not_allowed"
        });
        await this.audit.record({
          eventType: "task_action_blocked",
          actor: "task_workflow",
          payload: {
            taskId,
            actionId,
            actionType: action.type,
            phase,
            status,
            reason: "COMMAND_NOT_ALLOWED"
          }
        });
        continue;
      }

      try {
        const result = await this.commandExecutor({
          command: action.command,
          args: action.args,
          timeoutMs: this.commandTimeoutMs
        });
        if (result.exitCode !== 0) {
          runtime.blockingReasons.push({
            code: "COMMAND_EXECUTION_FAILED",
            message: `Command failed with exit code ${result.exitCode}: ${action.command}`
          });
          runtime.actionHistory.push({
            at: transitionAt,
            phase,
            status,
            result: "error",
            nextActionCount: 0,
            blockingReasonCount: 1,
            actionId,
            actionType: action.type,
            error: `exit_code_${result.exitCode}`
          });
          await this.audit.record({
            eventType: "task_action_failed",
            actor: "task_workflow",
            payload: {
              taskId,
              actionId,
              actionType: action.type,
              phase,
              status,
              reason: `exit_code_${result.exitCode}`
            }
          });
          continue;
        }

        runtime.actionHistory.push({
          at: transitionAt,
          phase,
          status,
          result: "ok",
          nextActionCount: 0,
          blockingReasonCount: 0,
          actionId,
          actionType: action.type
        });
        await this.audit.record({
          eventType: "task_action_executed",
          actor: "task_workflow",
          payload: {
            taskId,
            actionId,
            actionType: action.type,
            phase,
            status
          }
        });
      } catch (error) {
        runtime.blockingReasons.push({
          code: "COMMAND_EXECUTION_FAILED",
          message: `Command execution failed: ${action.command}`
        });
        runtime.actionHistory.push({
          at: transitionAt,
          phase,
          status,
          result: "error",
          nextActionCount: 0,
          blockingReasonCount: 1,
          actionId,
          actionType: action.type,
          error: error instanceof Error ? error.message : String(error)
        });
        await this.audit.record({
          eventType: "task_action_failed",
          actor: "task_workflow",
          payload: {
            taskId,
            actionId,
            actionType: action.type,
            phase,
            status,
            reason: error instanceof Error ? error.message : String(error)
          }
        });
      }
    }
  }

  private wasActionHandled(
    runtime: WorkflowRuntimeState,
    actionId: string,
    phase: "onEnter" | "onExit",
    status: TaskStatus
  ): boolean {
    return runtime.actionHistory.some(
      (entry) => entry.actionId === actionId && entry.phase === phase && entry.status === status
    );
  }

  private isCommandAction(
    action: WorkflowNextAction
  ): action is WorkflowNextAction & { command: string; args: string[] } {
    return (
      action.type === "command" &&
      typeof action.command === "string" &&
      Array.isArray(action.args)
    );
  }

  private isCommandAllowed(command: string): boolean {
    return this.commandAllowlist.some((entry) => {
      if (entry.endsWith("/")) {
        return command.startsWith(entry);
      }
      return command === entry;
    });
  }

  private async executeCommand(
    request: WorkflowCommandExecutionRequest
  ): Promise<WorkflowCommandExecutionResult> {
    try {
      const result = await execFileAsync(request.command, request.args, {
        timeout: request.timeoutMs,
        windowsHide: true
      });
      return {
        exitCode: 0,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? ""
      };
    } catch (error) {
      const failed = error as {
        code?: number | string;
        stdout?: string;
        stderr?: string;
        message?: string;
      };
      if (typeof failed.code === "number") {
        return {
          exitCode: failed.code,
          stdout: failed.stdout ?? "",
          stderr: failed.stderr ?? ""
        };
      }
      throw new Error(failed.message ?? "command_execution_failed");
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
