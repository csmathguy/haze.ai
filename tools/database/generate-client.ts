import { rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import * as path from "node:path";

const GENERATED_CLIENT_DIRECTORY = path.resolve("node_modules", ".prisma", "client");
const GENERATED_CLIENT_LINK_DIRECTORY = path.resolve("node_modules", "@prisma", "client", ".prisma");
const PRISMA_CLI_ENTRYPOINT = path.resolve("node_modules", "prisma", "build", "index.js");

async function main(): Promise<void> {
  await rm(GENERATED_CLIENT_DIRECTORY, { force: true, recursive: true });
  await rm(GENERATED_CLIENT_LINK_DIRECTORY, { force: true, recursive: true });
  await runPrismaGenerate();
}

async function runPrismaGenerate(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [PRISMA_CLI_ENTRYPOINT, "generate", "--schema", "prisma/schema.prisma"], {
      cwd: process.cwd(),
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
