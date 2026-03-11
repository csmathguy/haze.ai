import { describe, expect, it } from "vitest";

import { buildChangedFilePlan } from "./changed-files.js";

describe("buildChangedFilePlan", () => {
  it("widens shared changes to all dependent typecheck scopes", () => {
    const plan = buildChangedFilePlan(["packages/shared/src/index.ts"]);

    expect(plan.typecheckScopes).toEqual(["api", "shared", "web"]);
    expect(plan.testCommand).toEqual({
      kind: "related",
      targets: ["packages/shared/src/index.ts"]
    });
  });

  it("keeps docs-only changes out of code validation", () => {
    const plan = buildChangedFilePlan(["docs/architecture.md"]);

    expect(plan.lintTargets).toEqual([]);
    expect(plan.stylelintTargets).toEqual([]);
    expect(plan.testCommand).toEqual({
      kind: "none",
      targets: []
    });
    expect(plan.typecheckScopes).toEqual([]);
  });

  it("skips repo bootstrap JavaScript files in the typed lint target list", () => {
    const plan = buildChangedFilePlan(["eslint.config.mjs", "tools/runtime/run-npm.cjs"]);

    expect(plan.lintTargets).toEqual([]);
    expect(plan.stylelintTargets).toEqual([]);
    expect(plan.testCommand).toEqual({
      kind: "full",
      targets: []
    });
  });

  it("uses the architecture-only test command for architecture rule changes", () => {
    const plan = buildChangedFilePlan(["tools/quality/architecture/architecture.spec.ts"]);

    expect(plan.testCommand).toEqual({
      kind: "arch",
      targets: []
    });
    expect(plan.typecheckScopes).toEqual(["quality"]);
  });

  it("runs Prisma validation and full tests for schema changes", () => {
    const plan = buildChangedFilePlan(["prisma/schema.prisma"]);

    expect(plan.prismaCheck).toBe(true);
    expect(plan.stylelintTargets).toEqual([]);
    expect(plan.testCommand).toEqual({
      kind: "full",
      targets: []
    });
    expect(plan.typecheckScopes).toEqual(["api", "quality"]);
  });

  it("falls back to the full suite for test and tooling changes", () => {
    const testPlan = buildChangedFilePlan(["apps/api/src/index.test.ts"]);
    const toolingPlan = buildChangedFilePlan(["tools/agent/workflow-log.ts"]);

    expect(testPlan.testCommand).toEqual({
      kind: "full",
      targets: []
    });
    expect(toolingPlan.testCommand).toEqual({
      kind: "full",
      targets: []
    });
  });

  it("routes CSS changes into stylelint", () => {
    const plan = buildChangedFilePlan(["apps/web/src/app/App.module.css"]);

    expect(plan.stylelintTargets).toEqual(["apps/web/src/app/App.module.css"]);
    expect(plan.testCommand).toEqual({
      kind: "none",
      targets: []
    });
  });
});
