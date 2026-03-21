/**
 * agent:check-migrations
 *
 * Detects untracked migration directories whose SQL duplicates SQL already
 * tracked by git. Run this before `git merge origin/main` or before pushing
 * to catch "duplicate column name" failures before they hit the pre-push gate.
 *
 * Exit codes:
 *   0 — no conflicts found
 *   1 — one or more untracked migrations duplicate tracked migration SQL
 *
 * Usage:
 *   npm run db:check-migrations
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import * as path from "node:path";

const cwd = process.cwd();
const migrationsDir = path.join(cwd, "prisma", "migrations");

if (!existsSync(migrationsDir)) {
  process.stdout.write("[check-migrations] No prisma/migrations directory found. Nothing to check.\n");
  process.exit(0);
}

// ─── 1. Get list of files tracked by git ──────────────────────────────────

const trackedFiles = new Set<string>(
  execFileSync("git", ["ls-files", "prisma/migrations"], { cwd, encoding: "utf8" })
    .split("\n")
    .map((f) => f.trim())
    .filter((f) => f.length > 0)
);

// ─── 2. Find untracked migration directories ──────────────────────────────

const allDirs = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

const untrackedMigrationDirs = allDirs.filter((dir) => {
  const sqlPath = `prisma/migrations/${dir}/migration.sql`;
  return !trackedFiles.has(sqlPath);
});

if (untrackedMigrationDirs.length === 0) {
  process.stdout.write("[check-migrations] No untracked migration directories found. All clear.\n");
  process.exit(0);
}

// ─── 3. Collect SQL from tracked migrations ───────────────────────────────

const trackedSql = new Map<string, string>(); // filename → normalized sql
for (const tracked of trackedFiles) {
  if (tracked.endsWith("migration.sql")) {
    const fullPath = path.join(cwd, tracked);
    if (existsSync(fullPath)) {
      const sql = readFileSync(fullPath, "utf8").trim().replace(/\s+/g, " ").toLowerCase();
      trackedSql.set(tracked, sql);
    }
  }
}

// ─── 4. Check each untracked migration for duplicate SQL ─────────────────

function findOverlappingStatements(untrackedSql: string, trackedSql: string): string[] {
  const split = (sql: string): string[] =>
    sql.split(";").map((s) => s.trim()).filter((s) => s.length > 0);
  const untrackedStatements = split(untrackedSql);
  const trackedStatements = new Set(split(trackedSql));
  return untrackedStatements.filter((s) => trackedStatements.has(s));
}

function reportConflict(dir: string, trackedFile: string, detail: string): void {
  process.stderr.write(
    `[check-migrations] CONFLICT: prisma/migrations/${dir}/migration.sql\n` +
    `  ${detail} ${trackedFile}\n` +
    `  Delete the untracked directory before merging main:\n` +
    `    rm -rf prisma/migrations/${dir}\n`
  );
}

let conflicts = 0;

for (const dir of untrackedMigrationDirs) {
  const sqlPath = path.join(migrationsDir, dir, "migration.sql");
  if (!existsSync(sqlPath)) continue;

  const untrackedNormalized = readFileSync(sqlPath, "utf8").trim().replace(/\s+/g, " ").toLowerCase();
  let found = false;

  for (const [trackedFile, trackedNormalized] of trackedSql) {
    if (untrackedNormalized === trackedNormalized) {
      reportConflict(dir, trackedFile, "duplicates tracked migration:");
      conflicts++;
      found = true;
      break;
    }

    const overlapping = findOverlappingStatements(untrackedNormalized, trackedNormalized);
    if (overlapping.length > 0) {
      reportConflict(dir, trackedFile, `contains ${String(overlapping.length)} overlapping statement(s) with:`);
      conflicts++;
      found = true;
      break;
    }
  }

  if (!found) {
    process.stdout.write(`[check-migrations] OK: prisma/migrations/${dir} (no conflicts)\n`);
  }
}

if (conflicts === 0) {
  process.stdout.write(
    `[check-migrations] ${String(untrackedMigrationDirs.length)} untracked migration(s) checked — no SQL conflicts.\n`
  );
  process.exit(0);
} else {
  process.stderr.write(
    `[check-migrations] ${String(conflicts)} conflict(s) found. Fix before merging or pushing.\n`
  );
  process.exit(1);
}
