import {
  disconnectPrismaClient as _disconnectPrismaClient,
  getPrismaClient as _getPrismaClient,
  resolveDatabaseFilePath as _resolveDatabaseFilePath
} from "@taxes/db";
export type { PrismaClient } from "@taxes/db";

import { AUDIT_DATABASE_URL } from "../config.js";

export async function getAuditPrismaClient(databaseUrl: string = AUDIT_DATABASE_URL) {
  return _getPrismaClient(databaseUrl);
}

export async function disconnectAuditPrismaClient(databaseUrl: string = AUDIT_DATABASE_URL): Promise<void> {
  return _disconnectPrismaClient(databaseUrl);
}

export function resolveAuditDatabaseFilePath(databaseUrl: string): string {
  return _resolveDatabaseFilePath(databaseUrl);
}
