import type { FastifyInstance } from "fastify";

import { getCodeReviewWorkspace } from "../services/workspace.js";

export function registerWorkspaceRoutes(app: FastifyInstance): void {
  app.get("/api/code-review/workspace", () => ({
    workspace: getCodeReviewWorkspace()
  }));
}
