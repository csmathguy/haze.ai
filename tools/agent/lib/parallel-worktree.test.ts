import { describe, expect, it } from "vitest";

import {
  createParallelTaskPlan,
  parseParallelTaskArgs,
  renderParallelTaskBrief
} from "./parallel-worktree.js";
import { mergeMainIntoWorktree } from "./worktree-merge-main.js";

describe("parseParallelTaskArgs", () => {
  it("accepts required fields and repeated scope flags", () => {
    const parsed = parseParallelTaskArgs([
      "--task",
      "api-contract",
      "--summary",
      "Define extraction contract",
      "--scope",
      "packages/shared/src/extraction.ts",
      "--scope",
      "apps/api/src/services"
    ]);

    expect(parsed.taskId).toBe("api-contract");
    expect(parsed.summary).toBe("Define extraction contract");
    expect(parsed.scopes).toEqual(["packages/shared/src/extraction.ts", "apps/api/src/services"]);
    expect(parsed.baseRef).toBe("HEAD");
    expect(parsed.dryRun).toBe(false);
    expect(parsed.mergeMain).toBe(false);
  });

  it("accepts the merge-main flag", () => {
    const parsed = parseParallelTaskArgs([
      "--task",
      "api-contract",
      "--summary",
      "Define extraction contract",
      "--scope",
      "tools/agent/parallel-worktree.ts",
      "--merge-main"
    ]);

    expect(parsed.mergeMain).toBe(true);
  });

  it("rejects missing required arguments", () => {
    expect(() => parseParallelTaskArgs(["--task", "missing-summary"])).toThrow("Missing required argument --summary");
  });
});

describe("mergeMainIntoWorktree", () => {
  it("returns a merge confirmation message when fetch and merge succeed", () => {
    const calls: string[] = [];
    const outcome = mergeMainIntoWorktree("C:/repo/.worktrees/plan-73", (args, cwd) => {
      calls.push(`${cwd}:${args.join(" ")}`);

      if (args[0] === "merge") {
        return "Already up to date.\n";
      }

      return "";
    });

    expect(calls).toEqual([
      "C:/repo/.worktrees/plan-73:fetch origin",
      "C:/repo/.worktrees/plan-73:merge origin/main"
    ]);
    expect(outcome).toEqual({
      message: "Already up to date.",
      status: "merged"
    });
  });

  it("returns a non-fatal warning when merge fails", () => {
    const outcome = mergeMainIntoWorktree("C:/repo/.worktrees/plan-73", (args) => {
      if (args[0] === "merge") {
        const error = new Error("merge failed") as Error & { stderr: string };
        error.stderr = "CONFLICT (content): Merge conflict in AGENTS.md\nAutomatic merge failed.\n";
        throw error;
      }

      return "";
    });

    expect(outcome).toEqual({
      message: "CONFLICT (content): Merge conflict in AGENTS.md",
      status: "warning"
    });
  });
});

describe("createParallelTaskPlan", () => {
  it("creates a contract-first slice when shared code feeds app code", () => {
    const plan = createParallelTaskPlan(
      {
        baseRef: "main",
        dependsOn: [],
        dryRun: false,
        mergeMain: false,
        owner: "contract-agent",
        scopes: ["packages/shared/src/extraction.ts", "apps/api/src/services/extractor.ts"],
        summary: "Define extraction contract",
        taskId: "extraction-contract",
        validations: []
      },
      "C:/repo"
    );

    expect(plan.branchName).toBe("feature/extraction-contract");
    expect(plan.worktreePath).toBe("C:/repo/.worktrees/extraction-contract");
    expect(plan.localBriefPath).toBe("C:/repo/.worktrees/extraction-contract/.codex-local/parallel-task.md");
    expect(plan.sliceKind).toBe("contract-first");
    expect(plan.validations).toEqual(["npm run typecheck", "npm test"]);
    expect(plan.warnings).toContain(
      "This slice changes shared contracts and app code together. Prefer merging the shared contract first when possible."
    );
  });

  it("adds Prisma and stylelint validation when relevant", () => {
    const plan = createParallelTaskPlan(
      {
        baseRef: "HEAD",
        dependsOn: ["schema-contract"],
        dryRun: true,
        mergeMain: false,
        scopes: ["prisma/schema.prisma", "apps/web/src/app/App.module.css"],
        summary: "Apply schema state to web review UI",
        taskId: "review-ui-threading",
        validations: []
      },
      "C:/repo"
    );

    expect(plan.sliceKind).toBe("contract-first");
    expect(plan.validations).toEqual(["npm run prisma:check", "npm run stylelint", "npm run typecheck", "npm test"]);
    expect(plan.dependsOn).toEqual(["schema-contract"]);
    expect(plan.warnings).toContain(
      "This slice spans backend and frontend boundaries. Split the work unless a single agent owns the typed contract handoff."
    );
  });
});

describe("renderParallelTaskBrief", () => {
  it("renders the agent brief with boundaries and integration steps", () => {
    const plan = createParallelTaskPlan(
      {
        baseRef: "main",
        dependsOn: ["shared-contract"],
        dryRun: false,
        mergeMain: false,
        owner: "web-agent",
        scopes: ["apps/web/src/features/review"],
        summary: "Thread review task data into the web feature",
        taskId: "review-web-threading",
        validations: ["npm run typecheck:web", "npm test"],
        worktreeRoot: ".parallel"
      },
      "C:/repo"
    );

    const brief = renderParallelTaskBrief(plan);

    expect(brief).toContain("# Parallel Task: review-web-threading");
    expect(brief).toContain("Owner: web-agent");
    expect(brief).toContain("Branch: feature/review-web-threading");
    expect(brief).toContain("Allowed Scope");
    expect(brief).toContain("apps/web/src/features/review");
    expect(brief).toContain("Dependencies");
    expect(brief).toContain("shared-contract");
    expect(brief).toContain("Integration Checklist");
  });
});
