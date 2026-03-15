export type ExistenceCheckOutcome =
  | { action: "create"; reason: string; worktreePath: string }
  | { action: "force-recreate"; reason: string; worktreePath: string }
  | { action: "skip"; reason: string; worktreePath: string };

export interface ExistenceCheckDeps {
  directoryExists: (path: string) => boolean;
  force: boolean;
  runGit: (args: string[], cwd: string) => string;
}

export function branchExists(branchName: string, cwd: string, runGit: (args: string[], cwd: string) => string): boolean {
  const output = runGit(["branch", "--list", branchName], cwd).trim();
  return output.length > 0;
}

export function checkWorktreeExistence(
  worktreePath: string,
  branchName: string,
  deps: ExistenceCheckDeps,
  repoRoot: string
): ExistenceCheckOutcome {
  const dirExists = deps.directoryExists(worktreePath);

  if (!dirExists) {
    return { action: "create", reason: "worktree directory does not exist", worktreePath };
  }

  const hasBranch = branchExists(branchName, repoRoot, deps.runGit);

  if (hasBranch && !deps.force) {
    return {
      action: "skip",
      reason: `worktree already exists on branch ${branchName}`,
      worktreePath
    };
  }

  if (hasBranch) {
    return {
      action: "force-recreate",
      reason: "--force specified",
      worktreePath
    };
  }

  // dir exists but branch does not — inconsistent state
  return {
    action: "force-recreate",
    reason: "directory exists but branch is missing — inconsistent state",
    worktreePath
  };
}
