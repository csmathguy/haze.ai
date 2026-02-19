import { randomUUID } from "node:crypto";
import express from "express";
import type { AuditEventRecord } from "./audit.js";
import { FileAuditSink } from "./audit.js";
import { HeartbeatMonitor } from "./heartbeat.js";
import { logger } from "./logger.js";
import { BasicOrchestrator } from "./orchestrator.js";
import { OrchestratorWorkerService } from "./orchestrator-worker.js";
import { TaskActions } from "./task-actions.js";
import { ProjectFileStore } from "./project-file-store.js";
import { TaskFileStore } from "./task-file-store.js";
import {
  type CreateProjectInput,
  ProjectServiceError,
  ProjectWorkflowService,
  type UpdateProjectInput
} from "./projects.js";
import {
  type CreateTaskInput,
  type TaskProjectGithubConfig,
  type TaskRetrospectiveInput,
  TaskServiceError,
  TaskWorkflowService
} from "./tasks.js";
import { resolveRepoPath } from "./paths.js";
import { registerTaskPlannerDeterminationRoute } from "./task-planner-determination-route.js";

const PORT = Number(process.env.PORT ?? 3001);
const AUDIT_LOG_DIR = process.env.AUDIT_LOG_DIR ?? "data/audit";
const AUDIT_RETENTION_DAYS = Number(process.env.AUDIT_RETENTION_DAYS ?? 7);
const TASKS_FILE_PATH = process.env.TASKS_FILE_PATH ?? "data/tasks/tasks.json";
const PROJECTS_FILE_PATH = process.env.PROJECTS_FILE_PATH ?? "data/projects/projects.json";
const TASKS_DOCS_DIR = resolveRepoPath(process.env.TASKS_DOCS_DIR);

const app = express();
app.use(express.json());

const audit = new FileAuditSink(AUDIT_LOG_DIR, {
  retentionDays: AUDIT_RETENTION_DAYS
});

const getHeaderValue = (raw: string | undefined): string | undefined => {
  if (!raw) {
    return undefined;
  }

  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const buildAuditContext = (req: express.Request) => ({
  requestId: getHeaderValue(req.header("x-request-id")) ?? randomUUID(),
  traceId: getHeaderValue(req.header("x-trace-id")) ?? randomUUID(),
  userId: getHeaderValue(req.header("x-user-id")) ?? null
});

const handleTaskError = (error: unknown, res: express.Response): boolean => {
  if (error instanceof TaskServiceError) {
    res.status(error.statusCode).json({ error: error.message });
    return true;
  }

  return false;
};

const handleProjectError = (error: unknown, res: express.Response): boolean => {
  if (error instanceof ProjectServiceError) {
    res.status(error.statusCode).json({ error: error.message });
    return true;
  }

  return false;
};

const handleUnexpectedTaskError = (
  error: unknown,
  res: express.Response,
  operation: string
): void => {
  logger.error({ error, operation }, "task route failed");
  res.status(500).json({ error: "Internal server error" });
};

async function bootstrap(): Promise<void> {
  const projectStore = new ProjectFileStore(PROJECTS_FILE_PATH);
  const persistedProjects = await projectStore.load();
  const projects = new ProjectWorkflowService({
    initialProjects: persistedProjects,
    onChanged: async (records) => {
      await projectStore.save(records);
    }
  });
  const taskStore = new TaskFileStore(TASKS_FILE_PATH);
  const persistedTasks = await taskStore.load();

  const tasks = new TaskWorkflowService(audit, {
    initialTasks: persistedTasks,
    resolveProjectGithubConfig: (projectId): TaskProjectGithubConfig | null => {
      try {
        const project = projects.get(projectId);
        const metadata = project.metadata as Record<string, unknown>;
        const github = metadata.github;
        if (!github || typeof github !== "object" || Array.isArray(github)) {
          return null;
        }
        const config = github as Record<string, unknown>;
        return {
          repository:
            typeof config.repository === "string" ? config.repository : undefined,
          tokenEnvVar:
            typeof config.tokenEnvVar === "string" ? config.tokenEnvVar : undefined,
          mergeMethod:
            config.mergeMethod === "merge" ||
            config.mergeMethod === "squash" ||
            config.mergeMethod === "rebase"
              ? config.mergeMethod
              : undefined
        };
      } catch {
        return null;
      }
    },
    onChanged: async (records) => {
      await taskStore.save(records);
    }
  });
  const taskActions = new TaskActions(tasks);

  if (TASKS_DOCS_DIR) {
    const docsTasks = await taskStore.loadTasksFromDocumentation(TASKS_DOCS_DIR);
    if (docsTasks.length > 0) {
      await tasks.syncFromCodebase(docsTasks);
    }
  }

  const orchestrator = new BasicOrchestrator(audit);
  const worker = new OrchestratorWorkerService(tasks, audit, {
    pollIntervalMs: Number(process.env.ORCHESTRATOR_WORKER_POLL_INTERVAL_MS ?? 5000)
  });
  const heartbeat = new HeartbeatMonitor(
    orchestrator,
    {
      intervalMs: Number(process.env.HEARTBEAT_INTERVAL_MS ?? 30000),
      stallThresholdMs: Number(process.env.HEARTBEAT_STALL_THRESHOLD_MS ?? 90000)
    },
    audit
  );

  heartbeat.start();
  worker.start();

  void audit.record({
    eventType: "backend_started",
    actor: "system",
      payload: {
        port: PORT,
        auditLogDir: AUDIT_LOG_DIR,
        retentionDays: AUDIT_RETENTION_DAYS,
        tasksFilePath: TASKS_FILE_PATH,
        projectsFilePath: PROJECTS_FILE_PATH
      }
    });

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "haze-backend",
      now: new Date().toISOString()
    });
  });

  app.get("/orchestrator/status", (_req, res) => {
    res.json(orchestrator.getStatus());
  });

  app.get("/orchestrator/worker/status", (_req, res) => {
    res.json(worker.getStatus());
  });

  app.get("/audit/recent", async (req, res) => {
    const rawLimit = Number(req.query.limit ?? 100);
    const limit = Number.isNaN(rawLimit) ? 100 : rawLimit;
    const records = await audit.getRecent(limit);
    res.json({ records });
  });

  app.get("/tasks", (req, res) => {
    const status = req.query.status as string | undefined;
    const all = tasks.listWithDependents();
    const records = status ? all.filter((task) => task.status === status) : all;
    res.json({ records });
  });

  app.get("/tasks/:id", (req, res) => {
    try {
      const record = tasks.getWithDependents(req.params.id);
      res.json({ record });
    } catch (error) {
      if (!handleTaskError(error, res)) {
        handleUnexpectedTaskError(error, res, "get_task");
      }
    }
  });

  app.get("/workflow/status-model", (_req, res) => {
    res.json(tasks.getStatusModel());
  });

  app.get("/projects", (_req, res) => {
    res.json({ records: projects.list() });
  });

  app.get("/projects/:id", (req, res) => {
    try {
      res.json({ record: projects.get(req.params.id) });
    } catch (error) {
      if (!handleProjectError(error, res)) {
        handleUnexpectedTaskError(error, res, "get_project");
      }
    }
  });

  app.post("/tasks", async (req, res) => {
    try {
      const input = (req.body ?? {}) as CreateTaskInput;
      if (input.projectId && !projects.exists(input.projectId)) {
        throw new TaskServiceError(`Unknown project: ${input.projectId}`, 400);
      }
      const record = await tasks.create(input);
      res.status(201).json({ record: tasks.getWithDependents(record.id) });
    } catch (error) {
      if (!handleTaskError(error, res)) {
        handleUnexpectedTaskError(error, res, "create_task");
      }
    }
  });

  app.patch("/tasks/:id", async (req, res) => {
    try {
      const input = (req.body ?? {}) as CreateTaskInput;
      if (input.projectId && !projects.exists(input.projectId)) {
        throw new TaskServiceError(`Unknown project: ${input.projectId}`, 400);
      }
      const record = await tasks.update(req.params.id, req.body ?? {});
      res.json({ record: tasks.getWithDependents(record.id) });
    } catch (error) {
      if (!handleTaskError(error, res)) {
        handleUnexpectedTaskError(error, res, "update_task");
      }
    }
  });

  app.post("/tasks/:id/retrospectives", async (req, res) => {
    try {
      const input = (req.body ?? {}) as TaskRetrospectiveInput;
      const record = await tasks.recordRetrospective(req.params.id, input);
      res.status(201).json({ record: tasks.getWithDependents(record.id) });
    } catch (error) {
      if (!handleTaskError(error, res)) {
        handleUnexpectedTaskError(error, res, "record_task_retrospective");
      }
    }
  });

  registerTaskPlannerDeterminationRoute({ app, tasks, handleTaskError, handleUnexpectedTaskError });

  app.delete("/tasks/:id", async (req, res) => {
    try {
      await tasks.delete(req.params.id);
      res.status(204).end();
    } catch (error) {
      if (!handleTaskError(error, res)) {
        handleUnexpectedTaskError(error, res, "delete_task");
      }
    }
  });

  app.post("/projects", async (req, res) => {
    try {
      const input = (req.body ?? {}) as CreateProjectInput;
      const record = await projects.create(input);
      res.status(201).json({ record });
    } catch (error) {
      if (!handleProjectError(error, res)) {
        handleUnexpectedTaskError(error, res, "create_project");
      }
    }
  });

  app.patch("/projects/:id", async (req, res) => {
    try {
      const input = (req.body ?? {}) as UpdateProjectInput;
      const record = await projects.update(req.params.id, input);
      res.json({ record });
    } catch (error) {
      if (!handleProjectError(error, res)) {
        handleUnexpectedTaskError(error, res, "update_project");
      }
    }
  });

  app.delete("/projects/:id", async (req, res) => {
    try {
      const isUsedByTask = tasks.list().some((task) => task.projectId === req.params.id);
      if (isUsedByTask) {
        throw new ProjectServiceError(
          `Project ${req.params.id} cannot be deleted; it is associated with one or more tasks`,
          409
        );
      }
      await projects.delete(req.params.id);
      res.status(204).end();
    } catch (error) {
      if (!handleProjectError(error, res)) {
        handleUnexpectedTaskError(error, res, "delete_project");
      }
    }
  });

  app.post("/tasks/actions/next", async (_req, res) => {
    const record = await taskActions.nextTask();
    if (!record) {
      res.status(404).json({ error: "No eligible task available" });
      return;
    }

    res.json({ record: tasks.getWithDependents(record.id) });
  });

  app.post("/agent/actions/add-task", async (req, res) => {
    try {
      const input = (req.body ?? {}) as CreateTaskInput;
      const record = await taskActions.addTask(input);
      res.status(201).json({ record: tasks.getWithDependents(record.id) });
    } catch (error) {
      if (!handleTaskError(error, res)) {
        handleUnexpectedTaskError(error, res, "agent_add_task");
      }
    }
  });

  app.post("/agent/actions/sync-tasks-from-codebase", async (_req, res) => {
    if (!TASKS_DOCS_DIR) {
      res.status(400).json({
        error: "TASKS_DOCS_DIR is not configured; codebase task sync is disabled"
      });
      return;
    }

    try {
      const docsRecords = await taskStore.loadTasksFromDocumentation(TASKS_DOCS_DIR);
      const result = await tasks.syncFromCodebase(docsRecords);
      res.json({
        synced: true,
        imported: result.imported,
        totalTasks: tasks.list().length
      });
    } catch (error) {
      if (!handleTaskError(error, res)) {
        handleUnexpectedTaskError(error, res, "sync_tasks_from_codebase");
      }
    }
  });

  app.get("/audit/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const writeEvent = (event: string, data: AuditEventRecord | { connected: true }) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    writeEvent("connected", { connected: true });

    const unsubscribe = audit.subscribe((record) => {
      writeEvent("audit", record);
    });

    req.on("close", () => {
      unsubscribe();
      res.end();
    });
  });

  app.post("/orchestrator/wake", async (req, res) => {
    const context = buildAuditContext(req);
    const reason = String(req.body?.reason ?? "manual_api_request");
    heartbeat.pulse("manual_wake_api");
    await audit.record({
      eventType: "api_orchestrator_wake_requested",
      actor: "api",
      requestId: context.requestId,
      traceId: context.traceId,
      userId: context.userId,
      payload: { reason }
    });
    await orchestrator.wake(reason);
    res.status(202).json({ accepted: true, reason, requestId: context.requestId });
  });

  app.post("/orchestrator/worker/start", async (_req, res) => {
    worker.start();
    await audit.record({ eventType: "api_orchestrator_worker_start_requested", actor: "api" });
    res.json(worker.getStatus());
  });
  app.post("/orchestrator/worker/stop", async (_req, res) => {
    worker.stop();
    await audit.record({ eventType: "api_orchestrator_worker_stop_requested", actor: "api" });
    res.json(worker.getStatus());
  });
  app.post("/heartbeat/pulse", async (req, res) => {
    const context = buildAuditContext(req);
    const source = String(req.body?.source ?? "external");
    heartbeat.pulse(source);
    await audit.record({
      eventType: "api_heartbeat_pulse_requested",
      actor: "api",
      requestId: context.requestId,
      traceId: context.traceId,
      userId: context.userId,
      payload: { source }
    });
    res.status(202).json({ accepted: true, source, requestId: context.requestId });
  });

  app.listen(PORT, () => {
    logger.info(
      {
        port: PORT,
        auditLogDir: AUDIT_LOG_DIR,
        retentionDays: AUDIT_RETENTION_DAYS,
        tasksFilePath: TASKS_FILE_PATH,
        projectsFilePath: PROJECTS_FILE_PATH
      },
      "backend started"
    );
  });
}

bootstrap().catch((error) => {
  logger.error({ error }, "backend bootstrap failed");
  process.exit(1);
});
