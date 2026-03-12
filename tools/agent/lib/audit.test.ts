import { describe, expect, it } from "vitest";

import {
  appendExecutionSummary,
  createRunId,
  createWorkflowSummary,
  getAuditDateSegment,
  slugify
} from "./audit.js";

describe("slugify", () => {
  it("normalizes workflow labels into stable path segments", () => {
    expect(slugify("Implementation Workflow")).toBe("implementation-workflow");
  });
});

describe("createRunId", () => {
  it("includes the workflow slug in the run id", () => {
    const runId = createRunId("Quality Gates", new Date(2026, 2, 10, 12, 0, 0, 0));

    expect(runId).toContain("quality-gates");
    expect(runId.startsWith("2026-03-10T120000-000")).toBe(true);
  });
});

describe("getAuditDateSegment", () => {
  it("extracts the date prefix from the run id", () => {
    expect(getAuditDateSegment("2026-03-11T120000-000Z-quality-gates-deadbeef")).toBe("2026-03-11");
  });
});

describe("appendExecutionSummary", () => {
  it("tracks execution stats and command step summaries", () => {
    const summary = createWorkflowSummary("run-123", "implementation");

    appendExecutionSummary(summary, {
      command: ["npm", "run", "test"],
      durationMs: 42,
      executionId: "exec-123",
      exitCode: 0,
      kind: "command",
      logFile: "logs/test.log",
      name: "test",
      startedAt: "2026-03-11T10:00:00.000Z",
      status: "success",
      step: "test"
    });

    expect(summary.executions).toHaveLength(1);
    expect(summary.steps).toHaveLength(1);
    expect(summary.stats.executionCount).toBe(1);
    expect(summary.stats.failedExecutionCount).toBe(0);
    expect(summary.stats.byKind.command).toBe(1);
    expect(summary.stats.byStatus.success).toBe(1);
  });

  it("counts failed non-command executions without adding legacy steps", () => {
    const summary = createWorkflowSummary("run-123", "implementation");

    appendExecutionSummary(summary, {
      durationMs: 17,
      errorMessage: "tool failed",
      executionId: "exec-456",
      kind: "tool",
      name: "semantic-kernel-adapter",
      startedAt: "2026-03-11T10:00:00.000Z",
      status: "failed"
    });

    expect(summary.executions).toHaveLength(1);
    expect(summary.steps).toHaveLength(0);
    expect(summary.stats.executionCount).toBe(1);
    expect(summary.stats.failedExecutionCount).toBe(1);
    expect(summary.stats.byKind.tool).toBe(1);
    expect(summary.stats.byStatus.failed).toBe(1);
  });
});
