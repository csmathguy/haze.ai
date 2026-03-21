/**
 * agent:repo-health
 *
 * Fast environment health check. Run at the start of every agent session to
 * surface common failure conditions before they cause expensive push cycles,
 * merge conflicts, or wasted diagnosis time.
 *
 * Checks:
 *   1. Main checkout is clean (no uncommitted changes)
 *   2. Worktree node_modules junctions are healthy
 *   3. No untracked migration directories duplicate tracked migration SQL
 *   4. Current branch packages/ is not behind origin/main
 *
 * Exit codes:
 *   0 — all clear (green) or warnings only (yellow)
 *   1 — one or more critical issues found (red)
 *
 * Usage:
 *   npm run repo:health
 */

import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import * as path from "node:path";

import { readAgentSession } from "./lib/session.js";

const cwd = process.cwd();

// ─── Types ────────────────────────────────────────────────────────────────

type Severity = "ok" | "warn" | "critical";

interface Issue {
  severity: Severity;
  message: string;
  fix?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function git(args: string[], repoPath = cwd): string {
  try {
    return execFileSync("git", args, { cwd: repoPath, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function icon(severity: Severity): string {
  if (severity === "ok") return "✓";
  if (severity === "warn") return "⚠";
  return "✗";
}

// ─── 1. Parse worktree list ───────────────────────────────────────────────

interface Worktree {
  path: string;
  isMain: boolean;
}

function listWorktrees(): Worktree[] {
  const raw = git(["worktree", "list"]);
  return raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line, index) => ({
      path: line.split(/\s+/)[0] ?? "",
      isMain: index === 0
    }));
}

// ─── 2. Main checkout clean ───────────────────────────────────────────────

function checkMainClean(mainPath: string): Issue {
  const status = git(["status", "--short"], mainPath);
  if (status.length === 0) {
    return { severity: "ok", message: "Main checkout is clean" };
  }

  const lines = status.split("\n").filter((l) => l.trim().length > 0);
  const tracked = lines.filter((l) => !l.startsWith("??")).length;
  const untracked = lines.filter((l) => l.startsWith("??")).length;

  const parts: string[] = [];
  if (tracked > 0) parts.push(`${String(tracked)} uncommitted change(s)`);
  if (untracked > 0) parts.push(`${String(untracked)} untracked file(s)`);

  return {
    severity: tracked > 0 ? "critical" : "warn",
    message: `Main checkout has ${parts.join(", ")}`,
    fix: "Move in-progress changes to a worktree — main checkout should stay clean"
  };
}

// ─── 3. Junction health ────────────────────────────────────────────────────

function checkJunction(worktree: Worktree): Issue {
  const nodeModules = path.join(worktree.path, "node_modules");

  if (!existsSync(nodeModules)) {
    return {
      severity: "critical",
      message: `${worktree.path}: node_modules missing`,
      fix: `Run: npm run worktree:ensure-junction  (from within ${worktree.path})`
    };
  }

  const stat = lstatSync(nodeModules);
  if (!stat.isSymbolicLink()) {
    const entries = readdirSync(nodeModules);
    const isEmpty = entries.length === 0 || (entries.length === 1 && entries[0] === ".vite");
    if (isEmpty) {
      return {
        severity: "critical",
        message: `${worktree.path}: node_modules is an empty directory (junction missing)`,
        fix: `Run: npm run worktree:ensure-junction  (from within ${worktree.path})`
      };
    }
    return { severity: "warn", message: `${worktree.path}: node_modules is a real directory (not a junction)` };
  }

  return { severity: "ok", message: `${worktree.path}: junction healthy` };
}

// ─── 4. Migration conflicts ────────────────────────────────────────────────

function normalizeSql(sql: string): string {
  return sql.trim().replace(/\s+/g, " ").toLowerCase();
}

function getTrackedMigrationSql(repoPath: string): Map<string, string> {
  const tracked = git(["ls-files", "prisma/migrations"], repoPath);
  const result = new Map<string, string>();

  for (const file of tracked.split("\n").filter((f) => f.endsWith("migration.sql"))) {
    const fullPath = path.join(repoPath, file);
    if (existsSync(fullPath)) {
      result.set(file, normalizeSql(readFileSync(fullPath, "utf8")));
    }
  }
  return result;
}

function checkMigrationConflicts(repoPath: string): Issue[] {
  const migrationsDir = path.join(repoPath, "prisma", "migrations");
  if (!existsSync(migrationsDir)) return [];

  const trackedSql = getTrackedMigrationSql(repoPath);
  const trackedFiles = new Set(git(["ls-files", "prisma/migrations"], repoPath).split("\n"));

  const untrackedDirs = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((dir) => !trackedFiles.has(`prisma/migrations/${dir}/migration.sql`));

  return untrackedDirs.flatMap((dir) => {
    const sqlPath = path.join(migrationsDir, dir, "migration.sql");
    if (!existsSync(sqlPath)) return [];

    const untrackedNorm = normalizeSql(readFileSync(sqlPath, "utf8"));
    for (const [trackedFile, trackedNorm] of trackedSql) {
      if (untrackedNorm === trackedNorm || hasOverlappingStatements(untrackedNorm, trackedNorm)) {
        return [{
          severity: "critical" as Severity,
          message: `Untracked migration prisma/migrations/${dir} duplicates ${trackedFile}`,
          fix: `Run: rm -rf prisma/migrations/${dir}`
        }];
      }
    }
    return [];
  });
}

function hasOverlappingStatements(a: string, b: string): boolean {
  const split = (sql: string): string[] => sql.split(";").map((s) => s.trim()).filter((s) => s.length > 0);
  const bSet = new Set(split(b));
  return split(a).some((s) => bSet.has(s));
}

// ─── 5. Packages in sync ──────────────────────────────────────────────────

function checkPackagesInSync(repoPath: string): Issue {
  const behind = git(["log", "HEAD..origin/main", "--oneline", "--", "packages/"], repoPath);
  if (behind.length === 0) {
    return { severity: "ok", message: "packages/ is in sync with origin/main" };
  }

  const count = behind.split("\n").filter((l) => l.trim().length > 0).length;
  return {
    severity: "warn",
    message: `packages/ is ${String(count)} commit(s) behind origin/main`,
    fix: "Run: git merge origin/main && npm run prisma:generate"
  };
}

// ─── 6. Stale agent session ────────────────────────────────────────────────

const STALE_SESSION_HOURS = 4;

async function checkStaleSession(): Promise<Issue> {
  const session = await readAgentSession();

  if (session === undefined) {
    return { severity: "ok", message: "No active agent session" };
  }

  const ageMs = Date.now() - Date.parse(session.startedAt);
  const ageHours = ageMs / (1000 * 60 * 60);

  if (ageHours >= STALE_SESSION_HOURS) {
    const ageLabel = ageHours >= 24
      ? `${(ageHours / 24).toFixed(1)}d`
      : `${ageHours.toFixed(1)}h`;
    const idLabel = session.workItemId !== undefined ? ` (${session.workItemId})` : "";
    return {
      severity: "warn",
      message: `Agent session '${session.workflowName}'${idLabel} has been open for ${ageLabel} with no recent activity`,
      fix: `Close it with: npm run workflow:end ${session.workflowName} success|failed`
    };
  }

  const ageMin = Math.round(ageMs / 60000);
  const idLabel = session.workItemId !== undefined ? ` (${session.workItemId})` : "";
  return { severity: "ok", message: `Active session: '${session.workflowName}'${idLabel} (${String(ageMin)}m ago)` };
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function collectIssues(): Promise<Issue[]> {
  const worktrees = listWorktrees();
  const mainWorktree = worktrees.find((w) => w.isMain);
  const mainPath = mainWorktree?.path ?? cwd;
  const nonMainWorktrees = worktrees.filter((w) => !w.isMain);

  const issues: Issue[] = [
    checkMainClean(mainPath),
    ...nonMainWorktrees.map(checkJunction),
    ...(nonMainWorktrees.length === 0 ? [{ severity: "ok" as Severity, message: "No active worktrees" }] : []),
    ...checkMigrationConflicts(cwd),
    checkPackagesInSync(cwd),
    await checkStaleSession()
  ];

  return issues;
}

function printReport(issues: Issue[]): void {
  process.stdout.write("\n[repo:health]\n\n");

  for (const issue of issues) {
    process.stdout.write(`  ${icon(issue.severity)} ${issue.message}\n`);
    if (issue.fix !== undefined && issue.severity !== "ok") {
      process.stdout.write(`    → ${issue.fix}\n`);
    }
  }

  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const warnCount = issues.filter((i) => i.severity === "warn").length;

  process.stdout.write("\n");

  if (criticalCount === 0 && warnCount === 0) {
    process.stdout.write("  All clear. Environment is healthy.\n\n");
    process.exit(0);
  }

  if (criticalCount === 0) {
    process.stdout.write(`  ${String(warnCount)} warning(s). Review before pushing.\n\n`);
    process.exit(0);
  }

  process.stderr.write(`  ${String(criticalCount)} critical issue(s) found. Fix before proceeding.\n\n`);
  process.exit(1);
}

void collectIssues().then(printReport);
