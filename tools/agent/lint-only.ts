import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";

import { buildChangedFilePlan, type TypecheckScope } from "./lib/changed-files.js";
import { resolveNpmCommand } from "./lib/process.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const qualityCacheDir = path.join(repoRoot, "artifacts", "quality-cache");
const typecheckProjectByScope: Record<TypecheckScope, string> = {
  api: "apps/taxes/api/tsconfig.json",
  quality: "tsconfig.json",
  shared: "packages/shared/tsconfig.json",
  web: "apps/taxes/web/tsconfig.json"
};
const typeScriptCliPath = path.join(repoRoot, "node_modules", "typescript", "bin", "tsc");

async function main(): Promise<void> {
  const files = process.argv.slice(2);

  if (files.length === 0) {
    throw new Error("quality:lint-only requires at least one file path.");
  }

  const plan = buildChangedFilePlan(files);
  const requiresWork = plan.prismaCheck || plan.lintTargets.length > 0 || plan.typecheckScopes.length > 0;
  const npmCommand = resolveNpmCommand();

  if (!requiresWork) {
    process.stdout.write("No lint or typecheck validation required for the specified files.\n");
    return;
  }

  await mkdir(qualityCacheDir, { recursive: true });

  if (plan.prismaCheck && !runCommand(npmCommand.command, [...npmCommand.prefixArgs, "run", "prisma:check"])) {
    process.exitCode = 1;
    return;
  }

  if (!(await runEslint(plan.lintTargets))) {
    process.exitCode = 1;
    return;
  }

  for (const scope of plan.typecheckScopes) {
    if (!runTypecheck(scope)) {
      process.exitCode = 1;
      return;
    }
  }
}

function runCommand(command: string, args: string[]): boolean {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: process.env,
    shell: false,
    stdio: "inherit"
  });

  return (result.status ?? 1) === 0;
}

async function runEslint(files: string[]): Promise<boolean> {
  if (files.length === 0) {
    return true;
  }

  const eslint = new ESLint({
    cache: true,
    cacheLocation: path.join(qualityCacheDir, "eslint.cache"),
    cwd: repoRoot
  });
  const results = await eslint.lintFiles(files);
  const formatter = await eslint.loadFormatter("stylish");
  const output = await formatter.format(results);

  if (output.length > 0) {
    process.stdout.write(output);
  }

  return results.every((result) => result.errorCount === 0 && result.warningCount === 0);
}

function runTypecheck(scope: TypecheckScope): boolean {
  return runCommand(process.execPath, [
    typeScriptCliPath,
    "--noEmit",
    "--incremental",
    "--tsBuildInfoFile",
    path.join(qualityCacheDir, `${scope}.tsbuildinfo`),
    "-p",
    typecheckProjectByScope[scope]
  ]);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
