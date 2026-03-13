import { describe, expect, it } from "vitest";

import type { AuditRunOverview } from "@taxes/shared";

import { summarizeRunPresentation } from "./run-presentation.js";

describe("summarizeRunPresentation", () => {
  it("compresses changed-file task text into a readable title and preview chips", () => {
    const run = createRun({
      task: "Validate changed files: apps/plan/web/src/app/App.tsx, apps/plan/web/src/app/components/WorkItemBoard.tsx, docs/testing-and-quality.md, skills/implementation-workflow/SKILL.md"
    });

    expect(summarizeRunPresentation(run)).toEqual({
      previewItems: [
        "apps/plan/web/src/app/App.tsx",
        "apps/plan/web/src/app/components/WorkItemBoard.tsx",
        "docs/testing-and-quality.md"
      ],
      secondaryText: "4 files",
      title: "Validate changed files",
      trailingCount: 1
    });
  });

  it("keeps short tasks intact when they are not dense file lists", () => {
    const run = createRun({
      task: "Merge origin/main and resolve AGENTS.md conflict"
    });

    expect(summarizeRunPresentation(run)).toEqual({
      previewItems: [],
      title: "Merge origin/main and resolve AGENTS.md conflict"
    });
  });
});

function createRun(overrides: Partial<AuditRunOverview>): AuditRunOverview {
  return {
    actor: "codex",
    artifactCount: 0,
    decisionCount: 0,
    executionCount: 0,
    failedExecutionCount: 0,
    failureCount: 0,
    handoffCount: 0,
    runId: "2026-03-13T000000-000-implementation-deadbeef",
    startedAt: "2026-03-13T00:00:00.000Z",
    stats: {
      byKind: {},
      byStatus: {},
      executionCount: 0,
      failedExecutionCount: 0
    },
    status: "success",
    workflow: "implementation",
    worktreePath: "C:\\Users\\csmat\\source\\repos\\Taxes-audit-ux",
    ...overrides
  };
}
