/**
 * agent:worktree:ensure-junction
 *
 * Idempotent junction health-check for worktrees. Run this at the start of any
 * worktree session to guarantee that node_modules is properly linked and the
 * Prisma client is generated.
 *
 * What it does:
 *   1. Verifies the current directory is a worktree (not the main checkout).
 *   2. Checks whether node_modules is a junction/symlink pointing to the main checkout.
 *   3. If node_modules is missing or is a plain empty directory, removes it and
 *      re-creates the junction using Node's symlinkSync (works without admin on Windows).
 *   4. Verifies tsx is accessible through the junction.
 *   5. Runs prisma:generate so the Prisma client exists for type-checking and tests.
 *
 * Usage:
 *   npm run worktree:ensure-junction          (from within the worktree)
 *   node tools/runtime/run-npm.cjs run worktree:ensure-junction  (from main checkout)
 */

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import * as path from "node:path";

const cwd = process.cwd();

// ─── 1. Confirm we are inside a worktree ───────────────────────────────────

const gitEntry = path.join(cwd, ".git");
const isWorktree = existsSync(gitEntry) && lstatSync(gitEntry).isFile();

if (!isWorktree) {
  process.stderr.write(
    "[ensure-junction] Not a worktree (no .git file found). Run this from inside a worktree directory.\n"
  );
  process.exit(1);
}

// ─── 2. Locate main checkout via git common-dir ────────────────────────────

let repoRoot: string;
try {
  const commonDir = execFileSync(
    "git",
    ["rev-parse", "--path-format=absolute", "--git-common-dir"],
    { cwd, encoding: "utf8" }
  ).trim();
  repoRoot = path.dirname(commonDir);
} catch {
  process.stderr.write("[ensure-junction] Could not determine repo root via git.\n");
  process.exit(1);
}

const sourceModules = path.join(repoRoot, "node_modules");
const targetModules = path.join(cwd, "node_modules");

if (!existsSync(sourceModules)) {
  process.stderr.write(
    `[ensure-junction] Main checkout node_modules not found at ${sourceModules}.\n` +
    "Run 'npm install' in the main checkout first.\n"
  );
  process.exit(1);
}

// ─── 3. Check junction health ──────────────────────────────────────────────

let needsRepair = false;

if (!existsSync(targetModules)) {
  process.stdout.write("[ensure-junction] node_modules missing — will create junction.\n");
  needsRepair = true;
} else {
  const stat = lstatSync(targetModules);
  const isLink = stat.isSymbolicLink();

  if (!isLink) {
    // It's a real directory. Check if it's empty (placeholder) or populated.
    const entries = readdirSync(targetModules);
    if (entries.length === 0 || (entries.length === 1 && entries[0] === ".vite")) {
      process.stdout.write("[ensure-junction] node_modules is an empty directory — will replace with junction.\n");
      needsRepair = true;
    } else {
      process.stdout.write(
        "[ensure-junction] WARNING: node_modules is a real directory with content. " +
        "This may work but is not the expected junction setup.\n"
      );
    }
  } else {
    process.stdout.write(`[ensure-junction] Junction exists: ${targetModules}\n`);
  }
}

// ─── 4. Repair junction if needed ─────────────────────────────────────────

if (needsRepair) {
  // Remove existing directory/broken junction
  if (existsSync(targetModules)) {
    rmSync(targetModules, { recursive: true, force: true });
  }

  try {
    symlinkSync(sourceModules, targetModules, "junction");
    process.stdout.write(`[ensure-junction] Junction created: ${targetModules} -> ${sourceModules}\n`);
  } catch (err) {
    process.stderr.write(`[ensure-junction] Failed to create junction: ${String(err)}\n`);
    process.exit(1);
  }
}

// ─── 5. Verify tsx is accessible ───────────────────────────────────────────

const tsxBin = path.join(targetModules, ".bin", "tsx");
const tsxExists = existsSync(tsxBin);

if (!tsxExists) {
  process.stderr.write(
    `[ensure-junction] tsx not found at ${tsxBin} after junction setup.\n` +
    "The main checkout node_modules may need 'npm install'.\n"
  );
  process.exit(1);
}

process.stdout.write("[ensure-junction] tsx accessible — junction is healthy.\n");

// ─── 6. Run prisma:generate ────────────────────────────────────────────────

process.stdout.write("[ensure-junction] Running prisma:generate...\n");

const prismaResult = spawnSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "prisma:generate"],
  { cwd, stdio: "inherit" }
);

if (prismaResult.status !== 0) {
  process.stderr.write("[ensure-junction] prisma:generate failed.\n");
  process.exit(prismaResult.status ?? 1);
}

// ─── 7. Check for untracked migration conflicts ────────────────────────────

process.stdout.write("[ensure-junction] Checking for untracked migration conflicts...\n");

const migrationsResult = spawnSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "db:check-migrations"],
  { cwd, stdio: "inherit" }
);

if (migrationsResult.status !== 0) {
  process.stderr.write(
    "[ensure-junction] Migration conflict detected. Resolve before merging or pushing.\n"
  );
  // Non-fatal: warn but don't block worktree setup
}

process.stdout.write("[ensure-junction] Done. Worktree is ready.\n");
