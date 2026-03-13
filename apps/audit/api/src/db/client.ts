import { mkdir } from "node:fs/promises";
import * as path from "node:path";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import * as PrismaClientModule from "@prisma/client";

import { AUDIT_DATABASE_URL } from "../config.js";

const SQLITE_FILE_PREFIX = "file:";
const { PrismaClient } = PrismaClientModule;
type AuditPrismaClient = InstanceType<typeof PrismaClient>;
const clients = new Map<string, AuditPrismaClient>();

export async function getAuditPrismaClient(databaseUrl: string = AUDIT_DATABASE_URL) {
  const existingClient = clients.get(databaseUrl);

  if (existingClient !== undefined) {
    return existingClient;
  }

  await ensureAuditDatabaseParentDirectory(databaseUrl);

  const client = new PrismaClient({
    adapter: new PrismaBetterSqlite3(
      {
        timeout: 5_000,
        url: resolveAuditDatabaseFilePath(databaseUrl)
      },
      {
        timestampFormat: "iso8601"
      }
    )
  });

  await client.$connect();
  await client.$executeRawUnsafe("PRAGMA foreign_keys = ON");
  await client.$executeRawUnsafe("PRAGMA busy_timeout = 5000");
  await client.$executeRawUnsafe("PRAGMA journal_mode = WAL");
  await client.$executeRawUnsafe("PRAGMA synchronous = NORMAL");
  clients.set(databaseUrl, client);

  return client;
}

export async function disconnectAuditPrismaClient(databaseUrl: string = AUDIT_DATABASE_URL): Promise<void> {
  const client = clients.get(databaseUrl);

  if (client === undefined) {
    return;
  }

  clients.delete(databaseUrl);
  await client.$disconnect();
}

export function resolveAuditDatabaseFilePath(databaseUrl: string): string {
  if (!databaseUrl.startsWith(SQLITE_FILE_PREFIX)) {
    throw new Error(`Unsupported SQLite database URL: ${databaseUrl}`);
  }

  const rawPath = databaseUrl.slice(SQLITE_FILE_PREFIX.length);

  if (rawPath.length === 0) {
    throw new Error("SQLite database URL must include a file path.");
  }

  if (/^\/[A-Za-z]:\//u.test(rawPath)) {
    return rawPath.slice(1).replaceAll("/", path.sep);
  }

  if (path.isAbsolute(rawPath)) {
    return rawPath;
  }

  return path.resolve(rawPath);
}

async function ensureAuditDatabaseParentDirectory(databaseUrl: string): Promise<void> {
  const databaseFilePath = resolveAuditDatabaseFilePath(databaseUrl);
  await mkdir(path.dirname(databaseFilePath), { recursive: true });
}
