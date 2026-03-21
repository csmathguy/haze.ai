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

interface MigrationObject {
  column?: string;
  name: string;
  table?: string;
  type: "column" | "index" | "table";
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
    executeMigrationStatements(database, migration.sql);
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

function executeMigrationStatements(database: Database.Database, sql: string): void {
  for (const statement of splitSqlStatements(sql)) {
    if (statement.length === 0) {
      continue;
    }

    try {
      database.exec(statement);
    } catch (error) {
      if (!canSkipStatement(error, statement)) {
        throw error;
      }
    }
  }
}

function canSkipStatement(error: unknown, statement: string): boolean {
  if (!isAlreadyExistsError(error)) {
    return false;
  }

  const normalizedStatement = stripLeadingSqlComments(statement);

  return (
    normalizedStatement.startsWith("CREATE TABLE") ||
    /^CREATE\s+(?:UNIQUE\s+)?INDEX\b/i.test(normalizedStatement) ||
    normalizedStatement.startsWith("ALTER TABLE")
  );
}

function isAlreadyExistsError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("already exists");
}

function objectExists(
  database: Database.Database,
  object: MigrationObject
): boolean {
  if (object.type === "column") {
    return columnExists(database, object.table ?? object.name, object.column ?? object.name);
  }

  const statement = database.prepare(`
    SELECT 1
    FROM "sqlite_master"
    WHERE "type" = @objectType
      AND "name" = @tableName
    LIMIT 1
  `);
  const row = statement.get({ objectType: object.type, tableName: object.name }) as { 1: number } | undefined;

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

function columnExists(database: Database.Database, tableName: string, columnName: string): boolean {
  const columns = database.prepare(`PRAGMA table_info("${tableName}")`).all() as { name: string }[];

  return columns.some((column) => column.name === columnName);
}

function getCreatedObjects(sql: string): MigrationObject[] {
  return [
    ...collectCreatedTables(sql),
    ...collectCreatedIndexes(sql),
    ...collectAddedColumns(sql)
  ];
}

function collectCreatedTables(sql: string): MigrationObject[] {
  return collectMatches(sql, /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?"([^"]+)"/gi, (match) => {
    const tableName = match[1];

    return tableName !== undefined && tableName.length > 0 && !tableName.startsWith("new_")
      ? [{ name: tableName, type: "table" }]
      : [];
  });
}

function collectCreatedIndexes(sql: string): MigrationObject[] {
  return collectMatches(sql, /CREATE (?:UNIQUE\s+)?INDEX\s+"([^"]+)"/gi, (match) => {
    const indexName = match[1];

    return indexName !== undefined && indexName.length > 0 ? [{ name: indexName, type: "index" }] : [];
  });
}

function collectAddedColumns(sql: string): MigrationObject[] {
  return collectMatches(sql, /ALTER TABLE\s+"([^"]+)"\s+ADD COLUMN\s+"([^"]+)"/gi, (match) => {
    const tableName = match[1];
    const columnName = match[2];

    return tableName !== undefined && columnName !== undefined && tableName.length > 0 && columnName.length > 0
      ? [
          {
            column: columnName,
            name: `${tableName}.${columnName}`,
            table: tableName,
            type: "column"
          }
        ]
      : [];
  });
}

function collectMatches(
  sql: string,
  pattern: RegExp,
  mapMatch: (match: RegExpExecArray) => MigrationObject[]
): MigrationObject[] {
  const objects: MigrationObject[] = [];
  let match: RegExpExecArray | null = pattern.exec(sql);

  while (match !== null) {
    objects.push(...mapMatch(match));
    match = pattern.exec(sql);
  }

  return objects;
}

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

function stripLeadingSqlComments(statement: string): string {
  return statement
    .replace(/^(?:--.*(?:\r?\n|$)\s*)+/g, "")
    .trimStart();
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
