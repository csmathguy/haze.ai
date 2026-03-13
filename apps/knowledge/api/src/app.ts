import cors from "@fastify/cors";
import Fastify from "fastify";

import { KNOWLEDGE_API_HOST } from "./config.js";
import { disconnectKnowledgePrismaClient } from "./db/client.js";
import { registerKnowledgeRoutes } from "./routes/knowledge.js";
import type { KnowledgePersistenceOptions } from "./services/context.js";

export async function buildApp(options: KnowledgePersistenceOptions = {}) {
  const app = Fastify({
    logger: false
  });

  await app.register(cors, {
    origin: [`http://${KNOWLEDGE_API_HOST}:5176`, "http://localhost:5176"]
  });
  app.addHook("onClose", async () => {
    await disconnectKnowledgePrismaClient(options.databaseUrl);
  });
  registerKnowledgeRoutes(app, options);

  return app;
}
