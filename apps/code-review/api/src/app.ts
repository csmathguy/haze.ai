import cors from "@fastify/cors";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";

import { CODE_REVIEW_API_HOST } from "./config.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerWorkspaceRoutes } from "./routes/workspace.js";
import { createCodeReviewService, type CodeReviewService } from "./services/workspace.js";

interface BuildAppOptions {
  readonly auditDatabaseUrl?: string;
  readonly codeReviewService?: CodeReviewService;
  readonly planningDatabaseUrl?: string;
}

export async function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({
    logger: false
  });

  await app.register(cors, {
    origin: [`http://${CODE_REVIEW_API_HOST}:5178`, "http://localhost:5178"]
  });

  registerHealthRoutes(app);
  registerWorkspaceRoutes(app, options.codeReviewService ?? createCodeReviewService(buildServiceOptions(options)));

  return app;
}

/** Gateway registration — registers code-review domain routes without CORS or health. */
export function registerCodeReviewPlugin(app: FastifyInstance, opts: BuildAppOptions, done: () => void): void {
  registerWorkspaceRoutes(app, opts.codeReviewService ?? createCodeReviewService(buildServiceOptions(opts)));
  done();
}

function buildServiceOptions(opts: BuildAppOptions) {
  return {
    ...(opts.auditDatabaseUrl !== undefined ? { auditDatabaseUrl: opts.auditDatabaseUrl } : {}),
    ...(opts.planningDatabaseUrl !== undefined ? { planningDatabaseUrl: opts.planningDatabaseUrl } : {})
  };
}
