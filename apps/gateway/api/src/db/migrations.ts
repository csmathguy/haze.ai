import { createHash } from "node:crypto";
import { access, mkdir, readFile, readdir } from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";

import { resolveDatabaseFilePath } from "@taxes/db";

const MIGRATIONS_DIRECTORY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../../prisma/migrations");
const MIGRATIONS_TABLE_NAME = "_taxes_migrations";

interface MigrationEntry {
  checksum: string;
  name: string;
  sql: string;
}

export async function applyPendingMigrations(databaseUrl: string): Promise<number> {
  const databaseFilePath = resolveDatabaseFilePath(databaseUrl);
  const migrations = await readMigrationEntries();

  if (databaseFilePath !== ":memory:") {
    await mkdir(path.dirname(databaseFilePath), { recursive: true });
  }

  const database = new Database(databaseFilePath);

  try {
    configureDatabase(database, databaseFilePath);
    ensureMigrationsTable(database);

    let appliedCount = 0;
    const appliedMigrations = readAppliedMigrations(database);

    for (const migration of migrations) {
      if (appliedMigrations.has(migration.name)) {
        continue;
      }

      applyMigration(database, migration);
      appliedCount += 1;
    }

    return appliedCount;
  } finally {
    database.close();
  }
}

function applyMigration(database: Database.Database, migration: MigrationEntry): void {
  const insertMigration = database.prepare(`
    INSERT INTO "_taxes_migrations" ("name", "checksum", "appliedAt")
    VALUES (@name, @checksum, @appliedAt)
  `);

  database.exec("BEGIN");

  try {
    database.exec(migration.sql);
    insertMigration.run({
      appliedAt: new Date().toISOString(),
      checksum: migration.checksum,
      name: migration.name
    });
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");

    if (canTreatMigrationAsAlreadyApplied(database, migration, error)) {
      insertMigration.run({
        appliedAt: new Date().toISOString(),
        checksum: migration.checksum,
        name: migration.name
      });
      return;
    }

    throw error;
  }
}

function configureDatabase(database: Database.Database, databaseFilePath: string): void {
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");

  if (databaseFilePath !== ":memory:") {
    database.pragma("journal_mode = WAL");
    database.pragma("synchronous = NORMAL");
  }
}

function ensureMigrationsTable(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS "_taxes_migrations" (
      "name" TEXT NOT NULL PRIMARY KEY,
      "checksum" TEXT NOT NULL,
      "appliedAt" TEXT NOT NULL
    )
  `);
}

function readAppliedMigrations(database: Database.Database): Set<string> {
  const statement = database.prepare(`SELECT "name" FROM "${MIGRATIONS_TABLE_NAME}" ORDER BY "name" ASC`);
  const rows = statement.all() as { name: string }[];

  return new Set(rows.map((row) => row.name));
}

function canTreatMigrationAsAlreadyApplied(
  database: Database.Database,
  migration: MigrationEntry,
  error: unknown
): boolean {
  if (!isAlreadyExistsError(error)) {
    return false;
  }

  const createdObjects = getCreatedObjects(migration.sql);

  return createdObjects.length > 0 && createdObjects.every((object) => objectExists(database, object));
}

function isAlreadyExistsError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("already exists");
}

function objectExists(
  database: Database.Database,
  object: {
    name: string;
    type: "index" | "table";
  }
): boolean {
  const statement = database.prepare(`
    SELECT 1
    FROM "sqlite_master"
    WHERE "type" = 'table'
      AND "name" = @tableName
    LIMIT 1
  `);
  const row = statement.get({ tableName: object.name }) as { 1: number } | undefined;

  if (row !== undefined) {
    return object.type === "table";
  }

  if (object.type !== "index") {
    return false;
  }

  const indexStatement = database.prepare(`
    SELECT 1
    FROM "sqlite_master"
    WHERE "type" = 'index'
      AND "name" = @indexName
    LIMIT 1
  `);
  const indexRow = indexStatement.get({ indexName: object.name }) as { 1: number } | undefined;

  return indexRow !== undefined;
}

function getCreatedObjects(sql: string): { name: string; type: "index" | "table" }[] {
  const objects: { name: string; type: "index" | "table" }[] = [];
  const createTablePattern = /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?"([^"]+)"/gi;
  const createIndexPattern = /CREATE (?:UNIQUE\s+)?INDEX\s+"([^"]+)"/gi;
  let match: RegExpExecArray | null = createTablePattern.exec(sql);

  while (match !== null) {
    const tableName = match[1];
    if (tableName !== undefined && tableName.length > 0) {
      objects.push({ name: tableName, type: "table" });
    }
    match = createTablePattern.exec(sql);
  }

  match = createIndexPattern.exec(sql);
  while (match !== null) {
    const indexName = match[1];
    if (indexName !== undefined && indexName.length > 0) {
      objects.push({ name: indexName, type: "index" });
    }
    match = createIndexPattern.exec(sql);
  }

  return objects;
}

async function readMigrationEntries(): Promise<MigrationEntry[]> {
  const entries = await readdir(MIGRATIONS_DIRECTORY, { withFileTypes: true });
  const migrationDirectories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
  const migrations: MigrationEntry[] = [];

  for (const directoryName of migrationDirectories) {
    const migrationFilePath = path.join(MIGRATIONS_DIRECTORY, directoryName, "migration.sql");

    try {
      await access(migrationFilePath);
    } catch {
      continue;
    }

    const sql = await readFile(migrationFilePath, "utf8");

    migrations.push({
      checksum: createHash("sha256").update(sql).digest("hex"),
      name: directoryName,
      sql
    });
  }

  return migrations;
}
