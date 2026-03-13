import { mkdtemp, rm } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { buildPrismaSqliteUrl, disconnectPrismaClient } from "../db/client.js";
import { applyPendingMigrations } from "../db/migrations.js";

export interface TestWorkspaceContext {
  cleanup(): Promise<void>;
  databaseUrl: string;
  rootDirectory: string;
}

export async function createTestWorkspaceContext(prefix: string): Promise<TestWorkspaceContext> {
  const rootDirectory = await mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
  const databaseFilePath = path.join(rootDirectory, "sqlite", "taxes.test.db");
  const databaseUrl = buildPrismaSqliteUrl(databaseFilePath);

  await applyPendingMigrations(databaseUrl);

  return {
    async cleanup() {
      await disconnectPrismaClient(databaseUrl);
      await rm(rootDirectory, { force: true, recursive: true });
    },
    databaseUrl,
    rootDirectory
  };
}
