import type { AuditAnalyticsSnapshot, AuditEventRecord, AuditRunDetail, AuditRunOverview } from "@taxes/shared";
import { AuditAnalyticsSnapshotSchema, AuditRunDetailSchema } from "@taxes/shared";

import { AUDIT_DATABASE_URL } from "../config.js";
import { getAuditPrismaClient } from "../db/client.js";
import { ensureAuditDatabaseReady } from "../db/migrations.js";
import type { AuditSyncEvent, AuditSyncSummary } from "./audit-sync-contract.js";
import type { AuditPersistenceOptions } from "./context.js";
import {
  mapAnalyticsBreakdownEntry,
  mapArtifactRecord,
  mapDecisionRecord,
  mapEventRecord,
  mapExecutionRecord,
  mapFailureRecord,
  mapHandoffRecord,
  mapRunOverview
} from "./audit-serialization.js";
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
import {
  buildArtifactCreateInput,
  buildArtifactUpdateInput,
  buildDecisionCreateInput,
  buildDecisionUpdateInput,
  buildFailureCreateInput,
  buildFailureUpdateInput,
  buildHandoffCreateInput,
  buildHandoffUpdateInput,
  syncTypedRecordFromEvent
} from "./audit-typed-record-model.js";

interface ListAuditRunsOptions {
  agentName?: string;
  limit: number;
  project?: string;
  status?: string;
  workflow?: string;
  workItemId?: string;
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
    await syncTypedRecordFromEvent(transaction, event);
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

    for (const decision of summary.decisions) {
      await transaction.auditDecisionRecord.upsert({
        create: buildDecisionCreateInput(summary.runId, decision),
        update: buildDecisionUpdateInput(decision),
        where: {
          id: decision.decisionId
        }
      });
    }

    for (const artifact of summary.artifacts) {
      await transaction.auditArtifactRecord.upsert({
        create: buildArtifactCreateInput(summary.runId, artifact),
        update: buildArtifactUpdateInput(artifact),
        where: {
          id: artifact.artifactId
        }
      });
    }

    for (const failure of summary.failures) {
      await transaction.auditFailureRecord.upsert({
        create: buildFailureCreateInput(summary.runId, failure),
        update: buildFailureUpdateInput(failure),
        where: {
          id: failure.failureId
        }
      });
    }

    for (const handoff of summary.handoffs) {
      await transaction.auditHandoffRecord.upsert({
        create: buildHandoffCreateInput(summary.runId, handoff),
        update: buildHandoffUpdateInput(handoff),
        where: {
          id: handoff.handoffId
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
    where: buildRunWhereInput(input)
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
      artifacts: {
        orderBy: {
          timestamp: "asc"
        }
      },
      decisions: {
        orderBy: {
          timestamp: "asc"
        }
      },
      events: {
        orderBy: {
          timestamp: "asc"
        }
      },
      executions: {
        orderBy: {
          startedAt: "asc"
        }
      },
      failures: {
        orderBy: {
          timestamp: "asc"
        }
      },
      handoffs: {
        orderBy: {
          timestamp: "asc"
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
    artifacts: run.artifacts.map(mapArtifactRecord),
    decisions: run.decisions.map(mapDecisionRecord),
    events: run.events.map(mapEventRecord),
    executions: run.executions.map(mapExecutionRecord),
    failures: run.failures.map(mapFailureRecord),
    handoffs: run.handoffs.map(mapHandoffRecord),
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

export async function getAuditAnalytics(
  input: ListAuditRunsOptions,
  options: AuditPersistenceOptions = {}
): Promise<AuditAnalyticsSnapshot> {
  const prisma = await getReadyAuditClient(options.databaseUrl);
  const where = buildRunWhereInput(input);
  const runs = await prisma.auditRun.findMany({
    select: {
      agentName: true,
      artifactCount: true,
      decisionCount: true,
      executionCount: true,
      failureCount: true,
      handoffCount: true,
      id: true,
      project: true,
      status: true,
      workflow: true
      ,
      workItemId: true
    },
    where
  });
  const runIds = runs.map((run) => run.id);
  const failureRows =
    runIds.length === 0
      ? []
      : await prisma.auditFailureRecord.groupBy({
          _count: {
            category: true
          },
          by: ["category"],
          where: {
            runId: {
              in: runIds
            }
          }
        });
  const handoffRows =
    runIds.length === 0
      ? []
      : await prisma.auditHandoffRecord.groupBy({
          _count: {
            status: true
          },
          by: ["status"],
          where: {
            runId: {
              in: runIds
            }
          }
        });

  return AuditAnalyticsSnapshotSchema.parse({
    byAgent: summarizeBreakdown(runs.map((run) => run.agentName ?? "unassigned")),
    byProject: summarizeBreakdown(runs.map((run) => run.project ?? "unassigned")),
    byWorkItem: summarizeBreakdown(runs.map((run) => run.workItemId ?? "unassigned")),
    byWorkflow: summarizeBreakdown(runs.map((run) => run.workflow)),
    failureCategories: failureRows
      .map((row) => mapAnalyticsBreakdownEntry(row.category, row._count.category))
      .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key)),
    handoffStatuses: handoffRows
      .map((row) => mapAnalyticsBreakdownEntry(row.status, row._count.status))
      .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key)),
    totals: {
      artifactCount: runs.reduce((sum, run) => sum + run.artifactCount, 0),
      decisionCount: runs.reduce((sum, run) => sum + run.decisionCount, 0),
      executionCount: runs.reduce((sum, run) => sum + run.executionCount, 0),
      failureCount: runs.reduce((sum, run) => sum + run.failureCount, 0),
      handoffCount: runs.reduce((sum, run) => sum + run.handoffCount, 0),
      failedRuns: runs.filter((run) => run.status === "failed").length,
      runningRuns: runs.filter((run) => run.status === "running").length,
      totalRuns: runs.length
    }
  });
}

async function getReadyAuditClient(databaseUrl: string | undefined) {
  const resolvedDatabaseUrl = databaseUrl ?? AUDIT_DATABASE_URL;
  await ensureAuditDatabaseReady(resolvedDatabaseUrl);
  return getAuditPrismaClient(resolvedDatabaseUrl);
}

function buildRunWhereInput(input: ListAuditRunsOptions) {
  return {
    ...(input.agentName === undefined ? {} : { agentName: input.agentName }),
    ...(input.project === undefined ? {} : { project: input.project }),
    ...(input.status === undefined ? {} : { status: input.status }),
    ...(input.workflow === undefined ? {} : { workflow: input.workflow }),
    ...(input.workItemId === undefined ? {} : { workItemId: input.workItemId }),
    ...(input.worktreePath === undefined ? {} : { worktreePath: input.worktreePath })
  };
}

function summarizeBreakdown(values: string[]) {
  return Array.from(values.reduce((counts, value) => counts.set(value, (counts.get(value) ?? 0) + 1), new Map<string, number>()).entries())
    .map(([key, count]) => mapAnalyticsBreakdownEntry(key, count))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}
