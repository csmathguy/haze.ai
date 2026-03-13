import cors from "@fastify/cors";
import Fastify from "fastify";

import { CODE_REVIEW_API_HOST } from "./config.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerWorkspaceRoutes } from "./routes/workspace.js";

export async function buildApp() {
  const app = Fastify({
    logger: false
  });

  await app.register(cors, {
    origin: [`http://${CODE_REVIEW_API_HOST}:5173`, "http://localhost:5173"]
  });

  registerHealthRoutes(app);
  registerWorkspaceRoutes(app);

  return app;
}
