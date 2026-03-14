import { spawn } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { rm } from "node:fs/promises";
import * as path from "node:path";

const PRISMA_CLI_ENTRYPOINT = path.resolve("node_modules", "prisma", "build", "index.js");

/**
 * Resolve the working directory for prisma generate.
 *
 * When running inside a git worktree, node_modules is a junction pointing to the
 * main checkout's node_modules. If we generate the Prisma client from the worktree,
 * Prisma uses the worktree's schema but writes the output into the shared (junction)
 * node_modules. On the next run this can leave the shared client in an inconsistent
 * state relative to the main checkout's schema, causing transient TypeScript errors
 * (e.g. "has no exported member 'Prisma'") during the pre-push typecheck step.
 *
 * Generating from the main checkout CWD ensures the shared client always reflects
 * the main checkout's schema after the quality gate completes.
 *
 * Worktree detection reads the .git file directly (no child process) to avoid
 * dependency on a specific PATH-resolved git binary.
 */
function resolveGenerateCwd(): string {
  const gitEntry = path.resolve(".git");

  if (!existsSync(gitEntry) || !statSync(gitEntry).isFile()) {
    return process.cwd();
  }

  try {
    // Worktree .git file: "gitdir: <absolute-path-to-worktree-git-dir>"
    const gitFileContent = readFileSync(gitEntry, "utf8").trim();
    const prefix = "gitdir:";

    if (!gitFileContent.startsWith(prefix)) {
      return process.cwd();
    }

    const gitDirPath = gitFileContent.slice(prefix.length).trim();

    if (!gitDirPath) {
      return process.cwd();
    }

    const worktreeGitDir = path.resolve(gitDirPath);
    const commondirPath = path.join(worktreeGitDir, "commondir");

    if (!existsSync(commondirPath)) {
      return process.cwd();
    }

    // commondir holds a relative or absolute path to the main .git directory
    const commondir = readFileSync(commondirPath, "utf8").trim();
    const mainGitDir = path.isAbsolute(commondir) ? commondir : path.join(worktreeGitDir, commondir);

    return path.dirname(mainGitDir);
  } catch {
    return process.cwd();
  }
}

const generateCwd = resolveGenerateCwd();
const GENERATED_CLIENT_DIRECTORY = path.resolve(generateCwd, "node_modules", ".prisma", "client");
const GENERATED_CLIENT_LINK_DIRECTORY = path.resolve(generateCwd, "node_modules", "@prisma", "client", ".prisma");

async function main(): Promise<void> {
  if (generateCwd !== process.cwd()) {
    process.stdout.write(`[prisma:generate] Worktree detected. Generating from main checkout: ${generateCwd}\n`);
  }

  await rm(GENERATED_CLIENT_DIRECTORY, { force: true, recursive: true });
  await rm(GENERATED_CLIENT_LINK_DIRECTORY, { force: true, recursive: true });
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
