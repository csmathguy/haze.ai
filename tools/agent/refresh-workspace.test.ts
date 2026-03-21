import { describe, expect, it } from "vitest";

import { parseCheckoutMode } from "./refresh-workspace.js";
import { hasPendingCheckoutChanges, selectAutoCheckoutRoot } from "./lib/refresh-workspace-selection.js";

type CheckoutMode = "auto" | "current-worktree" | "main";

const parseCheckoutModeTyped: (value: string) => CheckoutMode = parseCheckoutMode;

describe("hasPendingCheckoutChanges", () => {
  it("returns false when git status output is empty", () => {
    expect(hasPendingCheckoutChanges("")).toBe(false);
  });

  it("returns true when git status output contains staged or unstaged entries", () => {
    expect(hasPendingCheckoutChanges("M  tools/agent/refresh-workspace.ts\n")).toBe(true);
    expect(hasPendingCheckoutChanges("?? apps/gateway/api/src/db/migrations.test.ts\n")).toBe(true);
  });
});

describe("parseCheckoutMode", () => {
  it("accepts supported checkout modes", () => {
    expect(parseCheckoutModeTyped("auto")).toBe("auto");
    expect(parseCheckoutModeTyped("current-worktree")).toBe("current-worktree");
    expect(parseCheckoutModeTyped("main")).toBe("main");
  });

  it("rejects unsupported checkout modes", () => {
    expect(() => parseCheckoutModeTyped("feature")).toThrow(/Unsupported checkout/);
  });
});

describe("selectAutoCheckoutRoot", () => {
  const repositoryRoot = "C:/repo";

  it("keeps the repository root when it is already clean", () => {
    expect(
      selectAutoCheckoutRoot({
        branch: "main",
        repositoryRoot,
        rootStatusOutput: "",
        worktrees: []
      })
    ).toBe(repositoryRoot);
  });

  it("prefers a clean worktree already on the target branch", () => {
    expect(
      selectAutoCheckoutRoot({
        branch: "main",
        repositoryRoot,
        rootStatusOutput: " M tools/agent/refresh-workspace.ts\n",
        worktrees: [
          { branch: "feature/plan-234", statusOutput: "", worktreePath: "C:/repo/.worktrees/plan-234" },
          { branch: "main", statusOutput: "", worktreePath: "C:/repo/.worktrees/main" }
        ]
      })
    ).toBe("C:/repo/.worktrees/main");
  });

  it("falls back to any clean worktree when the target branch is unavailable", () => {
    expect(
      selectAutoCheckoutRoot({
        branch: "main",
        repositoryRoot,
        rootStatusOutput: " M tools/agent/refresh-workspace.ts\n",
        worktrees: [
          { branch: "feature/plan-234", statusOutput: "", worktreePath: "C:/repo/.worktrees/plan-234" },
          { branch: "feature/plan-235", statusOutput: " M readme.md\n", worktreePath: "C:/repo/.worktrees/plan-235" }
        ]
      })
    ).toBe("C:/repo/.worktrees/plan-234");
  });

  it("falls back to the repository root when no clean worktree is available", () => {
    expect(
      selectAutoCheckoutRoot({
        branch: "main",
        repositoryRoot,
        rootStatusOutput: " M tools/agent/refresh-workspace.ts\n",
        worktrees: [
          { branch: "main", statusOutput: " M readme.md\n", worktreePath: "C:/repo/.worktrees/main" }
        ]
      })
    ).toBe(repositoryRoot);
  });
});
