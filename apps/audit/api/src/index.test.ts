import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { AuditRunDetailSchema, AuditRunOverviewSchema } from "@taxes/shared";
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
      completedAt: "2026-03-12T00:00:05.000Z",
      cwd,
      durationMs: 5000,
      executions: [],
      runId,
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
      workflow: "implementation"
    };
    const event: AuditEvent = {
      actor: "codex",
      cwd,
      eventId: "event-1",
      eventType: "workflow-start",
      runId,
      status: "running",
      task: "seed audit api",
      timestamp: "2026-03-12T00:00:00.000Z",
      workflow: "implementation"
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
    const detailResponse = await app.inject({
      method: "GET",
      url: `/api/audit/runs/${runId}`
    });

    const runsPayload = z.object({ runs: z.array(AuditRunOverviewSchema) }).parse(runsResponse.json());
    const detailPayload = z.object({ detail: AuditRunDetailSchema }).parse(detailResponse.json());

    expect(runsResponse.statusCode).toBe(200);
    expect(runsPayload.runs[0]?.runId).toBe(runId);
    expect(runsPayload.runs[0]?.status).toBe("success");
    expect(runsPayload.runs[0]?.workflow).toBe("implementation");
    expect(detailResponse.statusCode).toBe(200);
    expect(detailPayload.detail.run.runId).toBe(runId);
    expect(detailPayload.detail.events[0]?.eventId).toBe("event-1");

    await app.close();
  });
});
