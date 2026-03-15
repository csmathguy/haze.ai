import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import * as path from "node:path";

const PRISMA_CLI_ENTRYPOINT = path.resolve("node_modules", "prisma", "build", "index.js");

// With Prisma 7 and a custom output field in the schema, the generated client is
// written to packages/db/src/generated/prisma (relative to the schema file).
// We always generate from the current worktree/checkout so the output lands in the
// correct packages/db directory — not into the shared node_modules junction.
// Previously this script detected worktrees and generated from the main checkout to
// avoid corrupting shared node_modules. That concern no longer applies because the
// output path is inside the source tree (packages/db/src/generated), not node_modules.
const generateCwd = process.cwd();
const GENERATED_CLIENT_DIRECTORY = path.resolve(generateCwd, "packages", "db", "src", "generated", "prisma");

async function main(): Promise<void> {
  await rm(GENERATED_CLIENT_DIRECTORY, { force: true, recursive: true });
  await runPrismaGenerate();
}

async function runPrismaGenerate(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [PRISMA_CLI_ENTRYPOINT, "generate", "--schema", "prisma/schema.prisma"], {
      cwd: generateCwd,
      env: process.env,
      stdio: "inherit"
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Prisma generate exited with code ${code?.toString() ?? "unknown"}.`));
    });
  });
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
