import Fastify from "fastify";
import cors from "@fastify/cors";
import type { FastifyInstance } from "fastify";

import { PLAN_API_HOST } from "./config.js";
import { disconnectPrismaClient } from "./db/client.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerPlanningRoutes } from "./routes/planning.js";
import type { PlanningPersistenceOptions } from "./services/context.js";

export async function buildApp(options: PlanningPersistenceOptions = {}) {
  const app = Fastify({
    logger: false
  });

  await app.register(cors, {
    origin: [`http://${PLAN_API_HOST}:5174`, `http://${PLAN_API_HOST}:5175`, "http://localhost:5174", "http://localhost:5175"]
  });
  app.addHook("onClose", async () => {
    await disconnectPrismaClient(options.databaseUrl);
  });
  registerHealthRoutes(app);
  registerPlanningRoutes(app, options);

  return app;
}

export { getWorkItemById } from "./services/planning.js";

/** Gateway registration — registers plan domain routes without CORS or health. */
export function registerPlanPlugin(app: FastifyInstance, opts: PlanningPersistenceOptions, done: () => void): void {
  app.addHook("onClose", async () => {
    await disconnectPrismaClient(opts.databaseUrl);
  });
  registerPlanningRoutes(app, opts);
  done();
}
