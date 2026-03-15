import { describe, expect, it, vi } from "vitest";

import { checkWorktreeExistence } from "./worktree-existence.js";

const WORKTREE_PATH = "/repo/.worktrees/plan-86";
const BRANCH_NAME = "feature/plan-86";
const REPO_ROOT = "/repo";

describe("checkWorktreeExistence", () => {
  it("returns create when directory does not exist", () => {
    const deps = {
      directoryExists: vi.fn().mockReturnValue(false),
      force: false,
      runGit: vi.fn()
    };

    const result = checkWorktreeExistence(WORKTREE_PATH, BRANCH_NAME, deps, REPO_ROOT);

    expect(result.action).toBe("create");
    expect(deps.runGit).not.toHaveBeenCalled();
  });

  it("returns skip when directory and branch exist and force is false", () => {
    const deps = {
      directoryExists: vi.fn().mockReturnValue(true),
      force: false,
      runGit: vi.fn().mockReturnValue("  feature/plan-86\n")
    };

    const result = checkWorktreeExistence(WORKTREE_PATH, BRANCH_NAME, deps, REPO_ROOT);

    expect(result.action).toBe("skip");
    expect(result.reason).toContain(BRANCH_NAME);
  });

  it("returns force-recreate when directory and branch exist and force is true", () => {
    const deps = {
      directoryExists: vi.fn().mockReturnValue(true),
      force: true,
      runGit: vi.fn().mockReturnValue("  feature/plan-86\n")
    };

    const result = checkWorktreeExistence(WORKTREE_PATH, BRANCH_NAME, deps, REPO_ROOT);

    expect(result.action).toBe("force-recreate");
    expect(result.reason).toContain("--force");
  });

  it("returns force-recreate when directory exists but branch is missing", () => {
    const deps = {
      directoryExists: vi.fn().mockReturnValue(true),
      force: false,
      runGit: vi.fn().mockReturnValue("")
    };

    const result = checkWorktreeExistence(WORKTREE_PATH, BRANCH_NAME, deps, REPO_ROOT);

    expect(result.action).toBe("force-recreate");
    expect(result.reason).toContain("inconsistent state");
  });

  it("passes correct git args when checking branch existence", () => {
    const deps = {
      directoryExists: vi.fn().mockReturnValue(true),
      force: false,
      runGit: vi.fn().mockReturnValue("")
    };

    checkWorktreeExistence(WORKTREE_PATH, BRANCH_NAME, deps, REPO_ROOT);

    expect(deps.runGit).toHaveBeenCalledWith(["branch", "--list", BRANCH_NAME], REPO_ROOT);
  });
});
