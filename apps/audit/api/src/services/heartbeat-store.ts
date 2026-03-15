import { randomUUID } from "node:crypto";

import { AUDIT_DATABASE_URL } from "../config.js";
import { getAuditPrismaClient } from "../db/client.js";
import { ensureAuditDatabaseReady } from "../db/migrations.js";
import type { AuditPersistenceOptions } from "./context.js";

export interface HeartbeatEventInput {
  message: string;
  runId: string;
  workItemId?: string;
}

export interface HeartbeatEventRow {
  createdAt: Date;
  id: string;
  message: string;
  runId: string;
  workItemId: string | null;
}

export async function writeHeartbeatEvent(
  input: HeartbeatEventInput,
  options: AuditPersistenceOptions = {}
): Promise<void> {
  const prisma = await getReadyAuditClient(options.databaseUrl);

  await prisma.heartbeatEvent.create({
    data: {
      id: randomUUID(),
      message: input.message,
      runId: input.runId,
      ...(input.workItemId === undefined ? {} : { workItemId: input.workItemId })
    }
  });
}

export async function listActiveHeartbeatEvents(
  options: AuditPersistenceOptions = {}
): Promise<HeartbeatEventRow[]> {
  const prisma = await getReadyAuditClient(options.databaseUrl);

  const activeRuns = await prisma.auditRun.findMany({
    select: { id: true },
    where: { status: "running" }
  });

  if (activeRuns.length === 0) {
    return [];
  }

  const activeRunIds = activeRuns.map((run) => run.id);

  return prisma.heartbeatEvent.findMany({
    orderBy: { createdAt: "asc" },
    where: {
      runId: {
        in: activeRunIds
      }
    }
  });
}

async function getReadyAuditClient(databaseUrl: string | undefined) {
  const resolvedDatabaseUrl = databaseUrl ?? AUDIT_DATABASE_URL;
  await ensureAuditDatabaseReady(resolvedDatabaseUrl);
  return getAuditPrismaClient(resolvedDatabaseUrl);
}
