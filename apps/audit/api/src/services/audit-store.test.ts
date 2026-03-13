import { afterEach, describe, expect, it } from "vitest";

import type { AuditEventRecord, AuditRunDetail, AuditRunOverview } from "@taxes/shared";
import { AuditEventRecordSchema, AuditRunDetailSchema, AuditRunOverviewSchema } from "@taxes/shared";
import type { AuditEvent, AuditSummary } from "../../../../../tools/agent/lib/audit.js";
import type { TestAuditContext } from "../test/database.js";
import { createTestAuditContext } from "../test/database.js";
import {
  getAuditAnalytics,
  getAuditRunDetail,
  listAuditEventsSince,
  listAuditRuns,
  syncAuditEvent,
  syncAuditSummary
} from "./audit-store.js";

describe("audit store", () => {
  const contexts: TestAuditContext[] = [];

  afterEach(async () => {
    await Promise.all(contexts.splice(0, contexts.length).map(async (context) => context.cleanup()));
  });

  it("persists run summaries, executions, and event history in the shared audit database", async () => {
    const context = await createTestAuditContext("audit-store");
    contexts.push(context);
    const seeded = await seedAuditRun(context.databaseUrl);

    const runs = AuditRunOverviewSchema.array().parse(
      await listAuditRuns(
        {
          limit: 10
        },
        {
          databaseUrl: context.databaseUrl
        }
      )
    );
    const detailValue = await getAuditRunDetail(seeded.runId, {
      databaseUrl: context.databaseUrl
    });

    if (detailValue === null) {
      throw new Error("Expected an audit run detail record.");
    }

    const detail = AuditRunDetailSchema.parse(detailValue);
    const analytics = await getAuditAnalytics(
      {
        limit: 10
      },
      {
        databaseUrl: context.databaseUrl
      }
    );
    const recentEvents = AuditEventRecordSchema.array().parse(
      await listAuditEventsSince("2026-03-12T00:00:00.500Z", {
        databaseUrl: context.databaseUrl,
        limit: 10
      })
    );

    assertPersistedRun(
      {
        analytics,
        detail,
        recentEvents,
        runs
      },
      seeded
    );
  });
});

async function seedAuditRun(databaseUrl: string) {
  const startedAt = "2026-03-12T00:00:00.000Z";
  const endedAt = "2026-03-12T00:00:10.000Z";
  const runId = "2026-03-12T000000-000-implementation-deadbeef";
  const cwd = "C:\\Users\\csmat\\source\\repos\\Taxes-audit-platform";
  const eventBase = {
    actor: "codex",
    cwd,
    runId,
    workflow: "implementation"
  } as const;
  const events: AuditEvent[] = [
    {
      ...eventBase,
      eventId: "event-1",
      eventType: "workflow-start",
      status: "running",
      task: "monitor audit work",
      timestamp: startedAt
    },
    {
      ...eventBase,
      eventId: "event-2",
      eventType: "execution-start",
      executionId: "exec-1",
      executionKind: "validation",
      executionName: "quality-gates",
      status: "running",
      timestamp: "2026-03-12T00:00:01.000Z"
    },
    {
      ...eventBase,
      durationMs: 2000,
      eventId: "event-3",
      eventType: "execution-end",
      executionId: "exec-1",
      executionKind: "validation",
      executionName: "quality-gates",
      status: "success",
      timestamp: "2026-03-12T00:00:03.000Z"
    },
    {
      ...eventBase,
      eventId: "event-4",
      eventType: "decision-recorded",
      executionId: "exec-1",
      metadata: {
        category: "transport",
        decisionId: "decision-1",
        rationale: "One-way updates are enough for the monitor",
        selectedOption: "sse",
        summary: "Use SSE for audit streaming"
      },
      status: "running",
      timestamp: "2026-03-12T00:00:04.000Z"
    },
    {
      ...eventBase,
      eventId: "event-5",
      eventType: "artifact-recorded",
      executionId: "exec-1",
      metadata: {
        artifactId: "artifact-1",
        artifactType: "report",
        label: "audit roadmap",
        path: "docs/agent-observability.md",
        status: "updated"
      },
      status: "running",
      timestamp: "2026-03-12T00:00:05.000Z"
    },
    {
      ...eventBase,
      eventId: "event-6",
      eventType: "failure-recorded",
      executionId: "exec-1",
      metadata: {
        category: "environment",
        detail: "Audit API was started from the wrong working directory",
        failureId: "failure-1",
        retryable: true,
        severity: "medium",
        status: "open",
        summary: "Migration directory resolution failed"
      },
      status: "running",
      timestamp: "2026-03-12T00:00:06.000Z"
    }
  ];
  const summary: AuditSummary = {
    actor: "codex",
    artifacts: [
      {
        artifactId: "artifact-1",
        artifactType: "report",
        executionId: "exec-1",
        label: "audit roadmap",
        path: "docs/agent-observability.md",
        status: "updated",
        timestamp: "2026-03-12T00:00:05.000Z"
      }
    ],
    completedAt: endedAt,
    cwd,
    decisions: [
      {
        category: "transport",
        decisionId: "decision-1",
        executionId: "exec-1",
        rationale: "One-way updates are enough for the monitor",
        selectedOption: "sse",
        summary: "Use SSE for audit streaming",
        timestamp: "2026-03-12T00:00:04.000Z"
      }
    ],
    durationMs: 10000,
    executions: [
      {
        durationMs: 2000,
        executionId: "exec-1",
        kind: "validation",
        name: "quality-gates",
        startedAt: "2026-03-12T00:00:01.000Z",
        status: "success"
      }
    ],
    runId,
    startedAt,
    stats: {
      byKind: {
        validation: 1
      },
      byStatus: {
        success: 1
      },
      executionCount: 1,
      failedExecutionCount: 0
    },
    status: "success",
    steps: [],
    failures: [
      {
        category: "environment",
        detail: "Audit API was started from the wrong working directory",
        executionId: "exec-1",
        failureId: "failure-1",
        retryable: true,
        severity: "medium",
        status: "open",
        summary: "Migration directory resolution failed",
        timestamp: "2026-03-12T00:00:06.000Z"
      }
    ],
    task: "monitor audit work",
    workflow: "implementation"
  };

  for (const event of events) {
    await syncAuditEvent(event, {
      databaseUrl
    });
  }

  await syncAuditSummary(summary, {
    databaseUrl
  });

  return {
    cwd,
    endedAt,
    runId
  };
}

function assertPersistedRun(
  persisted: {
    analytics: Awaited<ReturnType<typeof getAuditAnalytics>>;
    detail: AuditRunDetail;
    recentEvents: AuditEventRecord[];
    runs: AuditRunOverview[];
  },
  seeded: Awaited<ReturnType<typeof seedAuditRun>>
): void {
  assertRunOverview(persisted.runs, seeded);
  assertRunDetail(persisted.detail, seeded);
  expect(persisted.analytics.totals.decisionCount).toBe(1);
  expect(persisted.analytics.totals.artifactCount).toBe(1);
  expect(persisted.analytics.totals.failureCount).toBe(1);
  expect(persisted.analytics.failureCategories[0]?.key).toBe("environment");
  expect(persisted.recentEvents.map((event) => event.eventId)).toEqual(["event-2", "event-3", "event-4", "event-5", "event-6"]);
}

function assertRunOverview(runs: AuditRunOverview[], seeded: Awaited<ReturnType<typeof seedAuditRun>>): void {
  expect(runs[0]).toEqual(
    expect.objectContaining({
      artifactCount: 1,
      completedAt: seeded.endedAt,
      decisionCount: 1,
      executionCount: 1,
      failedExecutionCount: 0,
      failureCount: 1,
      runId: seeded.runId,
      status: "success",
      task: "monitor audit work",
      workflow: "implementation"
    })
  );
  expect(runs[0]?.worktreePath).toBeTruthy();
  expect(runs[0]?.repoPath).toBeTruthy();
}

function assertRunDetail(detail: AuditRunDetail, seeded: Awaited<ReturnType<typeof seedAuditRun>>): void {
  expect(detail.events.map((event) => event.eventId)).toContain("event-1");
  expect(detail.events.find((event) => event.eventId === "event-3")?.executionId).toBe("exec-1");
  expect(detail.decisions[0]?.decisionId).toBe("decision-1");
  expect(detail.artifacts[0]?.artifactId).toBe("artifact-1");
  expect(detail.executions[0]?.executionId).toBe("exec-1");
  expect(detail.executions[0]?.kind).toBe("validation");
  expect(detail.executions[0]?.status).toBe("success");
  expect(detail.failures[0]?.failureId).toBe("failure-1");
  expect(detail.run.runId).toBe(seeded.runId);
  expect(detail.run.status).toBe("success");
}
