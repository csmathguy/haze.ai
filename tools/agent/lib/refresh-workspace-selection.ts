export interface WorktreeStatus {
  branch: string | null;
  statusOutput: string;
  worktreePath: string;
}

interface AutoCheckoutSelectionInput {
  branch: string;
  repositoryRoot: string;
  rootStatusOutput: string;
  worktrees: WorktreeStatus[];
}

export function hasPendingCheckoutChanges(statusOutput: string): boolean {
  return statusOutput.trim().length > 0;
}

export function selectAutoCheckoutRoot(input: AutoCheckoutSelectionInput): string {
  if (!hasPendingCheckoutChanges(input.rootStatusOutput)) {
    return input.repositoryRoot;
  }

  const cleanTargetBranchWorktree = input.worktrees.find(
    (worktree) =>
      worktree.worktreePath !== input.repositoryRoot &&
      worktree.branch === input.branch &&
      !hasPendingCheckoutChanges(worktree.statusOutput)
  );

  if (cleanTargetBranchWorktree !== undefined) {
    return cleanTargetBranchWorktree.worktreePath;
  }

  const cleanWorktree = input.worktrees.find(
    (worktree) => worktree.worktreePath !== input.repositoryRoot && !hasPendingCheckoutChanges(worktree.statusOutput)
  );

  if (cleanWorktree !== undefined) {
    return cleanWorktree.worktreePath;
  }

  return input.repositoryRoot;
}
