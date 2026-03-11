import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";

import { API_HOST, MAX_UPLOAD_FILE_BYTES } from "./config.js";
import { disconnectPrismaClient } from "./db/client.js";
import { registerDocumentRoutes } from "./routes/documents.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerWorkspaceRoutes } from "./routes/workspace.js";
import type { WorkspacePersistenceOptions } from "./services/context.js";

export async function buildApp(options: WorkspacePersistenceOptions = {}) {
  const app = Fastify({
    logger: false
  });

  await app.register(cors, {
    origin: [`http://${API_HOST}:5173`, "http://localhost:5173"]
  });
  await app.register(multipart, {
    limits: {
      fileSize: MAX_UPLOAD_FILE_BYTES,
      files: 1
    }
  });
  app.addHook("onClose", async () => {
    await disconnectPrismaClient(options.databaseUrl);
  });
  registerHealthRoutes(app);
  registerWorkspaceRoutes(app, options);
  registerDocumentRoutes(app, options);

  return app;
}
