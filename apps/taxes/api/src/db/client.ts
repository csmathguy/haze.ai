import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import * as path from "node:path";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import type { PrismaClient as PrismaClientType } from "@prisma/client";

type PrismaClientConstructor = new (...args: unknown[]) => PrismaClientType;

const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client") as { PrismaClient: PrismaClientConstructor };

const DEFAULT_DATABASE_URL = process.env.DATABASE_URL ?? "file:./data/sqlite/taxes.db";
const SQLITE_FILE_PREFIX = "file:";
const SQLITE_PRAGMA_COMMANDS = [
  "PRAGMA foreign_keys = ON",
  "PRAGMA busy_timeout = 5000",
  "PRAGMA journal_mode = WAL",
  "PRAGMA synchronous = NORMAL"
] as const;
const clients = new Map<string, PrismaClientType>();

export async function getPrismaClient(databaseUrl: string = DEFAULT_DATABASE_URL): Promise<PrismaClientType> {
  const existingClient = clients.get(databaseUrl);

  if (existingClient !== undefined) {
    return existingClient;
  }

  await ensureDatabaseParentDirectory(databaseUrl);

  const client = new PrismaClient({
    adapter: new PrismaBetterSqlite3(
      {
        timeout: 5_000,
        url: resolveDatabaseFilePath(databaseUrl)
      },
      {
        timestampFormat: "iso8601"
      }
    )
  });

  await client.$connect();
  await applySqlitePragmas(client, databaseUrl);
  clients.set(databaseUrl, client);

  return client;
}

export async function disconnectPrismaClient(databaseUrl: string = DEFAULT_DATABASE_URL): Promise<void> {
  const client = clients.get(databaseUrl);

  if (client === undefined) {
    return;
  }

  clients.delete(databaseUrl);
  await client.$disconnect();
}

export function buildPrismaSqliteUrl(databaseFilePath: string): string {
  const projectDirectory = path.resolve(".");
  const relativePath = path.relative(projectDirectory, databaseFilePath).replaceAll("\\", "/");
  const normalizedPath = relativePath.startsWith(".") ? relativePath : `./${relativePath}`;

  return `file:${normalizedPath}`;
}

export function resolveDatabaseFilePath(databaseUrl: string): string {
  if (databaseUrl === ":memory:") {
    return databaseUrl;
  }

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

async function applySqlitePragmas(client: PrismaClientType, databaseUrl: string): Promise<void> {
  const pragmas = databaseUrl === ":memory:" ? SQLITE_PRAGMA_COMMANDS.slice(0, 2) : SQLITE_PRAGMA_COMMANDS;

  for (const command of pragmas) {
    await client.$executeRawUnsafe(command);
  }
}

async function ensureDatabaseParentDirectory(databaseUrl: string): Promise<void> {
  const databaseFilePath = resolveDatabaseFilePath(databaseUrl);

  if (databaseFilePath === ":memory:") {
    return;
  }

  await mkdir(path.dirname(databaseFilePath), { recursive: true });
}
