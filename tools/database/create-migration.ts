import { execFile } from "node:child_process";
import { access, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { promisify } from "node:util";

import { DATABASE_URL } from "../../apps/taxes/api/src/config.js";
import { applyPendingMigrations } from "../../apps/taxes/api/src/db/migrations.js";

const execFileAsync = promisify(execFile);
const MIGRATIONS_DIRECTORY = path.resolve("prisma", "migrations");
const PRISMA_CLI_PATH = path.resolve("node_modules", "prisma", "build", "index.js");
const PRISMA_SCHEMA_PATH = path.resolve("prisma", "schema.prisma");

async function main(): Promise<void> {
  await pruneIncompleteMigrationDirectories();
  const migrationName = parseMigrationName(process.argv.slice(2));
  const sql = await createMigrationSql();

  if (sql.trim().length === 0) {
    process.stdout.write("No schema changes detected.\n");
    return;
  }

  const migrationDirectory = path.join(MIGRATIONS_DIRECTORY, `${createTimestampPrefix()}_${migrationName}`);

  await mkdir(migrationDirectory, { recursive: true });
  await writeFile(path.join(migrationDirectory, "migration.sql"), `${sql.trim()}\n`);

  process.stdout.write(`Created migration ${path.basename(migrationDirectory)}.\n`);
  await applyPendingMigrations(DATABASE_URL);
}

async function pruneIncompleteMigrationDirectories(): Promise<void> {
  const entries = await readdir(MIGRATIONS_DIRECTORY, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const migrationDirectory = path.join(MIGRATIONS_DIRECTORY, entry.name);
    const migrationFilePath = path.join(migrationDirectory, "migration.sql");

    try {
      await access(migrationFilePath);
    } catch {
      await rm(migrationDirectory, { force: true, recursive: true });
    }
  }
}

async function createMigrationSql(): Promise<string> {
  const result = await execFileAsync(
    process.execPath,
    [
      PRISMA_CLI_PATH,
      "migrate",
      "diff",
      "--from-migrations",
      MIGRATIONS_DIRECTORY,
      "--to-schema",
      PRISMA_SCHEMA_PATH,
      "--script"
    ],
    {
      cwd: path.resolve("."),
      env: {
        ...process.env,
        DATABASE_URL
      },
      maxBuffer: 10 * 1024 * 1024
    }
  );

  const normalizedSql = result.stdout.replace(/^Loaded Prisma config.*$/gmu, "").trim();

  return normalizedSql === "-- This is an empty migration." ? "" : normalizedSql;
}

function createTimestampPrefix(now: Date = new Date()): string {
  const parts = [
    now.getFullYear().toString().padStart(4, "0"),
    (now.getMonth() + 1).toString().padStart(2, "0"),
    now.getDate().toString().padStart(2, "0"),
    now.getHours().toString().padStart(2, "0"),
    now.getMinutes().toString().padStart(2, "0"),
    now.getSeconds().toString().padStart(2, "0")
  ];

  return parts.join("");
}

function parseMigrationName(args: string[]): string {
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== "--name") {
      continue;
    }

    const rawName = args[index + 1];

    if (rawName === undefined) {
      throw new Error("Missing value after --name.");
    }

    const normalizedName = rawName.trim().toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");

    if (normalizedName.length === 0) {
      throw new Error("Migration name must contain letters or numbers.");
    }

    return normalizedName;
  }

  throw new Error("Pass a migration name with --name.");
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
