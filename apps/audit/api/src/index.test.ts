import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { AuditAnalyticsSnapshotSchema, AuditRunDetailSchema, AuditRunOverviewSchema, AuditWorkItemTimelineSchema } from "@taxes/shared";
import type { AuditEvent, AuditSummary } from "../../../../tools/agent/lib/audit.js";
import { buildApp } from "./app.js";
import type { TestAuditContext } from "./test/database.js";
import { createTestAuditContext } from "./test/database.js";
import { syncAuditEvent, syncAuditSummary } from "./services/audit-store.js";

describe("audit app", () => {
  const contexts: TestAuditContext[] = [];

  afterEach(async () => {
    await Promise.all(contexts.splice(0, contexts.length).map(async (context) => context.cleanup()));
  });

  it("returns audit run overviews and run details from the shared audit database", async () => {
    const context = await createTestAuditContext("audit-app");
    contexts.push(context);

    const runId = "2026-03-12T000000-000-implementation-deadbeef";
    const cwd = "C:\\Users\\csmat\\source\\repos\\Taxes-audit-platform";
    const summary: AuditSummary = {
      actor: "codex",
      artifacts: [],
      completedAt: "2026-03-12T00:00:05.000Z",
      cwd,
      decisions: [],
      durationMs: 5000,
      executions: [],
      failures: [],
      handoffs: [],
      planRunId: "plan-run-1",
      planStepId: "plan-step-1",
      project: "audit",
      runId,
      sessionId: "session-1",
      startedAt: "2026-03-12T00:00:00.000Z",
      stats: {
        byKind: {},
        byStatus: {},
        executionCount: 0,
        failedExecutionCount: 0
      },
      status: "success",
      steps: [],
      task: "seed audit api",
      workflow: "implementation",
      workItemId: "PLAN-7"
    };
    const event: AuditEvent = {
      actor: "codex",
      cwd,
      eventId: "event-1",
      eventType: "workflow-start",
      planRunId: "plan-run-1",
      planStepId: "plan-step-1",
      project: "audit",
      runId,
      sessionId: "session-1",
      status: "running",
      task: "seed audit api",
      timestamp: "2026-03-12T00:00:00.000Z",
      workflow: "implementation",
      workItemId: "PLAN-7"
    };

    await syncAuditEvent(event, {
      databaseUrl: context.databaseUrl
    });
    await syncAuditSummary(summary, {
      databaseUrl: context.databaseUrl
    });

    const app = await buildApp({
      databaseUrl: context.databaseUrl
    });
    const runsResponse = await app.inject({
      method: "GET",
      url: "/api/audit/runs"
    });
    const analyticsResponse = await app.inject({
      method: "GET",
      url: "/api/audit/analytics"
    });
    const detailResponse = await app.inject({
      method: "GET",
      url: `/api/audit/runs/${runId}`
    });
    const timelineResponse = await app.inject({
      method: "GET",
      url: "/api/audit/work-items/PLAN-7/timeline"
    });

    const runsPayload = z.object({ runs: z.array(AuditRunOverviewSchema) }).parse(runsResponse.json());
    const analyticsPayload = z.object({ analytics: AuditAnalyticsSnapshotSchema }).parse(analyticsResponse.json());
    const detailPayload = z.object({ detail: AuditRunDetailSchema }).parse(detailResponse.json());
    const timelinePayload = z.object({ timeline: AuditWorkItemTimelineSchema }).parse(timelineResponse.json());

    expect(runsResponse.statusCode).toBe(200);
    expect(runsPayload.runs[0]?.runId).toBe(runId);
    expect(runsPayload.runs[0]?.status).toBe("success");
    expect(runsPayload.runs[0]?.workflow).toBe("implementation");
    expect(analyticsResponse.statusCode).toBe(200);
    expect(analyticsPayload.analytics.totals.totalRuns).toBe(1);
    expect(detailResponse.statusCode).toBe(200);
    expect(detailPayload.detail.run.runId).toBe(runId);
    expect(detailPayload.detail.events[0]?.eventId).toBe("event-1");
    expect(timelineResponse.statusCode).toBe(200);
    expect(timelinePayload.timeline.workItemId).toBe("PLAN-7");
    expect(timelinePayload.timeline.runs[0]?.runId).toBe(runId);

    await app.close();
  });
});
