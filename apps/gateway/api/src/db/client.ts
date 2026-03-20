import {
  disconnectPrismaClient as _disconnectPrismaClient,
  getPrismaClient as _getPrismaClient,
  resolveDatabaseFilePath as _resolveDatabaseFilePath
} from "@taxes/db";

export type { PrismaClient } from "@taxes/db";

import { WORKFLOW_DATABASE_URL } from "../config.js";

export async function getWorkflowPrismaClient(databaseUrl: string = WORKFLOW_DATABASE_URL) {
  return _getPrismaClient(databaseUrl);
}

export async function disconnectWorkflowPrismaClient(databaseUrl: string = WORKFLOW_DATABASE_URL): Promise<void> {
  return _disconnectPrismaClient(databaseUrl);
}

export function resolveWorkflowDatabaseFilePath(databaseUrl: string): string {
  return _resolveDatabaseFilePath(databaseUrl);
}
