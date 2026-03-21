export interface GitWorktree {
  branch: string | null;
  worktreePath: string;
}

export function parseGitWorktreePorcelain(output: string): GitWorktree[] {
  const worktrees: GitWorktree[] = [];
  let current: Partial<GitWorktree> = {};

  for (const line of output.split(/\r?\n/u)) {
    if (line.startsWith("worktree ")) {
      if (current.worktreePath !== undefined) {
        worktrees.push({ branch: current.branch ?? null, worktreePath: current.worktreePath });
      }

      current = { branch: null, worktreePath: line.slice("worktree ".length).trim() };
      continue;
    }

    if (line.startsWith("branch ")) {
      const branchRef = line.slice("branch ".length).trim();
      current.branch = branchRef.startsWith("refs/heads/") ? branchRef.slice("refs/heads/".length) : branchRef;
    }
  }

  if (current.worktreePath !== undefined) {
    worktrees.push({ branch: current.branch ?? null, worktreePath: current.worktreePath });
  }

  return worktrees;
}
