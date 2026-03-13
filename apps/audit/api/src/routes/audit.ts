import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { AUDIT_STREAM_POLL_INTERVAL_MS } from "../config.js";
import type { AuditPersistenceOptions } from "../services/context.js";
import { getAuditAnalytics, getAuditRunDetail, listAuditEventsSince, listAuditRuns } from "../services/audit-store.js";

const ListRunsQuerySchema = z.object({
  agentName: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  project: z.string().optional(),
  status: z.string().optional(),
  workflow: z.string().optional(),
  workItemId: z.string().optional(),
  worktreePath: z.string().optional()
});
const ListEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
  since: z.iso.datetime().optional()
});

export function registerAuditRoutes(app: FastifyInstance, options: AuditPersistenceOptions = {}): void {
  app.get("/api/audit/runs", async (request) => {
    const query = parseListRunsQuery(request.query);
    return {
      runs: await listAuditRuns(buildRunListInput(query, query.limit ?? 50), options)
    };
  });

  app.get("/api/audit/analytics", async (request) => {
    const query = parseListRunsQuery(request.query);

    return {
      analytics: await getAuditAnalytics(buildRunListInput(query, query.limit ?? 200), options)
    };
  });

  app.get("/api/audit/runs/:runId", async (request, reply) => {
    const params = z.object({ runId: z.string() }).parse(request.params);
    const detail = await getAuditRunDetail(params.runId, options);

    if (detail === null) {
      reply.code(404);
      return {
        error: "Audit run not found."
      };
    }

    return {
      detail
    };
  });

  app.get("/api/audit/events", async (request) => {
    const query = ListEventsQuerySchema.parse(request.query);

    return {
      events: await listAuditEventsSince(query.since ?? new Date(0).toISOString(), {
        limit: query.limit ?? 100,
        ...(options.databaseUrl === undefined ? {} : { databaseUrl: options.databaseUrl })
      })
    };
  });

  app.get("/api/audit/stream", async (request, reply) => {
    const query = ListEventsQuerySchema.parse(request.query);
    const stream = reply.raw;
    let latestEventId: string | undefined;
    let latestTimestamp = query.since ?? new Date().toISOString();
    reply.header("Cache-Control", "no-cache");
    reply.header("Connection", "keep-alive");
    reply.header("Content-Type", "text/event-stream");
    reply.hijack();
    stream.flushHeaders();
    stream.write(`event: ready\ndata: ${JSON.stringify({ since: latestTimestamp })}\n\n`);

    for (;;) {
      if (request.raw.destroyed) {
        break;
      }

      const events = await listAuditEventsSince(
        latestTimestamp,
        buildStreamQueryOptions(query.limit ?? 100, latestEventId, options.databaseUrl)
      );

      for (const event of events) {
        stream.write(`event: audit-event\ndata: ${JSON.stringify(event)}\n\n`);
        latestEventId = event.eventId;
        latestTimestamp = event.timestamp;
      }

      await wait(AUDIT_STREAM_POLL_INTERVAL_MS);
    }
  });
}

function buildRunListInput(
  query: z.infer<typeof ListRunsQuerySchema>,
  limit: number
) {
  return {
    ...(query.agentName === undefined ? {} : { agentName: query.agentName }),
    limit,
    ...(query.project === undefined ? {} : { project: query.project }),
    ...(query.status === undefined ? {} : { status: query.status }),
    ...(query.workflow === undefined ? {} : { workflow: query.workflow }),
    ...(query.workItemId === undefined ? {} : { workItemId: query.workItemId }),
    ...(query.worktreePath === undefined ? {} : { worktreePath: query.worktreePath })
  };
}

function parseListRunsQuery(query: unknown) {
  return ListRunsQuerySchema.parse(query);
}

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function buildStreamQueryOptions(limit: number, afterEventId: string | undefined, databaseUrl: string | undefined) {
  return {
    limit,
    ...(afterEventId === undefined ? {} : { afterEventId }),
    ...(databaseUrl === undefined ? {} : { databaseUrl })
  };
}
