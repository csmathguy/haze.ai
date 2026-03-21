/**
 * Worktree-aware pre-commit hook runner.
 *
 * When invoked inside a git worktree, standard `npm run quality:changed:staged`
 * fails because the worktree shares node_modules via a junction from the main
 * checkout. Vitest's module deduplication treats junction-resolved paths and
 * tsconfig-alias paths as different module instances, causing false cache misses
 * in tests that write and read files within a single test run.
 *
 * This script resolves the issue by:
 *   1. Detecting whether the current directory is a worktree (.git is a file).
 *   2. In a worktree: extracting the staged file list from the worktree's index,
 *      then running `quality:changed` from the WORKTREE CWD with `--pool forks`.
 *      Using `--pool forks` spawns each test file in a separate forked Node.js
 *      process, eliminating the shared module cache that causes deduplication
 *      issues when node_modules is a junction to the main checkout.
 *   3. In the main checkout: running `quality:changed:staged` as normal.
 */

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync, execFileSync } = require("node:child_process");

const cwd = process.cwd();
const gitEntry = path.join(cwd, ".git");
const isWorktree = fs.existsSync(gitEntry) && fs.statSync(gitEntry).isFile();

// Skip expensive lint/test run for pure merge commits — the pre-push gate catches real issues.
// During a merge commit, git sets MERGE_HEAD in the git directory.
if (isMergeCommit(cwd, gitEntry, isWorktree)) {
  process.stdout.write("[pre-commit] Merge commit detected — skipping quality check (pre-push gate will verify).\n");
  process.exit(0);
}

if (isWorktree) {
  const stagedFiles = getStagedFiles(cwd);

  if (stagedFiles.length === 0) {
    process.stdout.write("No staged files. Skipping quality check.\n");
    process.exit(0);
  }

  process.stdout.write("[pre-commit] Worktree detected. Running quality check from worktree with --pool forks\n");
  process.stdout.write(`[pre-commit] Staged files: ${stagedFiles.join(", ")}\n`);

  const result = runNpm(cwd, ["run", "quality:changed", "--", "--pool", "forks", ...stagedFiles]);
  process.exit(result.status ?? 1);
} else {
  const result = runNpm(cwd, ["run", "quality:changed:staged"]);
  process.exit(result.status ?? 1);
}

function isMergeCommit(cwd, gitEntry, isWorktree) {
  let gitDir;
  if (isWorktree) {
    // .git is a file with content "gitdir: <path>"
    const content = fs.readFileSync(gitEntry, "utf8").trim();
    const match = /^gitdir:\s*(.+)$/.exec(content);
    gitDir = match ? path.resolve(cwd, match[1]) : null;
  } else {
    gitDir = gitEntry;
  }
  return gitDir !== null && fs.existsSync(path.join(gitDir, "MERGE_HEAD"));
}

function getStagedFiles(repoPath) {
  const result = execFileSync("git", ["diff", "--name-only", "--staged"], {
    cwd: repoPath,
    encoding: "utf8"
  });

  return result
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function runNpm(runCwd, args) {
  const pinnedVersion = fs.readFileSync(path.join(runCwd, ".nvmrc"), "utf8").trim();
  const runtime = resolveRuntime(pinnedVersion);

  return spawnSync(runtime.nodeExecutable, [runtime.npmCli, ...args], {
    cwd: runCwd,
    env: process.env,
    stdio: "inherit",
    windowsHide: true
  });
}

function resolveRuntime(version) {
  const nvmHome = process.env.NVM_HOME;
  const appData = process.env.APPDATA;
  const nvmDirectory =
    typeof nvmHome === "string" && nvmHome.length > 0
      ? nvmHome
      : typeof appData === "string" && appData.length > 0
        ? path.join(appData, "nvm")
        : null;

  if (nvmDirectory !== null) {
    const nodeDirectory = path.join(nvmDirectory, `v${version}`);
    const nodeExecutable = path.join(nodeDirectory, "node.exe");
    const npmCli = path.join(nodeDirectory, "node_modules", "npm", "bin", "npm-cli.js");

    if (fs.existsSync(nodeExecutable) && fs.existsSync(npmCli)) {
      return { nodeExecutable, npmCli };
    }
  }

  if (typeof process.env.npm_execpath === "string" && process.env.npm_execpath.length > 0) {
    return {
      nodeExecutable: process.execPath,
      npmCli: process.env.npm_execpath
    };
  }

  throw new Error(
    `Pinned Node.js ${version} was not found. Install it under nvm or update .nvmrc to a locally available runtime.`
  );
}
