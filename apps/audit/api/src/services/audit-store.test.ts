import { afterEach, describe, expect, it } from "vitest";

import type { AuditEventRecord, AuditRunDetail, AuditRunOverview } from "@taxes/shared";
import { AuditEventRecordSchema, AuditRunDetailSchema, AuditRunOverviewSchema } from "@taxes/shared";
import type { AuditEvent, AuditSummary } from "../../../../../tools/agent/lib/audit.js";
import type { TestAuditContext } from "../test/database.js";
import { createTestAuditContext } from "../test/database.js";
import {
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
    const recentEvents = AuditEventRecordSchema.array().parse(
      await listAuditEventsSince("2026-03-12T00:00:00.500Z", {
        databaseUrl: context.databaseUrl,
        limit: 10
      })
    );

    assertPersistedRun(runs, detail, recentEvents, seeded);
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
    }
  ];
  const summary: AuditSummary = {
    actor: "codex",
    completedAt: endedAt,
    cwd,
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
  runs: AuditRunOverview[],
  detail: AuditRunDetail,
  recentEvents: AuditEventRecord[],
  seeded: Awaited<ReturnType<typeof seedAuditRun>>
): void {
  assertRunOverview(runs, seeded);
  assertRunDetail(detail, seeded);
  expect(recentEvents.map((event) => event.eventId)).toEqual(["event-2", "event-3"]);
}

function assertRunOverview(runs: AuditRunOverview[], seeded: Awaited<ReturnType<typeof seedAuditRun>>): void {
  expect(runs[0]?.completedAt).toBe(seeded.endedAt);
  expect(runs[0]?.executionCount).toBe(1);
  expect(runs[0]?.failedExecutionCount).toBe(0);
  expect(runs[0]?.runId).toBe(seeded.runId);
  expect(runs[0]?.status).toBe("success");
  expect(runs[0]?.task).toBe("monitor audit work");
  expect(runs[0]?.workflow).toBe("implementation");
  expect(runs[0]?.worktreePath).toBeTruthy();
  expect(runs[0]?.repoPath).toBeTruthy();
}

function assertRunDetail(detail: AuditRunDetail, seeded: Awaited<ReturnType<typeof seedAuditRun>>): void {
  expect(detail.events.map((event) => event.eventId)).toContain("event-1");
  expect(detail.events.find((event) => event.eventId === "event-3")?.executionId).toBe("exec-1");
  expect(detail.executions[0]?.executionId).toBe("exec-1");
  expect(detail.executions[0]?.kind).toBe("validation");
  expect(detail.executions[0]?.status).toBe("success");
  expect(detail.run.runId).toBe(seeded.runId);
  expect(detail.run.status).toBe("success");
}
