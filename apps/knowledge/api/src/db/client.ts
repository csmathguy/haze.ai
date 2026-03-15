import {
  buildPrismaSqliteUrl,
  disconnectPrismaClient as _disconnectPrismaClient,
  getPrismaClient as _getPrismaClient,
  resolveDatabaseFilePath
} from "@taxes/db";
export type { PrismaClient } from "@taxes/db";

export { buildPrismaSqliteUrl, resolveDatabaseFilePath };

import { KNOWLEDGE_DATABASE_URL } from "../config.js";

export async function getKnowledgePrismaClient(databaseUrl: string = KNOWLEDGE_DATABASE_URL) {
  return _getPrismaClient(databaseUrl);
}

export async function disconnectKnowledgePrismaClient(databaseUrl: string = KNOWLEDGE_DATABASE_URL): Promise<void> {
  return _disconnectPrismaClient(databaseUrl);
}

export function buildKnowledgeSqliteUrl(databaseFilePath: string): string {
  return buildPrismaSqliteUrl(databaseFilePath);
}
