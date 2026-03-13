import type { AuditEventRecord, AuditRunDetail, AuditRunOverview } from "@taxes/shared";
import { AuditRunDetailSchema } from "@taxes/shared";

import { AUDIT_DATABASE_URL } from "../config.js";
import { getAuditPrismaClient } from "../db/client.js";
import { ensureAuditDatabaseReady } from "../db/migrations.js";
import type { AuditSyncEvent, AuditSyncSummary } from "./audit-sync-contract.js";
import type { AuditPersistenceOptions } from "./context.js";
import { mapEventRecord, mapExecutionRecord, mapRunOverview } from "./audit-serialization.js";
import {
  buildEventCreateInput,
  buildEventUpdateInput,
  buildExecutionCreateInput,
  buildExecutionUpdateInput,
  buildRunCreateInputFromEvent,
  buildRunCreateInputFromSummary,
  buildRunUpdateInputFromEvent,
  buildRunUpdateInputFromSummary,
  syncExecutionFromEvent
} from "./audit-write-model.js";

interface ListAuditRunsOptions {
  limit: number;
  status?: string;
  workflow?: string;
  worktreePath?: string;
}

interface ListAuditEventsSinceOptions extends AuditPersistenceOptions {
  afterEventId?: string;
  limit: number;
}

export async function syncAuditEvent(
  event: AuditSyncEvent,
  options: AuditPersistenceOptions = {}
): Promise<void> {
  const prisma = await getReadyAuditClient(options.databaseUrl);

  await prisma.$transaction(async (transaction) => {
    await transaction.auditRun.upsert({
      create: buildRunCreateInputFromEvent(event),
      update: buildRunUpdateInputFromEvent(event),
      where: {
        id: event.runId
      }
    });
    await syncExecutionFromEvent(transaction, event);
    await transaction.auditEventRecord.upsert({
      create: buildEventCreateInput(event),
      update: buildEventUpdateInput(event),
      where: {
        id: event.eventId
      }
    });
  });
}

export async function syncAuditSummary(
  summary: AuditSyncSummary,
  options: AuditPersistenceOptions = {}
): Promise<void> {
  const prisma = await getReadyAuditClient(options.databaseUrl);

  await prisma.$transaction(async (transaction) => {
    await transaction.auditRun.upsert({
      create: buildRunCreateInputFromSummary(summary),
      update: buildRunUpdateInputFromSummary(summary),
      where: {
        id: summary.runId
      }
    });

    for (const execution of summary.executions) {
      await transaction.auditExecutionRecord.upsert({
        create: buildExecutionCreateInput(summary.runId, execution),
        update: buildExecutionUpdateInput(execution),
        where: {
          id: execution.executionId
        }
      });
    }
  });
}

export async function listAuditRuns(
  input: ListAuditRunsOptions,
  options: AuditPersistenceOptions = {}
): Promise<AuditRunOverview[]> {
  const prisma = await getReadyAuditClient(options.databaseUrl);
  const runs = await prisma.auditRun.findMany({
    orderBy: [{ latestEventAt: "desc" }, { startedAt: "desc" }],
    take: input.limit,
      where: {
        ...(input.status === undefined ? {} : { status: input.status }),
        ...(input.workflow === undefined ? {} : { workflow: input.workflow }),
        ...(input.worktreePath === undefined ? {} : { worktreePath: input.worktreePath })
      }
  });

  return runs.map(mapRunOverview);
}

export async function getAuditRunDetail(
  runId: string,
  options: AuditPersistenceOptions = {}
): Promise<AuditRunDetail | null> {
  const prisma = await getReadyAuditClient(options.databaseUrl);
  const run = await prisma.auditRun.findUnique({
    include: {
      events: {
        orderBy: {
          timestamp: "asc"
        }
      },
      executions: {
        orderBy: {
          startedAt: "asc"
        }
      }
    },
    where: {
      id: runId
    }
  });

  if (run === null) {
    return null;
  }

  return AuditRunDetailSchema.parse({
    events: run.events.map(mapEventRecord),
    executions: run.executions.map(mapExecutionRecord),
    run: mapRunOverview(run)
  });
}

export async function listAuditEventsSince(
  since: string,
  options: ListAuditEventsSinceOptions
): Promise<AuditEventRecord[]> {
  const prisma = await getReadyAuditClient(options.databaseUrl);
  const events = await prisma.auditEventRecord.findMany({
    orderBy: [{ timestamp: "asc" }, { id: "asc" }],
    take: options.limit,
    where: {
      OR: [
        {
          timestamp: {
            gt: new Date(since)
          }
        },
        ...(options.afterEventId === undefined
          ? []
          : [
              {
                id: {
                  gt: options.afterEventId
                },
                timestamp: new Date(since)
              }
            ])
      ]
    }
  });

  return events.map(mapEventRecord);
}

async function getReadyAuditClient(databaseUrl: string | undefined) {
  const resolvedDatabaseUrl = databaseUrl ?? AUDIT_DATABASE_URL;
  await ensureAuditDatabaseReady(resolvedDatabaseUrl);
  return getAuditPrismaClient(resolvedDatabaseUrl);
}
