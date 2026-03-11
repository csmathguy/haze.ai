import type { FastifyInstance } from "fastify";

import type { WorkspacePersistenceOptions } from "../services/context.js";
import { getWorkspaceSnapshot } from "../services/workspace.js";

export function registerWorkspaceRoutes(app: FastifyInstance, options: WorkspacePersistenceOptions = {}): void {
  app.get("/api/workspace", async () => ({
    snapshot: await getWorkspaceSnapshot(options)
  }));
}
