import { execFileSync } from "node:child_process";
import { existsSync, symlinkSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";

import {
  createParallelTaskPlan,
  parseParallelTaskArgs,
  renderParallelTaskBrief
} from "./lib/parallel-worktree.js";

async function main(): Promise<void> {
  const args = parseParallelTaskArgs(process.argv.slice(2));
  const repoRoot = resolveRepoRoot();
  const plan = createParallelTaskPlan(args, repoRoot);

  if (existsSync(plan.worktreePath)) {
    throw new Error(`Worktree already exists at ${plan.worktreePath}`);
  }

  const freshnessWarnings = checkSharedPackageFreshness(repoRoot, plan.baseRef);

  if (!plan.dryRun) {
    execFileSync("git", ["worktree", "add", plan.worktreePath, "-b", plan.branchName, plan.baseRef], {
      cwd: repoRoot,
      stdio: "inherit"
    });

    linkNodeModules(repoRoot, plan.worktreePath);

    await mkdir(path.dirname(plan.localBriefPath), { recursive: true });
    await writeFile(plan.localBriefPath, `${renderParallelTaskBrief(plan)}\n`, "utf8");
  }

  plan.warnings.push(...freshnessWarnings);
  process.stdout.write(`${formatSummary(plan)}\n`);
}

function linkNodeModules(repoRoot: string, worktreePath: string): void {
  const source = path.join(repoRoot, "node_modules");
  const target = path.join(worktreePath, "node_modules");

  if (!existsSync(source)) {
    process.stderr.write(`[worktree] node_modules not found at ${source} — skipping junction. Run npm install in the main checkout first.\n`);
    return;
  }

  if (existsSync(target)) {
    return;
  }

  // On Windows, 'junction' links directories without requiring admin rights.
  // On other platforms, the type argument is ignored and a regular symlink is created.
  symlinkSync(source, target, "junction");
  process.stdout.write(`[worktree] Linked node_modules: ${target} -> ${source}\n`);
}

function resolveRepoRoot(): string {
  const gitCommonDir = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
    cwd: process.cwd(),
    encoding: "utf8"
  }).trim();

  return path.dirname(gitCommonDir);
}

function formatSummary(plan: ReturnType<typeof createParallelTaskPlan>): string {
  const lines = [
    `Task: ${plan.taskId}`,
    `Branch: ${plan.branchName}`,
    `Worktree: ${plan.worktreePath}`,
    `Brief: ${plan.localBriefPath}`,
    `Slice Kind: ${plan.sliceKind}`,
    `Dry Run: ${plan.dryRun ? "yes" : "no"}`
  ];

  if (plan.warnings.length > 0) {
    lines.push("Warnings:");
    lines.push(...plan.warnings.map((warning) => `- ${warning}`));
  }

  lines.push("Next:");
  lines.push(`- cd ${plan.worktreePath}`);
  lines.push(`- node tools/runtime/run-npm.cjs run workflow:start implementation "${plan.summary}"`);
  lines.push("- Use $parallel-work-implementer inside that worktree.");

  return lines.join("\n");
}

function checkSharedPackageFreshness(repoRoot: string, baseRef: string): string[] {
  try {
    const baseCommit = execFileSync("git", ["rev-parse", baseRef], {
      cwd: repoRoot,
      encoding: "utf8"
    }).trim();

    const diverged = execFileSync(
      "git",
      ["log", `${baseCommit}..origin/main`, "--oneline", "--", "packages/"],
      {
        cwd: repoRoot,
        encoding: "utf8"
      }
    )
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (diverged.length > 0) {
      return [
        `origin/main has ${String(diverged.length)} commit(s) to packages/ not in ${baseRef}. Merge main before pushing to avoid schema version mismatches:`,
        ...diverged.map((c) => `  ${c}`),
        `  Run: git merge origin/main`
      ];
    }

    return [];
  } catch {
    // Non-fatal: skip freshness check if git commands fail (e.g. no origin)
    return [];
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
