import { describe, expect, it } from "vitest";

import { buildLintOnlyCommands, shouldRunLintOnly } from "./lint-only.js";

const npmCommand = {
  command: "npm",
  prefixArgs: []
};

describe("buildLintOnlyCommands", () => {
  it("runs eslint before scoped typechecks for changed code files", () => {
    const commands = buildLintOnlyCommands(
      ["tools/agent/parallel-worktree.ts", "apps/code-review/api/src/services/workspace.test.ts"],
      npmCommand
    );

    expect(commands.map((command) => command.step)).toEqual(["lint-changed", "typecheck-quality", "typecheck-api"]);
    expect(commands[0]?.args).toEqual([
      "exec",
      "eslint",
      "--",
      "--max-warnings=0",
      "tools/agent/parallel-worktree.ts",
      "apps/code-review/api/src/services/workspace.test.ts"
    ]);
  });

  it("runs prisma generation before typechecks when schema inputs changed", () => {
    const commands = buildLintOnlyCommands(["prisma/schema.prisma"], npmCommand);

    expect(commands.map((command) => command.step)).toEqual(["prisma-check", "typecheck-api", "typecheck-quality"]);
  });

  it("returns no commands for files outside lint and typecheck scopes", () => {
    expect(buildLintOnlyCommands(["docs/architecture.md"], npmCommand)).toEqual([]);
  });
});

describe("shouldRunLintOnly", () => {
  it("returns true when changed files require lint or typecheck work", () => {
    expect(shouldRunLintOnly(["apps/code-review/web/src/app/App.tsx"])).toBe(true);
  });

  it("returns false for documentation-only changes", () => {
    expect(shouldRunLintOnly(["docs/architecture.md"])).toBe(false);
  });
});
