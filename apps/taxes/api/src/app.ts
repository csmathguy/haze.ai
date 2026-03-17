import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import type { FastifyInstance } from "fastify";

import { MAX_UPLOAD_FILE_BYTES, WEB_ALLOWED_ORIGINS } from "./config.js";
import { disconnectPrismaClient } from "./db/client.js";
import { registerDocumentRoutes } from "./routes/documents.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerQuestionnaireRoutes } from "./routes/questionnaire.js";
import { registerWorkspaceRoutes } from "./routes/workspace.js";
import type { WorkspacePersistenceOptions } from "./services/context.js";

export async function buildApp(options: WorkspacePersistenceOptions = {}) {
  const app = Fastify({
    logger: false
  });

  await app.register(cors, {
    origin: WEB_ALLOWED_ORIGINS
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
  registerQuestionnaireRoutes(app, options);
  registerWorkspaceRoutes(app, options);
  registerDocumentRoutes(app, options);

  return app;
}

/** Gateway registration — registers taxes domain routes without CORS or health. */
export async function registerTaxesPlugin(app: FastifyInstance, opts: WorkspacePersistenceOptions = {}): Promise<void> {
  await app.register(multipart, {
    limits: {
      fileSize: MAX_UPLOAD_FILE_BYTES,
      files: 1
    }
  });
  app.addHook("onClose", async () => {
    await disconnectPrismaClient(opts.databaseUrl);
  });
  registerQuestionnaireRoutes(app, opts);
  registerWorkspaceRoutes(app, opts);
  registerDocumentRoutes(app, opts);
}
