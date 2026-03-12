import { mkdtemp, rm } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { disconnectPrismaClient, buildPrismaSqliteUrl } from "../db/client.js";
import { applyPendingMigrations } from "../db/migrations.js";

export interface TestPlanningContext {
  cleanup(): Promise<void>;
  databaseUrl: string;
}

export async function createTestPlanningContext(prefix: string): Promise<TestPlanningContext> {
  const rootDirectory = await mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
  const databaseFilePath = path.join(rootDirectory, "sqlite", "planning.test.db");
  const databaseUrl = buildPrismaSqliteUrl(databaseFilePath);

  await applyPendingMigrations(databaseUrl);

  return {
    async cleanup() {
      await disconnectPrismaClient(databaseUrl);
      await rm(rootDirectory, { force: true, recursive: true });
    },
    databaseUrl
  };
}
