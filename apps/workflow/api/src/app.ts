import cors from "@fastify/cors";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";

import { WORKFLOW_API_HOST, PLANNING_DATABASE_URL } from "./config.js";
import { getWorkflowPrismaClient, disconnectWorkflowPrismaClient } from "./db/client.js";
import { WorkflowWorker } from "./event-bus/workflow-worker.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerWorkflowRoutes, type WorkflowPersistenceOptions } from "./routes/workflow.js";

// Re-export executor modules for use throughout the application
export * from "./executor/index.js";

export async function buildApp(options: WorkflowPersistenceOptions = {}) {
  const app = Fastify({
    logger: false
  });

  await app.register(cors, {
    origin: [`http://${WORKFLOW_API_HOST}:5174`, "http://localhost:5174"]
  });

  let worker: WorkflowWorker | null = null;

  app.addHook("onReady", async () => {
    const db = await getWorkflowPrismaClient(options.databaseUrl);
    worker = new WorkflowWorker({
      pollIntervalMs: options.pollIntervalMs ?? 1000,
      batchSize: 10,
      db,
      planningDatabaseUrl: options.planningDatabaseUrl ?? PLANNING_DATABASE_URL
    });
    worker.start();
  });

  app.addHook("onClose", async () => {
    worker?.stop();
    await disconnectWorkflowPrismaClient(options.databaseUrl);
  });

  registerHealthRoutes(app);
  registerWorkflowRoutes(app, { databaseUrl: options.databaseUrl });

  return app;
}

/** Gateway registration — registers workflow domain routes. */
export function registerWorkflowPlugin(
  app: FastifyInstance,
  opts: WorkflowPersistenceOptions,
  done: () => void
): void {
  let worker: WorkflowWorker | null = null;

  app.addHook("onReady", async () => {
    const db = await getWorkflowPrismaClient(opts.databaseUrl);
    worker = new WorkflowWorker({
      pollIntervalMs: opts.pollIntervalMs ?? 1000,
      batchSize: 10,
      db,
      planningDatabaseUrl: opts.planningDatabaseUrl ?? PLANNING_DATABASE_URL
    });
    worker.start();
  });

  app.addHook("onClose", async () => {
    worker?.stop();
    await disconnectWorkflowPrismaClient(opts.databaseUrl);
  });

  registerHealthRoutes(app);
  registerWorkflowRoutes(app, { databaseUrl: opts.databaseUrl });
  done();
}
