import cors from "@fastify/cors";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";

import { WORKFLOW_API_HOST } from "./config.js";
import { disconnectWorkflowPrismaClient } from "./db/client.js";
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
  app.addHook("onClose", async () => {
    await disconnectWorkflowPrismaClient(options.databaseUrl);
  });

  registerHealthRoutes(app);
  registerWorkflowRoutes(app);

  return app;
}

/** Gateway registration — registers workflow domain routes. */
export function registerWorkflowPlugin(
  app: FastifyInstance,
  opts: WorkflowPersistenceOptions,
  done: () => void
): void {
  app.addHook("onClose", async () => {
    await disconnectWorkflowPrismaClient(opts.databaseUrl);
  });
  registerHealthRoutes(app);
  registerWorkflowRoutes(app);
  done();
}
