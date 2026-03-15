import {
  buildPrismaSqliteUrl,
  disconnectPrismaClient as _disconnectPrismaClient,
  getPrismaClient as _getPrismaClient,
  resolveDatabaseFilePath
} from "@taxes/db";
export type { PrismaClient } from "@taxes/db";

export { buildPrismaSqliteUrl, resolveDatabaseFilePath };

import { PLANNING_DATABASE_URL } from "../config.js";

export async function getPrismaClient(databaseUrl: string = PLANNING_DATABASE_URL) {
  return _getPrismaClient(databaseUrl);
}

export async function disconnectPrismaClient(databaseUrl: string = PLANNING_DATABASE_URL): Promise<void> {
  return _disconnectPrismaClient(databaseUrl);
}
