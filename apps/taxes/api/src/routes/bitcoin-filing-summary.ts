import type { FastifyInstance } from "fastify";

import type { WorkspacePersistenceOptions } from "../services/context.js";
import { buildBitcoinFilingSummary } from "../services/bitcoin-filing-summary.js";
import { getWorkspaceSnapshot } from "../services/workspace.js";

export function registerBitcoinFilingSummaryRoutes(
  app: FastifyInstance,
  options: WorkspacePersistenceOptions = {}
): void {
  app.get("/api/bitcoin-filing-summary", async () => ({
    summary: buildBitcoinFilingSummary(await getWorkspaceSnapshot(options))
  }));
}
