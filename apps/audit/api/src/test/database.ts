import { mkdtemp, rm } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { buildAuditDatabaseUrl } from "../config.js";
import { disconnectAuditPrismaClient } from "../db/client.js";
import { applyPendingAuditMigrations } from "../db/migrations.js";

export interface TestAuditContext {
  cleanup(): Promise<void>;
  databaseUrl: string;
  rootDirectory: string;
}

export async function createTestAuditContext(prefix: string): Promise<TestAuditContext> {
  const rootDirectory = await mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
  const databaseFilePath = path.join(rootDirectory, "sqlite", "audit.test.db");
  const databaseUrl = buildAuditDatabaseUrl(databaseFilePath);

  await applyPendingAuditMigrations(databaseUrl);

  return {
    async cleanup() {
      await disconnectAuditPrismaClient(databaseUrl);
      await rm(rootDirectory, { force: true, recursive: true });
    },
    databaseUrl,
    rootDirectory
  };
}
