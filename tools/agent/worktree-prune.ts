/**
 * agent:worktree:prune
 *
 * Removes worktrees whose branches have been fully merged into origin/main.
 * Also prunes orphan worktrees (registered but directory missing).
 *
 * Usage: npm run agent:worktree:prune
 */

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, rmdirSync, rmSync } from "node:fs";
import * as path from "node:path";

interface WorktreeEntry {
  worktreePath: string;
  branch: string | null;
  isMain: boolean;
}

function resolveRepoRoot(): string {
  const gitCommonDir = execFileSync(
    "git",
    ["rev-parse", "--path-format=absolute", "--git-common-dir"],
    { cwd: process.cwd(), encoding: "utf8" }
  ).trim();
  return path.dirname(gitCommonDir);
}

function listWorktrees(repoRoot: string): WorktreeEntry[] {
  const raw = execFileSync("git", ["worktree", "list", "--porcelain"], {
    cwd: repoRoot,
    encoding: "utf8"
  });

  const entries: WorktreeEntry[] = [];
  let current: Partial<WorktreeEntry> = {};

  for (const line of raw.split(/\r?\n/u)) {
    if (line.startsWith("worktree ")) {
      current = { worktreePath: line.slice("worktree ".length).trim() };
    } else if (line.startsWith("branch ")) {
      const ref = line.slice("branch ".length).trim();
      current.branch = ref.replace(/^refs\/heads\//u, "");
    } else if (line === "bare") {
      current.branch = null;
    } else if (line === "") {
      if (current.worktreePath) {
        entries.push({
          worktreePath: current.worktreePath,
          branch: current.branch ?? null,
          isMain: entries.length === 0
        });
      }
      current = {};
    }
  }

  if (current.worktreePath) {
    entries.push({
      worktreePath: current.worktreePath,
      branch: current.branch ?? null,
      isMain: entries.length === 0
    });
  }

  return entries;
}

function isMergedIntoMain(branch: string, repoRoot: string): boolean {
  try {
    const result = spawnSync(
      "git",
      ["merge-base", "--is-ancestor", `origin/${branch}`, "origin/main"],
      { cwd: repoRoot }
    );
    return result.status === 0;
  } catch {
    return false;
  }
}

function removeWorktree(worktreePath: string, repoRoot: string): void {
  // On Windows, git worktree remove cannot delete directory junction points
  // (node_modules). Unlink the junction first, then let git clean up the rest.
  const junctionPath = path.join(worktreePath, "node_modules");
  if (existsSync(junctionPath)) {
    try {
      rmdirSync(junctionPath); // removes junction without recursing into it
    } catch {
      // If rmdirSync fails (e.g. already a real directory), try unlinkSync approach
      try {
        rmSync(junctionPath, { recursive: false });
      } catch {
        // Non-fatal — git worktree remove --force will try anyway
      }
    }
  }

  try {
    execFileSync("git", ["worktree", "remove", worktreePath, "--force"], {
      cwd: repoRoot,
      stdio: "pipe"
    });
  } catch {
    // Fallback: manual rm then git worktree prune (handles "Directory not empty" cases)
    rmSync(worktreePath, { recursive: true, force: true });
    execFileSync("git", ["worktree", "prune"], { cwd: repoRoot, stdio: "pipe" });
  }
}

function deleteLocalBranch(branch: string, repoRoot: string): void {
  try {
    execFileSync("git", ["branch", "-d", branch], {
      cwd: repoRoot,
      stdio: "pipe"
    });
  } catch {
    // Branch may already be gone or have an open PR — non-fatal
  }
}

interface PruneResults {
  removed: number;
  skipped: number;
  errors: number;
  skippedNames: string[];
}

function processWorktree(wt: WorktreeEntry, repoRoot: string, results: PruneResults): void {
  if (!wt.branch) {
    results.skippedNames.push(`${wt.worktreePath} (detached HEAD)`);
    results.skipped++;
    return;
  }

  let merged: boolean;
  try {
    merged = isMergedIntoMain(wt.branch, repoRoot);
  } catch {
    process.stderr.write(`  Error checking merge status for ${wt.branch}\n`);
    results.errors++;
    return;
  }

  if (!merged) {
    results.skippedNames.push(wt.branch);
    results.skipped++;
    return;
  }

  process.stdout.write(`  Removing: ${wt.branch} (${wt.worktreePath})\n`);
  try {
    removeWorktree(wt.worktreePath, repoRoot);
    deleteLocalBranch(wt.branch, repoRoot);
    results.removed++;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`  Error removing ${wt.branch}: ${msg}\n`);
    results.errors++;
  }
}

function main(): void {
  const repoRoot = resolveRepoRoot();

  // Fetch to get latest merge state
  process.stdout.write("Fetching origin...\n");
  try {
    execFileSync("git", ["fetch", "origin", "--prune"], { cwd: repoRoot, stdio: "pipe" });
  } catch {
    process.stderr.write("Warning: git fetch failed — using cached remote state.\n");
  }

  // Prune orphan worktrees first (directory missing but still registered)
  execFileSync("git", ["worktree", "prune"], { cwd: repoRoot, stdio: "pipe" });

  const worktrees = listWorktrees(repoRoot);
  const results: PruneResults = { removed: 0, skipped: 0, errors: 0, skippedNames: [] };

  for (const wt of worktrees) {
    if (!wt.isMain) processWorktree(wt, repoRoot, results);
  }

  process.stdout.write("\n--- Worktree prune summary ---\n");
  process.stdout.write(`  Removed : ${String(results.removed)}\n`);
  process.stdout.write(`  Skipped : ${String(results.skipped)}`);
  if (results.skippedNames.length > 0) {
    process.stdout.write(` (${results.skippedNames.join(", ")})`);
  }
  process.stdout.write("\n");
  if (results.errors > 0) {
    process.stdout.write(`  Errors  : ${String(results.errors)}\n`);
  }
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
