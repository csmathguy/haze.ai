import {
  buildPrismaSqliteUrl,
  disconnectPrismaClient as _disconnectPrismaClient,
  getPrismaClient as _getPrismaClient,
  resolveDatabaseFilePath
} from "@taxes/db";

export { buildPrismaSqliteUrl, resolveDatabaseFilePath };

const DEFAULT_DATABASE_URL = process.env.DATABASE_URL ?? "file:./data/sqlite/taxes.db";

export async function getPrismaClient(databaseUrl: string = DEFAULT_DATABASE_URL): Promise<Awaited<ReturnType<typeof _getPrismaClient>>> {
  return _getPrismaClient(databaseUrl);
}

export async function disconnectPrismaClient(databaseUrl: string = DEFAULT_DATABASE_URL): Promise<void> {
  return _disconnectPrismaClient(databaseUrl);
}
