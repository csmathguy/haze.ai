import { afterEach, describe, expect, it } from "vitest";

import type { TestAuditContext } from "../../../apps/audit/api/src/test/database.js";
import { createTestAuditContext } from "../../../apps/audit/api/src/test/database.js";
import { getAuditRunDetail } from "../../../apps/audit/api/src/services/audit-store.js";
import {
  appendAuditEvent,
  appendExecutionSummary,
  createRunId,
  createEvent,
  createWorkflowSummary,
  ensureAuditPaths,
  getAuditDateSegment,
  slugify,
  writeSummary
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

describe("database sync", () => {
  const contexts: TestAuditContext[] = [];

  afterEach(async () => {
    delete process.env.AUDIT_DATABASE_URL;
    await Promise.all(contexts.splice(0, contexts.length).map(async (context) => context.cleanup()));
  });

  it("dual-writes file audit events and summaries into the shared audit database", async () => {
    const context = await createTestAuditContext("tool-audit");
    contexts.push(context);
    process.env.AUDIT_DATABASE_URL = context.databaseUrl;

    const runId = "2026-03-12T010000-000-implementation-facefeed";
    const paths = await ensureAuditPaths(runId);
    const summary = createWorkflowSummary(runId, "implementation", "sync db");
    const event = createEvent(runId, "implementation", "workflow-start", {
      status: "running",
      task: "sync db"
    });

    await appendAuditEvent(paths, event);
    await writeSummary(paths, summary);

    const detail = await getAuditRunDetail(runId, {
      databaseUrl: context.databaseUrl
    });

    expect(detail).not.toBeNull();
    expect(detail?.events).toEqual([
      expect.objectContaining({
        eventId: event.eventId,
        eventType: "workflow-start"
      })
    ]);
    expect(detail?.run).toEqual(
      expect.objectContaining({
        runId,
        status: "running",
        workflow: "implementation"
      })
    );
  });
});
