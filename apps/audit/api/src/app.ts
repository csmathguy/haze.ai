import cors from "@fastify/cors";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";

import { AUDIT_API_HOST } from "./config.js";
import { disconnectAuditPrismaClient } from "./db/client.js";
import { registerAuditRoutes } from "./routes/audit.js";
import { registerHealthRoutes } from "./routes/health.js";
import type { AuditPersistenceOptions } from "./services/context.js";

export async function buildApp(options: AuditPersistenceOptions = {}) {
  const app = Fastify({
    logger: false
  });

  await app.register(cors, {
    origin: [`http://${AUDIT_API_HOST}:5174`, "http://localhost:5174"]
  });
  app.addHook("onClose", async () => {
    await disconnectAuditPrismaClient(options.databaseUrl);
  });

  registerHealthRoutes(app);
  registerAuditRoutes(app, options);

  return app;
}

export { getAuditWorkItemTimeline } from "./services/audit-work-item-timeline.js";

/** Gateway registration — registers audit domain routes without CORS or health. */
export function registerAuditPlugin(app: FastifyInstance, opts: AuditPersistenceOptions, done: () => void): void {
  app.addHook("onClose", async () => {
    await disconnectAuditPrismaClient(opts.databaseUrl);
  });
  registerAuditRoutes(app, opts);
  done();
}
