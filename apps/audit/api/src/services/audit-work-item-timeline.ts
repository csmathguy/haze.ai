import type { AuditWorkItemTimeline } from "@taxes/shared";
import { AuditWorkItemTimelineSchema } from "@taxes/shared";

import { AUDIT_DATABASE_URL } from "../config.js";
import { getAuditPrismaClient } from "../db/client.js";
import { ensureAuditDatabaseReady } from "../db/migrations.js";
import type { AuditPersistenceOptions } from "./context.js";
import {
  mapArtifactRecord,
  mapDecisionRecord,
  mapEventRecord,
  mapFailureRecord,
  mapHandoffRecord,
  mapRunOverview
} from "./audit-serialization.js";

export async function getAuditWorkItemTimeline(
  workItemId: string,
  options: AuditPersistenceOptions = {}
): Promise<AuditWorkItemTimeline | null> {
  const prisma = await getReadyAuditClient(options.databaseUrl);
  const runs = await listWorkItemRuns(prisma, workItemId);

  if (runs.length === 0) {
    return null;
  }

  const timelineRecords = await listTimelineRecords(prisma, runs.map((run) => run.id), workItemId);

  return AuditWorkItemTimelineSchema.parse({
    artifacts: timelineRecords.artifacts.map(mapArtifactRecord),
    decisions: timelineRecords.decisions.map(mapDecisionRecord),
    events: timelineRecords.events.map(mapEventRecord),
    failures: timelineRecords.failures.map(mapFailureRecord),
    handoffs: timelineRecords.handoffs.map(mapHandoffRecord),
    runs: runs.map(mapRunOverview),
    summary: buildTimelineSummary({
      ...timelineRecords,
      runs
    }),
    workItemId
  });
}

async function getReadyAuditClient(databaseUrl: string | undefined) {
  const resolvedDatabaseUrl = databaseUrl ?? AUDIT_DATABASE_URL;
  await ensureAuditDatabaseReady(resolvedDatabaseUrl);
  return getAuditPrismaClient(resolvedDatabaseUrl);
}

async function listWorkItemRuns(prisma: Awaited<ReturnType<typeof getAuditPrismaClient>>, workItemId: string) {
  return prisma.auditRun.findMany({
    orderBy: [{ latestEventAt: "desc" }, { startedAt: "desc" }],
    where: {
      workItemId
    }
  });
}

async function listTimelineRecords(
  prisma: Awaited<ReturnType<typeof getAuditPrismaClient>>,
  runIds: string[],
  workItemId: string
) {
  const [events, decisions, artifacts, failures, handoffs] = await Promise.all([
    prisma.auditEventRecord.findMany({
      orderBy: [{ timestamp: "asc" }, { id: "asc" }],
      where: {
        runId: {
          in: runIds
        }
      }
    }),
    prisma.auditDecisionRecord.findMany({
      orderBy: [{ timestamp: "asc" }, { id: "asc" }],
      where: {
        runId: {
          in: runIds
        }
      }
    }),
    prisma.auditArtifactRecord.findMany({
      orderBy: [{ timestamp: "asc" }, { id: "asc" }],
      where: {
        runId: {
          in: runIds
        }
      }
    }),
    prisma.auditFailureRecord.findMany({
      orderBy: [{ timestamp: "asc" }, { id: "asc" }],
      where: {
        runId: {
          in: runIds
        }
      }
    }),
    prisma.auditHandoffRecord.findMany({
      orderBy: [{ timestamp: "asc" }, { id: "asc" }],
      where: {
        OR: [{ runId: { in: runIds } }, { workItemId }]
      }
    })
  ]);

  return {
    artifacts,
    decisions,
    events,
    failures,
    handoffs
  };
}

function buildTimelineSummary(input: {
  artifacts: Awaited<ReturnType<typeof listTimelineRecords>>["artifacts"];
  decisions: Awaited<ReturnType<typeof listTimelineRecords>>["decisions"];
  events: Awaited<ReturnType<typeof listTimelineRecords>>["events"];
  failures: Awaited<ReturnType<typeof listTimelineRecords>>["failures"];
  handoffs: Awaited<ReturnType<typeof listTimelineRecords>>["handoffs"];
  runs: Awaited<ReturnType<typeof listWorkItemRuns>>;
}) {
  const latestEventAt = findLatestEventAt(input.runs, input.events);

  return {
    activeAgents: collectActiveAgents(input.runs, input.handoffs),
    artifactCount: input.artifacts.length,
    decisionCount: input.decisions.length,
    executionCount: input.runs.reduce((count, run) => count + run.executionCount, 0),
    failureCount: input.failures.length,
    handoffCount: input.handoffs.length,
    ...(latestEventAt === undefined ? {} : { latestEventAt }),
    runCount: input.runs.length,
    workflows: collectWorkflows(input.runs)
  };
}

function findLatestEventAt(
  runs: Awaited<ReturnType<typeof listWorkItemRuns>>,
  events: Awaited<ReturnType<typeof listTimelineRecords>>["events"]
) {
  return [runs[0]?.latestEventAt?.toISOString(), events.at(-1)?.timestamp.toISOString()].find(
    (value): value is string => value !== undefined
  );
}

function collectActiveAgents(
  runs: Awaited<ReturnType<typeof listWorkItemRuns>>,
  handoffs: Awaited<ReturnType<typeof listTimelineRecords>>["handoffs"]
) {
  return Array.from(
    new Set([
      ...runs.map((run) => run.agentName).filter((value): value is string => value !== null),
      ...handoffs.map((handoff) => handoff.sourceAgent),
      ...handoffs.map((handoff) => handoff.targetAgent)
    ])
  ).sort((left, right) => left.localeCompare(right));
}

function collectWorkflows(runs: Awaited<ReturnType<typeof listWorkItemRuns>>) {
  return Array.from(new Set(runs.map((run) => run.workflow))).sort((left, right) => left.localeCompare(right));
}
