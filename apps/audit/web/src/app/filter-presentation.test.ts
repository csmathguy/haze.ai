import { describe, expect, it } from "vitest";

import { buildActiveFilterSummaries, clearAuditRunFilters, countActiveFilters } from "./filter-presentation.js";

describe("filter presentation", () => {
  it("counts only non-empty filters", () => {
    expect(
      countActiveFilters({
        agentName: "codex",
        project: "",
        status: "running",
        workflow: "",
        workItemId: "PLAN-59",
        worktreePath: ""
      })
    ).toBe(3);
  });

  it("builds labeled summaries for the active filters", () => {
    expect(
      buildActiveFilterSummaries({
        agentName: "",
        project: "audit",
        status: "",
        workflow: "implementation",
        workItemId: "PLAN-59",
        worktreePath: ""
      })
    ).toEqual([
      {
        key: "project",
        label: "Project",
        value: "audit"
      },
      {
        key: "workflow",
        label: "Workflow",
        value: "implementation"
      },
      {
        key: "workItemId",
        label: "Work item",
        value: "PLAN-59"
      }
    ]);
  });

  it("returns a cleared filter state", () => {
    expect(clearAuditRunFilters()).toEqual({
      agentName: "",
      project: "",
      status: "",
      workflow: "",
      workItemId: "",
      worktreePath: ""
    });
  });
});
