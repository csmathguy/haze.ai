import { mkdtemp, rm } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { buildKnowledgeSqliteUrl, disconnectKnowledgePrismaClient } from "../db/client.js";
import { applyPendingKnowledgeMigrations } from "../db/migrations.js";

export interface TestKnowledgeContext {
  cleanup(): Promise<void>;
  databaseUrl: string;
  docsRoot: string;
  rootDirectory: string;
}

export async function createTestKnowledgeContext(prefix: string): Promise<TestKnowledgeContext> {
  const rootDirectory = await mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
  const databaseFilePath = path.join(rootDirectory, "sqlite", "knowledge.test.db");
  const databaseUrl = buildKnowledgeSqliteUrl(databaseFilePath);
  const docsRoot = path.join(rootDirectory, "docs");

  await applyPendingKnowledgeMigrations(databaseUrl);

  return {
    async cleanup() {
      await disconnectKnowledgePrismaClient(databaseUrl);
      await rm(rootDirectory, { force: true, recursive: true });
    },
    databaseUrl,
    docsRoot,
    rootDirectory
  };
}
