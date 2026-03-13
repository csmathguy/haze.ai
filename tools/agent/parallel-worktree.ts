import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
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

  if (!plan.dryRun) {
    execFileSync("git", ["worktree", "add", plan.worktreePath, "-b", plan.branchName, plan.baseRef], {
      cwd: repoRoot,
      stdio: "inherit"
    });

    await mkdir(path.dirname(plan.localBriefPath), { recursive: true });
    await writeFile(plan.localBriefPath, `${renderParallelTaskBrief(plan)}\n`, "utf8");
  }

  process.stdout.write(`${formatSummary(plan)}\n`);
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

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
