import Fastify from "fastify";
import cors from "@fastify/cors";

import { PLAN_API_HOST } from "./config.js";
import { disconnectPrismaClient } from "./db/client.js";
import { registerPlanningRoutes } from "./routes/planning.js";
import type { PlanningPersistenceOptions } from "./services/context.js";

export async function buildApp(options: PlanningPersistenceOptions = {}) {
  const app = Fastify({
    logger: false
  });

  await app.register(cors, {
    origin: [`http://${PLAN_API_HOST}:5174`, "http://localhost:5174"]
  });
  app.addHook("onClose", async () => {
    await disconnectPrismaClient(options.databaseUrl);
  });
  registerPlanningRoutes(app, options);

  return app;
}
