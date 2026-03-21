import { mkdir, mkdtemp, rm } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { buildPrismaSqliteUrl, resolveDatabaseFilePath } from "@taxes/db";

import { applyPendingMigrations } from "./migrations.js";

const INITIAL_SCHEMA_SQL = `
  CREATE TABLE "HouseholdProfile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "taxYear" INTEGER NOT NULL,
    "filingStatus" TEXT NOT NULL,
    "hasDigitalAssets" BOOLEAN NOT NULL DEFAULT false,
    "primaryTaxpayer" TEXT NOT NULL,
    "stateResidence" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  );
  CREATE TABLE "ImportedDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "storedFileName" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "importedAt" DATETIME NOT NULL
  );
  CREATE TABLE "MissingFact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    CONSTRAINT "MissingFact_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ImportedDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );
  CREATE TABLE "AssetLot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountName" TEXT NOT NULL,
    "acquiredOn" TEXT NOT NULL,
    "assetKind" TEXT NOT NULL,
    "assetKey" TEXT NOT NULL,
    "costBasisInCents" INTEGER NOT NULL,
    "displayName" TEXT NOT NULL,
    "holdingTerm" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "sourceDocumentId" TEXT,
    CONSTRAINT "AssetLot_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "ImportedDocument" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  );
`;

interface TestContext {
  cleanup(): Promise<void>;
  databaseUrl: string;
  rootDirectory: string;
}

async function createContext(prefix: string): Promise<TestContext> {
  const rootDirectory = await mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
  const databaseUrl = buildPrismaSqliteUrl(path.join(rootDirectory, "gateway.test.db"));

  return {
    async cleanup() {
      await rm(rootDirectory, { force: true, recursive: true });
    },
    databaseUrl,
    rootDirectory
  };
}

describe("applyPendingMigrations", () => {
  const contexts: TestContext[] = [];

  afterEach(async () => {
    await Promise.all(contexts.splice(0, contexts.length).map(async (context) => context.cleanup()));
  });

  it("records the init migration when the schema already exists", async () => {
    const context = await createContext("gateway-migrations");
    contexts.push(context);

    const databaseFilePath = resolveDatabaseFilePath(context.databaseUrl);
    await mkdir(path.dirname(databaseFilePath), { recursive: true });

    const database = new Database(databaseFilePath);
    try {
      database.exec(INITIAL_SCHEMA_SQL);
    } finally {
      database.close();
    }

    await expect(applyPendingMigrations(context.databaseUrl)).resolves.toBeGreaterThanOrEqual(1);
    await expect(applyPendingMigrations(context.databaseUrl)).resolves.toBe(0);
  });
});
